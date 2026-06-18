// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./AegisTokenGate.sol";
import "./interfaces/IVenusBNB.sol";
import "./interfaces/IPancakeRouter.sol";

/**
 * @title AegisVault
 * @author Aegis Protocol
 * @notice Non-custodial vault that allows users to deposit BNB/tokens and
 *         authorize AI agents to execute protective actions on their behalf.
 *         Users retain full control — agents can only protect, never steal.
 * @dev Implements deposit/withdraw, agent authorization, position tracking,
 *      and emergency withdrawal mechanisms.
 */
contract AegisVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ═══════════════════════════════════════════════════════════════
    //                      CUSTOM ERRORS
    // ═══════════════════════════════════════════════════════════════

    error InvalidRegistry();
    error FeeTooHigh();
    error BelowMinDeposit();
    error InvalidToken();
    error ZeroAmount();
    error DepositsPaused();
    error NoActivePosition();
    error InsufficientBalance();
    error InsufficientTokenBalance();
    error NoAgentAuthorized();
    error NotAuthorizedOperator();
    error SlippageTooHigh();
    error StopLossTooHigh();
    error AutoWithdrawNotAllowed();
    error ExceedsMaxActionValue();
    error PositionNotActive();
    error TransferFailed();
    error InvalidOperator();
    error ActionDoesNotExist();
    error InvalidTokenGate();
    error YieldArrayMismatch();
    error NoYieldToClaim();
    error PerformanceFeeTooHigh();
    error YieldValueMismatch();
    error UserNotActive();
    error VenusSupplyFailed();
    error VenusRedeemFailed();
    error VenusNotEnabled();
    error InsufficientVenusBalance();
    error StopLossSwapFailed();
    error AutoSwapNotAllowed();
    error OperatorPending();
    error OperatorNotPending();
    error TimelockNotExpired();
    error StopLossCooldown();
    error VenusSlippageExceeded();
    error MinStablecoinTooLow();

    // ═══════════════════════════════════════════════════════════════
    //                        STRUCTS
    // ═══════════════════════════════════════════════════════════════

    /// @notice User position in the vault
    struct Position {
        uint256 bnbBalance;          // BNB deposited
        uint256 depositTimestamp;     // When first deposited
        uint256 lastActionTimestamp;  // Last agent action timestamp
        bool isActive;               // Whether position is active
        uint256 authorizedAgentId;   // Authorized agent token ID
        bool agentAuthorized;        // Whether an agent is authorized
        RiskProfile riskProfile;     // User's risk tolerance
    }

    /// @notice Token balance tracking
    struct TokenBalance {
        address token;
        uint256 amount;
    }

    /// @notice User-defined risk tolerance
    struct RiskProfile {
        uint256 maxSlippage;           // Max slippage in basis points (e.g., 100 = 1%)
        uint256 stopLossThreshold;     // Auto-exit if loss exceeds this (basis points)
        uint256 maxSingleActionValue;  // Max value per agent action (wei)
        bool allowAutoWithdraw;        // Allow agent to auto-withdraw on threats
        bool allowAutoSwap;            // Allow agent to swap tokens for protection
    }

    /// @notice Protection action executed by an agent
    struct ProtectionAction {
        uint256 agentId;
        address user;
        ActionType actionType;
        uint256 value;
        uint256 timestamp;
        bytes32 reasonHash;      // IPFS hash of AI reasoning
        bool successful;
    }

    /// @notice Types of protection actions
    enum ActionType {
        EmergencyWithdraw,    // Withdraw funds to safety
        Rebalance,            // Rebalance position
        AlertOnly,            // Alert user (no fund movement)
        StopLoss,             // Execute stop-loss
        TakeProfit            // Execute take-profit
    }

    // ═══════════════════════════════════════════════════════════════
    //                        STATE
    // ═══════════════════════════════════════════════════════════════

    /// @notice User positions
    mapping(address => Position) public positions;

    /// @notice User ERC20 token balances: user => token => amount
    mapping(address => mapping(address => uint256)) public tokenBalances;

    /// @notice User's deposited tokens list
    mapping(address => address[]) public userTokens;

    /// @notice All protection actions history
    ProtectionAction[] public actionHistory;

    /// @notice Actions by user
    mapping(address => uint256[]) public userActions;

    /// @notice Actions by agent
    mapping(uint256 => uint256[]) public agentActions;

    /// @notice Reference to the agent registry contract
    address public registryAddress;

    /// @notice Total BNB deposited across all users
    uint256 public totalBnbDeposited;

    /// @notice Total protection actions executed
    uint256 public totalActionsExecuted;

    /// @notice Total value protected across all actions
    uint256 public totalValueProtected;

    /// @notice Protocol fee in basis points (e.g., 50 = 0.5%)
    uint256 public protocolFeeBps;

    /// @notice Minimum deposit amount
    uint256 public minDeposit;

    /// @notice Whether the vault is paused for new deposits
    bool public depositsPaused;

    /// @notice Authorized agent operators (operator address => authorized)
    mapping(address => bool) public authorizedOperators;

    /// @notice Optional TokenGate for $UNIQ holder fee discounts
    AegisTokenGate public tokenGate;

    /// @notice Accumulated protocol fees (BNB)
    uint256 public accumulatedFees;

    /// @notice Timelock delay for operator authorization (seconds)
    uint256 public constant OPERATOR_TIMELOCK = 48 hours;

    /// @notice Pending operator authorizations: operator => activation timestamp (0 = not pending)
    mapping(address => uint256) public pendingOperators;

    /// @notice On-chain stop-loss cooldown per user (seconds)
    uint256 public constant STOP_LOSS_COOLDOWN = 1 hours;

    /// @notice Last stop-loss execution timestamp per user
    mapping(address => uint256) public lastStopLossTimestamp;

    /// @notice Maximum Venus redeem slippage in basis points (e.g., 200 = 2%)
    uint256 public venusRedeemSlippageBps = 200;

    /// @notice Whether initial setup is complete (disables instant operator auth)
    bool public setupFinalized;

    /// @notice Performance fee on yield in basis points (e.g., 1500 = 15%)
    uint256 public performanceFeeBps;

    /// @notice Yield earned per user (gross, before fees)
    mapping(address => uint256) public yieldEarned;

    /// @notice Yield already claimed per user
    mapping(address => uint256) public yieldClaimed;

    /// @notice Total yield distributed across all users
    uint256 public totalYieldDistributed;

    /// @notice Accumulated performance fees from yield
    uint256 public accumulatedPerformanceFees;

    // ── Venus Protocol Integration ──────────────────────────────
    /// @notice Venus vBNB market contract
    IVenusBNB public venusVBNB;

    /// @notice PancakeSwap V2 router for stop-loss swaps
    IPancakeRouter public pancakeRouter;

    /// @notice Stablecoin address (USDT/BUSD) for stop-loss output
    address public stablecoin;

    /// @notice Total BNB deployed to Venus
    uint256 public venusDeployedAmount;

    /// @notice % of deposits auto-supplied to Venus (basis points, e.g., 8000 = 80%)
    uint256 public venusAllocationBps;

    /// @notice Whether Venus auto-deployment is enabled
    bool public venusEnabled;

    /// @notice User stablecoin balances after stop-loss swaps
    mapping(address => uint256) public stablecoinBalances;

    // ═══════════════════════════════════════════════════════════════
    //                        EVENTS
    // ═══════════════════════════════════════════════════════════════

    event Deposited(address indexed user, uint256 amount, uint256 timestamp);
    event TokenDeposited(address indexed user, address indexed token, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount, uint256 timestamp);
    event TokenWithdrawn(address indexed user, address indexed token, uint256 amount);
    event AgentAuthorized(address indexed user, uint256 indexed agentId);
    event AgentRevoked(address indexed user, uint256 indexed agentId);
    event RiskProfileUpdated(address indexed user);
    event ProtectionExecuted(
        uint256 indexed actionId,
        uint256 indexed agentId,
        address indexed user,
        ActionType actionType,
        uint256 value,
        bytes32 reasonHash,
        bool successful
    );
    event EmergencyWithdrawal(address indexed user, uint256 bnbAmount);
    event TokenGateUpdated(address indexed tokenGate);
    event ProtocolFeeDeducted(address indexed user, uint256 feeAmount, uint256 effectiveFeeBps);
    event YieldDistributed(address indexed user, uint256 grossYield, uint256 fee, uint256 netYield, uint256 timestamp);
    event YieldClaimed(address indexed user, uint256 amount, uint256 timestamp);
    event PerformanceFeeUpdated(uint256 oldFeeBps, uint256 newFeeBps);
    event VenusSupplied(uint256 amount, uint256 totalDeployed);
    event VenusRedeemed(uint256 amount, uint256 totalDeployed);
    event VenusYieldHarvested(uint256 yieldAmount, uint256 feeAmount);
    event StopLossExecuted(address indexed user, uint256 bnbAmount, uint256 stablecoinReceived);
    event VenusConfigUpdated(address vBNB, address router, address stablecoin);
    event StablecoinWithdrawn(address indexed user, uint256 amount);
    event OperatorAuthorizationQueued(address indexed operator, uint256 activationTime);
    event OperatorAuthorizationCancelled(address indexed operator);
    event OperatorAuthorizationFinalized(address indexed operator);
    event SetupFinalized();

    // ═══════════════════════════════════════════════════════════════
    //                      MODIFIERS
    // ═══════════════════════════════════════════════════════════════

    modifier onlyAuthorizedAgent(address user) {
        if (!positions[user].agentAuthorized) revert NoAgentAuthorized();
        if (!authorizedOperators[msg.sender]) revert NotAuthorizedOperator();
        _;
    }

    modifier whenDepositsActive() {
        if (depositsPaused) revert DepositsPaused();
        _;
    }

    modifier hasPosition() {
        if (!positions[msg.sender].isActive) revert NoActivePosition();
        _;
    }

    // ═══════════════════════════════════════════════════════════════
    //                    CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════

    constructor(
        address _registryAddress,
        uint256 _protocolFeeBps,
        uint256 _minDeposit,
        uint256 _performanceFeeBps
    ) Ownable(msg.sender) {
        if (_registryAddress == address(0)) revert InvalidRegistry();
        if (_protocolFeeBps > 500) revert FeeTooHigh();
        if (_performanceFeeBps > 3000) revert PerformanceFeeTooHigh(); // max 30%

        registryAddress = _registryAddress;
        protocolFeeBps = _protocolFeeBps;
        minDeposit = _minDeposit;
        performanceFeeBps = _performanceFeeBps;
    }

    // ═══════════════════════════════════════════════════════════════
    //                   USER FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Deposit BNB into the vault
     */
    function deposit() external payable nonReentrant whenDepositsActive {
        if (msg.value < minDeposit) revert BelowMinDeposit();

        Position storage pos = positions[msg.sender];

        if (!pos.isActive) {
            pos.depositTimestamp = block.timestamp;
            pos.isActive = true;
            // Set default risk profile
            pos.riskProfile = RiskProfile({
                maxSlippage: 100,           // 1%
                stopLossThreshold: 1000,    // 10%
                maxSingleActionValue: msg.value / 2, // 50% of deposit
                allowAutoWithdraw: true,
                allowAutoSwap: false
            });
        }

        pos.bnbBalance += msg.value;
        totalBnbDeposited += msg.value;

        // Auto-deploy portion to Venus if enabled
        if (venusEnabled && address(venusVBNB) != address(0)) {
            uint256 venusAmount = (msg.value * venusAllocationBps) / 10000;
            if (venusAmount > 0) {
                _supplyToVenus(venusAmount);
            }
        }

        emit Deposited(msg.sender, msg.value, block.timestamp);
    }

    /**
     * @notice Deposit ERC20 tokens into the vault
     * @param token Token contract address
     * @param amount Amount to deposit
     */
    function depositToken(address token, uint256 amount) external nonReentrant whenDepositsActive {
        if (token == address(0)) revert InvalidToken();
        if (amount == 0) revert ZeroAmount();

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        Position storage pos = positions[msg.sender];
        if (!pos.isActive) {
            pos.depositTimestamp = block.timestamp;
            pos.isActive = true;
            pos.riskProfile = RiskProfile({
                maxSlippage: 100,
                stopLossThreshold: 1000,
                maxSingleActionValue: type(uint256).max,
                allowAutoWithdraw: true,
                allowAutoSwap: false
            });
        }

        if (tokenBalances[msg.sender][token] == 0) {
            userTokens[msg.sender].push(token);
        }
        tokenBalances[msg.sender][token] += amount;

        emit TokenDeposited(msg.sender, token, amount);
    }

    /**
     * @notice Withdraw BNB from the vault
     * @param amount Amount to withdraw (0 = withdraw all)
     */
    function withdraw(uint256 amount) external nonReentrant hasPosition {
        Position storage pos = positions[msg.sender];
        uint256 withdrawAmount = amount == 0 ? pos.bnbBalance : amount;

        if (withdrawAmount > pos.bnbBalance) revert InsufficientBalance();

        pos.bnbBalance -= withdrawAmount;
        totalBnbDeposited -= withdrawAmount;

        if (pos.bnbBalance == 0 && _getUserTokenCount(msg.sender) == 0) {
            pos.isActive = false;
        }

        // If vault BNB is insufficient, redeem from Venus first
        if (address(this).balance < withdrawAmount && venusEnabled && address(venusVBNB) != address(0)) {
            uint256 needed = withdrawAmount - address(this).balance;
            _redeemFromVenus(needed);
        }

        (bool sent, ) = payable(msg.sender).call{value: withdrawAmount}("");
        if (!sent) revert TransferFailed();

        emit Withdrawn(msg.sender, withdrawAmount, block.timestamp);
    }

    /**
     * @notice Withdraw ERC20 tokens from the vault
     * @param token Token address
     * @param amount Amount to withdraw (0 = withdraw all)
     */
    function withdrawToken(address token, uint256 amount) external nonReentrant hasPosition {
        uint256 balance = tokenBalances[msg.sender][token];
        uint256 withdrawAmount = amount == 0 ? balance : amount;

        if (withdrawAmount > balance) revert InsufficientTokenBalance();

        tokenBalances[msg.sender][token] -= withdrawAmount;
        IERC20(token).safeTransfer(msg.sender, withdrawAmount);

        emit TokenWithdrawn(msg.sender, token, withdrawAmount);
    }

    /**
     * @notice Authorize an AI agent to protect your position
     * @param agentId Agent token ID from the registry
     */
    function authorizeAgent(uint256 agentId) external hasPosition {
        Position storage pos = positions[msg.sender];
        pos.authorizedAgentId = agentId;
        pos.agentAuthorized = true;

        emit AgentAuthorized(msg.sender, agentId);
    }

    /**
     * @notice Revoke agent authorization
     */
    function revokeAgent() external hasPosition {
        Position storage pos = positions[msg.sender];
        uint256 oldAgentId = pos.authorizedAgentId;
        pos.agentAuthorized = false;
        pos.authorizedAgentId = 0;

        emit AgentRevoked(msg.sender, oldAgentId);
    }

    /**
     * @notice Update risk profile settings
     * @param maxSlippage Max slippage in basis points
     * @param stopLossThreshold Stop loss threshold in basis points
     * @param maxSingleActionValue Max value per agent action
     * @param allowAutoWithdraw Allow agent to auto-withdraw
     * @param allowAutoSwap Allow agent to swap tokens
     */
    function updateRiskProfile(
        uint256 maxSlippage,
        uint256 stopLossThreshold,
        uint256 maxSingleActionValue,
        bool allowAutoWithdraw,
        bool allowAutoSwap
    ) external hasPosition {
        require(maxSlippage <= 1000, "Slippage too high"); // Max 10%
        require(stopLossThreshold <= 5000, "Stop loss too high"); // Max 50%

        positions[msg.sender].riskProfile = RiskProfile({
            maxSlippage: maxSlippage,
            stopLossThreshold: stopLossThreshold,
            maxSingleActionValue: maxSingleActionValue,
            allowAutoWithdraw: allowAutoWithdraw,
            allowAutoSwap: allowAutoSwap
        });

        emit RiskProfileUpdated(msg.sender);
    }

    /**
     * @notice Emergency withdraw all funds immediately
     */
    function emergencyWithdraw() external nonReentrant {
        Position storage pos = positions[msg.sender];
        uint256 bnbAmount = pos.bnbBalance;

        // Reset position
        pos.bnbBalance = 0;
        pos.isActive = false;
        pos.agentAuthorized = false;

        totalBnbDeposited -= bnbAmount;

        // Withdraw all tokens
        address[] storage tokens = userTokens[msg.sender];
        uint256 tokensLength = tokens.length;
        for (uint256 i = 0; i < tokensLength;) {
            uint256 tokenBal = tokenBalances[msg.sender][tokens[i]];
            if (tokenBal > 0) {
                tokenBalances[msg.sender][tokens[i]] = 0;
                IERC20(tokens[i]).safeTransfer(msg.sender, tokenBal);
            }
            unchecked { ++i; }
        }

        // Withdraw stablecoin balance from stop-loss
        uint256 stableBal = stablecoinBalances[msg.sender];
        if (stableBal > 0 && stablecoin != address(0)) {
            stablecoinBalances[msg.sender] = 0;
            IERC20(stablecoin).safeTransfer(msg.sender, stableBal);
        }

        // If vault BNB is insufficient, redeem from Venus
        if (bnbAmount > 0 && address(this).balance < bnbAmount && venusEnabled && address(venusVBNB) != address(0)) {
            uint256 needed = bnbAmount - address(this).balance;
            _redeemFromVenus(needed);
        }

        // Withdraw BNB
        if (bnbAmount > 0) {
            (bool sent, ) = payable(msg.sender).call{value: bnbAmount}("");
            if (!sent) revert TransferFailed();
        }

        emit EmergencyWithdrawal(msg.sender, bnbAmount);
    }

    // ═══════════════════════════════════════════════════════════════
    //                   YIELD FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Distribute yield to vault depositors. Owner or authorized operator
     *         sends BNB (from Venus/PancakeSwap earnings) and assigns it to users.
     *         Performance fee is deducted and a TokenGate discount is applied.
     * @param users Array of user addresses receiving yield
     * @param amounts Array of gross yield amounts (before fees) per user
     */
    function distributeYield(
        address[] calldata users,
        uint256[] calldata amounts
    ) external payable nonReentrant {
        if (!authorizedOperators[msg.sender] && msg.sender != owner()) revert NotAuthorizedOperator();
        if (users.length != amounts.length) revert YieldArrayMismatch();

        uint256 totalRequired = 0;
        for (uint256 i = 0; i < users.length;) {
            totalRequired += amounts[i];
            unchecked { ++i; }
        }
        if (msg.value != totalRequired) revert YieldValueMismatch();

        for (uint256 i = 0; i < users.length;) {
            address user = users[i];
            uint256 grossYield = amounts[i];

            if (!positions[user].isActive || grossYield == 0) {
                unchecked { ++i; }
                continue;
            }

            // Calculate performance fee with TokenGate discount
            uint256 effectivePerformanceFee = performanceFeeBps;
            if (address(tokenGate) != address(0)) {
                uint256 discount = tokenGate.getFeeDiscount(user);
                if (discount >= effectivePerformanceFee) {
                    effectivePerformanceFee = 0;
                } else {
                    effectivePerformanceFee -= discount;
                }
            }

            uint256 fee = (grossYield * effectivePerformanceFee) / 10000;
            uint256 netYield = grossYield - fee;

            // Credit net yield to user position
            positions[user].bnbBalance += netYield;
            totalBnbDeposited += netYield;

            // Track yield
            yieldEarned[user] += grossYield;
            totalYieldDistributed += grossYield;

            // Accumulate performance fee
            if (fee > 0) {
                accumulatedPerformanceFees += fee;
            }

            emit YieldDistributed(user, grossYield, fee, netYield, block.timestamp);

            unchecked { ++i; }
        }
    }

    /**
     * @notice Get yield info for a user
     * @param user Address to check
     * @return grossYieldEarned Total yield earned (before fees)
     * @return netYieldEarned Total yield credited (after fees)
     * @return pendingInPosition Net yield sitting in position balance
     * @return effectivePerformanceFeeBps Performance fee after TokenGate discount
     */
    function getYieldInfo(address user) external view returns (
        uint256 grossYieldEarned,
        uint256 netYieldEarned,
        uint256 pendingInPosition,
        uint256 effectivePerformanceFeeBps
    ) {
        grossYieldEarned = yieldEarned[user];

        effectivePerformanceFeeBps = performanceFeeBps;
        if (address(tokenGate) != address(0)) {
            uint256 discount = tokenGate.getFeeDiscount(user);
            if (discount >= effectivePerformanceFeeBps) {
                effectivePerformanceFeeBps = 0;
            } else {
                effectivePerformanceFeeBps -= discount;
            }
        }

        uint256 totalFees = (grossYieldEarned * effectivePerformanceFeeBps) / 10000;
        netYieldEarned = grossYieldEarned - totalFees;
        pendingInPosition = netYieldEarned; // All net yield is in the position balance
    }

    // ═══════════════════════════════════════════════════════════════
    //                   $UNIQ FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Withdraw accumulated protocol fees (owner only)
     */
    function withdrawAccumulatedFees() external onlyOwner {
        uint256 amount = accumulatedFees;
        if (amount == 0) revert ZeroAmount();
        accumulatedFees = 0;
        (bool sent, ) = payable(owner()).call{value: amount}("");
        if (!sent) revert TransferFailed();
    }

    // ═══════════════════════════════════════════════════════════════
    //                   AGENT FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Execute a protection action on behalf of a user
     * @param user User address to protect
     * @param actionType Type of protective action
     * @param value Value involved in the action
     * @param reasonHash IPFS hash of AI reasoning/analysis
     * @return actionId The action ID in the history
     */
    function executeProtection(
        address user,
        ActionType actionType,
        uint256 value,
        bytes32 reasonHash
    ) external nonReentrant onlyAuthorizedAgent(user) returns (uint256 actionId) {
        Position storage pos = positions[user];
        if (!pos.isActive) revert PositionNotActive();

        uint256 agentId = pos.authorizedAgentId;

        // Validate action against risk profile
        if (actionType == ActionType.EmergencyWithdraw) {
            if (!pos.riskProfile.allowAutoWithdraw) revert AutoWithdrawNotAllowed();
        }

        if (value > 0) {
            if (value > pos.riskProfile.maxSingleActionValue) revert ExceedsMaxActionValue();
        }

        bool successful = true;

        // Execute the protection action
        if (actionType == ActionType.EmergencyWithdraw && value > 0) {
            if (value > pos.bnbBalance) revert InsufficientBalance();

            // Calculate and deduct protocol fee (with holder discount)
            uint256 effectiveFeeBps = protocolFeeBps;
            if (address(tokenGate) != address(0)) {
                effectiveFeeBps = tokenGate.getEffectiveFee(user, protocolFeeBps);
            }
            uint256 feeAmount;
            if (effectiveFeeBps > 0) {
                feeAmount = (value * effectiveFeeBps) / 10000;
            }
            uint256 userAmount = value - feeAmount;

            pos.bnbBalance -= value;
            totalBnbDeposited -= value;
            if (feeAmount > 0) {
                accumulatedFees += feeAmount;
                emit ProtocolFeeDeducted(user, feeAmount, effectiveFeeBps);
            }

            (bool sent, ) = payable(user).call{value: userAmount}("");
            successful = sent;
        } else if (actionType == ActionType.StopLoss && value > 0) {
            if (value > pos.bnbBalance) revert InsufficientBalance();
            if (!pos.riskProfile.allowAutoWithdraw) revert AutoWithdrawNotAllowed();

            // Calculate and deduct protocol fee (with holder discount)
            uint256 effectiveFeeBps = protocolFeeBps;
            if (address(tokenGate) != address(0)) {
                effectiveFeeBps = tokenGate.getEffectiveFee(user, protocolFeeBps);
            }
            uint256 feeAmount;
            if (effectiveFeeBps > 0) {
                feeAmount = (value * effectiveFeeBps) / 10000;
            }
            uint256 userAmount = value - feeAmount;

            pos.bnbBalance -= value;
            totalBnbDeposited -= value;
            if (feeAmount > 0) {
                accumulatedFees += feeAmount;
                emit ProtocolFeeDeducted(user, feeAmount, effectiveFeeBps);
            }

            (bool sent, ) = payable(user).call{value: userAmount}("");
            successful = sent;
        }

        pos.lastActionTimestamp = block.timestamp;

        // Record the action
        actionId = actionHistory.length;
        actionHistory.push(ProtectionAction({
            agentId: agentId,
            user: user,
            actionType: actionType,
            value: value,
            timestamp: block.timestamp,
            reasonHash: reasonHash,
            successful: successful
        }));

        userActions[user].push(actionId);
        agentActions[agentId].push(actionId);

        totalActionsExecuted++;
        if (successful && value > 0) {
            totalValueProtected += value;
        }

        emit ProtectionExecuted(
            actionId,
            agentId,
            user,
            actionType,
            value,
            reasonHash,
            successful
        );
    }

    // ═══════════════════════════════════════════════════════════════
    //                   VENUS FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Harvest yield from Venus. Calculates profit (current value - deployed),
     *         redeems the profit, deducts performance fee, and distributes to depositors.
     * @param users Array of users to distribute yield to
     * @param shares Array of proportional shares (basis points, must sum to 10000)
     */
    function harvestVenusYield(
        address[] calldata users,
        uint256[] calldata shares
    ) external nonReentrant {
        if (!authorizedOperators[msg.sender] && msg.sender != owner()) revert NotAuthorizedOperator();
        if (!venusEnabled || address(venusVBNB) == address(0)) revert VenusNotEnabled();
        if (users.length != shares.length) revert YieldArrayMismatch();

        // Get current Venus value
        uint256 currentValue = venusVBNB.balanceOfUnderlying(address(this));
        if (currentValue <= venusDeployedAmount) revert NoYieldToClaim();

        uint256 grossYield = currentValue - venusDeployedAmount;

        // Record BNB balance before redeem for slippage check
        uint256 bnbBefore = address(this).balance;

        // Redeem the yield portion from Venus
        uint256 result = venusVBNB.redeemUnderlying(grossYield);
        if (result != 0) revert VenusRedeemFailed();

        // Validate actual BNB received against expected (slippage protection)
        uint256 bnbReceived = address(this).balance - bnbBefore;
        uint256 minAcceptable = grossYield - (grossYield * venusRedeemSlippageBps) / 10000;
        if (bnbReceived < minAcceptable) revert VenusSlippageExceeded();

        // Performance fee
        uint256 totalFee = (grossYield * performanceFeeBps) / 10000;
        uint256 distributable = grossYield - totalFee;
        if (totalFee > 0) {
            accumulatedPerformanceFees += totalFee;
        }

        // Distribute to users by share
        uint256 totalShares = 0;
        for (uint256 i = 0; i < users.length;) {
            totalShares += shares[i];
            unchecked { ++i; }
        }
        require(totalShares == 10000, "Shares must sum to 10000");

        for (uint256 i = 0; i < users.length;) {
            if (positions[users[i]].isActive && shares[i] > 0) {
                uint256 userYield = (distributable * shares[i]) / 10000;
                uint256 userGross = (grossYield * shares[i]) / 10000;

                positions[users[i]].bnbBalance += userYield;
                totalBnbDeposited += userYield;
                yieldEarned[users[i]] += userGross;
                totalYieldDistributed += userGross;

                emit YieldDistributed(users[i], userGross, (userGross * performanceFeeBps) / 10000, userYield, block.timestamp);
            }
            unchecked { ++i; }
        }

        emit VenusYieldHarvested(grossYield, totalFee);
    }

    /**
     * @notice Manually supply additional BNB to Venus (owner/operator only)
     * @param amount BNB amount to supply
     */
    function supplyToVenus(uint256 amount) external nonReentrant {
        if (!authorizedOperators[msg.sender] && msg.sender != owner()) revert NotAuthorizedOperator();
        if (!venusEnabled || address(venusVBNB) == address(0)) revert VenusNotEnabled();
        if (amount == 0) revert ZeroAmount();
        require(address(this).balance >= amount, "Insufficient vault BNB");

        _supplyToVenus(amount);
    }

    /**
     * @notice Manually redeem BNB from Venus (owner/operator only)
     * @param amount BNB amount to redeem
     */
    function redeemFromVenus(uint256 amount) external nonReentrant {
        if (!authorizedOperators[msg.sender] && msg.sender != owner()) revert NotAuthorizedOperator();
        if (!venusEnabled || address(venusVBNB) == address(0)) revert VenusNotEnabled();
        if (amount == 0) revert ZeroAmount();

        _redeemFromVenus(amount);
    }

    // ═══════════════════════════════════════════════════════════════
    //                   STOP-LOSS FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Execute stop-loss: swap user's BNB to stablecoin via PancakeSwap.
     *         Called by authorized agent when BNB price drops below threshold.
     * @param user User address
     * @param bnbAmount Amount of BNB to swap
     * @param minStablecoinOut Minimum stablecoin to receive (slippage protection)
     */
    function executeStopLoss(
        address user,
        uint256 bnbAmount,
        uint256 minStablecoinOut
    ) external nonReentrant onlyAuthorizedAgent(user) {
        Position storage pos = positions[user];
        if (!pos.isActive) revert PositionNotActive();
        if (!pos.riskProfile.allowAutoSwap) revert AutoSwapNotAllowed();
        if (bnbAmount > pos.bnbBalance) revert InsufficientBalance();
        if (address(pancakeRouter) == address(0) || stablecoin == address(0)) revert VenusNotEnabled();

        // On-chain stop-loss cooldown
        if (block.timestamp < lastStopLossTimestamp[user] + STOP_LOSS_COOLDOWN) revert StopLossCooldown();

        // Minimum stablecoin output floor: at least 1 unit (prevents zero-value swaps)
        if (minStablecoinOut == 0) revert MinStablecoinTooLow();

        // Debit user's BNB balance
        pos.bnbBalance -= bnbAmount;
        totalBnbDeposited -= bnbAmount;

        // If vault BNB insufficient, redeem from Venus
        if (address(this).balance < bnbAmount && venusEnabled && address(venusVBNB) != address(0)) {
            uint256 needed = bnbAmount - address(this).balance;
            _redeemFromVenus(needed);
        }

        // Swap BNB → stablecoin via PancakeSwap
        address[] memory path = new address[](2);
        path[0] = pancakeRouter.WETH();
        path[1] = stablecoin;

        uint256[] memory amounts = pancakeRouter.swapExactETHForTokens{value: bnbAmount}(
            minStablecoinOut,
            path,
            address(this),
            block.timestamp + 1800  // 30 min deadline for BSC congestion
        );

        uint256 stablecoinReceived = amounts[amounts.length - 1];
        stablecoinBalances[user] += stablecoinReceived;

        // Update on-chain cooldown
        lastStopLossTimestamp[user] = block.timestamp;

        // Record the action
        uint256 actionId = actionHistory.length;
        actionHistory.push(ProtectionAction({
            agentId: pos.authorizedAgentId,
            user: user,
            actionType: ActionType.StopLoss,
            value: bnbAmount,
            timestamp: block.timestamp,
            reasonHash: bytes32(0),
            successful: true
        }));
        userActions[user].push(actionId);
        agentActions[pos.authorizedAgentId].push(actionId);
        totalActionsExecuted++;
        totalValueProtected += bnbAmount;

        pos.lastActionTimestamp = block.timestamp;

        emit StopLossExecuted(user, bnbAmount, stablecoinReceived);
        emit ProtectionExecuted(actionId, pos.authorizedAgentId, user, ActionType.StopLoss, bnbAmount, bytes32(0), true);
    }

    /**
     * @notice Withdraw stablecoin balance (from stop-loss conversions)
     * @param amount Amount to withdraw (0 = all)
     */
    function withdrawStablecoin(uint256 amount) external nonReentrant {
        if (stablecoin == address(0)) revert InvalidToken();
        uint256 balance = stablecoinBalances[msg.sender];
        uint256 withdrawAmount = amount == 0 ? balance : amount;
        if (withdrawAmount > balance) revert InsufficientBalance();

        stablecoinBalances[msg.sender] -= withdrawAmount;
        IERC20(stablecoin).safeTransfer(msg.sender, withdrawAmount);

        emit StablecoinWithdrawn(msg.sender, withdrawAmount);
    }

    // ═══════════════════════════════════════════════════════════════
    //                   VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Get user's full position info
     */
    function getPosition(address user) external view returns (Position memory) {
        return positions[user];
    }

    /**
     * @notice Get user's risk profile
     */
    function getRiskProfile(address user) external view returns (RiskProfile memory) {
        return positions[user].riskProfile;
    }

    /**
     * @notice Get user's token balance
     */
    function getTokenBalance(address user, address token) external view returns (uint256) {
        return tokenBalances[user][token];
    }

    /**
     * @notice Get user's deposited token list
     */
    function getUserTokens(address user) external view returns (address[] memory) {
        return userTokens[user];
    }

    /**
     * @notice Get total action history count
     */
    function getActionCount() external view returns (uint256) {
        return actionHistory.length;
    }

    /**
     * @notice Get user's action history IDs
     */
    function getUserActions(address user) external view returns (uint256[] memory) {
        return userActions[user];
    }

    /**
     * @notice Get agent's action history IDs
     */
    function getAgentActions(uint256 agentId) external view returns (uint256[] memory) {
        return agentActions[agentId];
    }

    /**
     * @notice Get a specific protection action
     */
    function getAction(uint256 actionId) external view returns (ProtectionAction memory) {
        if (actionId >= actionHistory.length) revert ActionDoesNotExist();
        return actionHistory[actionId];
    }

    /**
     * @notice Get vault statistics
     */
    function getVaultStats() external view returns (
        uint256 _totalBnbDeposited,
        uint256 _totalActionsExecuted,
        uint256 _totalValueProtected
    ) {
        return (totalBnbDeposited, totalActionsExecuted, totalValueProtected);
    }

    /**
     * @notice Get yield statistics
     */
    function getYieldStats() external view returns (
        uint256 _totalYieldDistributed,
        uint256 _performanceFeeBps,
        uint256 _accumulatedPerformanceFees
    ) {
        return (totalYieldDistributed, performanceFeeBps, accumulatedPerformanceFees);
    }

    /**
     * @notice Get effective protocol fee for a user (base fee - holder discount)
     * @param user Address to check
     * @return effectiveFee Fee in basis points after any $UNIQ holder discount
     */
    function getEffectiveFee(address user) external view returns (uint256 effectiveFee) {
        if (address(tokenGate) == address(0)) return protocolFeeBps;
        return tokenGate.getEffectiveFee(user, protocolFeeBps);
    }

    /**
     * @notice Get Venus Protocol integration info
     * @return deployed BNB currently deployed to Venus
     * @return currentValue Current Venus balance (deployed + yield)
     * @return pendingYield Unharvested yield sitting in Venus
     * @return allocationBps Target allocation in basis points
     * @return enabled Whether Venus auto-deployment is enabled
     */
    function getVenusInfo() external view returns (
        uint256 deployed,
        uint256 currentValue,
        uint256 pendingYield,
        uint256 allocationBps,
        bool enabled
    ) {
        deployed = venusDeployedAmount;
        allocationBps = venusAllocationBps;
        enabled = venusEnabled;

        if (venusEnabled && address(venusVBNB) != address(0)) {
            // Use stored exchange rate for view (non-mutating)
            uint256 rate = venusVBNB.exchangeRateStored();
            uint256 vTokenBal = venusVBNB.balanceOf(address(this));
            currentValue = (vTokenBal * rate) / 1e18;
            pendingYield = currentValue > deployed ? currentValue - deployed : 0;
        }
    }

    /**
     * @notice Get user's stablecoin balance from stop-loss conversions
     */
    function getStablecoinBalance(address user) external view returns (uint256) {
        return stablecoinBalances[user];
    }

    // ═══════════════════════════════════════════════════════════════
    //                   ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Instantly set operator authorization (only during initial setup)
     * @dev After finalizeSetup() is called, use queueOperatorAuthorization() + timelock
     */
    function setOperatorAuthorization(address operator, bool authorized) external onlyOwner {
        require(!setupFinalized, "Use timelock after setup");
        if (operator == address(0)) revert InvalidOperator();
        authorizedOperators[operator] = authorized;
    }

    /**
     * @notice Finalize initial setup — disables instant operator authorization forever
     * @dev Call this after deploying and configuring all initial operators
     */
    function finalizeSetup() external onlyOwner {
        setupFinalized = true;
        emit SetupFinalized();
    }

    /**
     * @notice Queue an operator authorization (starts timelock)
     * @dev Revoking is instant; only granting requires timelock
     */
    function queueOperatorAuthorization(address operator) external onlyOwner {
        if (operator == address(0)) revert InvalidOperator();
        pendingOperators[operator] = block.timestamp + OPERATOR_TIMELOCK;
        emit OperatorAuthorizationQueued(operator, block.timestamp + OPERATOR_TIMELOCK);
    }

    /**
     * @notice Finalize operator authorization after timelock expires
     */
    function finalizeOperatorAuthorization(address operator) external onlyOwner {
        uint256 activation = pendingOperators[operator];
        if (activation == 0) revert OperatorNotPending();
        if (block.timestamp < activation) revert TimelockNotExpired();
        authorizedOperators[operator] = true;
        pendingOperators[operator] = 0;
        emit OperatorAuthorizationFinalized(operator);
    }

    /**
     * @notice Cancel a pending operator authorization
     */
    function cancelOperatorAuthorization(address operator) external onlyOwner {
        pendingOperators[operator] = 0;
        emit OperatorAuthorizationCancelled(operator);
    }

    /**
     * @notice Instantly revoke an existing operator
     */
    function revokeOperatorAuthorization(address operator) external onlyOwner {
        if (operator == address(0)) revert InvalidOperator();
        authorizedOperators[operator] = false;
        pendingOperators[operator] = 0;
    }

    /**
     * @notice Pause/resume deposits
     */
    function setDepositsPaused(bool paused) external onlyOwner {
        depositsPaused = paused;
    }

    /**
     * @notice Update protocol fee
     */
    function setProtocolFee(uint256 newFeeBps) external onlyOwner {
        if (newFeeBps > 500) revert FeeTooHigh();
        protocolFeeBps = newFeeBps;
    }

    /**
     * @notice Update minimum deposit
     */
    function setMinDeposit(uint256 newMinDeposit) external onlyOwner {
        minDeposit = newMinDeposit;
    }

    /**
     * @notice Set the TokenGate contract for $UNIQ holder discounts
     * @param _tokenGate TokenGate contract address (address(0) to disable)
     */
    function setTokenGate(address _tokenGate) external onlyOwner {
        tokenGate = AegisTokenGate(_tokenGate);
        emit TokenGateUpdated(_tokenGate);
    }

    /**
     * @notice Update performance fee on yield
     * @param newFeeBps New performance fee in basis points (max 3000 = 30%)
     */
    function setPerformanceFeeBps(uint256 newFeeBps) external onlyOwner {
        if (newFeeBps > 3000) revert PerformanceFeeTooHigh();
        uint256 oldFee = performanceFeeBps;
        performanceFeeBps = newFeeBps;
        emit PerformanceFeeUpdated(oldFee, newFeeBps);
    }

    /**
     * @notice Withdraw accumulated performance fees from yield (owner only)
     */
    function withdrawPerformanceFees() external onlyOwner {
        uint256 amount = accumulatedPerformanceFees;
        if (amount == 0) revert ZeroAmount();
        accumulatedPerformanceFees = 0;
        (bool sent, ) = payable(owner()).call{value: amount}("");
        if (!sent) revert TransferFailed();
    }

    /**
     * @notice Configure Venus Protocol integration addresses
     * @param _vBNB Venus vBNB market address
     * @param _router PancakeSwap V2 router address
     * @param _stablecoin Stablecoin (USDT/BUSD) address for stop-loss
     */
    function setVenusConfig(address _vBNB, address _router, address _stablecoin) external onlyOwner {
        venusVBNB = IVenusBNB(_vBNB);
        pancakeRouter = IPancakeRouter(_router);
        stablecoin = _stablecoin;
        emit VenusConfigUpdated(_vBNB, _router, _stablecoin);
    }

    /**
     * @notice Enable or disable Venus auto-deployment
     */
    function setVenusEnabled(bool _enabled) external onlyOwner {
        venusEnabled = _enabled;
    }

    /**
     * @notice Set Venus allocation percentage (basis points)
     * @param _allocationBps e.g., 8000 = 80% of deposits go to Venus
     */
    function setVenusAllocationBps(uint256 _allocationBps) external onlyOwner {
        require(_allocationBps <= 9500, "Max 95%"); // Keep 5% liquid
        venusAllocationBps = _allocationBps;
    }

    /**
     * @notice Approve stablecoin spending for PancakeSwap (one-time setup)
     */
    function approveRouterStablecoin() external onlyOwner {
        if (address(pancakeRouter) == address(0) || stablecoin == address(0)) revert VenusNotEnabled();
        IERC20(stablecoin).approve(address(pancakeRouter), type(uint256).max);
    }

    /**
     * @notice Update Venus redeem slippage tolerance
     * @param _slippageBps Max slippage in basis points (max 500 = 5%)
     */
    function setVenusRedeemSlippage(uint256 _slippageBps) external onlyOwner {
        require(_slippageBps <= 500, "Max 5% slippage");
        venusRedeemSlippageBps = _slippageBps;
    }

    // ═══════════════════════════════════════════════════════════════
    //                   INTERNAL FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Supply BNB to Venus vBNB market
     */
    function _supplyToVenus(uint256 amount) internal {
        // vBNB (CEther-style) mint() is non-returning; failures revert.
        venusVBNB.mint{value: amount}();
        venusDeployedAmount += amount;
        emit VenusSupplied(amount, venusDeployedAmount);
    }

    /**
     * @notice Redeem BNB from Venus vBNB market
     */
    function _redeemFromVenus(uint256 amount) internal {
        uint256 result = venusVBNB.redeemUnderlying(amount);
        if (result != 0) revert VenusRedeemFailed();
        if (venusDeployedAmount >= amount) {
            venusDeployedAmount -= amount;
        } else {
            venusDeployedAmount = 0;
        }
        emit VenusRedeemed(amount, venusDeployedAmount);
    }

    function _getUserTokenCount(address user) internal view returns (uint256 count) {
        address[] storage tokens = userTokens[user];
        uint256 tokensLength = tokens.length;
        for (uint256 i = 0; i < tokensLength;) {
            if (tokenBalances[user][tokens[i]] > 0) {
                count++;
            }
            unchecked { ++i; }
        }
    }

    receive() external payable {
        // Accept BNB transfers
    }
}

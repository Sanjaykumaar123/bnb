// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./AegisTokenGate.sol";

/**
 * @title AegisRegistry
 * @author Aegis Protocol
 * @notice ERC-8004 compatible AI Agent Registry for BNB Chain.
 *         Each AI agent is represented as an ERC-721 NFT with on-chain
 *         identity, capabilities metadata, and performance tracking.
 * @dev Implements agent registration, metadata management, and reputation
 *      scoring for autonomous DeFi guardian agents.
 */
contract AegisRegistry is ERC721Enumerable, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    // ═══════════════════════════════════════════════════════════════
    //                        STRUCTS
    // ═══════════════════════════════════════════════════════════════

    /// @notice Core agent metadata stored on-chain
    struct AgentInfo {
        string name;                 // Human-readable agent name
        string agentURI;             // Off-chain metadata URI (IPFS/HTTP)
        address operator;            // Address authorized to operate agent
        uint256 registeredAt;        // Block timestamp of registration
        uint256 totalDecisions;      // Number of decisions executed
        uint256 successfulActions;   // Number of successful protections
        uint256 totalValueProtected; // Cumulative value protected (wei)
        AgentStatus status;          // Current operational status
        AgentTier tier;              // Agent capability tier
    }

    /// @notice Agent operational status
    enum AgentStatus {
        Active,
        Paused,
        Decommissioned
    }

    /// @notice Agent capability tier (determines permissions)
    enum AgentTier {
        Scout,      // Monitor only - alerts but no execution
        Guardian,   // Can execute basic protection (withdraw)
        Sentinel,   // Can execute advanced protection (rebalance, swap)
        Archon      // Full autonomy with all protection strategies
    }

    /// @notice Reputation feedback entry
    struct ReputationEntry {
        address reviewer;
        uint8 score;          // 1-5 rating
        string comment;
        uint256 timestamp;
    }

    // ═══════════════════════════════════════════════════════════════
    //                        STATE
    // ═══════════════════════════════════════════════════════════════

    /// @notice Next token ID to mint
    uint256 private _nextTokenId;

    /// @notice Agent info by token ID
    mapping(uint256 => AgentInfo) public agents;

    /// @notice Reputation entries by agent ID
    mapping(uint256 => ReputationEntry[]) public reputationLog;

    /// @notice Agent ID by operator address (one agent per operator)
    mapping(address => uint256) public operatorToAgent;

    /// @notice Whether an operator address has a registered agent
    mapping(address => bool) public hasAgent;

    /// @notice Authorized vault contracts that can update agent stats
    mapping(address => bool) public authorizedVaults;

    /// @notice Registration fee (in BNB)
    uint256 public registrationFee;

    /// @notice Maximum agents that can be registered
    uint256 public maxAgents;

    /// @notice Optional TokenGate for $UNIQ holder features
    AegisTokenGate public tokenGate;

    /// @notice Holder badge per agent (set when operator is a $UNIQ holder)
    mapping(uint256 => AegisTokenGate.HolderTier) public holderBadge;

    /// @notice $UNIQ registration fee (alternative to BNB)
    uint256 public uniqRegistrationFee;

    // ═══════════════════════════════════════════════════════════════
    //                        EVENTS
    // ═══════════════════════════════════════════════════════════════

    event AgentRegistered(
        uint256 indexed agentId,
        address indexed operator,
        string name,
        AgentTier tier,
        uint256 timestamp
    );

    event AgentStatusChanged(
        uint256 indexed agentId,
        AgentStatus oldStatus,
        AgentStatus newStatus
    );

    event AgentTierUpgraded(
        uint256 indexed agentId,
        AgentTier oldTier,
        AgentTier newTier
    );

    event AgentMetadataUpdated(
        uint256 indexed agentId,
        string newURI
    );

    event AgentStatsUpdated(
        uint256 indexed agentId,
        uint256 totalDecisions,
        uint256 successfulActions,
        uint256 totalValueProtected
    );

    event ReputationFeedback(
        uint256 indexed agentId,
        address indexed reviewer,
        uint8 score,
        uint256 timestamp
    );

    event VaultAuthorized(address indexed vault, bool authorized);
    event TokenGateUpdated(address indexed tokenGate);
    event HolderBadgeUpdated(uint256 indexed agentId, AegisTokenGate.HolderTier tier);
    event AgentRegisteredWithUNIQ(uint256 indexed agentId, address indexed operator, uint256 uniqPaid);

    // ═══════════════════════════════════════════════════════════════
    //                      MODIFIERS
    // ═══════════════════════════════════════════════════════════════

    modifier onlyOperator(uint256 agentId) {
        require(agents[agentId].operator == msg.sender, "Not agent operator");
        _;
    }

    modifier onlyAuthorizedVault() {
        require(authorizedVaults[msg.sender], "Not authorized vault");
        _;
    }

    modifier agentExists(uint256 agentId) {
        require(agentId < _nextTokenId, "Agent does not exist");
        _;
    }

    // ═══════════════════════════════════════════════════════════════
    //                    CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════

    constructor(
        uint256 _registrationFee,
        uint256 _maxAgents
    ) ERC721("Aegis Guardian Agent", "AEGIS") Ownable(msg.sender) {
        registrationFee = _registrationFee;
        maxAgents = _maxAgents;
    }

    // ═══════════════════════════════════════════════════════════════
    //                   CORE FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Register a new AI guardian agent
     * @param name Human-readable agent name
     * @param agentURI Off-chain metadata URI
     * @param tier Initial agent capability tier
     * @return agentId The newly minted agent token ID
     */
    function registerAgent(
        string calldata name,
        string calldata agentURI,
        AgentTier tier
    ) external payable nonReentrant returns (uint256 agentId) {
        require(msg.value >= registrationFee, "Insufficient registration fee");
        require(!hasAgent[msg.sender], "Operator already has an agent");
        require(_nextTokenId < maxAgents, "Max agents reached");
        require(bytes(name).length > 0 && bytes(name).length <= 64, "Invalid name length");

        agentId = _nextTokenId++;

        agents[agentId] = AgentInfo({
            name: name,
            agentURI: agentURI,
            operator: msg.sender,
            registeredAt: block.timestamp,
            totalDecisions: 0,
            successfulActions: 0,
            totalValueProtected: 0,
            status: AgentStatus.Active,
            tier: tier
        });

        operatorToAgent[msg.sender] = agentId;
        hasAgent[msg.sender] = true;

        _safeMint(msg.sender, agentId);

        emit AgentRegistered(agentId, msg.sender, name, tier, block.timestamp);

        // Refund excess payment
        if (msg.value > registrationFee) {
            (bool refunded, ) = payable(msg.sender).call{value: msg.value - registrationFee}("");
            require(refunded, "Refund failed");
        }
    }

    /**
     * @notice Register a new agent by paying with $UNIQ instead of BNB
     * @param name Human-readable agent name
     * @param agentURI Off-chain metadata URI
     * @param tier Initial agent capability tier
     * @return agentId The newly minted agent token ID
     * @dev Requires prior ERC-20 approve() for uniqRegistrationFee
     */
    function registerAgentWithUNIQ(
        string calldata name,
        string calldata agentURI,
        AgentTier tier
    ) external nonReentrant returns (uint256 agentId) {
        require(address(tokenGate) != address(0), "TokenGate not set");
        require(uniqRegistrationFee > 0, "UNIQ fee not set");
        require(!hasAgent[msg.sender], "Operator already has an agent");
        require(_nextTokenId < maxAgents, "Max agents reached");
        require(bytes(name).length > 0 && bytes(name).length <= 64, "Invalid name length");

        IERC20 uniq = tokenGate.uniqToken();
        uniq.safeTransferFrom(msg.sender, address(this), uniqRegistrationFee);

        agentId = _nextTokenId++;

        agents[agentId] = AgentInfo({
            name: name,
            agentURI: agentURI,
            operator: msg.sender,
            registeredAt: block.timestamp,
            totalDecisions: 0,
            successfulActions: 0,
            totalValueProtected: 0,
            status: AgentStatus.Active,
            tier: tier
        });

        operatorToAgent[msg.sender] = agentId;
        hasAgent[msg.sender] = true;

        _safeMint(msg.sender, agentId);

        // Auto-set holder badge if applicable
        AegisTokenGate.HolderTier holderTier = tokenGate.getHolderTier(msg.sender);
        if (holderTier != AegisTokenGate.HolderTier.None) {
            holderBadge[agentId] = holderTier;
            emit HolderBadgeUpdated(agentId, holderTier);
        }

        emit AgentRegistered(agentId, msg.sender, name, tier, block.timestamp);
        emit AgentRegisteredWithUNIQ(agentId, msg.sender, uniqRegistrationFee);
    }

    /**
     * @notice Update agent metadata URI
     * @param agentId Agent token ID
     * @param newURI New metadata URI
     */
    function updateAgentURI(
        uint256 agentId,
        string calldata newURI
    ) external onlyOperator(agentId) agentExists(agentId) {
        agents[agentId].agentURI = newURI;
        emit AgentMetadataUpdated(agentId, newURI);
    }

    /**
     * @notice Change agent operational status
     * @param agentId Agent token ID
     * @param newStatus New status
     */
    function setAgentStatus(
        uint256 agentId,
        AgentStatus newStatus
    ) external onlyOperator(agentId) agentExists(agentId) {
        AgentStatus oldStatus = agents[agentId].status;
        require(oldStatus != newStatus, "Status unchanged");
        require(oldStatus != AgentStatus.Decommissioned, "Agent decommissioned");

        agents[agentId].status = newStatus;
        emit AgentStatusChanged(agentId, oldStatus, newStatus);
    }

    /**
     * @notice Upgrade agent tier (owner, or $UNIQ holder self-upgrade)
     * @param agentId Agent token ID
     * @param newTier New capability tier
     * @dev Owner can upgrade any agent. $UNIQ holders can self-upgrade based
     *      on their holder tier: Bronze→Guardian, Silver→Sentinel, Gold→Archon
     */
    function upgradeAgentTier(
        uint256 agentId,
        AgentTier newTier
    ) external agentExists(agentId) {
        AgentTier oldTier = agents[agentId].tier;
        require(uint8(newTier) > uint8(oldTier), "Can only upgrade tier");

        if (msg.sender != owner()) {
            // Holder self-upgrade path
            require(agents[agentId].operator == msg.sender, "Not agent operator");
            require(address(tokenGate) != address(0), "TokenGate not set");

            AegisTokenGate.HolderTier holderTier = tokenGate.getHolderTier(msg.sender);
            // Bronze holders → up to Guardian, Silver → Sentinel, Gold → Archon
            uint8 maxTier = uint8(holderTier); // HolderTier enum aligns: None=0, Bronze=1, Silver=2, Gold=3
            require(uint8(newTier) <= maxTier, "Tier exceeds holder level");

            // Refresh holder badge
            holderBadge[agentId] = holderTier;
        }

        agents[agentId].tier = newTier;
        emit AgentTierUpgraded(agentId, oldTier, newTier);
    }

    /**
     * @notice Record agent performance stats (callable by authorized vaults)
     * @param agentId Agent token ID
     * @param wasSuccessful Whether the action was successful
     * @param valueProtected Amount of value protected
     */
    function recordAgentAction(
        uint256 agentId,
        bool wasSuccessful,
        uint256 valueProtected
    ) external onlyAuthorizedVault agentExists(agentId) {
        AgentInfo storage agent = agents[agentId];
        agent.totalDecisions++;
        if (wasSuccessful) {
            agent.successfulActions++;
            agent.totalValueProtected += valueProtected;
        }

        emit AgentStatsUpdated(
            agentId,
            agent.totalDecisions,
            agent.successfulActions,
            agent.totalValueProtected
        );
    }

    /**
     * @notice Submit reputation feedback for an agent
     * @param agentId Agent token ID
     * @param score Rating 1-5
     * @param comment Review comment
     */
    function giveFeedback(
        uint256 agentId,
        uint8 score,
        string calldata comment
    ) external agentExists(agentId) {
        require(score >= 1 && score <= 5, "Score must be 1-5");
        require(agents[agentId].operator != msg.sender, "Cannot review own agent");

        reputationLog[agentId].push(ReputationEntry({
            reviewer: msg.sender,
            score: score,
            comment: comment,
            timestamp: block.timestamp
        }));

        emit ReputationFeedback(agentId, msg.sender, score, block.timestamp);
    }

    // ═══════════════════════════════════════════════════════════════
    //                   VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Get full agent information
     * @param agentId Agent token ID
     * @return info Full agent metadata and stats
     */
    function getAgent(uint256 agentId) external view agentExists(agentId) returns (AgentInfo memory info) {
        return agents[agentId];
    }

    /**
     * @notice Get agent's average reputation score (scaled by 100)
     * @param agentId Agent token ID
     * @return avgScore Average score * 100 (e.g., 450 = 4.50)
     */
    function getReputationScore(uint256 agentId) external view agentExists(agentId) returns (uint256 avgScore) {
        ReputationEntry[] storage entries = reputationLog[agentId];
        if (entries.length == 0) return 0;

        uint256 totalScore;
        for (uint256 i = 0; i < entries.length; i++) {
            totalScore += entries[i].score;
        }
        return (totalScore * 100) / entries.length;
    }

    /**
     * @notice Get reputation entry count for an agent
     * @param agentId Agent token ID
     * @return count Number of reputation entries
     */
    function getReputationCount(uint256 agentId) external view returns (uint256 count) {
        return reputationLog[agentId].length;
    }

    /**
     * @notice Get agent success rate (scaled by 10000 = 100.00%)
     * @param agentId Agent token ID
     * @return rate Success rate in basis points
     */
    function getSuccessRate(uint256 agentId) external view agentExists(agentId) returns (uint256 rate) {
        AgentInfo storage agent = agents[agentId];
        if (agent.totalDecisions == 0) return 0;
        return (agent.successfulActions * 10000) / agent.totalDecisions;
    }

    /**
     * @notice Get total number of registered agents
     * @return count Total agent count
     */
    function getAgentCount() external view returns (uint256 count) {
        return _nextTokenId;
    }

    /**
     * @notice Check if an agent is currently active
     * @param agentId Agent token ID
     * @return isActive True if agent status is Active
     */
    function isAgentActive(uint256 agentId) external view agentExists(agentId) returns (bool isActive) {
        return agents[agentId].status == AgentStatus.Active;
    }

    /**
     * @notice Check if an agent's operator is a $UNIQ holder
     * @param agentId Agent token ID
     * @return True if the operator holds any $UNIQ
     */
    function isUNIQHolder(uint256 agentId) external view agentExists(agentId) returns (bool) {
        if (address(tokenGate) == address(0)) return false;
        return tokenGate.isHolder(agents[agentId].operator);
    }

    /**
     * @notice Get the holder badge tier for an agent
     * @param agentId Agent token ID
     * @return tier The holder badge tier
     */
    function getHolderBadge(uint256 agentId) external view agentExists(agentId) returns (AegisTokenGate.HolderTier) {
        return holderBadge[agentId];
    }

    /**
     * @notice Refresh holder badge for an agent based on current $UNIQ balance
     * @param agentId Agent token ID
     */
    function refreshHolderBadge(uint256 agentId) external agentExists(agentId) {
        require(address(tokenGate) != address(0), "TokenGate not set");
        AegisTokenGate.HolderTier tier = tokenGate.getHolderTier(agents[agentId].operator);
        holderBadge[agentId] = tier;
        emit HolderBadgeUpdated(agentId, tier);
    }

    /**
     * @notice ERC-721 token URI override
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(tokenId < _nextTokenId, "Token does not exist");
        return agents[tokenId].agentURI;
    }

    // ═══════════════════════════════════════════════════════════════
    //                   ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Authorize or revoke a vault contract
     * @param vault Vault contract address
     * @param authorized Whether to authorize or revoke
     */
    function setVaultAuthorization(address vault, bool authorized) external onlyOwner {
        require(vault != address(0), "Invalid vault address");
        authorizedVaults[vault] = authorized;
        emit VaultAuthorized(vault, authorized);
    }

    /**
     * @notice Update registration fee
     * @param newFee New fee in wei
     */
    function setRegistrationFee(uint256 newFee) external onlyOwner {
        registrationFee = newFee;
    }

    /**
     * @notice Withdraw accumulated registration fees
     */
    function withdrawFees() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No fees to withdraw");
        (bool sent, ) = payable(owner()).call{value: balance}("");
        require(sent, "Withdrawal failed");
    }

    /**
     * @notice Set the TokenGate contract for $UNIQ holder features
     * @param _tokenGate TokenGate contract address (address(0) to disable)
     */
    function setTokenGate(address _tokenGate) external onlyOwner {
        tokenGate = AegisTokenGate(_tokenGate);
        emit TokenGateUpdated(_tokenGate);
    }

    /**
     * @notice Set $UNIQ registration fee
     * @param newFee Fee in $UNIQ token units (18 decimals)
     */
    function setUniqRegistrationFee(uint256 newFee) external onlyOwner {
        uniqRegistrationFee = newFee;
    }

    /**
     * @notice Withdraw accumulated $UNIQ registration fees
     */
    function withdrawUniqFees() external onlyOwner {
        require(address(tokenGate) != address(0), "TokenGate not set");
        IERC20 uniq = tokenGate.uniqToken();
        uint256 balance = uniq.balanceOf(address(this));
        require(balance > 0, "No UNIQ to withdraw");
        uniq.safeTransfer(owner(), balance);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IVenusBNB.sol";

/**
 * @title MockVenusBNB
 * @notice Simulates Venus vBNB market for testnet. Accrues ~4% APY over time.
 * @dev Exchange rate increases linearly based on elapsed time.
 *      For mainnet: replace with real Venus vBNB address.
 */
contract MockVenusBNB is IVenusBNB {
    // 4% APY expressed as rate per second (scaled 1e18)
    // 0.04 / 365.25 / 86400 ≈ 1.268e-9 → scaled = 1_268_391_679
    uint256 public constant RATE_PER_SECOND = 1_268_391_679;
    uint256 public constant INITIAL_EXCHANGE_RATE = 1e18;

    uint256 public deployTimestamp;
    uint256 public totalSupplied;   // Total BNB supplied
    uint256 public totalVTokens;    // Total vBNB minted

    mapping(address => uint256) public vTokenBalances;

    event Mint(address indexed supplier, uint256 mintAmount, uint256 mintTokens);
    event Redeem(address indexed redeemer, uint256 redeemAmount, uint256 redeemTokens);

    constructor() {
        deployTimestamp = block.timestamp;
    }

    /// @notice Current exchange rate: increases over time to simulate yield
    function exchangeRateCurrent() public override returns (uint256) {
        return _exchangeRate();
    }

    function exchangeRateStored() external view override returns (uint256) {
        return _exchangeRate();
    }

    /// @notice Supply BNB → receive vBNB
    function mint() external payable override {
        require(msg.value > 0, "Zero mint");

        uint256 rate = _exchangeRate();
        uint256 tokens = (msg.value * 1e18) / rate;

        vTokenBalances[msg.sender] += tokens;
        totalVTokens += tokens;
        totalSupplied += msg.value;

        emit Mint(msg.sender, msg.value, tokens);
    }

    /// @notice Redeem vBNB tokens → receive BNB
    function redeem(uint256 redeemTokens) external override returns (uint256) {
        require(redeemTokens > 0, "Zero redeem");
        require(vTokenBalances[msg.sender] >= redeemTokens, "Insufficient vBNB");

        uint256 rate = _exchangeRate();
        uint256 bnbAmount = (redeemTokens * rate) / 1e18;
        require(address(this).balance >= bnbAmount, "Insufficient liquidity");

        vTokenBalances[msg.sender] -= redeemTokens;
        totalVTokens -= redeemTokens;
        if (totalSupplied >= bnbAmount) {
            totalSupplied -= bnbAmount;
        } else {
            totalSupplied = 0;
        }

        (bool sent, ) = payable(msg.sender).call{value: bnbAmount}("");
        require(sent, "Transfer failed");

        emit Redeem(msg.sender, bnbAmount, redeemTokens);
        return 0;
    }

    /// @notice Redeem specific BNB amount
    function redeemUnderlying(uint256 redeemAmount) external override returns (uint256) {
        require(redeemAmount > 0, "Zero redeem");
        require(address(this).balance >= redeemAmount, "Insufficient liquidity");

        uint256 rate = _exchangeRate();
        uint256 tokensNeeded = (redeemAmount * 1e18 + rate - 1) / rate; // round up
        require(vTokenBalances[msg.sender] >= tokensNeeded, "Insufficient vBNB");

        vTokenBalances[msg.sender] -= tokensNeeded;
        totalVTokens -= tokensNeeded;
        if (totalSupplied >= redeemAmount) {
            totalSupplied -= redeemAmount;
        } else {
            totalSupplied = 0;
        }

        (bool sent, ) = payable(msg.sender).call{value: redeemAmount}("");
        require(sent, "Transfer failed");

        emit Redeem(msg.sender, redeemAmount, tokensNeeded);
        return 0;
    }

    /// @notice Get underlying BNB balance (including accrued interest)
    function balanceOfUnderlying(address owner) external override returns (uint256) {
        uint256 rate = _exchangeRate();
        return (vTokenBalances[owner] * rate) / 1e18;
    }

    function balanceOf(address owner) external view override returns (uint256) {
        return vTokenBalances[owner];
    }

    /// @notice Simulated supply rate per block (~4% APY)
    /// BSC = ~3s blocks, ~10.5M blocks/year
    /// 0.04 / 10_500_000 ≈ 3.81e-9 → scaled = 3_809_523_809
    function supplyRatePerBlock() external pure override returns (uint256) {
        return 3_809_523_809;
    }

    // ═══ Internal ═══

    function _exchangeRate() internal view returns (uint256) {
        uint256 elapsed = block.timestamp - deployTimestamp;
        // rate = 1e18 + (elapsed * RATE_PER_SECOND)
        return INITIAL_EXCHANGE_RATE + (elapsed * RATE_PER_SECOND);
    }

    /// @notice Accept BNB (to fund yield payouts)
    receive() external payable {}
}

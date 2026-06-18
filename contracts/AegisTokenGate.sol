// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AegisTokenGate
 * @author Aegis Protocol — Uniq Minds
 * @notice Token-gated access control for $UNIQ holders.
 *         Determines holder tier based on balance and calculates
 *         fee discounts for protocol operations.
 * @dev Read-only balance checks — no staking/locking. Thresholds
 *      adjustable by owner to tune with market conditions.
 */
contract AegisTokenGate is Ownable {

    // ═══════════════════════════════════════════════════════════════
    //                      CUSTOM ERRORS
    // ═══════════════════════════════════════════════════════════════

    error InvalidTokenAddress();
    error InvalidThreshold();
    error ThresholdNotAscending();
    error InvalidDiscount();

    // ═══════════════════════════════════════════════════════════════
    //                        ENUMS
    // ═══════════════════════════════════════════════════════════════

    /// @notice Holder tier based on $UNIQ balance
    enum HolderTier { None, Bronze, Silver, Gold }

    // ═══════════════════════════════════════════════════════════════
    //                        STATE
    // ═══════════════════════════════════════════════════════════════

    /// @notice The $UNIQ token contract
    IERC20 public uniqToken;

    /// @notice Tier thresholds (hold X $UNIQ for tier benefits)
    uint256 public bronzeThreshold;
    uint256 public silverThreshold;
    uint256 public goldThreshold;

    /// @notice Fee discounts per tier (basis points reduction)
    uint256 public bronzeDiscount;
    uint256 public silverDiscount;
    uint256 public goldDiscount;

    // ═══════════════════════════════════════════════════════════════
    //                        EVENTS
    // ═══════════════════════════════════════════════════════════════

    event ThresholdsUpdated(uint256 bronze, uint256 silver, uint256 gold);
    event DiscountsUpdated(uint256 bronze, uint256 silver, uint256 gold);

    // ═══════════════════════════════════════════════════════════════
    //                    CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════

    constructor(address _uniqToken) Ownable(msg.sender) {
        if (_uniqToken == address(0)) revert InvalidTokenAddress();
        uniqToken = IERC20(_uniqToken);

        // Default thresholds
        bronzeThreshold = 10_000 * 1e18;      // 10K $UNIQ
        silverThreshold = 100_000 * 1e18;     // 100K $UNIQ
        goldThreshold   = 1_000_000 * 1e18;   // 1M $UNIQ

        // Default fee discounts (basis points reduction from protocol fee)
        bronzeDiscount = 10;  // 0.10% off
        silverDiscount = 25;  // 0.25% off
        goldDiscount   = 40;  // 0.40% off
    }

    // ═══════════════════════════════════════════════════════════════
    //                   VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Get the holder tier for a user based on their $UNIQ balance
     * @param user Address to check
     * @return tier The user's holder tier
     */
    function getHolderTier(address user) public view returns (HolderTier) {
        uint256 balance = uniqToken.balanceOf(user);

        if (balance >= goldThreshold) return HolderTier.Gold;
        if (balance >= silverThreshold) return HolderTier.Silver;
        if (balance >= bronzeThreshold) return HolderTier.Bronze;
        return HolderTier.None;
    }

    /**
     * @notice Get fee discount in basis points for a user
     * @param user Address to check
     * @return discount Fee reduction in basis points
     */
    function getFeeDiscount(address user) public view returns (uint256) {
        HolderTier tier = getHolderTier(user);

        if (tier == HolderTier.Gold) return goldDiscount;
        if (tier == HolderTier.Silver) return silverDiscount;
        if (tier == HolderTier.Bronze) return bronzeDiscount;
        return 0;
    }

    /**
     * @notice Check if a user holds any $UNIQ
     * @param user Address to check
     * @return True if user has a non-zero $UNIQ balance
     */
    function isHolder(address user) public view returns (bool) {
        return uniqToken.balanceOf(user) > 0;
    }

    /**
     * @notice Get the effective fee for a user given a base fee
     * @param user Address to check
     * @param baseFee Base protocol fee in basis points
     * @return effectiveFee Discounted fee in basis points
     */
    function getEffectiveFee(address user, uint256 baseFee) external view returns (uint256 effectiveFee) {
        uint256 discount = getFeeDiscount(user);
        if (discount >= baseFee) return 0;
        return baseFee - discount;
    }

    /**
     * @notice Get the user's $UNIQ balance
     * @param user Address to check
     * @return balance Token balance
     */
    function getBalance(address user) external view returns (uint256) {
        return uniqToken.balanceOf(user);
    }

    /**
     * @notice Get all tier thresholds
     * @return bronze Silver Gold thresholds
     */
    function getThresholds() external view returns (uint256, uint256, uint256) {
        return (bronzeThreshold, silverThreshold, goldThreshold);
    }

    /**
     * @notice Get all tier discounts
     * @return bronze Silver Gold discounts in basis points
     */
    function getDiscounts() external view returns (uint256, uint256, uint256) {
        return (bronzeDiscount, silverDiscount, goldDiscount);
    }

    // ═══════════════════════════════════════════════════════════════
    //                   ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Update tier thresholds
     * @param _bronze Bronze threshold (must be < silver)
     * @param _silver Silver threshold (must be < gold)
     * @param _gold Gold threshold
     */
    function setThresholds(
        uint256 _bronze,
        uint256 _silver,
        uint256 _gold
    ) external onlyOwner {
        if (_bronze == 0) revert InvalidThreshold();
        if (_bronze >= _silver || _silver >= _gold) revert ThresholdNotAscending();

        bronzeThreshold = _bronze;
        silverThreshold = _silver;
        goldThreshold = _gold;

        emit ThresholdsUpdated(_bronze, _silver, _gold);
    }

    /**
     * @notice Update tier fee discounts
     * @param _bronze Bronze discount in basis points
     * @param _silver Silver discount in basis points
     * @param _gold Gold discount in basis points
     */
    function setDiscounts(
        uint256 _bronze,
        uint256 _silver,
        uint256 _gold
    ) external onlyOwner {
        if (_bronze > _silver || _silver > _gold) revert InvalidDiscount();
        if (_gold > 500) revert InvalidDiscount(); // Max 5% discount

        bronzeDiscount = _bronze;
        silverDiscount = _silver;
        goldDiscount = _gold;

        emit DiscountsUpdated(_bronze, _silver, _gold);
    }
}

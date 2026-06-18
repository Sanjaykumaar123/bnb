// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IVenusBNB
 * @notice Interface for Venus Protocol vBNB market (cToken-style)
 * @dev Venus vBNB is the BNB lending market on BSC.
 *      - Supply BNB → receive vBNB (interest-bearing)
 *      - Redeem vBNB → receive BNB + accrued interest
 */
interface IVenusBNB {
    /// @notice Supply BNB to Venus and receive vBNB
    /// @dev CEther/vBNB mint() is payable and does not return a value.
    function mint() external payable;

    /// @notice Redeem vBNB tokens for underlying BNB
    /// @param redeemTokens Amount of vBNB to redeem
    /// @return 0 on success, else error code
    function redeem(uint256 redeemTokens) external returns (uint256);

    /// @notice Redeem a specific amount of underlying BNB
    /// @param redeemAmount Amount of BNB to receive
    /// @return 0 on success, else error code
    function redeemUnderlying(uint256 redeemAmount) external returns (uint256);

    /// @notice Get the underlying BNB balance (including accrued interest)
    /// @param owner Address to query
    /// @return The amount of underlying BNB
    function balanceOfUnderlying(address owner) external returns (uint256);

    /// @notice Get vBNB token balance
    /// @param owner Address to query
    /// @return The vBNB balance
    function balanceOf(address owner) external view returns (uint256);

    /// @notice Get current exchange rate (scaled by 1e18)
    /// @return The exchange rate
    function exchangeRateCurrent() external returns (uint256);

    /// @notice Get stored exchange rate (no state change)
    /// @return The stored exchange rate
    function exchangeRateStored() external view returns (uint256);

    /// @notice Get current supply rate per block (scaled by 1e18)
    /// @return The supply rate
    function supplyRatePerBlock() external view returns (uint256);
}

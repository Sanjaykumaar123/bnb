// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IPancakeRouter
 * @notice Minimal interface for PancakeSwap V2 Router (swap BNB → tokens)
 */
interface IPancakeRouter {
    /// @notice Swap exact BNB for tokens
    function swapExactETHForTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable returns (uint256[] memory amounts);

    /// @notice Get output amounts for a given input
    function getAmountsOut(
        uint256 amountIn,
        address[] calldata path
    ) external view returns (uint256[] memory amounts);

    /// @notice WBNB address used by the router
    function WETH() external view returns (address);
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title AegisScanner — On-Chain Token Risk Registry
 * @notice Stores AI-generated risk assessments for any BEP-20 token on BSC.
 *         Agents push scan results on-chain, users query before interacting with tokens.
 *
 * Risk flags:
 *   HONEYPOT          — Token cannot be sold after buying
 *   RUG_PULL_RISK     — Owner can drain liquidity / mint unlimited
 *   LOW_LIQUIDITY     — Under $10K liquidity, high slippage
 *   WHALE_DOMINATED   — Top holder owns >50%
 *   UNVERIFIED        — Contract source not verified on BSCScan
 *   PROXY_CONTRACT    — Upgradeable proxy (owner can change logic)
 *   MINT_FUNCTION     — Owner can mint new tokens
 *   PAUSE_FUNCTION    — Owner can pause transfers
 *   BLACKLIST_FUNCTION — Owner can blacklist addresses
 *   HIGH_TAX          — Buy/sell tax exceeds 10%
 */
contract AegisScanner is Ownable {
    // ─── Structs ─────────────────────────────────────────────
    struct TokenScan {
        address token;
        uint256 riskScore;        // 0-100 (0 = safe, 100 = scam)
        uint256 liquidity;        // USD value of LP (scaled by 1e18)
        uint256 holderCount;
        uint256 topHolderPercent; // basis points (5000 = 50%)
        uint256 buyTax;           // basis points
        uint256 sellTax;          // basis points
        bool isHoneypot;
        bool ownerCanMint;
        bool ownerCanPause;
        bool ownerCanBlacklist;
        bool isContractRenounced;
        bool isLiquidityLocked;
        bool isVerified;
        uint256 scanTimestamp;
        address scannedBy;        // agent address that submitted
        string flags;             // comma-separated flag list
    }

    // ─── State ───────────────────────────────────────────────
    mapping(address => TokenScan) public tokenScans;
    mapping(address => bool) public authorizedScanners;
    address[] public scannedTokens;
    mapping(address => bool) private tokenExists;

    uint256 public totalScans;
    uint256 public totalHoneypots;
    uint256 public totalRugRisks;

    // ─── Events ──────────────────────────────────────────────
    event TokenScanned(
        address indexed token,
        uint256 riskScore,
        bool isHoneypot,
        uint256 liquidity,
        address indexed scannedBy,
        uint256 timestamp
    );
    event ScannerAuthorized(address indexed scanner, bool authorized);

    // ─── Constructor ─────────────────────────────────────────
    constructor() Ownable(msg.sender) {
        authorizedScanners[msg.sender] = true;
    }

    // ─── Modifiers ───────────────────────────────────────────
    modifier onlyScanner() {
        require(authorizedScanners[msg.sender], "Not authorized scanner");
        _;
    }

    // ─── Core Functions ──────────────────────────────────────

    /**
     * @notice Submit a token risk scan result
     * @param token The BEP-20 token address
     * @param riskScore 0-100 risk score
     * @param liquidity USD liquidity in wei (1e18 = $1)
     * @param holderCount Number of unique holders
     * @param topHolderPercent Top holder % in basis points
     * @param buyTax Buy tax in basis points
     * @param sellTax Sell tax in basis points
     * @param boolFlags Packed: [honeypot, canMint, canPause, canBlacklist, renounced, lpLocked, verified]
     * @param flags Comma-separated flag string
     */
    function submitScan(
        address token,
        uint256 riskScore,
        uint256 liquidity,
        uint256 holderCount,
        uint256 topHolderPercent,
        uint256 buyTax,
        uint256 sellTax,
        bool[7] calldata boolFlags,
        string calldata flags
    ) external onlyScanner {
        require(token != address(0), "Invalid token");
        require(riskScore <= 100, "Risk score 0-100");
        require(topHolderPercent <= 10000, "Percent in bps");

        tokenScans[token] = TokenScan({
            token: token,
            riskScore: riskScore,
            liquidity: liquidity,
            holderCount: holderCount,
            topHolderPercent: topHolderPercent,
            buyTax: buyTax,
            sellTax: sellTax,
            isHoneypot: boolFlags[0],
            ownerCanMint: boolFlags[1],
            ownerCanPause: boolFlags[2],
            ownerCanBlacklist: boolFlags[3],
            isContractRenounced: boolFlags[4],
            isLiquidityLocked: boolFlags[5],
            isVerified: boolFlags[6],
            scanTimestamp: block.timestamp,
            scannedBy: msg.sender,
            flags: flags
        });

        if (!tokenExists[token]) {
            scannedTokens.push(token);
            tokenExists[token] = true;
        }

        totalScans++;
        if (boolFlags[0]) totalHoneypots++;
        if (riskScore >= 70) totalRugRisks++;

        emit TokenScanned(token, riskScore, boolFlags[0], liquidity, msg.sender, block.timestamp);
    }

    // ─── View Functions ──────────────────────────────────────

    function getTokenScan(address token) external view returns (TokenScan memory) {
        return tokenScans[token];
    }

    function getTokenRiskScore(address token) external view returns (uint256) {
        return tokenScans[token].riskScore;
    }

    function isHoneypot(address token) external view returns (bool) {
        return tokenScans[token].isHoneypot;
    }

    function isScanned(address token) external view returns (bool) {
        return tokenExists[token];
    }

    function getScannedTokenCount() external view returns (uint256) {
        return scannedTokens.length;
    }

    function getRecentScans(uint256 count) external view returns (TokenScan[] memory) {
        uint256 len = scannedTokens.length;
        uint256 resultLen = count < len ? count : len;
        TokenScan[] memory results = new TokenScan[](resultLen);
        for (uint256 i = 0; i < resultLen; i++) {
            results[i] = tokenScans[scannedTokens[len - 1 - i]];
        }
        return results;
    }

    function getScannerStats() external view returns (uint256, uint256, uint256, uint256) {
        return (totalScans, totalHoneypots, totalRugRisks, scannedTokens.length);
    }

    // ─── Admin ───────────────────────────────────────────────

    function setScannerAuthorization(address scanner, bool authorized) external onlyOwner {
        authorizedScanners[scanner] = authorized;
        emit ScannerAuthorized(scanner, authorized);
    }
}

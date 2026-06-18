// ═══════════════════════════════════════════════════════════════
// Aegis Protocol — Contract ABIs for Frontend Integration
// Minimal ABIs for reading on-chain state from the dashboard
// ═══════════════════════════════════════════════════════════════

export const REGISTRY_ABI = [
  // Views
  "function getAgent(uint256 agentId) view returns (tuple(string name, string agentURI, address operator, uint256 registeredAt, uint256 totalDecisions, uint256 successfulActions, uint256 totalValueProtected, uint8 status, uint8 tier))",
  "function getAgentCount() view returns (uint256)",
  "function getReputationScore(uint256 agentId) view returns (uint256)",
  "function getSuccessRate(uint256 agentId) view returns (uint256)",
  "function getReputationCount(uint256 agentId) view returns (uint256)",
  "function isAgentActive(uint256 agentId) view returns (bool)",
  "function hasAgent(address operator) view returns (bool)",
  "function operatorToAgent(address operator) view returns (uint256)",
  // Write
  "function registerAgent(string name, string agentURI, uint8 tier) payable returns (uint256)",
  "function registerAgentWithUNIQ(string name, string agentURI, uint8 tier) returns (uint256)",
  "function giveFeedback(uint256 agentId, uint8 score, string comment)",
  "function upgradeAgentTier(uint256 agentId, uint8 newTier)",
  // Views (holder)
  "function isUNIQHolder(uint256 agentId) view returns (bool)",
  "function getHolderBadge(uint256 agentId) view returns (uint8)",
];

export const VAULT_ABI = [
  // Views
  "function getPosition(address user) view returns (tuple(uint256 bnbBalance, uint256 depositTimestamp, uint256 lastActionTimestamp, bool isActive, uint256 authorizedAgentId, bool agentAuthorized, tuple(uint256 maxSlippage, uint256 stopLossThreshold, uint256 maxSingleActionValue, bool allowAutoWithdraw, bool allowAutoSwap) riskProfile))",
  "function getVaultStats() view returns (uint256 totalBnbDeposited, uint256 totalActionsExecuted, uint256 totalValueProtected)",
  "function getYieldInfo(address user) view returns (uint256 grossYieldEarned, uint256 netYieldEarned, uint256 pendingInPosition, uint256 effectivePerformanceFeeBps)",
  "function getYieldStats() view returns (uint256 totalYieldDistributed, uint256 performanceFeeBps, uint256 accumulatedPerformanceFees)",
  "function getAction(uint256 actionId) view returns (tuple(uint256 agentId, address user, uint8 actionType, uint256 value, uint256 timestamp, bytes32 reasonHash, bool successful))",
  "function getActionCount() view returns (uint256)",
  "function getUserActions(address user) view returns (uint256[])",
  "function totalBnbDeposited() view returns (uint256)",
  "function totalActionsExecuted() view returns (uint256)",
  "function totalValueProtected() view returns (uint256)",
  "function getEffectiveFee(address user) view returns (uint256)",
  "function yieldEarned(address user) view returns (uint256)",
  "function totalYieldDistributed() view returns (uint256)",
  "function performanceFeeBps() view returns (uint256)",
  // Venus Protocol
  "function getVenusInfo() view returns (uint256 deployed, uint256 currentValue, uint256 pendingYield, uint256 allocationBps, bool enabled)",
  "function venusEnabled() view returns (bool)",
  "function venusDeployedAmount() view returns (uint256)",
  "function venusAllocationBps() view returns (uint256)",
  "function getStablecoinBalance(address user) view returns (uint256)",
  // Write
  "function deposit() payable",
  "function withdraw(uint256 amount)",
  "function authorizeAgent(uint256 agentId)",
  "function revokeAgent()",
  "function updateRiskProfile(uint256 maxSlippage, uint256 stopLossThreshold, uint256 maxSingleActionValue, bool allowAutoWithdraw, bool allowAutoSwap)",
  "function emergencyWithdraw()",
  "function withdrawStablecoin(uint256 amount)",
  // Events
  "event Deposited(address indexed user, uint256 amount, uint256 timestamp)",
  "event YieldDistributed(address indexed user, uint256 grossYield, uint256 fee, uint256 netYield, uint256 timestamp)",
  "event ProtectionExecuted(uint256 indexed actionId, uint256 indexed agentId, address indexed user, uint8 actionType, uint256 value, bytes32 reasonHash, bool successful)",
  "event VenusSupplied(uint256 amount, uint256 totalDeployed)",
  "event VenusRedeemed(uint256 amount, uint256 totalDeployed)",
  "event StopLossExecuted(address indexed user, uint256 bnbAmount, uint256 stablecoinReceived)",
];

export const LOGGER_ABI = [
  // Views
  "function getDecisionCount() view returns (uint256)",
  "function getDecision(uint256 decisionId) view returns (tuple(uint256 agentId, address targetUser, uint8 decisionType, uint8 riskLevel, uint256 confidence, bytes32 analysisHash, bytes32 dataHash, uint256 timestamp, bool actionTaken, uint256 actionId))",
  "function getRecentDecisions(uint256 count) view returns (tuple(uint256 agentId, address targetUser, uint8 decisionType, uint8 riskLevel, uint256 confidence, bytes32 analysisHash, bytes32 dataHash, uint256 timestamp, bool actionTaken, uint256 actionId)[])",
  "function getLatestRisk(address user) view returns (tuple(uint256 timestamp, uint8 overallRisk, uint256 liquidationRisk, uint256 volatilityScore, uint256 protocolRisk, uint256 smartContractRisk, bytes32 detailsHash))",
  "function getStats() view returns (uint256 totalDecisions, uint256 totalThreats, uint256 totalProtections)",
  "function getUserDecisions(address user) view returns (uint256[])",
  "function totalThreatsDetected() view returns (uint256)",
  "function totalProtectionsTriggered() view returns (uint256)",
];

export const ERC20_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
];

export const TOKEN_GATE_ABI = [
  "function getHolderTier(address user) view returns (uint8)",
  "function getFeeDiscount(address user) view returns (uint256)",
  "function getEffectiveFee(address user, uint256 baseFee) view returns (uint256)",
  "function isHolder(address user) view returns (bool)",
  "function getBalance(address user) view returns (uint256)",
];

export const SCANNER_ABI = [
  "function getTokenScan(address token) view returns (tuple(address token, uint256 riskScore, uint256 liquidity, uint256 holderCount, uint256 topHolderPercent, uint256 buyTax, uint256 sellTax, bool isHoneypot, bool ownerCanMint, bool ownerCanPause, bool ownerCanBlacklist, bool isContractRenounced, bool isLiquidityLocked, bool isVerified, uint256 scanTimestamp, address scannedBy, string flags))",
  "function getTokenRiskScore(address token) view returns (uint256)",
  "function isHoneypot(address token) view returns (bool)",
  "function isScanned(address token) view returns (bool)",
  "function getScannedTokenCount() view returns (uint256)",
  "function getRecentScans(uint256 count) view returns (tuple(address token, uint256 riskScore, uint256 liquidity, uint256 holderCount, uint256 topHolderPercent, uint256 buyTax, uint256 sellTax, bool isHoneypot, bool ownerCanMint, bool ownerCanPause, bool ownerCanBlacklist, bool isContractRenounced, bool isLiquidityLocked, bool isVerified, uint256 scanTimestamp, address scannedBy, string flags)[])",
  "function getScannerStats() view returns (uint256 totalScans, uint256 totalHoneypots, uint256 totalRugRisks, uint256 totalTokens)",
];

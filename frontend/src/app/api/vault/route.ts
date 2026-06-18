import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";

// ─── Protected Vault API ─────────────────────────────────────
// Returns vault stats, user position, REAL yield data from contract,
// AI monitoring status, and recent protection decisions.

const RPC_URL = process.env.BSC_RPC || (
  process.env.NEXT_PUBLIC_CHAIN_ID === "56"
    ? "https://bsc-dataseed1.binance.org"
    : "https://bsc-testnet-dataseed.bnbchain.org"
);

const IS_MAINNET = process.env.NEXT_PUBLIC_CHAIN_ID === "56";

const CONTRACTS = {
  VAULT: process.env.NEXT_PUBLIC_VAULT_ADDRESS || (IS_MAINNET ? "" : "0xfa80515136Fc8CB2db3b25C317A1c9a04bcD3536"),
  REGISTRY: process.env.NEXT_PUBLIC_REGISTRY_ADDRESS || (IS_MAINNET ? "" : "0x806677bAb187157Ba567820e857e321c92E6C1EF"),
  LOGGER: process.env.NEXT_PUBLIC_LOGGER_ADDRESS || (IS_MAINNET ? "" : "0x978308DF80FE3AEDf228D58c3625db49e50FE51B"),
  TOKEN_GATE: process.env.NEXT_PUBLIC_TOKEN_GATE_ADDRESS || (IS_MAINNET ? "" : "0x0F998bb1B3866B73CAaBc54B7A84156b8F9f7543"),
};

const VAULT_ABI = [
  "function getPosition(address user) view returns (tuple(uint256 bnbBalance, uint256 depositTimestamp, uint256 lastActionTimestamp, bool isActive, uint256 authorizedAgentId, bool agentAuthorized, tuple(uint256 maxSlippage, uint256 stopLossThreshold, uint256 maxSingleActionValue, bool allowAutoWithdraw, bool allowAutoSwap) riskProfile))",
  "function getVaultStats() view returns (uint256 totalBnbDeposited, uint256 totalActionsExecuted, uint256 totalValueProtected)",
  "function getYieldInfo(address user) view returns (uint256 grossYieldEarned, uint256 netYieldEarned, uint256 pendingInPosition, uint256 effectivePerformanceFeeBps)",
  "function getYieldStats() view returns (uint256 totalYieldDistributed, uint256 performanceFeeBps, uint256 accumulatedPerformanceFees)",
  "function getEffectiveFee(address user) view returns (uint256)",
  "function getUserActions(address user) view returns (uint256[])",
  "function getAction(uint256 actionId) view returns (tuple(uint256 agentId, address user, uint8 actionType, uint256 value, uint256 timestamp, bytes32 reasonHash, bool successful))",
  "function getActionCount() view returns (uint256)",
  "function protocolFeeBps() view returns (uint256)",
  "function performanceFeeBps() view returns (uint256)",
  "function minDeposit() view returns (uint256)",
  "function depositsPaused() view returns (bool)",
  "function yieldEarned(address user) view returns (uint256)",
  "function totalYieldDistributed() view returns (uint256)",
  "function getVenusInfo() view returns (uint256 deployed, uint256 currentValue, uint256 pendingYield, uint256 allocationBps, bool enabled)",
  "function getStablecoinBalance(address user) view returns (uint256)",
];

const REGISTRY_ABI = [
  "function getAgent(uint256 agentId) view returns (tuple(string name, string agentURI, address operator, uint256 registeredAt, uint256 totalDecisions, uint256 successfulActions, uint256 totalValueProtected, uint8 status, uint8 tier))",
  "function getAgentCount() view returns (uint256)",
];

const LOGGER_ABI = [
  "function getDecisionCount() view returns (uint256)",
  "function getDecision(uint256 decisionId) view returns (tuple(uint256 agentId, address targetUser, uint8 decisionType, uint8 riskLevel, uint256 confidence, bytes32 analysisHash, bytes32 dataHash, uint256 timestamp, bool actionTaken, uint256 actionId))",
  "function getRecentDecisions(uint256 count) view returns (tuple(uint256 agentId, address targetUser, uint8 decisionType, uint8 riskLevel, uint256 confidence, bytes32 analysisHash, bytes32 dataHash, uint256 timestamp, bool actionTaken, uint256 actionId)[])",
  "function getLatestRisk(address user) view returns (tuple(uint256 timestamp, uint8 overallRisk, uint256 liquidationRisk, uint256 volatilityScore, uint256 protocolRisk, uint256 smartContractRisk, bytes32 detailsHash))",
  "function getStats() view returns (uint256 totalDecisions, uint256 totalThreats, uint256 totalProtections)",
];

const TOKEN_GATE_ABI = [
  "function getHolderTier(address user) view returns (uint8)",
  "function getFeeDiscount(address user) view returns (uint256)",
  "function getEffectiveFee(address user, uint256 baseFee) view returns (uint256)",
];

const ACTION_TYPES = ["Emergency Withdraw", "Rebalance", "Alert Only", "Stop Loss", "Take Profit"];
const DECISION_TYPES = ["Risk Assessment", "Threat Detected", "Protection Triggered", "All Clear", "Market Analysis", "Position Review"];
const RISK_LEVELS = ["None", "Low", "Medium", "High", "Critical"];
const TIER_NAMES = ["None", "Bronze", "Silver", "Gold"];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userAddress = searchParams.get("address");

  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const vault = new ethers.Contract(CONTRACTS.VAULT, VAULT_ABI, provider);
    const registry = new ethers.Contract(CONTRACTS.REGISTRY, REGISTRY_ABI, provider);
    const logger = new ethers.Contract(CONTRACTS.LOGGER, LOGGER_ABI, provider);
    const tokenGate = new ethers.Contract(CONTRACTS.TOKEN_GATE, TOKEN_GATE_ABI, provider);

    // 1. Global vault stats
    const [vaultStats, yieldStats, actionCount, agentCount, baseFee, minDep, paused, loggerStats, venusInfo] =
      await Promise.all([
        vault.getVaultStats().catch(() => [0n, 0n, 0n]),
        vault.getYieldStats().catch(() => [0n, 0n, 0n]),
        vault.getActionCount().catch(() => 0n),
        registry.getAgentCount().catch(() => 0n),
        vault.protocolFeeBps().catch(() => 50n),
        vault.minDeposit().catch(() => ethers.parseEther("0.001")),
        vault.depositsPaused().catch(() => false),
        logger.getStats().catch(() => [0n, 0n, 0n]),
        vault.getVenusInfo().catch(() => [0n, 0n, 0n, 0n, false]),
      ]);

    const globalStats = {
      totalBnbDeposited: ethers.formatEther(vaultStats[0]),
      totalActionsExecuted: Number(vaultStats[1]),
      totalValueProtected: ethers.formatEther(vaultStats[2]),
      totalActions: Number(actionCount),
      agentCount: Number(agentCount),
      protocolFeeBps: Number(baseFee),
      performanceFeeBps: Number(yieldStats[1]),
      minDepositBnb: ethers.formatEther(minDep),
      depositsPaused: paused,
      totalYieldDistributed: ethers.formatEther(yieldStats[0]),
      accumulatedPerformanceFees: ethers.formatEther(yieldStats[2]),
      totalDecisions: Number(loggerStats[0]),
      totalThreats: Number(loggerStats[1]),
      totalProtections: Number(loggerStats[2]),
      venus: {
        deployed: ethers.formatEther(venusInfo[0]),
        currentValue: ethers.formatEther(venusInfo[1]),
        pendingYield: ethers.formatEther(venusInfo[2]),
        allocationPct: Number(venusInfo[3]) / 100,
        enabled: venusInfo[4],
      },
    };

    // 2. User-specific data (if address provided)
    let userPosition = null;
    let userYield = null;
    const userActions: unknown[] = [];
    let userRisk = null;
    let userTier = null;
    let effectiveFee = Number(baseFee);

    if (userAddress && ethers.isAddress(userAddress)) {
      const [position, fee, actionIds, riskSnapshot, holderTier, feeDiscount, yieldInfo, stablecoinBal] =
        await Promise.all([
          vault.getPosition(userAddress).catch(() => null),
          vault.getEffectiveFee(userAddress).catch(() => baseFee),
          vault.getUserActions(userAddress).catch(() => []),
          logger.getLatestRisk(userAddress).catch(() => null),
          tokenGate.getHolderTier(userAddress).catch(() => 0),
          tokenGate.getFeeDiscount(userAddress).catch(() => 0n),
          vault.getYieldInfo(userAddress).catch(() => null),
          vault.getStablecoinBalance(userAddress).catch(() => 0n),
        ]);

      effectiveFee = Number(fee);

      if (position) {
        const depositTs = Number(position.depositTimestamp);
        const daysSinceDeposit = depositTs > 0
          ? (Date.now() / 1000 - depositTs) / 86400
          : 0;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const userPos: Record<string, any> = {
          bnbBalance: ethers.formatEther(position.bnbBalance),
          depositTimestamp: depositTs,
          lastActionTimestamp: Number(position.lastActionTimestamp),
          isActive: position.isActive,
          authorizedAgentId: Number(position.authorizedAgentId),
          agentAuthorized: position.agentAuthorized,
          riskProfile: {
            maxSlippage: Number(position.riskProfile.maxSlippage),
            stopLossThreshold: Number(position.riskProfile.stopLossThreshold),
            maxSingleActionValue: ethers.formatEther(position.riskProfile.maxSingleActionValue),
            allowAutoWithdraw: position.riskProfile.allowAutoWithdraw,
            allowAutoSwap: position.riskProfile.allowAutoSwap,
          },
          stablecoinBalance: ethers.formatEther(stablecoinBal),
        };
        userPosition = userPos;

        // Real yield data from contract
        if (yieldInfo) {
          userYield = {
            grossYieldEarned: ethers.formatEther(yieldInfo.grossYieldEarned),
            netYieldEarned: ethers.formatEther(yieldInfo.netYieldEarned),
            pendingInPosition: ethers.formatEther(yieldInfo.pendingInPosition),
            performanceFeeBps: Number(yieldInfo.effectivePerformanceFeeBps),
            performanceFeePct: (Number(yieldInfo.effectivePerformanceFeeBps) / 100).toFixed(1),
            daysSinceDeposit: Math.floor(daysSinceDeposit),
            strategy: "Venus Lending + PancakeSwap LP",
          };
        }

        // Authorized agent info
        if (position.agentAuthorized) {
          try {
            const agent = await registry.getAgent(position.authorizedAgentId);
            userPosition!.agentName = agent.name;
            userPosition!.agentTier = ["Scout", "Guardian", "Sentinel", "Archon"][agent.tier] || "Unknown";
            userPosition!.agentSuccessRate = Number(agent.totalDecisions) > 0
              ? ((Number(agent.successfulActions) / Number(agent.totalDecisions)) * 100).toFixed(1)
              : "N/A";
          } catch { /* agent not found */ }
        }
      }

      // User action history (last 20)
      const actionIdsList: bigint[] = Array.isArray(actionIds) ? actionIds : [];
      const recentIds = actionIdsList.slice(-20).reverse();
      for (const id of recentIds) {
        try {
          const action = await vault.getAction(id);
          userActions.push({
            id: Number(id),
            agentId: Number(action.agentId),
            actionType: ACTION_TYPES[Number(action.actionType)] || "Unknown",
            value: ethers.formatEther(action.value),
            timestamp: Number(action.timestamp),
            reasonHash: action.reasonHash,
            successful: action.successful,
          });
        } catch { /* skip */ }
      }

      // Risk snapshot
      if (riskSnapshot && Number(riskSnapshot.timestamp) > 0) {
        userRisk = {
          timestamp: Number(riskSnapshot.timestamp),
          overallRisk: RISK_LEVELS[Number(riskSnapshot.overallRisk)] || "Unknown",
          liquidationRisk: Number(riskSnapshot.liquidationRisk) / 100,
          volatilityScore: Number(riskSnapshot.volatilityScore) / 100,
          protocolRisk: Number(riskSnapshot.protocolRisk) / 100,
          smartContractRisk: Number(riskSnapshot.smartContractRisk) / 100,
        };
      }

      // Tier info
      userTier = {
        tier: Number(holderTier),
        tierName: TIER_NAMES[Number(holderTier)] || "None",
        feeDiscountBps: Number(feeDiscount),
        effectiveFeeBps: effectiveFee,
      };
    }

    // 3. Recent global decisions (last 10)
    const recentDecisions: unknown[] = [];
    try {
      const decCount = Number(await logger.getDecisionCount());
      const startIdx = Math.max(0, decCount - 10);
      for (let i = decCount - 1; i >= startIdx; i--) {
        const d = await logger.getDecision(i);
        recentDecisions.push({
          id: i,
          agentId: Number(d.agentId),
          decisionType: DECISION_TYPES[Number(d.decisionType)] || "Unknown",
          riskLevel: RISK_LEVELS[Number(d.riskLevel)] || "Unknown",
          confidence: (Number(d.confidence) / 100).toFixed(1),
          timestamp: Number(d.timestamp),
          actionTaken: d.actionTaken,
        });
      }
    } catch { /* logger may be empty */ }

    return NextResponse.json({
      global: globalStats,
      position: userPosition,
      yield: userYield,
      actions: userActions,
      risk: userRisk,
      tier: userTier,
      decisions: recentDecisions,
      effectiveFee,
      timestamp: Date.now(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Vault API failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════
// Aegis Protocol — Comprehensive On-Chain Demo
// Creates 15+ diverse transactions on BSC Testnet
// Demonstrates: Agent lifecycle, vault operations, AI decisions,
//               risk profiles, threat scenarios, protection actions
// ═══════════════════════════════════════════════════════════════

import { ethers } from "ethers";
import * as dotenv from "dotenv";
import * as fs from "fs";

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY!;
const RPC = "https://data-seed-prebsc-1-s1.binance.org:8545";

// Read deployment addresses
const deployment = JSON.parse(fs.readFileSync("deployment.json", "utf8"));
const REGISTRY = deployment.contracts.AegisRegistry;
const VAULT = deployment.contracts.AegisVault;
const LOGGER = deployment.contracts.DecisionLogger;

// Full ABIs
const REGISTRY_ABI = [
  "function getAgentCount() view returns (uint256)",
  "function getAgent(uint256 tokenId) view returns (tuple(string name, address operator, uint8 tier, uint8 status, uint256 totalDecisions, uint256 successfulActions, uint256 totalValueProtected, uint256 registeredAt))",
  "function getReputationScore(uint256 tokenId) view returns (uint256)",
  "function getSuccessRate(uint256 tokenId) view returns (uint256)",
  "function giveFeedback(uint256 tokenId, uint8 score, string comment) external",
];

const VAULT_ABI = [
  "function deposit() external payable",
  "function authorizeAgent(uint256 agentId) external",
  "function updateRiskProfile(uint256 maxSlippage, uint256 stopLossThreshold, uint256 maxSingleActionValue, bool allowAutoWithdraw, bool allowAutoSwap) external",
  "function getPosition(address user) view returns (tuple(uint256 bnbBalance, bool isActive, bool agentAuthorized, uint256 authorizedAgentId, uint256 depositTimestamp, tuple(uint256 maxSlippage, uint256 stopLossThreshold, uint256 maxSingleActionValue, bool allowAutoWithdraw, bool allowAutoSwap) riskProfile))",
  "function getVaultStats() view returns (uint256, uint256, uint256)",
];

const LOGGER_ABI = [
  "function logDecision(uint256 agentId, address targetUser, uint8 decisionType, uint8 riskLevel, uint256 confidence, bytes32 analysisHash, bytes32 dataHash, bool actionTaken, uint256 actionId) external returns (uint256)",
  "function updateRiskSnapshot(address user, uint8 overallRisk, uint256 liquidationRisk, uint256 volatilityScore, uint256 protocolRisk, uint256 smartContractRisk, bytes32 detailsHash) external",
  "function getStats() view returns (uint256 totalDecisions, uint256 totalThreats, uint256 totalProtections)",
  "function getRecentDecisions(uint256 count) view returns (tuple(uint256 agentId, address targetUser, uint8 decisionType, uint8 riskLevel, uint256 confidence, uint256 timestamp, bool actionTaken)[] memory)",
];

async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║   AEGIS PROTOCOL — COMPREHENSIVE ON-CHAIN DEMO               ║
║   15+ Transactions on BSC Testnet                             ║
╚═══════════════════════════════════════════════════════════════╝
`);

  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const registry = new ethers.Contract(REGISTRY, REGISTRY_ABI, wallet);
  const vault = new ethers.Contract(VAULT, VAULT_ABI, wallet);
  const logger = new ethers.Contract(LOGGER, LOGGER_ABI, wallet);

  const balance = await provider.getBalance(wallet.address);
  console.log(`Wallet: ${wallet.address}`);
  console.log(`Balance: ${ethers.formatEther(balance)} tBNB`);
  console.log(`Registry: ${REGISTRY}`);
  console.log(`Vault: ${VAULT}`);
  console.log(`Logger: ${LOGGER}`);
  console.log("");

  const txLog: { action: string; hash: string; status: string }[] = [];

  async function logTx(action: string, txPromise: Promise<ethers.ContractTransactionResponse>) {
    try {
      const tx = await txPromise;
      const receipt = await tx.wait();
      const hash = receipt!.hash;
      console.log(`  ✅ ${action}: ${hash}`);
      txLog.push({ action, hash, status: "confirmed" });
      return receipt;
    } catch (err: any) {
      console.log(`  ❌ ${action}: ${err.message.slice(0, 80)}`);
      txLog.push({ action, hash: "failed", status: err.message.slice(0, 50) });
      return null;
    }
  }

  // ═══ PHASE 1: Verify Agent Registration ═══
  console.log("═══ PHASE 1: Agent Verification ═══");
  const agentCount = await registry.getAgentCount();
  console.log(`  Registered agents: ${agentCount}`);
  if (Number(agentCount) > 0) {
    const agent = await registry.getAgent(0);
    console.log(`  Agent #0: "${agent.name}" | Tier: ${["Scout","Guardian","Sentinel","Archon"][agent.tier]} | Status: Active`);
  }

  // ═══ PHASE 2: Vault Deposit ═══
  console.log("\n═══ PHASE 2: Vault Operations ═══");
  await logTx("Deposit 0.005 tBNB", vault.deposit({ value: ethers.parseEther("0.005") }));

  // ═══ PHASE 3: Update Risk Profile (Conservative) ═══
  console.log("\n═══ PHASE 3: Risk Profile — Conservative ═══");
  await logTx("Risk Profile (Conservative: 0.5% slip, 10% SL)",
    vault.updateRiskProfile(
      50,   // 0.5% max slippage
      1000, // 10% stop-loss
      ethers.parseEther("1"),
      true,  // allow auto-withdraw
      false  // no auto-swap
    )
  );

  // ═══ PHASE 4: AI Market Analysis — Normal Conditions ═══
  console.log("\n═══ PHASE 4: AI Decision — Market Analysis (Normal) ═══");
  const analysisHash1 = ethers.keccak256(ethers.toUtf8Bytes(
    "BNB trading at $612.50 with +1.8% 24h movement. Volume at $780M (+15% change). BSC ecosystem liquidity at $4.2B. All risk vectors within normal parameters. No significant threats detected."
  ));
  const dataHash1 = ethers.keccak256(ethers.toUtf8Bytes(
    JSON.stringify({ price: 612.50, change24h: 1.8, volume: 780000000, liquidity: 4200000000, source: "CoinGecko+DeFiLlama+PancakeSwap" })
  ));
  await logTx("AI Decision: Market Analysis (All Clear)",
    logger.logDecision(0, wallet.address, 4, 0, 9200, analysisHash1, dataHash1, false, 0)
  );

  // ═══ PHASE 5: Risk Snapshot Update ═══
  console.log("\n═══ PHASE 5: Risk Snapshot — Low Risk ═══");
  const snapshotHash1 = ethers.keccak256(ethers.toUtf8Bytes("Low risk snapshot - normal market conditions"));
  await logTx("Risk Snapshot (overall=LOW, liq=8, vol=22, proto=5, sc=12)",
    logger.updateRiskSnapshot(wallet.address, 1, 800, 2200, 500, 1200, snapshotHash1)
  );

  // ═══ PHASE 6: AI Detects Volatility Increase ═══
  console.log("\n═══ PHASE 6: AI Decision — Volatility Warning ═══");
  const analysisHash2 = ethers.keccak256(ethers.toUtf8Bytes(
    "BNB price declined -4.2% in past 6 hours with volume spike of +180%. Analyzing PancakeSwap order flow shows increased sell pressure. Liquidity stable but monitoring for cascading risk. Sentiment shifting bearish. Increasing monitoring frequency."
  ));
  const dataHash2 = ethers.keccak256(ethers.toUtf8Bytes(
    JSON.stringify({ price: 587.30, change24h: -4.2, volume: 1400000000, volumeChange: 180, liquidityChange: -2.1 })
  ));
  await logTx("AI Decision: Volatility Warning (Low Risk)",
    logger.logDecision(0, wallet.address, 0, 1, 7800, analysisHash2, dataHash2, false, 0)
  );

  // ═══ PHASE 7: Update Risk Snapshot — Elevated ═══
  console.log("\n═══ PHASE 7: Risk Snapshot — Elevated ═══");
  const snapshotHash2 = ethers.keccak256(ethers.toUtf8Bytes("Elevated risk snapshot - volatility increase detected"));
  await logTx("Risk Snapshot (overall=MEDIUM, liq=22, vol=55, proto=12, sc=15)",
    logger.updateRiskSnapshot(wallet.address, 2, 2200, 5500, 1200, 1500, snapshotHash2)
  );

  // ═══ PHASE 8: AI Detects Threat — Abnormal Volume ═══
  console.log("\n═══ PHASE 8: AI Decision — Threat Detected ═══");
  const analysisHash3 = ethers.keccak256(ethers.toUtf8Bytes(
    "ALERT: Abnormal volume spike of +350% detected on BNB/BUSD pair. PancakeSwap reserves show 12% decrease in past 2 hours. Cross-referencing with whale wallet tracker: 3 large wallets moved >$5M each. Pattern consistent with coordinated selling. Risk elevated to HIGH. Recommend stop-loss evaluation."
  ));
  const dataHash3 = ethers.keccak256(ethers.toUtf8Bytes(
    JSON.stringify({ price: 561.20, change24h: -8.7, volume: 2800000000, volumeChange: 350, whaleMovements: 3, liquidityDrain: -12 })
  ));
  await logTx("AI Decision: Threat Detected (High Risk, 88% confidence)",
    logger.logDecision(0, wallet.address, 1, 3, 8800, analysisHash3, dataHash3, false, 0)
  );

  // ═══ PHASE 9: Risk Profile — Switch to Aggressive Defense ═══
  console.log("\n═══ PHASE 9: Risk Profile — Aggressive Defense ═══");
  await logTx("Risk Profile (Aggressive: 0.3% slip, 5% SL, auto-withdraw ON)",
    vault.updateRiskProfile(
      30,    // 0.3% max slippage (tighter)
      500,   // 5% stop-loss (tighter)
      ethers.parseEther("0.5"),
      true,  // allow auto-withdraw
      true   // allow auto-swap
    )
  );

  // ═══ PHASE 10: Risk Snapshot — High Risk ═══
  console.log("\n═══ PHASE 10: Risk Snapshot — High ═══");
  const snapshotHash3 = ethers.keccak256(ethers.toUtf8Bytes("High risk snapshot - threat confirmed, protection imminent"));
  await logTx("Risk Snapshot (overall=HIGH, liq=52, vol=78, proto=35, sc=20)",
    logger.updateRiskSnapshot(wallet.address, 3, 5200, 7800, 3500, 2000, snapshotHash3)
  );

  // ═══ PHASE 11: AI Protection Triggered ═══
  console.log("\n═══ PHASE 11: AI Decision — Protection Triggered ═══");
  const analysisHash4 = ethers.keccak256(ethers.toUtf8Bytes(
    "CRITICAL: Stop-loss threshold breached. BNB dropped -15.3% with accelerating sell volume. PancakeSwap liquidity down 28% from baseline. LLM analysis confidence: 95%. Executing emergency position reduction. On-chain reasoning hash attested for audit trail. User risk profile allows auto-withdraw. Triggering protection action."
  ));
  const dataHash4 = ethers.keccak256(ethers.toUtf8Bytes(
    JSON.stringify({ price: 519.80, change24h: -15.3, volume: 4200000000, liquidityChange: -28, stopLossBreached: true, action: "STOP_LOSS" })
  ));
  await logTx("AI Decision: Protection Triggered (Critical, 95% confidence, ACTION TAKEN)",
    logger.logDecision(0, wallet.address, 2, 4, 9500, analysisHash4, dataHash4, true, 1)
  );

  // ═══ PHASE 12: Market Recovery — All Clear ═══
  console.log("\n═══ PHASE 12: AI Decision — Recovery Detected ═══");
  const analysisHash5 = ethers.keccak256(ethers.toUtf8Bytes(
    "Market stabilizing. BNB recovered to $598.40 (+8.2% from local bottom). Volume normalizing. PancakeSwap liquidity inflows detected. Whale selling pressure subsided. Downgrading risk from CRITICAL to LOW. Previous protection action saved estimated 12% of position value. Resuming standard monitoring interval."
  ));
  const dataHash5 = ethers.keccak256(ethers.toUtf8Bytes(
    JSON.stringify({ price: 598.40, change24h: 2.1, volume: 900000000, liquidityChange: 5.2, recoveryDetected: true })
  ));
  await logTx("AI Decision: All Clear — Recovery (Low, 91% confidence)",
    logger.logDecision(0, wallet.address, 3, 1, 9100, analysisHash5, dataHash5, false, 0)
  );

  // ═══ PHASE 13: Risk Snapshot — Normalized ═══
  console.log("\n═══ PHASE 13: Risk Snapshot — Normalized ═══");
  const snapshotHash4 = ethers.keccak256(ethers.toUtf8Bytes("Normalized risk snapshot - market recovered, resuming standard monitoring"));
  await logTx("Risk Snapshot (overall=LOW, liq=10, vol=28, proto=8, sc=12)",
    logger.updateRiskSnapshot(wallet.address, 1, 1000, 2800, 800, 1200, snapshotHash4)
  );

  // ═══ PHASE 14: Position Review ═══
  console.log("\n═══ PHASE 14: AI Decision — Position Review ═══");
  const analysisHash6 = ethers.keccak256(ethers.toUtf8Bytes(
    "Position review complete. User deposit active with authorized guardian agent #0. Risk profile: 0.3% slippage, 5% stop-loss. Auto-withdraw and auto-swap enabled. Position health: GOOD. No pending threats. Next review in 30 seconds."
  ));
  const dataHash6 = ethers.keccak256(ethers.toUtf8Bytes(
    JSON.stringify({ positionActive: true, agentAuthorized: true, riskProfile: "aggressive", health: "good" })
  ));
  await logTx("AI Decision: Position Review (None, 98% confidence)",
    logger.logDecision(0, wallet.address, 5, 0, 9800, analysisHash6, dataHash6, false, 0)
  );

  // ═══ PHASE 15: Final Summary Log ═══
  console.log("\n═══ PHASE 15: Final — Agent Performance Summary ═══");
  const analysisHash7 = ethers.keccak256(ethers.toUtf8Bytes(
    "Agent performance review: 13 cycles completed. Threat detection accuracy: 95%+. Protection actions: saved estimated 12% of position value during market crash. Oracle cross-verification: 0 manipulation attempts detected. Agent uptime: 100%. Rating: Excellent."
  ));
  const dataHash7 = ethers.keccak256(ethers.toUtf8Bytes(
    JSON.stringify({ cycles: 13, accuracy: 95, saved: 12, manipulations: 0, uptime: 100, rating: "excellent" })
  ));
  await logTx("AI Decision: Agent Performance Summary (Excellent, 99% confidence)",
    logger.logDecision(0, wallet.address, 5, 0, 9900, analysisHash7, dataHash7, false, 0)
  );

  // ═══ SUMMARY ═══
  console.log(`\n${"═".repeat(65)}`);
  console.log("  COMPREHENSIVE DEMO COMPLETE");
  console.log(`${"═".repeat(65)}`);
  console.log(`\n  Successful transactions: ${txLog.filter(t => t.status === "confirmed").length}`);
  console.log(`  Failed transactions: ${txLog.filter(t => t.status !== "confirmed").length}`);

  // Read final on-chain state
  const stats = await logger.getStats();
  console.log(`\n  On-Chain State:`);
  console.log(`    Total Decisions: ${stats[0]}`);
  console.log(`    Total Threats: ${stats[1]}`);
  console.log(`    Total Protections: ${stats[2]}`);

  const position = await vault.getPosition(wallet.address);
  console.log(`    Vault Balance: ${ethers.formatEther(position.bnbBalance)} tBNB`);
  console.log(`    Agent Authorized: ${position.agentAuthorized}`);

  const reputation = await registry.getReputationScore(0);
  console.log(`    Agent Reputation: ${Number(reputation) / 100}/5`);

  const finalBalance = await provider.getBalance(wallet.address);
  console.log(`\n  Wallet Balance: ${ethers.formatEther(finalBalance)} tBNB`);

  // Print TX table for README
  console.log(`\n  Transaction Log:`);
  console.log(`  | # | Action | TX Hash |`);
  console.log(`  |---|--------|---------|`);
  txLog.filter(t => t.status === "confirmed").forEach((tx, i) => {
    console.log(`  | ${i + 1} | ${tx.action} | ${tx.hash.slice(0, 14)}... |`);
  });
}

main().catch(console.error);

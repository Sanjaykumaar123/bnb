/**
 * Aegis Protocol - On-Chain Demo Interactions
 * Runs real transactions on BSC Testnet to create verifiable on-chain proof
 */
import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("═".repeat(60));
  console.log("  AEGIS PROTOCOL — ON-CHAIN DEMO");
  console.log("═".repeat(60));
  console.log(`  Wallet:  ${deployer.address}`);
  console.log(`  Balance: ${ethers.formatEther(balance)} tBNB`);

  // Load deployment addresses
  const fs = await import("fs");
  const deployment = JSON.parse(fs.readFileSync("deployment.json", "utf-8"));
  const registryAddr = deployment.contracts.AegisRegistry;
  const vaultAddr = deployment.contracts.AegisVault;
  const loggerAddr = deployment.contracts.DecisionLogger;

  console.log(`\n  Registry: ${registryAddr}`);
  console.log(`  Vault:    ${vaultAddr}`);
  console.log(`  Logger:   ${loggerAddr}`);

  // Attach to contracts
  const registry = await ethers.getContractAt("AegisRegistry", registryAddr);
  const vault = await ethers.getContractAt("AegisVault", vaultAddr);
  const logger = await ethers.getContractAt("DecisionLogger", loggerAddr);

  // ─── Phase 1: Verify Agent Registration ───────────────────
  console.log("\n─────────────────────────────────────────────────────────");
  console.log("  Phase 1: Verify Agent Registration");
  console.log("─────────────────────────────────────────────────────────");

  const agentCount = await registry.getAgentCount();
  console.log(`  Total agents registered: ${agentCount}`);

  const agent = await registry.getAgent(0);
  console.log(`  Agent #0: "${agent.name}"`);
  console.log(`  Owner:    ${agent.owner}`);
  console.log(`  Tier:     ${["Scout", "Guardian", "Sentinel", "Archon"][Number(agent.tier)]}`);
  console.log(`  Status:   ${["Active", "Paused", "Decommissioned"][Number(agent.status)]}`);

  // ─── Phase 2: Deposit into Vault ──────────────────────────
  console.log("\n─────────────────────────────────────────────────────────");
  console.log("  Phase 2: Deposit into AegisVault");
  console.log("─────────────────────────────────────────────────────────");

  const depositAmount = ethers.parseEther("0.01");
  console.log(`  Depositing ${ethers.formatEther(depositAmount)} tBNB...`);

  const tx1 = await vault.deposit({ value: depositAmount });
  const receipt1 = await tx1.wait();
  console.log(`  ✓ Deposit TX: ${receipt1?.hash}`);
  console.log(`  ✓ Gas used:   ${receipt1?.gasUsed}`);

  const vaultBalance = await ethers.provider.getBalance(vaultAddr);
  console.log(`  Vault balance: ${ethers.formatEther(vaultBalance)} tBNB`);

  // ─── Phase 3: Authorize Agent for Vault Operations ────────
  console.log("\n─────────────────────────────────────────────────────────");
  console.log("  Phase 3: Authorize Agent for Vault");
  console.log("─────────────────────────────────────────────────────────");

  const tx2 = await vault.authorizeAgent(0);
  const receipt2 = await tx2.wait();
  console.log(`  ✓ Agent #0 authorized. TX: ${receipt2?.hash}`);

  // ─── Phase 4: Update Risk Profile ─────────────────────────
  console.log("\n─────────────────────────────────────────────────────────");
  console.log("  Phase 4: Update Risk Profile");
  console.log("─────────────────────────────────────────────────────────");

  // updateRiskProfile(maxSlippage, stopLossThreshold, maxSingleActionValue, allowAutoWithdraw, allowAutoSwap)
  const tx3 = await vault.updateRiskProfile(100, 1500, ethers.parseEther("0.005"), true, false);
  const receipt3 = await tx3.wait();
  console.log(`  ✓ Risk profile updated. TX: ${receipt3?.hash}`);
  console.log(`  Max slippage:       1%`);
  console.log(`  Stop-loss thresh:   15%`);
  console.log(`  Max action value:   0.005 tBNB`);
  console.log(`  Auto withdraw:      enabled`);
  console.log(`  Auto swap:          disabled`);

  // ─── Phase 5: Log AI Decision ─────────────────────────────
  console.log("\n─────────────────────────────────────────────────────────");
  console.log("  Phase 5: Log AI Agent Decision");
  console.log("─────────────────────────────────────────────────────────");

  const analysisHash1 = ethers.keccak256(ethers.toUtf8Bytes("BNB price drop detected: -8.2% in 4h. Market volatility HIGH. Suggesting rebalance."));
  const dataHash1 = ethers.keccak256(ethers.toUtf8Bytes("coingecko:bnb:price:580.42:vol24h:1.2B"));

  const tx4 = await logger.logDecision(
    0, // agentId
    deployer.address, // targetUser
    1, // decisionType: ThreatDetected
    3, // riskLevel: High
    8500, // confidence: 85.00%
    analysisHash1, // analysisHash
    dataHash1, // dataHash
    false, // actionTaken
    0 // actionId
  );
  const receipt4 = await tx4.wait();
  console.log(`  ✓ Decision logged. TX: ${receipt4?.hash}`);
  console.log(`  Decision type: ThreatDetected`);
  console.log(`  Risk level:    High`);
  console.log(`  Confidence:    85.00%`);

  // ─── Phase 6: Log Another Decision (Protection Triggered) ─
  console.log("\n─────────────────────────────────────────────────────────");
  console.log("  Phase 6: Log Protection Decision");
  console.log("─────────────────────────────────────────────────────────");

  const analysisHash2 = ethers.keccak256(ethers.toUtf8Bytes("CRITICAL: Smart contract vulnerability detected. Initiating emergency withdrawal."));
  const dataHash2 = ethers.keccak256(ethers.toUtf8Bytes("defillama:bsc:tvl:4.8B:change:-12%"));

  const tx5 = await logger.logDecision(
    0,
    deployer.address,
    2, // ProtectionTriggered
    4, // Critical
    9700, // 97.00% confidence
    analysisHash2,
    dataHash2,
    true, // action was taken
    0
  );
  const receipt5 = await tx5.wait();
  console.log(`  ✓ Protection decision logged. TX: ${receipt5?.hash}`);
  console.log(`  Decision type: ProtectionTriggered`);
  console.log(`  Risk level:    CRITICAL`);
  console.log(`  Confidence:    97.00%`);

  // ─── Phase 7: Read On-Chain State ─────────────────────────
  console.log("\n─────────────────────────────────────────────────────────");
  console.log("  Phase 7: Verify On-Chain State");
  console.log("─────────────────────────────────────────────────────────");

  const decisionCount = await logger.getDecisionCount();
  console.log(`  Total decisions logged: ${decisionCount}`);

  const decision0 = await logger.getDecision(0);
  console.log(`  Decision #0:`);
  console.log(`    Agent ID:    ${decision0.agentId}`);
  console.log(`    Type:        ${["RiskAssessment", "ThreatDetected", "ProtectionTriggered", "AllClear", "MarketAnalysis", "PositionReview"][Number(decision0.decisionType)]}`);
  console.log(`    Risk:        ${["None", "Low", "Medium", "High", "Critical"][Number(decision0.riskLevel)]}`);
  console.log(`    Confidence:  ${Number(decision0.confidence) / 100}%`);
  console.log(`    Action taken: ${decision0.actionTaken}`);
  console.log(`    Timestamp:   ${new Date(Number(decision0.timestamp) * 1000).toISOString()}`);

  const position = await vault.positions(deployer.address);
  console.log(`\n  User deposit: ${ethers.formatEther(position.bnbBalance)} tBNB`);
  console.log(`  Agent authorized: ${position.agentAuthorized}`);
  console.log(`  Agent ID: ${position.authorizedAgentId}`);

  const finalBalance = await ethers.provider.getBalance(deployer.address);
  console.log(`  Final wallet balance: ${ethers.formatEther(finalBalance)} tBNB`);

  // ─── Summary ──────────────────────────────────────────────
  console.log("\n" + "═".repeat(60));
  console.log("  ON-CHAIN DEMO COMPLETE — ALL TRANSACTIONS VERIFIED");
  console.log("═".repeat(60));
  console.log("\n  BSCScan Links:");
  console.log(`  Registry:  https://testnet.bscscan.com/address/${registryAddr}`);
  console.log(`  Vault:     https://testnet.bscscan.com/address/${vaultAddr}`);
  console.log(`  Logger:    https://testnet.bscscan.com/address/${loggerAddr}`);
  console.log(`  Deployer:  https://testnet.bscscan.com/address/${deployer.address}`);
  console.log("\n  Transaction Hashes:");
  console.log(`  Deposit:   ${receipt1?.hash}`);
  console.log(`  AuthAgent: ${receipt2?.hash}`);
  console.log(`  RiskProf:  ${receipt3?.hash}`);
  console.log(`  Decision1: ${receipt4?.hash}`);
  console.log(`  Decision2: ${receipt5?.hash}`);
  console.log("═".repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

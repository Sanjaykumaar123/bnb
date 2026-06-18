import { ethers } from "hardhat";

async function main() {
  // ─── Safety Check ─────────────────────────────────────────
  const network = await ethers.provider.getNetwork();
  if (Number(network.chainId) !== 56) {
    throw new Error(`Expected BSC Mainnet (chainId 56), got chainId ${network.chainId}. Aborting.`);
  }

  const [deployer] = await ethers.getSigners();
  const operatorAddress = process.env.AGENT_OPERATOR_ADDRESS || deployer.address;
  const scannerOperatorAddress = process.env.SCANNER_OPERATOR_ADDRESS || operatorAddress;
  if (!ethers.isAddress(operatorAddress)) {
    throw new Error(`Invalid AGENT_OPERATOR_ADDRESS: ${operatorAddress}`);
  }
  if (!ethers.isAddress(scannerOperatorAddress)) {
    throw new Error(`Invalid SCANNER_OPERATOR_ADDRESS: ${scannerOperatorAddress}`);
  }

  console.log("═".repeat(60));
  console.log("  AEGIS PROTOCOL — BSC MAINNET DEPLOYMENT");
  console.log("═".repeat(60));
  console.log("  Deployer:", deployer.address);
  console.log("  Operator:", operatorAddress);
  console.log("  Scanner Operator:", scannerOperatorAddress);
  console.log("  Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "BNB");
  console.log("  Chain ID:", Number(network.chainId));
  console.log("═".repeat(60));

  // ─── Real Protocol Addresses (BSC Mainnet) ────────────────
  const VENUS_VBNB = "0xA07c5b74C9B40447a954e1466938b865b6BBea36";
  const USDT_ADDRESS = "0x55d398326f99059fF775485246999027B3197955";
  const PANCAKE_ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
  const UNIQ_TOKEN = "0xdd5f3e8c2cfc8444fac46744d0a4a85df03d7777";

  // ─── Deploy AegisRegistry ─────────────────────────────────
  const registrationFee = ethers.parseEther("0.01"); // 0.01 BNB on mainnet
  const maxAgents = 10000;

  console.log("\n1. Deploying AegisRegistry...");
  const Registry = await ethers.getContractFactory("AegisRegistry");
  const registry = await Registry.deploy(registrationFee, maxAgents);
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("   AegisRegistry:", registryAddress);

  // ─── Deploy AegisVault ────────────────────────────────────
  const protocolFeeBps = 50; // 0.5%
  const minDeposit = ethers.parseEther("0.01"); // 0.01 BNB on mainnet
  const performanceFeeBps = 1500; // 15% of yield

  console.log("\n2. Deploying AegisVault...");
  const Vault = await ethers.getContractFactory("AegisVault");
  const vault = await Vault.deploy(registryAddress, protocolFeeBps, minDeposit, performanceFeeBps);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("   AegisVault:", vaultAddress);

  // ─── Deploy DecisionLogger ────────────────────────────────
  console.log("\n3. Deploying DecisionLogger...");
  const Logger = await ethers.getContractFactory("DecisionLogger");
  const logger = await Logger.deploy();
  await logger.waitForDeployment();
  const loggerAddress = await logger.getAddress();
  console.log("   DecisionLogger:", loggerAddress);

  // ─── Deploy AegisTokenGate ────────────────────────────────
  console.log("\n4. Deploying AegisTokenGate...");
  const Gate = await ethers.getContractFactory("AegisTokenGate");
  const gate = await Gate.deploy(UNIQ_TOKEN);
  await gate.waitForDeployment();
  const tokenGateAddress = await gate.getAddress();
  console.log("   AegisTokenGate:", tokenGateAddress);

  // ─── Deploy AegisScanner ──────────────────────────────────
  console.log("\n5. Deploying AegisScanner...");
  const Scanner = await ethers.getContractFactory("AegisScanner");
  const scanner = await Scanner.deploy();
  await scanner.waitForDeployment();
  const scannerAddress = await scanner.getAddress();
  console.log("   AegisScanner:", scannerAddress);

  // ─── Configure Permissions ────────────────────────────────
  console.log("\n6. Configuring permissions...");

  const tx1 = await registry.setVaultAuthorization(vaultAddress, true);
  await tx1.wait();
  console.log("   ✓ Vault authorized in Registry");

  const tx2 = await vault.setOperatorAuthorization(operatorAddress, true);
  await tx2.wait();
  console.log("   ✓ Runtime operator authorized in Vault");

  const tx3 = await logger.setLoggerAuthorization(operatorAddress, true);
  await tx3.wait();
  console.log("   ✓ Runtime operator authorized in DecisionLogger");

  const tx4a = await vault.setTokenGate(tokenGateAddress);
  await tx4a.wait();
  console.log("   ✓ TokenGate wired into Vault");

  const tx4b = await registry.setTokenGate(tokenGateAddress);
  await tx4b.wait();
  console.log("   ✓ TokenGate wired into Registry");

  const tx5 = await scanner.setScannerAuthorization(scannerOperatorAddress, true);
  await tx5.wait();
  console.log("   ✓ Scanner operator authorized");

  // ─── Configure Venus Protocol (Real Mainnet) ──────────────
  console.log("\n7. Configuring Venus Protocol (Mainnet)...");

  const txVenus = await vault.setVenusConfig(VENUS_VBNB, PANCAKE_ROUTER, USDT_ADDRESS);
  await txVenus.wait();
  console.log("   ✓ Venus config: vBNB", VENUS_VBNB);
  console.log("   ✓ PancakeSwap Router:", PANCAKE_ROUTER);
  console.log("   ✓ Stablecoin (USDT):", USDT_ADDRESS);

  const txAlloc = await vault.setVenusAllocationBps(8000); // 80% to Venus
  await txAlloc.wait();
  console.log("   ✓ Venus allocation: 80%");

  const txEnable = await vault.setVenusEnabled(true);
  await txEnable.wait();
  console.log("   ✓ Venus enabled");

  // Approve PancakeSwap Router for USDT (from within the vault)
  const txApprove = await vault.approveRouterStablecoin();
  await txApprove.wait();
  console.log("   ✓ Vault approved USDT for PancakeSwap Router");

  // ─── Register Initial Agent ───────────────────────────────
  console.log("\n8. Registering initial agent...");
  const txAgent = await registry.registerAgent(
    "Aegis Guardian Alpha",
    "https://aegis-protocol.io/agent/alpha",
    3, // Archon tier
    { value: registrationFee }
  );
  await txAgent.wait();
  console.log("   ✓ Agent 'Aegis Guardian Alpha' registered (ID: 0)");

  // ─── Finalize Setup (locks instant operator auth) ─────────
  console.log("\n9. Finalizing setup (enabling operator timelock)...");
  const txFinalize = await vault.finalizeSetup();
  await txFinalize.wait();
  console.log("   ✓ Setup finalized — operator changes now require 48h timelock");

  // ─── Summary ──────────────────────────────────────────────
  console.log("\n" + "═".repeat(60));
  console.log("  BSC MAINNET DEPLOYMENT COMPLETE");
  console.log("═".repeat(60));
  console.log(`  Network:          BSC Mainnet`);
  console.log(`  Chain ID:         56`);
  console.log(`  Deployer:         ${deployer.address}`);
  console.log(`  Operator:         ${operatorAddress}`);
  console.log(`  Scanner Operator: ${scannerOperatorAddress}`);
  console.log(`  AegisRegistry:    ${registryAddress}`);
  console.log(`  AegisVault:       ${vaultAddress}`);
  console.log(`  DecisionLogger:   ${loggerAddress}`);
  console.log(`  AegisTokenGate:   ${tokenGateAddress}`);
  console.log(`  AegisScanner:     ${scannerAddress}`);
  console.log(`  Venus vBNB:       ${VENUS_VBNB}`);
  console.log(`  USDT:             ${USDT_ADDRESS}`);
  console.log(`  PancakeSwap:      ${PANCAKE_ROUTER}`);
  console.log(`  $UNIQ Token:      ${UNIQ_TOKEN}`);
  console.log("═".repeat(60));

  // ─── Save Deployment ──────────────────────────────────────
  const fs = await import("fs");
  const deploymentData = {
    network: "bscMainnet",
    chainId: 56,
    deployedAt: new Date().toISOString(),
    contracts: {
      AegisRegistry: registryAddress,
      AegisVault: vaultAddress,
      DecisionLogger: loggerAddress,
      AegisTokenGate: tokenGateAddress,
      AegisScanner: scannerAddress,
    },
    operators: {
      deployer: deployer.address,
      agentOperator: operatorAddress,
      scannerOperator: scannerOperatorAddress,
    },
    externalProtocols: {
      VenusVBNB: VENUS_VBNB,
      USDT: USDT_ADDRESS,
      PancakeSwapRouter: PANCAKE_ROUTER,
      UNIQ: UNIQ_TOKEN,
    },
    configuration: {
      registrationFee: ethers.formatEther(registrationFee),
      maxAgents,
      protocolFeeBps,
      performanceFeeBps,
      minDeposit: ethers.formatEther(minDeposit),
      venusAllocationBps: 8000,
    },
  };

  fs.writeFileSync("deployment-mainnet.json", JSON.stringify(deploymentData, null, 2));
  console.log("\n  Saved to deployment-mainnet.json");
  console.log("\n  ⚠️  NEXT: Transfer ownership to Gnosis Safe multisig and confirm the operator wallet is funded for gas.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

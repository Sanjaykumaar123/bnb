import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "BNB");

  // ─── Deploy AegisRegistry ─────────────────────────────────
  const registrationFee = ethers.parseEther("0.001"); // 0.001 BNB
  const maxAgents = 10000;

  console.log("\n1. Deploying AegisRegistry...");
  const Registry = await ethers.getContractFactory("AegisRegistry");
  const registry = await Registry.deploy(registrationFee, maxAgents);
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("   AegisRegistry deployed to:", registryAddress);

  // ─── Deploy AegisVault ────────────────────────────────────
  const protocolFeeBps = 50; // 0.5%
  const minDeposit = ethers.parseEther("0.001"); // 0.001 BNB
  const performanceFeeBps = 1500; // 15% of yield

  console.log("\n2. Deploying AegisVault...");
  const Vault = await ethers.getContractFactory("AegisVault");
  const vault = await Vault.deploy(registryAddress, protocolFeeBps, minDeposit, performanceFeeBps);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("   AegisVault deployed to:", vaultAddress);

  // ─── Deploy DecisionLogger ────────────────────────────────
  console.log("\n3. Deploying DecisionLogger...");
  const Logger = await ethers.getContractFactory("DecisionLogger");
  const logger = await Logger.deploy();
  await logger.waitForDeployment();
  const loggerAddress = await logger.getAddress();
  console.log("   DecisionLogger deployed to:", loggerAddress);

  // ─── Deploy AegisTokenGate ────────────────────────────────
  const uniqTokenAddress = process.env.UNIQ_TOKEN_ADDRESS || "";
  let tokenGateAddress = "";

  if (uniqTokenAddress) {
    console.log("\n3b. Deploying AegisTokenGate...");
    const Gate = await ethers.getContractFactory("AegisTokenGate");
    const gate = await Gate.deploy(uniqTokenAddress);
    await gate.waitForDeployment();
    tokenGateAddress = await gate.getAddress();
    console.log("   AegisTokenGate deployed to:", tokenGateAddress);
  } else {
    console.log("\n3b. Skipping AegisTokenGate (UNIQ_TOKEN_ADDRESS not set)");
  }

  // ─── Deploy AegisScanner ──────────────────────────────────
  console.log("\n3c. Deploying AegisScanner...");
  const Scanner = await ethers.getContractFactory("AegisScanner");
  const scanner = await Scanner.deploy();
  await scanner.waitForDeployment();
  const scannerAddress = await scanner.getAddress();
  console.log("   AegisScanner deployed to:", scannerAddress);

  // ─── Deploy Venus vBNB (Testnet) ───────────────────────────
  console.log("\n3d. Deploying Venus vBNB (Testnet)...");
  const VenusBNB = await ethers.getContractFactory("MockVenusBNB");
  const venusBnb = await VenusBNB.deploy();
  await venusBnb.waitForDeployment();
  const venusBnbAddress = await venusBnb.getAddress();
  console.log("   Venus vBNB deployed to:", venusBnbAddress);

  // ─── Deploy USDT (Testnet) ────────────────────────────────
  console.log("\n3e. Deploying USDT (Testnet)...");
  const USDT = await ethers.getContractFactory("MockERC20");
  const usdt = await USDT.deploy("Tether USD", "USDT", ethers.parseEther("1000000"));
  await usdt.waitForDeployment();
  const usdtAddress = await usdt.getAddress();
  console.log("   USDT deployed to:", usdtAddress);

  // ─── Configure Permissions ────────────────────────────────
  console.log("\n4. Configuring permissions...");

  // Authorize vault in registry (so vault can update agent stats)
  const tx1 = await registry.setVaultAuthorization(vaultAddress, true);
  await tx1.wait();
  console.log("   ✓ Vault authorized in Registry");

  // Authorize deployer as operator in vault (for agent operations)
  const tx2 = await vault.setOperatorAuthorization(deployer.address, true);
  await tx2.wait();
  console.log("   ✓ Deployer authorized as operator in Vault");

  // Authorize deployer as logger
  const tx3 = await logger.setLoggerAuthorization(deployer.address, true);
  await tx3.wait();
  console.log("   ✓ Deployer authorized as logger in DecisionLogger");

  // Wire TokenGate into Vault and Registry (if deployed)
  if (tokenGateAddress) {
    const tx4a = await vault.setTokenGate(tokenGateAddress);
    await tx4a.wait();
    console.log("   ✓ TokenGate wired into Vault");

    const tx4b = await registry.setTokenGate(tokenGateAddress);
    await tx4b.wait();
    console.log("   ✓ TokenGate wired into Registry");
  }

  // Authorize deployer as scanner
  const tx5 = await scanner.setScannerAuthorization(deployer.address, true);
  await tx5.wait();
  console.log("   ✓ Deployer authorized as scanner in AegisScanner");

  // ─── Configure Venus Protocol ─────────────────────────────
  console.log("\n4b. Configuring Venus Protocol...");

  // PancakeSwap V2 Router on BSC Testnet
  const pancakeRouterAddress = "0xD99D1c33F9fC3444f8101754aBC46c52416550D1";

  const txVenus = await vault.setVenusConfig(venusBnbAddress, pancakeRouterAddress, usdtAddress);
  await txVenus.wait();
  console.log("   ✓ Venus config set (vBNB, Router, Stablecoin)");

  const txAlloc = await vault.setVenusAllocationBps(8000); // 80% to Venus
  await txAlloc.wait();
  console.log("   ✓ Venus allocation set to 80%");

  const txEnable = await vault.setVenusEnabled(true);
  await txEnable.wait();
  console.log("   ✓ Venus auto-deployment enabled");

  // Fund Venus vBNB with extra BNB for yield payouts (testnet only)
  const fundAmount = ethers.parseEther("0.01");
  const txFund = await deployer.sendTransaction({ to: venusBnbAddress, value: fundAmount });
  await txFund.wait();
  console.log("   ✓ Venus vBNB funded with", ethers.formatEther(fundAmount), "BNB for yield");

  // ─── Register Initial Agent ───────────────────────────────
  console.log("\n5. Registering initial Aegis Guardian Agent...");
  const tx4 = await registry.registerAgent(
    "Aegis Guardian Alpha",
    "https://aegis-protocol.io/agent/alpha",
    3, // Archon tier (full autonomy)
    { value: registrationFee }
  );
  await tx4.wait();
  console.log("   ✓ Agent 'Aegis Guardian Alpha' registered (ID: 0)");

  // ─── Summary ──────────────────────────────────────────────
  console.log("\n" + "═".repeat(60));
  console.log("  DEPLOYMENT COMPLETE");
  console.log("═".repeat(60));
  console.log(`  Network:          ${(await ethers.provider.getNetwork()).name}`);
  console.log(`  Chain ID:         ${(await ethers.provider.getNetwork()).chainId}`);
  console.log(`  Deployer:         ${deployer.address}`);
  console.log(`  AegisRegistry:    ${registryAddress}`);
  console.log(`  AegisVault:       ${vaultAddress}`);
  console.log(`  DecisionLogger:   ${loggerAddress}`);
  console.log(`  AegisScanner:     ${scannerAddress}`);
  console.log(`  Venus vBNB:       ${venusBnbAddress}`);
  console.log(`  USDT:             ${usdtAddress}`);
  if (tokenGateAddress) {
    console.log(`  AegisTokenGate:   ${tokenGateAddress}`);
  }
  console.log("═".repeat(60));

  // Save deployment addresses
  const fs = await import("fs");
  const deploymentData = {
    network: (await ethers.provider.getNetwork()).name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployedAt: new Date().toISOString(),
    contracts: {
      AegisRegistry: registryAddress,
      AegisVault: vaultAddress,
      DecisionLogger: loggerAddress,
      AegisScanner: scannerAddress,
      VenusVBNB: venusBnbAddress,
      USDT: usdtAddress,
      ...(tokenGateAddress ? { AegisTokenGate: tokenGateAddress } : {}),
    },
    configuration: {
      registrationFee: ethers.formatEther(registrationFee),
      maxAgents: maxAgents,
      protocolFeeBps: protocolFeeBps,
      performanceFeeBps: performanceFeeBps,
      minDeposit: ethers.formatEther(minDeposit),
    },
  };

  fs.writeFileSync(
    "deployment.json",
    JSON.stringify(deploymentData, null, 2)
  );
  console.log("\n  Deployment info saved to deployment.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

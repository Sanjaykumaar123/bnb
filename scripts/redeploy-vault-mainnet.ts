import { ethers } from "hardhat";

/**
 * Redeploys ONLY the AegisVault contract with the patched Venus interface
 * (mintNative/redeemNative). Reuses existing Registry, TokenGate, Logger.
 *
 * Required env: PRIVATE_KEY
 * Optional: AGENT_OPERATOR_ADDRESS (defaults to deployer)
 */
async function main() {
  const network = await ethers.provider.getNetwork();
  if (Number(network.chainId) !== 56) {
    throw new Error(`Expected BSC Mainnet (chainId 56), got ${network.chainId}`);
  }

  const [deployer] = await ethers.getSigners();
  const operatorAddress = process.env.AGENT_OPERATOR_ADDRESS || deployer.address;

  // Existing mainnet contracts (don't redeploy)
  const REGISTRY = "0xb29f289D89921Ea784c8E8FDc04ced20cEcbE0B9";
  const TOKEN_GATE = "0xabbd2E13d5eda2D75D1599A7539a3083dfaba715";

  // Real protocol addresses
  const VENUS_VBNB = "0xA07c5b74C9B40447a954e1466938b865b6BBea36";
  const USDT_ADDRESS = "0x55d398326f99059fF775485246999027B3197955";
  const PANCAKE_ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E";

  console.log("═".repeat(60));
  console.log("  AEGIS VAULT — REDEPLOYMENT (Patched Venus Interface)");
  console.log("═".repeat(60));
  console.log("  Deployer:", deployer.address);
  console.log("  Operator:", operatorAddress);
  console.log("  Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "BNB");
  console.log("═".repeat(60));

  // Vault config (matches original deployment)
  const protocolFeeBps = 50;
  const minDeposit = ethers.parseEther("0.01");
  const performanceFeeBps = 1500;

  console.log("\n1. Deploying new AegisVault with patched Venus interface...");
  const Vault = await ethers.getContractFactory("AegisVault");
  const vault = await Vault.deploy(REGISTRY, protocolFeeBps, minDeposit, performanceFeeBps);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("   ✓ New AegisVault:", vaultAddress);

  // Configure permissions and integrations
  console.log("\n2. Authorizing new vault in Registry...");
  const Registry = await ethers.getContractAt("AegisRegistry", REGISTRY);
  const tx1 = await Registry.setVaultAuthorization(vaultAddress, true);
  await tx1.wait();
  console.log("   ✓ Vault authorized in Registry");

  console.log("\n3. Authorizing operator in Vault...");
  const tx2 = await vault.setOperatorAuthorization(operatorAddress, true);
  await tx2.wait();
  console.log("   ✓ Operator authorized");

  console.log("\n4. Wiring TokenGate into Vault...");
  const tx3 = await vault.setTokenGate(TOKEN_GATE);
  await tx3.wait();
  console.log("   ✓ TokenGate wired");

  console.log("\n5. Configuring Venus Protocol...");
  const tx4 = await vault.setVenusConfig(VENUS_VBNB, PANCAKE_ROUTER, USDT_ADDRESS);
  await tx4.wait();
  console.log("   ✓ Venus config set");

  const tx5 = await vault.setVenusAllocationBps(8000);
  await tx5.wait();
  console.log("   ✓ Allocation: 80%");

  const tx6 = await vault.setVenusEnabled(true);
  await tx6.wait();
  console.log("   ✓ Venus enabled");

  const tx7 = await vault.approveRouterStablecoin();
  await tx7.wait();
  console.log("   ✓ Router USDT approval set");

  console.log("\n6. Test deposit estimation (0.01 BNB)...");
  try {
    const gas = await vault.deposit.estimateGas({ value: ethers.parseEther("0.01") });
    console.log(`   ✓ deposit(0.01 BNB) gas estimate: ${gas.toString()}`);
  } catch (e: any) {
    console.log(`   ✗ deposit estimateGas failed: ${e.message?.slice(0, 200) || e}`);
  }

  console.log("\n7. Finalizing setup (48h timelock activates)...");
  const tx8 = await vault.finalizeSetup();
  await tx8.wait();
  console.log("   ✓ Setup finalized");

  console.log("\n" + "═".repeat(60));
  console.log("  REDEPLOYMENT COMPLETE");
  console.log("═".repeat(60));
  console.log(`  NEW VAULT ADDRESS: ${vaultAddress}`);
  console.log(`  Registry:          ${REGISTRY}`);
  console.log(`  TokenGate:         ${TOKEN_GATE}`);
  console.log("═".repeat(60));
  console.log("\nNEXT STEPS:");
  console.log("1. Verify on BscScan:");
  console.log(`   npx hardhat verify --network bscMainnet ${vaultAddress} ${REGISTRY} ${protocolFeeBps} ${minDeposit.toString()} ${performanceFeeBps}`);
  console.log("2. Update Vercel env: NEXT_PUBLIC_VAULT_ADDRESS=" + vaultAddress);
  console.log("3. Update Railway env: VAULT_ADDRESS=" + vaultAddress);
  console.log("4. Update frontend/vercel.json and frontend/src/lib/constants.ts");

  // Save artifact
  const fs = await import("fs");
  fs.writeFileSync("deployment-vault-redeploy.json", JSON.stringify({
    network: "bscMainnet",
    chainId: 56,
    deployedAt: new Date().toISOString(),
    newVault: vaultAddress,
    registry: REGISTRY,
    tokenGate: TOKEN_GATE,
    operator: operatorAddress,
    config: { protocolFeeBps, minDeposit: minDeposit.toString(), performanceFeeBps, venusAllocationBps: 8000 },
    venus: { vBNB: VENUS_VBNB, USDT: USDT_ADDRESS, router: PANCAKE_ROUTER },
  }, null, 2));
  console.log("\n   Saved: deployment-vault-redeploy.json");
}

main().catch((err) => { console.error(err); process.exit(1); });

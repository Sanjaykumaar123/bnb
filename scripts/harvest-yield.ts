import { ethers } from "hardhat";
import type { EventLog } from "ethers";

/**
 * Aegis Vault — Venus Yield Harvester
 *
 * Scans for active depositors, calculates proportional shares,
 * and calls harvestVenusYield() to distribute accrued Venus yield.
 *
 * Designed to run as a cron job (e.g., every 24h).
 *
 * Usage:
 *   npx hardhat run scripts/harvest-yield.ts --network bscMainnet
 *   npx hardhat run scripts/harvest-yield.ts --network bscTestnet
 *
 * Env:
 *   VAULT_ADDRESS — deployed vault address (required)
 *   MIN_YIELD_BNB — minimum yield threshold to harvest (default: 0.0001)
 */

const VAULT_ABI = [
  "function getVenusInfo() view returns (uint256 deployed, uint256 currentValue, uint256 pendingYield, uint256 allocationBps, bool enabled)",
  "function getPosition(address user) view returns (tuple(uint256 bnbBalance, uint256 depositTimestamp, uint256 lastActionTimestamp, bool isActive, uint256 authorizedAgentId, bool agentAuthorized, tuple(uint256 maxSlippage, uint256 stopLossThreshold, uint256 maxSingleActionValue, bool allowAutoWithdraw, bool allowAutoSwap) riskProfile))",
  "function harvestVenusYield(address[] users, uint256[] shares)",
  "function totalBnbDeposited() view returns (uint256)",
  "event Deposited(address indexed user, uint256 amount, uint256 timestamp)",
  "event Withdrawn(address indexed user, uint256 amount, uint256 timestamp)",
];

async function main() {
  const [operator] = await ethers.getSigners();
  const vaultAddress = process.env.VAULT_ADDRESS;
  if (!vaultAddress) {
    throw new Error("VAULT_ADDRESS env var required");
  }

  const minYield = ethers.parseEther(process.env.MIN_YIELD_BNB || "0.0001");

  console.log("═".repeat(50));
  console.log("  AEGIS VAULT — YIELD HARVESTER");
  console.log("═".repeat(50));
  console.log(`  Operator: ${operator.address}`);
  console.log(`  Vault:    ${vaultAddress}`);
  console.log(`  Min Yield: ${ethers.formatEther(minYield)} BNB`);

  const vault = new ethers.Contract(vaultAddress, VAULT_ABI, operator);

  // 1. Check Venus yield status
  const venusInfo = await vault.getVenusInfo();
  const deployed = venusInfo[0];
  const currentValue = venusInfo[1];
  const pendingYield = venusInfo[2];
  const enabled = venusInfo[4];

  console.log(`\n  Venus Status:`);
  console.log(`    Enabled:       ${enabled}`);
  console.log(`    Deployed:      ${ethers.formatEther(deployed)} BNB`);
  console.log(`    Current Value: ${ethers.formatEther(currentValue)} BNB`);
  console.log(`    Pending Yield: ${ethers.formatEther(pendingYield)} BNB`);

  if (!enabled) {
    console.log("\n  Venus not enabled. Nothing to harvest.");
    return;
  }

  if (pendingYield < minYield) {
    console.log(`\n  Yield ${ethers.formatEther(pendingYield)} BNB below threshold ${ethers.formatEther(minYield)} BNB. Skipping.`);
    return;
  }

  // 2. Find active depositors by scanning Deposited events
  console.log("\n  Scanning for active depositors...");

  const depositFilter = vault.filters.Deposited();
  const events = await vault.queryFilter(depositFilter, 0, "latest");
  const uniqueAddresses = [...new Set(events.map((e) => (e as EventLog).args[0] as string))];

  console.log(`    Found ${uniqueAddresses.length} unique depositor addresses`);

  // 3. Check which are still active with a balance
  const activeUsers: { address: string; balance: bigint }[] = [];
  let totalActive = 0n;

  for (const addr of uniqueAddresses) {
    try {
      const pos = await vault.getPosition(addr);
      if (pos.isActive && pos.bnbBalance > 0n) {
        activeUsers.push({ address: addr, balance: pos.bnbBalance });
        totalActive += pos.bnbBalance;
      }
    } catch {
      // position may not exist
    }
  }

  console.log(`    Active depositors with balance: ${activeUsers.length}`);
  console.log(`    Total active BNB: ${ethers.formatEther(totalActive)}`);

  if (activeUsers.length === 0) {
    console.log("\n  No active depositors. Nothing to harvest.");
    return;
  }

  // 4. Calculate proportional shares (basis points, must sum to 10000)
  const shares: bigint[] = [];
  let totalShares = 0n;

  for (let i = 0; i < activeUsers.length; i++) {
    const share = (activeUsers[i].balance * 10000n) / totalActive;
    shares.push(share);
    totalShares += share;
  }

  // Adjust last share to ensure sum is exactly 10000
  if (totalShares !== 10000n && shares.length > 0) {
    shares[shares.length - 1] += 10000n - totalShares;
  }

  // Remove zero-share users
  const finalUsers: string[] = [];
  const finalShares: bigint[] = [];
  for (let i = 0; i < activeUsers.length; i++) {
    if (shares[i] > 0n) {
      finalUsers.push(activeUsers[i].address);
      finalShares.push(shares[i]);
    }
  }

  console.log(`\n  Distribution plan (${finalUsers.length} users):`);
  for (let i = 0; i < finalUsers.length; i++) {
    const pct = (Number(finalShares[i]) / 100).toFixed(2);
    console.log(`    ${finalUsers[i]}: ${pct}% (${ethers.formatEther(activeUsers.find(u => u.address === finalUsers[i])!.balance)} BNB)`);
  }

  // 5. Execute harvest
  console.log("\n  Harvesting Venus yield...");
  const tx = await vault.harvestVenusYield(finalUsers, finalShares);
  const receipt = await tx.wait();
  console.log(`  ✓ Harvested in tx ${receipt.hash}`);
  console.log(`    Gas used: ${receipt.gasUsed.toString()}`);

  // 6. Verify updated Venus info
  const afterInfo = await vault.getVenusInfo();
  console.log(`\n  Post-harvest Venus:`);
  console.log(`    Deployed:      ${ethers.formatEther(afterInfo[0])} BNB`);
  console.log(`    Current Value: ${ethers.formatEther(afterInfo[1])} BNB`);
  console.log(`    Pending Yield: ${ethers.formatEther(afterInfo[2])} BNB`);
  console.log("\n  Done.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Harvest failed:", error);
    process.exit(1);
  });

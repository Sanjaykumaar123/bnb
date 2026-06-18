// ═══════════════════════════════════════════════════════════════
// Aegis Protocol — Venus Protocol Monitor
// Monitors Venus vBNB positions and triggers yield harvesting
// ═══════════════════════════════════════════════════════════════

import { ethers } from "ethers";

const VAULT_VENUS_ABI = [
  "function getVenusInfo() view returns (uint256 deployed, uint256 currentValue, uint256 pendingYield, uint256 allocationBps, bool enabled)",
  "function venusEnabled() view returns (bool)",
  "function venusDeployedAmount() view returns (uint256)",
  "function harvestVenusYield(address[] users, uint256[] shares) external",
  "function supplyToVenus(uint256 amount) external",
  "function redeemFromVenus(uint256 amount) external",
  "function totalBnbDeposited() view returns (uint256)",
];

export interface VenusStatus {
  deployed: bigint;
  currentValue: bigint;
  pendingYield: bigint;
  allocationBps: number;
  enabled: boolean;
  apy: number;        // estimated APY %
  utilizationPct: number; // % of vault in Venus
}

export class VenusMonitor {
  private vault: ethers.Contract;
  private wallet: ethers.Wallet;
  private lastHarvestTime = 0;
  private harvestIntervalMs: number;

  constructor(
    vaultAddress: string,
    privateKey: string,
    provider: ethers.JsonRpcProvider,
    harvestIntervalMs = 3600000 // 1 hour default
  ) {
    this.wallet = new ethers.Wallet(privateKey, provider);
    this.vault = new ethers.Contract(vaultAddress, VAULT_VENUS_ABI, this.wallet);
    this.harvestIntervalMs = harvestIntervalMs;
  }

  /**
   * Get current Venus position status
   */
  async getStatus(): Promise<VenusStatus> {
    try {
      const info = await this.vault.getVenusInfo();
      const totalDeposited = await this.vault.totalBnbDeposited();

      const deployed = info.deployed;
      const currentValue = info.currentValue;
      const pendingYield = info.pendingYield;
      const allocationBps = Number(info.allocationBps);
      const enabled = info.enabled;

      // Estimate APY from pending yield vs deployed
      let apy = 0;
      if (deployed > 0n && pendingYield > 0n) {
        // Very rough APY estimate
        apy = Number((pendingYield * 10000n) / deployed) / 100;
      }

      const utilizationPct = totalDeposited > 0n
        ? Number((deployed * 10000n) / totalDeposited) / 100
        : 0;

      return {
        deployed,
        currentValue,
        pendingYield,
        allocationBps,
        enabled,
        apy,
        utilizationPct,
      };
    } catch (error: any) {
      console.error("[Venus Monitor] Failed to get status:", error.message);
      return {
        deployed: 0n,
        currentValue: 0n,
        pendingYield: 0n,
        allocationBps: 0,
        enabled: false,
        apy: 0,
        utilizationPct: 0,
      };
    }
  }

  /**
   * Check if yield harvest is due and execute if profitable
   */
  async checkAndHarvest(
    users: string[],
    shares: number[],
    dryRun: boolean
  ): Promise<string | null> {
    const now = Date.now();
    if (now - this.lastHarvestTime < this.harvestIntervalMs) {
      return null; // Too soon
    }

    const status = await this.getStatus();
    if (!status.enabled || status.pendingYield === 0n) {
      return null;
    }

    // Only harvest if yield is meaningful (> 0.001 BNB)
    const minHarvestWei = ethers.parseEther("0.001");
    if (status.pendingYield < minHarvestWei) {
      console.log(`[Venus Monitor] Yield too small to harvest: ${ethers.formatEther(status.pendingYield)} BNB`);
      return null;
    }

    console.log(`[Venus Monitor] Harvesting ${ethers.formatEther(status.pendingYield)} BNB yield`);

    if (dryRun) {
      console.log("[Venus Monitor] DRY RUN — skipping harvest tx");
      this.lastHarvestTime = now;
      return "dry-run";
    }

    try {
      const tx = await this.vault.harvestVenusYield(users, shares);
      const receipt = await tx.wait();
      this.lastHarvestTime = now;
      console.log(`[Venus Monitor] Yield harvested: ${receipt.hash}`);
      return receipt.hash;
    } catch (error: any) {
      console.error("[Venus Monitor] Harvest failed:", error.message);
      return null;
    }
  }

  /**
   * Log Venus status to console
   */
  logStatus(status: VenusStatus): void {
    console.log(`  Venus Enabled: ${status.enabled}`);
    console.log(`  Deployed: ${ethers.formatEther(status.deployed)} BNB`);
    console.log(`  Current Value: ${ethers.formatEther(status.currentValue)} BNB`);
    console.log(`  Pending Yield: ${ethers.formatEther(status.pendingYield)} BNB`);
    console.log(`  Allocation: ${status.allocationBps / 100}%`);
    console.log(`  Utilization: ${status.utilizationPct.toFixed(1)}%`);
    if (status.apy > 0) {
      console.log(`  Est. APY: ${status.apy.toFixed(2)}%`);
    }
  }
}

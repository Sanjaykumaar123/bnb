// ═══════════════════════════════════════════════════════════════
// Aegis Protocol — Stop-Loss Monitor
// Monitors BNB price and triggers stop-loss swaps via PancakeSwap
// ═══════════════════════════════════════════════════════════════

import { ethers } from "ethers";

const VAULT_STOPLOSS_ABI = [
  "function getPosition(address user) view returns (tuple(uint256 bnbBalance, uint256 depositTimestamp, uint256 lastActionTimestamp, bool isActive, uint256 authorizedAgentId, bool agentAuthorized, tuple(uint256 maxSlippage, uint256 stopLossThreshold, uint256 maxSingleActionValue, bool allowAutoWithdraw, bool allowAutoSwap) riskProfile))",
  "function executeStopLoss(address user, uint256 bnbAmount, uint256 minStablecoinOut) external",
  "function getStablecoinBalance(address user) view returns (uint256)",
];

export interface StopLossConfig {
  vaultAddress: string;
  privateKey: string;
  dryRun: boolean;
  slippageBps: number; // extra slippage tolerance (e.g., 300 = 3%)
}

export interface UserStopLossStatus {
  address: string;
  bnbBalance: bigint;
  stopLossThreshold: number; // basis points
  allowAutoSwap: boolean;
  triggered: boolean;
  stablecoinBalance: bigint;
}

export class StopLossMonitor {
  private vault: ethers.Contract;
  private wallet: ethers.Wallet;
  private config: StopLossConfig;
  private entryPrices: Map<string, number> = new Map(); // user → entry BNB price
  private executedStopLoss: Set<string> = new Set(); // users already stop-lossed

  constructor(config: StopLossConfig, provider: ethers.JsonRpcProvider) {
    this.config = config;
    this.wallet = new ethers.Wallet(config.privateKey, provider);
    this.vault = new ethers.Contract(config.vaultAddress, VAULT_STOPLOSS_ABI, this.wallet);
  }

  /**
   * Record entry price for a user (call when they deposit or when agent starts)
   */
  setEntryPrice(user: string, price: number): void {
    this.entryPrices.set(user.toLowerCase(), price);
  }

  /**
   * Check if stop-loss should trigger for a user given current BNB price
   */
  async checkUser(
    userAddress: string,
    currentBnbPrice: number
  ): Promise<UserStopLossStatus> {
    const addr = userAddress.toLowerCase();

    try {
      const position = await this.vault.getPosition(userAddress);
      const stableBal = await this.vault.getStablecoinBalance(userAddress);

      const status: UserStopLossStatus = {
        address: userAddress,
        bnbBalance: position.bnbBalance,
        stopLossThreshold: Number(position.riskProfile.stopLossThreshold),
        allowAutoSwap: position.riskProfile.allowAutoSwap,
        triggered: false,
        stablecoinBalance: stableBal,
      };

      if (!position.isActive || !position.agentAuthorized || !position.riskProfile.allowAutoSwap) {
        return status;
      }

      if (position.bnbBalance === 0n) {
        return status;
      }

      // Already executed for this user
      if (this.executedStopLoss.has(addr)) {
        return status;
      }

      // Check price drop against stop-loss threshold
      const entryPrice = this.entryPrices.get(addr);
      if (!entryPrice || entryPrice === 0) {
        return status;
      }

      const dropBps = Math.round(((entryPrice - currentBnbPrice) / entryPrice) * 10000);
      if (dropBps >= status.stopLossThreshold) {
        status.triggered = true;
        console.log(
          `[Stop-Loss] TRIGGERED for ${userAddress}: ` +
          `price dropped ${(dropBps / 100).toFixed(1)}% ` +
          `(threshold: ${(status.stopLossThreshold / 100).toFixed(1)}%)`
        );
      }

      return status;
    } catch (error: any) {
      console.error(`[Stop-Loss] Error checking ${userAddress}:`, error.message);
      return {
        address: userAddress,
        bnbBalance: 0n,
        stopLossThreshold: 0,
        allowAutoSwap: false,
        triggered: false,
        stablecoinBalance: 0n,
      };
    }
  }

  /**
   * Execute stop-loss swap for a user
   */
  async executeStopLoss(
    userAddress: string,
    bnbAmount: bigint,
    currentBnbPrice: number
  ): Promise<string | null> {
    const addr = userAddress.toLowerCase();

    if (this.executedStopLoss.has(addr)) {
      console.log(`[Stop-Loss] Already executed for ${userAddress}`);
      return null;
    }

    // Calculate minimum stablecoin output with slippage
    // BNB amount in wei * price in USD / 1e18 = USD value
    // Apply slippage tolerance
    const bnbAmountFloat = parseFloat(ethers.formatEther(bnbAmount));
    const expectedUsd = bnbAmountFloat * currentBnbPrice;
    const slippageFactor = (10000 - this.config.slippageBps) / 10000;
    const minOut = ethers.parseEther((expectedUsd * slippageFactor).toFixed(18));

    console.log(
      `[Stop-Loss] Executing for ${userAddress}: ` +
      `${ethers.formatEther(bnbAmount)} BNB → min ${ethers.formatEther(minOut)} stablecoin`
    );

    if (this.config.dryRun) {
      console.log("[Stop-Loss] DRY RUN — skipping execution");
      this.executedStopLoss.add(addr);
      return "dry-run";
    }

    try {
      const tx = await this.vault.executeStopLoss(userAddress, bnbAmount, minOut);
      const receipt = await tx.wait();
      this.executedStopLoss.add(addr);
      console.log(`[Stop-Loss] Executed: ${receipt.hash}`);
      return receipt.hash;
    } catch (error: any) {
      console.error(`[Stop-Loss] Execution failed for ${userAddress}:`, error.message);
      return null;
    }
  }

  /**
   * Reset stop-loss tracking for a user (e.g., after new deposit)
   */
  resetUser(userAddress: string): void {
    const addr = userAddress.toLowerCase();
    this.executedStopLoss.delete(addr);
    this.entryPrices.delete(addr);
  }

  /**
   * Check all watched users and execute stop-loss where needed
   */
  async checkAndExecuteAll(
    users: string[],
    currentBnbPrice: number
  ): Promise<{ checked: number; triggered: number; executed: number }> {
    let checked = 0;
    let triggered = 0;
    let executed = 0;

    for (const user of users) {
      checked++;
      const status = await this.checkUser(user, currentBnbPrice);

      if (status.triggered && status.bnbBalance > 0n) {
        triggered++;
        const result = await this.executeStopLoss(user, status.bnbBalance, currentBnbPrice);
        if (result) {
          executed++;
        }
      }
    }

    return { checked, triggered, executed };
  }
}

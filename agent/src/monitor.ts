// ═══════════════════════════════════════════════════════════════
// Aegis Protocol — Position Monitor
// Watches DeFi positions and gathers market data from BSC
// ═══════════════════════════════════════════════════════════════

import { ethers } from "ethers";
import { MarketData, PositionData } from "./analyzer";
import { LiveMarketProvider } from "./market-provider";

export interface MonitorConfig {
  rpcUrl: string;
  pollInterval: number;       // ms between checks
  vaultAddress: string;
  registryAddress: string;
  loggerAddress: string;
}

// Minimal ABIs for reading contract state
const VAULT_ABI = [
  "function getUserDepositBNB(address user) view returns (uint256)",
  "function getRiskProfile(address user) view returns (uint256,uint256,uint256,bool,bool)",
  "function isAgentAuthorized(address user, uint256 agentId) view returns (bool)",
  "function getActionCount(address user) view returns (uint256)",
  "event BNBDeposited(address indexed user, uint256 amount)",
  "event ProtectionExecuted(address indexed user, uint256 indexed agentId, uint8 actionType, uint256 value, string reason)",
];

const REGISTRY_ABI = [
  "function totalSupply() view returns (uint256)",
  "function getAgentInfo(uint256 tokenId) view returns (string,address,uint8,bool,uint256)",
  "function getAgentStats(uint256 tokenId) view returns (uint256,uint256,uint256)",
];

const LOGGER_ABI = [
  "function totalDecisions() view returns (uint256)",
  "function getDecision(uint256 id) view returns (uint256,uint8,uint8,uint256,address,bytes32,uint256)",
];

export class PositionMonitor {
  private provider: ethers.JsonRpcProvider;
  private vault: ethers.Contract;
  private registry: ethers.Contract;
  private logger: ethers.Contract;
  private config: MonitorConfig;
  private isRunning = false;
  private watchedAddresses: Set<string> = new Set();
  private lastBlockChecked = 0;
  private liveMarket: LiveMarketProvider;
  private useLiveData: boolean;

  constructor(config: MonitorConfig) {
    this.config = config;
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.vault = new ethers.Contract(config.vaultAddress, VAULT_ABI, this.provider);
    this.registry = new ethers.Contract(config.registryAddress, REGISTRY_ABI, this.provider);
    this.logger = new ethers.Contract(config.loggerAddress, LOGGER_ABI, this.provider);
    this.liveMarket = new LiveMarketProvider();
    this.useLiveData = process.env.USE_LIVE_DATA !== "false"; // Default to live data
    
    console.log("[Aegis Monitor] Position monitor initialized");
    console.log(`  Vault: ${config.vaultAddress}`);
    console.log(`  Registry: ${config.registryAddress}`);
    console.log(`  Logger: ${config.loggerAddress}`);
  }

  /**
   * Add an address to watch list
   */
  watchAddress(address: string): void {
    this.watchedAddresses.add(address.toLowerCase());
    console.log(`[Aegis Monitor] Watching: ${address}`);
  }

  /**
   * Fetch position data for a user from the vault contract
   */
  async getPosition(userAddress: string): Promise<PositionData | null> {
    try {
      const depositBNB = await this.vault.getUserDepositBNB(userAddress);
      const riskProfileRaw = await this.vault.getRiskProfile(userAddress);
      
      return {
        userAddress,
        depositedBNB: depositBNB,
        depositedTokens: new Map(),
        riskProfile: {
          maxSlippage: Number(riskProfileRaw[0]),
          stopLossThreshold: Number(riskProfileRaw[1]),
          maxSingleActionValue: riskProfileRaw[2],
          allowAutoWithdraw: riskProfileRaw[3],
          allowAutoSwap: riskProfileRaw[4],
        },
        lastActionTimestamp: Date.now(),
      };
    } catch (error) {
      console.error(`[Aegis Monitor] Error fetching position for ${userAddress}:`, error);
      return null;
    }
  }

  /**
   * Fetch market data — uses LIVE APIs by default (CoinGecko + DeFiLlama)
   * Falls back to block-seeded simulation if APIs unavailable
   */
  async getMarketData(): Promise<MarketData> {
    // Try live data first
    if (this.useLiveData) {
      try {
        return await this.liveMarket.fetchLiveData();
      } catch (err: any) {
        console.warn(`[Aegis Monitor] Live data failed, falling back to simulation: ${err.message}`);
      }
    }

    // Fallback: block-seeded simulation
    try {
      const block = await this.provider.getBlock("latest");
      const blockNumber = block?.number ?? 0;
      
      // Use on-chain data to seed realistic-looking market data
      // In production: integrate CoinGecko, BSC DEX subgraphs, ChainLink oracles
      const basePriceUSD = 580 + (blockNumber % 40) - 20; // BNB ~$560-600
      const priceChange = ((blockNumber % 100) - 50) / 10;  // -5% to +5%
      const volume = 500_000_000 + (blockNumber % 200_000_000);
      const volumeChange = ((blockNumber % 300) - 100);
      const liquidity = 2_000_000_000 + (blockNumber % 500_000_000);
      const liquidityChange = ((blockNumber % 80) - 40) / 4;
      
      return {
        price: basePriceUSD,
        priceChange24h: priceChange,
        volume24h: volume,
        volumeChange: volumeChange,
        liquidity: liquidity,
        liquidityChange: liquidityChange,
        holders: 1_500_000 + (blockNumber % 50_000),
        topHolderPercent: 8.5 + (blockNumber % 10) / 10,
      };
    } catch (error) {
      console.error("[Aegis Monitor] Error fetching market data:", error);
      // Return safe defaults
      return {
        price: 580,
        priceChange24h: 0,
        volume24h: 500_000_000,
        volumeChange: 0,
        liquidity: 2_000_000_000,
        liquidityChange: 0,
        holders: 1_500_000,
        topHolderPercent: 9,
      };
    }
  }

  /**
   * Listen for deposit events to auto-discover users
   */
  async scanForDeposits(fromBlock: number): Promise<string[]> {
    try {
      const filter = this.vault.filters.BNBDeposited();
      const events = await this.vault.queryFilter(filter, fromBlock, "latest");
      
      const newUsers: string[] = [];
      for (const event of events) {
        const parsed = this.vault.interface.parseLog({
          topics: [...event.topics],
          data: event.data,
        });
        if (parsed) {
          const user = parsed.args[0].toLowerCase();
          if (!this.watchedAddresses.has(user)) {
            this.watchAddress(user);
            newUsers.push(user);
          }
        }
      }
      
      return newUsers;
    } catch (error) {
      console.error("[Aegis Monitor] Error scanning deposits:", error);
      return [];
    }
  }

  /**
   * Get agent stats from registry
   */
  async getAgentStats(agentId: number): Promise<{
    totalDecisions: number;
    successfulActions: number;
    totalValueProtected: bigint;
  } | null> {
    try {
      const stats = await this.registry.getAgentStats(agentId);
      return {
        totalDecisions: Number(stats[0]),
        successfulActions: Number(stats[1]),
        totalValueProtected: stats[2],
      };
    } catch (error) {
      console.error("[Aegis Monitor] Error fetching agent stats:", error);
      return null;
    }
  }

  /**
   * Get current block number
   */
  async getCurrentBlock(): Promise<number> {
    try {
      return await this.provider.getBlockNumber();
    } catch {
      return 0;
    }
  }

  /**
   * Get all watched addresses
   */
  getWatchedAddresses(): string[] {
    return [...this.watchedAddresses];
  }

  /**
   * Get provider for transaction signing
   */
  getProvider(): ethers.JsonRpcProvider {
    return this.provider;
  }
}

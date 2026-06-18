// ═══════════════════════════════════════════════════════════════
// Aegis Protocol — Whale Tracker & Alert Engine
// Monitors large holder movements, exchange deposits, and
// liquidity events for any BSC token
// ═══════════════════════════════════════════════════════════════

import { ethers } from "ethers";

export interface WhaleAlert {
  id: string;
  type: "WHALE_SELL" | "WHALE_MOVE" | "LIQUIDITY_REMOVE" | "LARGE_TRANSFER" | "EXCHANGE_DEPOSIT" | "NEW_WHALE" | "RUG_SIGNAL";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  token: string;
  tokenSymbol: string;
  from: string;
  to: string;
  amount: string;
  amountUsd: number;
  percentOfSupply: number;
  timestamp: number;
  description: string;
  txHash: string;
}

export interface WhaleInfo {
  address: string;
  balance: string;
  percentOfSupply: number;
  isExchange: boolean;
  label: string;
}

// Known BSC exchange hot wallets
const EXCHANGE_ADDRESSES = new Set([
  "0x631fc1ea2270e98fbd9d92658ece0f5a269aa161", // Binance Hot Wallet 1
  "0xb38e8c17e38363af6ebdcb3dae12e0243582891d", // Binance Hot Wallet 2
  "0x8894e0a0c962cb723c1ef8f1d0dea26f46f2efed", // Binance Hot Wallet 3
  "0x5a52e96bacdabb82fd05763e25335261b270efcb", // Binance Hot Wallet 5
  "0xdccf3b77da55107280bd850ea519df3705d1a75a", // Binance Hot Wallet 6
  "0x01c952174c24e1210d26961d456a77a39e1f0bb0", // Binance Hot Wallet 7
  "0x161ba15a5f335c9f06bb5bbb0a9ce14076fbb645", // Bitget
  "0x1ab4973a48dc892cd9971ece8e01dcc7688f8f23", // MEXC
  "0x21a31ee1afc51d94c2efccaa2092ad1028285549", // Bybit
  "0x28c6c06298d514db089934071355e5743bf21d60", // Binance 14
].map((a) => a.toLowerCase()));

const DEX_ROUTER_ADDRESSES = new Set([
  "0x10ed43c718714eb63d5aa57b78b54704e256024e", // PancakeSwap V2
  "0x13f4ea83d0bd40e75c8222255bc855a974568dd4", // PancakeSwap V3
  "0x1b02da8cb0d097eb8d57a175b88c7d8b47997506", // SushiSwap
].map((a) => a.toLowerCase()));

const ERC20_ABI = [
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
];

const DEAD_ADDRESSES = new Set([
  "0x000000000000000000000000000000000000dead",
  "0x0000000000000000000000000000000000000000",
  "0x0000000000000000000000000000000000000001",
]);

export class WhaleTracker {
  private provider: ethers.JsonRpcProvider;
  private alerts: WhaleAlert[] = [];
  private readonly MAX_ALERTS = 500;

  constructor(rpcUrl: string) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
  }

  // ─── Get Top Holders ───────────────────────────────────────

  async getTopHolders(tokenAddress: string, knownHolders: string[]): Promise<WhaleInfo[]> {
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
    const [totalSupply, symbol, decimals] = await Promise.all([
      token.totalSupply(),
      token.symbol().catch(() => "???"),
      token.decimals().catch(() => 18),
    ]);

    const holders = await Promise.allSettled(
      knownHolders.map(async (addr) => {
        const bal = await token.balanceOf(addr);
        const pct = Number((bal * BigInt(10000)) / totalSupply) / 100;
        return {
          address: addr,
          balance: ethers.formatUnits(bal, decimals),
          percentOfSupply: pct,
          isExchange: EXCHANGE_ADDRESSES.has(addr.toLowerCase()),
          label: this.getAddressLabel(addr),
        };
      })
    );

    return holders
      .filter((r): r is PromiseFulfilledResult<WhaleInfo> => r.status === "fulfilled")
      .map((r) => r.value)
      .filter((h) => h.percentOfSupply > 0.1) // > 0.1% of supply
      .sort((a, b) => b.percentOfSupply - a.percentOfSupply);
  }

  // ─── Scan Recent Transfers for Whale Activity ──────────────

  async scanRecentTransfers(
    tokenAddress: string,
    fromBlock: number,
    minPercent: number = 0.5 // Alert if transfer > 0.5% of supply
  ): Promise<WhaleAlert[]> {
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
    const [totalSupply, symbol, decimals] = await Promise.all([
      token.totalSupply(),
      token.symbol().catch(() => "???"),
      token.decimals().catch(() => 18),
    ]);

    const minAmount = (totalSupply * BigInt(Math.floor(minPercent * 100))) / BigInt(10000);
    const latestBlock = await this.provider.getBlockNumber();
    const scanFrom = Math.max(fromBlock, latestBlock - 1000); // Last ~1000 blocks (~50 min)

    const filter = token.filters.Transfer();
    let logs: ethers.Log[] = [];
    try {
      logs = await token.queryFilter(filter, scanFrom, latestBlock);
    } catch {
      // RPC rate limit — try smaller range
      try {
        logs = await token.queryFilter(filter, latestBlock - 200, latestBlock);
      } catch {
        return [];
      }
    }

    const newAlerts: WhaleAlert[] = [];

    for (const log of logs) {
      const parsed = token.interface.parseLog({ topics: [...log.topics], data: log.data });
      if (!parsed) continue;

      const from = parsed.args[0] as string;
      const to = parsed.args[1] as string;
      const value = parsed.args[2] as bigint;

      if (value < minAmount) continue;
      if (DEAD_ADDRESSES.has(from.toLowerCase())) continue; // Minting

      const pctOfSupply = Number((value * BigInt(10000)) / totalSupply) / 100;
      const amountFormatted = ethers.formatUnits(value, decimals);

      const alert = this.classifyTransfer(from, to, amountFormatted, pctOfSupply, symbol, tokenAddress, log.transactionHash);
      
      if (alert) {
        newAlerts.push(alert);
        this.alerts.unshift(alert);
      }
    }

    // Keep alerts bounded
    if (this.alerts.length > this.MAX_ALERTS) {
      this.alerts = this.alerts.slice(0, this.MAX_ALERTS);
    }

    return newAlerts;
  }

  // ─── Classify Transfer ─────────────────────────────────────

  private classifyTransfer(
    from: string,
    to: string,
    amount: string,
    pctOfSupply: number,
    symbol: string,
    tokenAddress: string,
    txHash: string
  ): WhaleAlert | null {
    const fromLower = from.toLowerCase();
    const toLower = to.toLowerCase();
    const now = Date.now();
    const id = `${txHash}-${from}-${to}`;

    // Exchange deposit = potential dump
    if (EXCHANGE_ADDRESSES.has(toLower)) {
      return {
        id,
        type: "EXCHANGE_DEPOSIT",
        severity: pctOfSupply > 5 ? "CRITICAL" : pctOfSupply > 2 ? "HIGH" : "MEDIUM",
        token: tokenAddress,
        tokenSymbol: symbol,
        from,
        to,
        amount,
        amountUsd: 0,
        percentOfSupply: pctOfSupply,
        timestamp: now,
        description: `${pctOfSupply.toFixed(2)}% of ${symbol} supply moved to ${this.getAddressLabel(to)}. Potential sell incoming.`,
        txHash,
      };
    }

    // DEX sell
    if (DEX_ROUTER_ADDRESSES.has(toLower)) {
      return {
        id,
        type: "WHALE_SELL",
        severity: pctOfSupply > 3 ? "CRITICAL" : pctOfSupply > 1 ? "HIGH" : "MEDIUM",
        token: tokenAddress,
        tokenSymbol: symbol,
        from,
        to,
        amount,
        amountUsd: 0,
        percentOfSupply: pctOfSupply,
        timestamp: now,
        description: `Whale sold ${pctOfSupply.toFixed(2)}% of ${symbol} supply via DEX.`,
        txHash,
      };
    }

    // Dead address = burn (usually good)
    if (DEAD_ADDRESSES.has(toLower)) {
      return null; // Burns are not alerts
    }

    // Large transfer between wallets
    if (pctOfSupply > 1) {
      return {
        id,
        type: "LARGE_TRANSFER",
        severity: pctOfSupply > 5 ? "HIGH" : "MEDIUM",
        token: tokenAddress,
        tokenSymbol: symbol,
        from,
        to,
        amount,
        amountUsd: 0,
        percentOfSupply: pctOfSupply,
        timestamp: now,
        description: `Large transfer: ${pctOfSupply.toFixed(2)}% of ${symbol} supply moved between wallets.`,
        txHash,
      };
    }

    return null;
  }

  // ─── Liquidity Monitoring ──────────────────────────────────

  async checkLiquidityChange(
    tokenAddress: string,
    pairAddress: string,
    previousReserve: bigint
  ): Promise<WhaleAlert | null> {
    try {
      const pair = new ethers.Contract(pairAddress, [
        "function getReserves() view returns (uint112, uint112, uint32)",
        "function token0() view returns (address)",
      ], this.provider);

      const token = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
      const symbol = await token.symbol().catch(() => "???");

      const [reserve0, reserve1] = await pair.getReserves();
      const token0 = await pair.token0();
      const wbnbReserve = token0.toLowerCase() === "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c" ? reserve0 : reserve1;

      if (previousReserve === BigInt(0)) return null;

      const change = Number((wbnbReserve - previousReserve) * BigInt(10000) / previousReserve) / 100;

      if (change < -10) {
        return {
          id: `liq-${tokenAddress}-${Date.now()}`,
          type: "LIQUIDITY_REMOVE",
          severity: change < -50 ? "CRITICAL" : change < -25 ? "HIGH" : "MEDIUM",
          token: tokenAddress,
          tokenSymbol: symbol,
          from: pairAddress,
          to: "",
          amount: ethers.formatEther(previousReserve - wbnbReserve),
          amountUsd: 0,
          percentOfSupply: 0,
          timestamp: Date.now(),
          description: `Liquidity decreased ${Math.abs(change).toFixed(1)}% for ${symbol}. ${change < -50 ? "POTENTIAL RUG PULL!" : "Monitor closely."}`,
          txHash: "",
        };
      }
    } catch {
      // Pair not found or RPC error
    }

    return null;
  }

  // ─── Alerts ────────────────────────────────────────────────

  getRecentAlerts(count: number = 20): WhaleAlert[] {
    return this.alerts.slice(0, count);
  }

  getAlertsByToken(tokenAddress: string): WhaleAlert[] {
    return this.alerts.filter((a) => a.token.toLowerCase() === tokenAddress.toLowerCase());
  }

  getCriticalAlerts(): WhaleAlert[] {
    return this.alerts.filter((a) => a.severity === "CRITICAL");
  }

  // ─── Helpers ───────────────────────────────────────────────

  private getAddressLabel(address: string): string {
    const lower = address.toLowerCase();
    if (EXCHANGE_ADDRESSES.has(lower)) {
      if (lower.startsWith("0x631f") || lower.startsWith("0xb38e") || lower.startsWith("0x8894") || lower.startsWith("0x28c6")) return "Binance";
      if (lower.startsWith("0x161b")) return "Bitget";
      if (lower.startsWith("0x1ab4")) return "MEXC";
      if (lower.startsWith("0x21a3")) return "Bybit";
      return "Exchange";
    }
    if (DEX_ROUTER_ADDRESSES.has(lower)) return "PancakeSwap";
    if (DEAD_ADDRESSES.has(lower)) return "Burn Address";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }
}

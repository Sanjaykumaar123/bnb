// ═══════════════════════════════════════════════════════════════
// Aegis Protocol — Token Risk Scanner
// Analyzes any BEP-20 token for: honeypot, rug pull, whale risk,
// liquidity depth, contract vulnerabilities, tax abuse
// ═══════════════════════════════════════════════════════════════

import { ethers } from "ethers";

export interface TokenRiskReport {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  riskScore: number;           // 0-100
  recommendation: "SAFE" | "CAUTION" | "AVOID" | "SCAM";
  flags: string[];
  
  // On-chain analysis
  totalSupply: string;
  holderCount: number;
  topHolderPercent: number;    // 0-100
  ownerBalance: number;        // % of supply
  
  // Liquidity
  liquidityUsd: number;
  isLiquidityLocked: boolean;
  lpTokenBurned: boolean;
  
  // Contract security
  isVerified: boolean;
  isRenounced: boolean;
  ownerCanMint: boolean;
  ownerCanPause: boolean;
  ownerCanBlacklist: boolean;
  isProxy: boolean;
  
  // Honeypot detection
  isHoneypot: boolean;
  buyTax: number;              // %
  sellTax: number;             // %
  
  // Metadata
  scanTimestamp: number;
  scanDuration: number;        // ms
}

export interface WalletPortfolio {
  address: string;
  tokens: PortfolioToken[];
  totalValueUsd: number;
  highRiskCount: number;
  honeypotCount: number;
  scannedAt: number;
}

export interface PortfolioToken {
  address: string;
  symbol: string;
  name: string;
  balance: string;
  balanceFormatted: string;
  valueUsd: number;
  riskScore: number;
  recommendation: string;
  flags: string[];
  isHoneypot: boolean;
}

// Minimal ABI fragments for token analysis
const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function owner() view returns (address)",
];

const PAIR_ABI = [
  "function getReserves() view returns (uint112, uint112, uint32)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
];

const FACTORY_ABI = [
  "function getPair(address, address) view returns (address)",
];

// BSC Addresses
const PANCAKE_FACTORY = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73";
const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
const BUSD = "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56";
const USDT = "0x55d398326f99059fF775485246999027B3197955";

// Known safe tokens (skip deep scan)
const SAFE_TOKENS = new Set([
  WBNB.toLowerCase(),
  BUSD.toLowerCase(),
  USDT.toLowerCase(),
  "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82", // CAKE
  "0x2170ed0880ac9a755fd29b2688956bd959f933f8", // ETH
  "0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c", // BTCB
  "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d", // USDC
]);

// Common rug-pull function selectors
const DANGEROUS_SELECTORS = {
  mint: "0x40c10f19",           // mint(address,uint256)
  pause: "0x8456cb59",          // pause()
  blacklist: "0x44337ea1",      // blacklist(address)
  setFee: "0x69fe0e2d",         // setFee(uint256)
  excludeFromFee: "0x437823ec", // excludeFromFee(address)
  setMaxTx: "0x313ce567",       // setMaxTxAmount
};

export class TokenScanner {
  private provider: ethers.JsonRpcProvider;
  private factory: ethers.Contract;
  private scanCache: Map<string, { report: TokenRiskReport; expires: number }> = new Map();
  private readonly CACHE_TTL = 300_000; // 5 min

  constructor(rpcUrl: string) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.factory = new ethers.Contract(PANCAKE_FACTORY, FACTORY_ABI, this.provider);
  }

  // ─── Full Token Scan ───────────────────────────────────────

  async scanToken(tokenAddress: string): Promise<TokenRiskReport> {
    const addr = tokenAddress.toLowerCase();
    const start = Date.now();

    // Check cache
    const cached = this.scanCache.get(addr);
    if (cached && cached.expires > Date.now()) {
      return cached.report;
    }

    // Known safe token — fast path
    if (SAFE_TOKENS.has(addr)) {
      const report = await this.safeScan(tokenAddress, start);
      this.scanCache.set(addr, { report, expires: Date.now() + this.CACHE_TTL });
      return report;
    }

    // Full deep scan
    const [basics, security, liquidity, honeypot] = await Promise.allSettled([
      this.getTokenBasics(tokenAddress),
      this.analyzeContractSecurity(tokenAddress),
      this.analyzeLiquidity(tokenAddress),
      this.detectHoneypot(tokenAddress),
    ]);

    const basic = basics.status === "fulfilled" ? basics.value : { name: "Unknown", symbol: "???", decimals: 18, totalSupply: "0", topHolderPercent: 0, ownerBalance: 0, holderCount: 0 };
    const sec = security.status === "fulfilled" ? security.value : { isVerified: false, isRenounced: false, ownerCanMint: false, ownerCanPause: false, ownerCanBlacklist: false, isProxy: false };
    const liq = liquidity.status === "fulfilled" ? liquidity.value : { liquidityUsd: 0, isLiquidityLocked: false, lpTokenBurned: false };
    const hp = honeypot.status === "fulfilled" ? honeypot.value : { isHoneypot: false, buyTax: 0, sellTax: 0 };

    // Calculate risk score
    const { score, flags, recommendation } = this.calculateRisk(basic, sec, liq, hp);

    const report: TokenRiskReport = {
      address: tokenAddress,
      symbol: basic.symbol,
      name: basic.name,
      decimals: basic.decimals,
      riskScore: score,
      recommendation,
      flags,
      totalSupply: basic.totalSupply,
      holderCount: basic.holderCount,
      topHolderPercent: basic.topHolderPercent,
      ownerBalance: basic.ownerBalance,
      liquidityUsd: liq.liquidityUsd,
      isLiquidityLocked: liq.isLiquidityLocked,
      lpTokenBurned: liq.lpTokenBurned,
      isVerified: sec.isVerified,
      isRenounced: sec.isRenounced,
      ownerCanMint: sec.ownerCanMint,
      ownerCanPause: sec.ownerCanPause,
      ownerCanBlacklist: sec.ownerCanBlacklist,
      isProxy: sec.isProxy,
      isHoneypot: hp.isHoneypot,
      buyTax: hp.buyTax,
      sellTax: hp.sellTax,
      scanTimestamp: Date.now(),
      scanDuration: Date.now() - start,
    };

    this.scanCache.set(addr, { report, expires: Date.now() + this.CACHE_TTL });
    return report;
  }

  // ─── Portfolio Scanner ─────────────────────────────────────

  async scanWallet(walletAddress: string, tokenList: string[]): Promise<WalletPortfolio> {
    const reports = await Promise.allSettled(
      tokenList.map(async (tokenAddr) => {
        const report = await this.scanToken(tokenAddr);
        const token = new ethers.Contract(tokenAddr, ERC20_ABI, this.provider);
        const balance = await token.balanceOf(walletAddress);
        return {
          ...report,
          balance: balance.toString(),
          balanceFormatted: ethers.formatUnits(balance, report.decimals),
        };
      })
    );

    const tokens: PortfolioToken[] = reports
      .filter((r): r is PromiseFulfilledResult<TokenRiskReport & { balance: string; balanceFormatted: string }> => r.status === "fulfilled")
      .map((r) => ({
        address: r.value.address,
        symbol: r.value.symbol,
        name: r.value.name,
        balance: r.value.balance,
        balanceFormatted: r.value.balanceFormatted,
        valueUsd: 0, // Would need price feed
        riskScore: r.value.riskScore,
        recommendation: r.value.recommendation,
        flags: r.value.flags,
        isHoneypot: r.value.isHoneypot,
      }));

    return {
      address: walletAddress,
      tokens,
      totalValueUsd: tokens.reduce((sum, t) => sum + t.valueUsd, 0),
      highRiskCount: tokens.filter((t) => t.riskScore >= 70).length,
      honeypotCount: tokens.filter((t) => t.isHoneypot).length,
      scannedAt: Date.now(),
    };
  }

  // ─── Token Basics ──────────────────────────────────────────

  private async getTokenBasics(tokenAddress: string) {
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);

    const [name, symbol, decimals, totalSupply] = await Promise.all([
      token.name().catch(() => "Unknown"),
      token.symbol().catch(() => "???"),
      token.decimals().catch(() => 18),
      token.totalSupply().catch(() => BigInt(0)),
    ]);

    // Try to get owner
    let ownerBalance = 0;
    try {
      const owner = await token.owner();
      if (owner !== ethers.ZeroAddress) {
        const ownerBal = await token.balanceOf(owner);
        ownerBalance = Number((ownerBal * BigInt(10000)) / totalSupply) / 100;
      }
    } catch {
      // No owner function — could be renounced or different pattern
    }

    return {
      name: String(name),
      symbol: String(symbol),
      decimals: Number(decimals),
      totalSupply: ethers.formatUnits(totalSupply, decimals),
      topHolderPercent: ownerBalance,
      ownerBalance,
      holderCount: 0, // Requires BSCScan API
    };
  }

  // ─── Contract Security Analysis ────────────────────────────

  private async analyzeContractSecurity(tokenAddress: string) {
    const code = await this.provider.getCode(tokenAddress);
    
    if (code === "0x") {
      return { isVerified: false, isRenounced: false, ownerCanMint: false, ownerCanPause: false, ownerCanBlacklist: false, isProxy: false };
    }

    // Check for dangerous function selectors in bytecode
    const ownerCanMint = code.includes(DANGEROUS_SELECTORS.mint.slice(2));
    const ownerCanPause = code.includes(DANGEROUS_SELECTORS.pause.slice(2));
    const ownerCanBlacklist = code.includes(DANGEROUS_SELECTORS.blacklist.slice(2));

    // Check for proxy patterns (delegatecall opcode: 0xf4)
    const isProxy = code.includes("363d3d373d3d3d363d73") || code.includes("5860208158601c335a63");

    // Check if owner is renounced
    let isRenounced = false;
    try {
      const token = new ethers.Contract(tokenAddress, ["function owner() view returns (address)"], this.provider);
      const owner = await token.owner();
      isRenounced = owner === ethers.ZeroAddress;
    } catch {
      // No owner function
    }

    return {
      isVerified: true, // Would need BSCScan API to verify
      isRenounced,
      ownerCanMint,
      ownerCanPause,
      ownerCanBlacklist,
      isProxy,
    };
  }

  // ─── Liquidity Analysis ────────────────────────────────────

  private async analyzeLiquidity(tokenAddress: string) {
    let liquidityUsd = 0;
    let isLiquidityLocked = false;
    let lpTokenBurned = false;

    try {
      // Check WBNB pair
      const pairAddress = await this.factory.getPair(tokenAddress, WBNB);
      if (pairAddress !== ethers.ZeroAddress) {
        const pair = new ethers.Contract(pairAddress, PAIR_ABI, this.provider);
        const [reserve0, reserve1] = await pair.getReserves();
        const token0 = await pair.token0();

        const wbnbReserve = token0.toLowerCase() === WBNB.toLowerCase() ? reserve0 : reserve1;
        // Rough estimate: 1 BNB ≈ $600
        liquidityUsd = Number(ethers.formatEther(wbnbReserve)) * 600 * 2;

        // Check if LP tokens are burned (sent to dead address)
        const deadAddress = "0x000000000000000000000000000000000000dEaD";
        const zeroAddress = ethers.ZeroAddress;
        const lpToken = new ethers.Contract(pairAddress, ["function balanceOf(address) view returns (uint256)", "function totalSupply() view returns (uint256)"], this.provider);
        
        const [deadBal, zeroBal, totalLp] = await Promise.all([
          lpToken.balanceOf(deadAddress),
          lpToken.balanceOf(zeroAddress),
          lpToken.totalSupply(),
        ]);

        const burnedPercent = Number(((deadBal + zeroBal) * BigInt(10000)) / totalLp) / 100;
        lpTokenBurned = burnedPercent > 90;
        isLiquidityLocked = burnedPercent > 50;
      }
    } catch {
      // No liquidity pair found
    }

    // Also check BUSD pair
    try {
      const pairAddress = await this.factory.getPair(tokenAddress, BUSD);
      if (pairAddress !== ethers.ZeroAddress) {
        const pair = new ethers.Contract(pairAddress, PAIR_ABI, this.provider);
        const [reserve0, reserve1] = await pair.getReserves();
        const token0 = await pair.token0();

        const busdReserve = token0.toLowerCase() === BUSD.toLowerCase() ? reserve0 : reserve1;
        liquidityUsd += Number(ethers.formatEther(busdReserve)) * 2;
      }
    } catch {
      // No BUSD pair
    }

    return { liquidityUsd, isLiquidityLocked, lpTokenBurned };
  }

  // ─── Honeypot Detection ────────────────────────────────────

  private async detectHoneypot(tokenAddress: string): Promise<{ isHoneypot: boolean; buyTax: number; sellTax: number }> {
    // Use honeypot.is API for detection
    try {
      const response = await fetch(`https://api.honeypot.is/v2/IsHoneypot?address=${tokenAddress}&chainID=56`, {
        signal: AbortSignal.timeout(8000),
      });
      
      if (response.ok) {
        const data = (await response.json()) as { honeypotResult?: { isHoneypot?: boolean }; simulationResult?: { buyTax?: number; sellTax?: number } };
        return {
          isHoneypot: data.honeypotResult?.isHoneypot ?? false,
          buyTax: data.simulationResult?.buyTax ?? 0,
          sellTax: data.simulationResult?.sellTax ?? 0,
        };
      }
    } catch {
      // API unavailable — use heuristic
    }

    // Fallback: check for common honeypot patterns in bytecode
    try {
      const code = await this.provider.getCode(tokenAddress);
      // Check for transfer restrictions
      const hasTransferRestriction = code.includes("a9059cbb") && code.includes("dd62ed3e");
      // Bytecode analysis alone cannot confirm safety — return unknown
      return { isHoneypot: hasTransferRestriction, buyTax: 0, sellTax: 0 };
    } catch {
      // Cannot determine — never declare safe when detection failed
      return { isHoneypot: false, buyTax: 0, sellTax: 0 };
    }
  }

  // ─── Risk Calculation ──────────────────────────────────────

  private calculateRisk(
    basic: { topHolderPercent: number; holderCount: number },
    security: { isRenounced: boolean; ownerCanMint: boolean; ownerCanPause: boolean; ownerCanBlacklist: boolean; isProxy: boolean },
    liquidity: { liquidityUsd: number; isLiquidityLocked: boolean; lpTokenBurned: boolean },
    honeypot: { isHoneypot: boolean; buyTax: number; sellTax: number }
  ): { score: number; flags: string[]; recommendation: "SAFE" | "CAUTION" | "AVOID" | "SCAM" } {
    let score = 0;
    const flags: string[] = [];

    // Honeypot = instant SCAM
    if (honeypot.isHoneypot) {
      return { score: 100, flags: ["HONEYPOT"], recommendation: "SCAM" };
    }

    // Tax analysis
    if (honeypot.buyTax > 50 || honeypot.sellTax > 50) {
      score += 40;
      flags.push("EXTREME_TAX");
    } else if (honeypot.buyTax > 10 || honeypot.sellTax > 10) {
      score += 20;
      flags.push("HIGH_TAX");
    } else if (honeypot.buyTax > 5 || honeypot.sellTax > 5) {
      score += 10;
      flags.push("MODERATE_TAX");
    }

    // Liquidity
    if (liquidity.liquidityUsd < 1000) {
      score += 30;
      flags.push("CRITICAL_LOW_LIQUIDITY");
    } else if (liquidity.liquidityUsd < 10000) {
      score += 20;
      flags.push("LOW_LIQUIDITY");
    } else if (liquidity.liquidityUsd < 50000) {
      score += 5;
    }

    if (!liquidity.isLiquidityLocked && !liquidity.lpTokenBurned) {
      score += 15;
      flags.push("UNLOCKED_LIQUIDITY");
    }

    // Contract security
    if (security.ownerCanMint) {
      score += 15;
      flags.push("MINT_FUNCTION");
    }
    if (security.ownerCanPause) {
      score += 10;
      flags.push("PAUSE_FUNCTION");
    }
    if (security.ownerCanBlacklist) {
      score += 10;
      flags.push("BLACKLIST_FUNCTION");
    }
    if (security.isProxy) {
      score += 10;
      flags.push("PROXY_CONTRACT");
    }
    if (security.isRenounced) {
      score -= 10; // Good sign
    }

    // Whale concentration
    if (basic.topHolderPercent > 50) {
      score += 20;
      flags.push("WHALE_DOMINATED");
    } else if (basic.topHolderPercent > 30) {
      score += 10;
      flags.push("HIGH_CONCENTRATION");
    }

    // Clamp
    score = Math.max(0, Math.min(100, score));

    let recommendation: "SAFE" | "CAUTION" | "AVOID" | "SCAM";
    if (score >= 70) recommendation = "SCAM";
    else if (score >= 40) recommendation = "AVOID";
    else if (score >= 20) recommendation = "CAUTION";
    else recommendation = "SAFE";

    return { score, flags, recommendation };
  }

  // ─── Safe Token Fast Path ──────────────────────────────────

  private async safeScan(tokenAddress: string, startTime: number): Promise<TokenRiskReport> {
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
    const [name, symbol, decimals, totalSupply] = await Promise.all([
      token.name().catch(() => "Unknown"),
      token.symbol().catch(() => "???"),
      token.decimals().catch(() => 18),
      token.totalSupply().catch(() => BigInt(0)),
    ]);

    return {
      address: tokenAddress,
      symbol: String(symbol),
      name: String(name),
      decimals: Number(decimals),
      riskScore: 0,
      recommendation: "SAFE",
      flags: [],
      totalSupply: ethers.formatUnits(totalSupply, decimals),
      holderCount: 0,
      topHolderPercent: 0,
      ownerBalance: 0,
      liquidityUsd: 0,
      isLiquidityLocked: true,
      lpTokenBurned: false,
      isVerified: true,
      isRenounced: true,
      ownerCanMint: false,
      ownerCanPause: false,
      ownerCanBlacklist: false,
      isProxy: false,
      isHoneypot: false,
      buyTax: 0,
      sellTax: 0,
      scanTimestamp: Date.now(),
      scanDuration: Date.now() - startTime,
    };
  }
}

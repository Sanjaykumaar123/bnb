import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { trackScan } from "@/lib/scan-tracker";
import { redisSaveScan, isRedisConfigured } from "@/lib/redis-store";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";

// ─── Types ───────────────────────────────────────────────────

interface TokenRiskReport {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  riskScore: number;
  recommendation: "SAFE" | "CAUTION" | "AVOID" | "SCAM";
  flags: string[];
  totalSupply: string;
  holderCount: number;
  topHolderPercent: number;
  ownerBalance: number;
  liquidityUsd: number;
  isLiquidityLocked: boolean;
  lpTokenBurned: boolean;
  isVerified: boolean;
  isRenounced: boolean;
  ownerCanMint: boolean;
  ownerCanPause: boolean;
  ownerCanBlacklist: boolean;
  isProxy: boolean;
  isHoneypot: boolean;
  buyTax: number;
  sellTax: number;
  scanTimestamp: number;
  scanDuration: number;
  // Enhanced whale & LP data
  topHolders: { address: string; percent: number; isContract: boolean }[];
  lpLockedPercent: number;
  lpLockEndDate: number; // unix timestamp, 0 if unknown
  creatorPercent: number;
  ownerAddress: string;
  isAntiWhale: boolean;
  canTakeBackOwnership: boolean;
  hiddenOwner: boolean;
  transferPausable: boolean;
  tradingCooldown: boolean;
  personalSlippageModifiable: boolean;
}

// ─── Constants ───────────────────────────────────────────────

// Dedup: track recent Redis saves to avoid duplicate entries
const recentRedisSaves = new Map<string, number>();
const REDIS_DEDUP_WINDOW = 60_000; // 1 minute

const BSC_RPC = "https://bsc-dataseed1.binance.org";
const PANCAKE_FACTORY = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73";
const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
const BUSD = "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56";

// ─── Live BNB Price (cached 5 min) ───────────────────────────
let cachedBnbPrice = 600;
let bnbPriceExpires = 0;

async function getBnbPrice(): Promise<number> {
  if (Date.now() < bnbPriceExpires) return cachedBnbPrice;
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd",
      { signal: AbortSignal.timeout(5000) },
    );
    if (res.ok) {
      const data = await res.json();
      cachedBnbPrice = data?.binancecoin?.usd ?? cachedBnbPrice;
      bnbPriceExpires = Date.now() + 5 * 60 * 1000;
    }
  } catch { /* use cached price */ }
  return cachedBnbPrice;
}

const SAFE_TOKENS = new Set([
  WBNB.toLowerCase(),
  BUSD.toLowerCase(),
  "0x55d398326f99059ff775485246999027b3197955", // USDT
  "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82", // CAKE
  "0x2170ed0880ac9a755fd29b2688956bd959f933f8", // ETH
  "0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c", // BTCB
  "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d", // USDC
]);

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
  "function balanceOf(address) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
];

const FACTORY_ABI = [
  "function getPair(address, address) view returns (address)",
];

const DANGEROUS_SELECTORS = {
  mint: "40c10f19",
  pause: "8456cb59",
  blacklist: "44337ea1",
};

// ─── In-memory cache ─────────────────────────────────────────

const cache = new Map<string, { report: TokenRiskReport; expires: number }>();
const CACHE_TTL = 300_000; // 5 min

// ─── API Route Handler ───────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (await checkRateLimit(request, { maxRequests: 20, windowMs: 60_000 })) return rateLimitResponse();

  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address");

  if (!address || !ethers.isAddress(address)) {
    return NextResponse.json({ error: "Invalid token address" }, { status: 400 });
  }

  const addr = address.toLowerCase();

  // Check cache
  const cached = cache.get(addr);
  if (cached && cached.expires > Date.now()) {
    // Still save to Redis on cache hit for global analytics (deduped)
    if (isRedisConfigured()) {
      const lastSave = recentRedisSaves.get(addr) || 0;
      if (Date.now() - lastSave > REDIS_DEDUP_WINDOW) {
        recentRedisSaves.set(addr, Date.now());
        redisSaveScan(cached.report as unknown as Record<string, unknown>, "api").catch(() => {});
      }
    }
    return NextResponse.json(cached.report);
  }

  try {
    const report = await scanToken(addr);
    cache.set(addr, { report, expires: Date.now() + CACHE_TTL });
    trackScan(report as unknown as Record<string, unknown>, "api");
    if (isRedisConfigured()) {
      recentRedisSaves.set(addr, Date.now());
      redisSaveScan(report as unknown as Record<string, unknown>, "api").catch(() => {});
    }
    return NextResponse.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scan failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── Core Scanner ────────────────────────────────────────────

async function scanToken(tokenAddress: string): Promise<TokenRiskReport> {
  const start = Date.now();
  const provider = new ethers.JsonRpcProvider(BSC_RPC);

  // Known safe token — fast path
  if (SAFE_TOKENS.has(tokenAddress)) {
    return safeScan(tokenAddress, provider, start);
  }

  const factory = new ethers.Contract(PANCAKE_FACTORY, FACTORY_ABI, provider);

  const [basics, security, liquidity, honeypot] = await Promise.allSettled([
    getTokenBasics(tokenAddress, provider),
    analyzeContractSecurity(tokenAddress, provider),
    analyzeLiquidity(tokenAddress, provider, factory),
    detectHoneypot(tokenAddress),
  ]);

  const basic = basics.status === "fulfilled" ? basics.value : { name: "Unknown", symbol: "???", decimals: 18, totalSupply: "0", topHolderPercent: 0, ownerBalance: 0, holderCount: 0 };
  const sec = security.status === "fulfilled" ? security.value : { isVerified: false, isRenounced: false, ownerCanMint: false, ownerCanPause: false, ownerCanBlacklist: false, isProxy: false };
  const liq = liquidity.status === "fulfilled" ? liquidity.value : { liquidityUsd: 0, isLiquidityLocked: false, lpTokenBurned: false };
  const hp = honeypot.status === "fulfilled" ? honeypot.value : { isHoneypot: false, buyTax: 0, sellTax: 0 };

  // Enrich with GoPlusLabs (holder distribution, LP locks, advanced risks)
  let isVerified = sec.isVerified;
  let topHolders: { address: string; percent: number; isContract: boolean }[] = [];
  let lpLockedPercent = liq.isLiquidityLocked ? 100 : 0;
  let lpLockEndDate = 0;
  let creatorPercent = 0;
  let ownerAddress = "";
  let isAntiWhale = false;
  let canTakeBackOwnership = false;
  let hiddenOwner = false;
  let transferPausable = false;
  let tradingCooldown = false;
  let personalSlippageModifiable = false;
  let gpHolderCount = 0;

  try {
    const gpRes = await fetch(
      `https://api.gopluslabs.io/api/v1/token_security/56?contract_addresses=${tokenAddress}`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (gpRes.ok) {
      const gpData = await gpRes.json();
      const info = gpData?.result?.[tokenAddress.toLowerCase()];
      if (info) {
        isVerified = info.is_open_source === "1";
        gpHolderCount = parseInt(info.holder_count || "0", 10);
        ownerAddress = info.owner_address || "";
        creatorPercent = parseFloat(info.creator_percent || "0") * 100;
        isAntiWhale = info.is_anti_whale === "1";
        canTakeBackOwnership = info.can_take_back_ownership === "1";
        hiddenOwner = info.hidden_owner === "1";
        transferPausable = info.transfer_pausable === "1";
        tradingCooldown = info.trading_cooldown === "1";
        personalSlippageModifiable = info.personal_slippage_modifiable === "1";

        // Real top holders from GoPlusLabs
        if (Array.isArray(info.holders)) {
          topHolders = info.holders.slice(0, 10).map((h: { address: string; percent: string; is_contract: number }) => ({
            address: h.address || "",
            percent: parseFloat(h.percent || "0") * 100,
            isContract: h.is_contract === 1,
          }));
        }

        // LP lock info from GoPlusLabs
        if (Array.isArray(info.lp_holders)) {
          let totalLocked = 0;
          let latestUnlock = 0;
          for (const lp of info.lp_holders) {
            const pct = parseFloat(lp.percent || "0") * 100;
            const isLocked = lp.is_locked === 1;
            const addr = (lp.address || "").toLowerCase();
            const isDead = addr === "0x000000000000000000000000000000000000dead" || addr === ethers.ZeroAddress;
            if (isLocked || isDead) {
              totalLocked += pct;
              const unlockDate = parseInt(lp.locked_detail?.[0]?.end_time || "0", 10);
              if (unlockDate > latestUnlock) latestUnlock = unlockDate;
            }
          }
          if (totalLocked > lpLockedPercent) lpLockedPercent = totalLocked;
          if (latestUnlock > 0) lpLockEndDate = latestUnlock;
        }
      }
    }
  } catch { /* GoPlus unavailable */ }

  // Merge GoPlusLabs holder count if we got it
  if (gpHolderCount > basic.holderCount) basic.holderCount = gpHolderCount;

  // Compute real topHolderPercent from actual holder data
  const realTopPercent = topHolders.length > 0 ? topHolders[0].percent : basic.topHolderPercent;
  if (realTopPercent > basic.topHolderPercent) basic.topHolderPercent = realTopPercent;

  const { score, flags, recommendation } = calculateRisk(basic, { ...sec, isVerified }, liq, hp);

  return {
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
    isLiquidityLocked: liq.isLiquidityLocked || lpLockedPercent > 50,
    lpTokenBurned: liq.lpTokenBurned,
    isVerified,
    isRenounced: sec.isRenounced,
    ownerCanMint: sec.ownerCanMint,
    ownerCanPause: sec.ownerCanPause || transferPausable,
    ownerCanBlacklist: sec.ownerCanBlacklist,
    isProxy: sec.isProxy,
    isHoneypot: hp.isHoneypot,
    buyTax: hp.buyTax,
    sellTax: hp.sellTax,
    scanTimestamp: Date.now(),
    scanDuration: Date.now() - start,
    // Enhanced data
    topHolders,
    lpLockedPercent,
    lpLockEndDate,
    creatorPercent,
    ownerAddress,
    isAntiWhale,
    canTakeBackOwnership,
    hiddenOwner,
    transferPausable,
    tradingCooldown,
    personalSlippageModifiable,
  };
}

// ─── Token Basics ────────────────────────────────────────────

async function getTokenBasics(tokenAddress: string, provider: ethers.JsonRpcProvider) {
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  const [name, symbol, decimals, totalSupply] = await Promise.all([
    token.name().catch(() => "Unknown"),
    token.symbol().catch(() => "???"),
    token.decimals().catch(() => 18),
    token.totalSupply().catch(() => BigInt(0)),
  ]);

  let ownerBalance = 0;
  try {
    const owner = await token.owner();
    if (owner !== ethers.ZeroAddress && totalSupply > BigInt(0)) {
      const ownerBal = await token.balanceOf(owner);
      ownerBalance = Number((ownerBal * BigInt(10000)) / totalSupply) / 100;
    }
  } catch { /* no owner */ }

  return {
    name: String(name),
    symbol: String(symbol),
    decimals: Number(decimals),
    totalSupply: ethers.formatUnits(totalSupply, decimals),
    topHolderPercent: ownerBalance,
    ownerBalance,
    holderCount: 0,
  };
}

// ─── Contract Security ───────────────────────────────────────

async function analyzeContractSecurity(tokenAddress: string, provider: ethers.JsonRpcProvider) {
  const code = await provider.getCode(tokenAddress);
  if (code === "0x") {
    return { isVerified: false, isRenounced: false, ownerCanMint: false, ownerCanPause: false, ownerCanBlacklist: false, isProxy: false };
  }

  const ownerCanMint = code.includes(DANGEROUS_SELECTORS.mint);
  const ownerCanPause = code.includes(DANGEROUS_SELECTORS.pause);
  const ownerCanBlacklist = code.includes(DANGEROUS_SELECTORS.blacklist);
  const isProxy = code.includes("363d3d373d3d3d363d73") || code.includes("5860208158601c335a63");

  let isRenounced = false;
  try {
    const token = new ethers.Contract(tokenAddress, ["function owner() view returns (address)"], provider);
    const owner = await token.owner();
    isRenounced = owner === ethers.ZeroAddress;
  } catch { /* no owner fn */ }

  return { isVerified: false, isRenounced, ownerCanMint, ownerCanPause, ownerCanBlacklist, isProxy };
}

// ─── Liquidity ───────────────────────────────────────────────

async function analyzeLiquidity(tokenAddress: string, provider: ethers.JsonRpcProvider, factory: ethers.Contract) {
  let liquidityUsd = 0;
  let isLiquidityLocked = false;
  let lpTokenBurned = false;

  try {
    const pairAddress = await factory.getPair(tokenAddress, WBNB);
    if (pairAddress !== ethers.ZeroAddress) {
      const pair = new ethers.Contract(pairAddress, PAIR_ABI, provider);
      const [reserve0, reserve1] = await pair.getReserves();
      const token0 = await pair.token0();
      const wbnbReserve = token0.toLowerCase() === WBNB.toLowerCase() ? reserve0 : reserve1;
      const bnbPrice = await getBnbPrice();
      liquidityUsd = Number(ethers.formatEther(wbnbReserve)) * bnbPrice * 2;

      const deadAddress = "0x000000000000000000000000000000000000dEaD";
      const [deadBal, zeroBal, totalLp] = await Promise.all([
        pair.balanceOf(deadAddress),
        pair.balanceOf(ethers.ZeroAddress),
        pair.totalSupply(),
      ]);
      const burnedPercent = totalLp > BigInt(0) ? Number(((deadBal + zeroBal) * BigInt(10000)) / totalLp) / 100 : 0;
      lpTokenBurned = burnedPercent > 90;
      isLiquidityLocked = burnedPercent > 50;
    }
  } catch { /* no WBNB pair */ }

  try {
    const pairAddress = await factory.getPair(tokenAddress, BUSD);
    if (pairAddress !== ethers.ZeroAddress) {
      const pair = new ethers.Contract(pairAddress, PAIR_ABI, provider);
      const [reserve0, reserve1] = await pair.getReserves();
      const token0 = await pair.token0();
      const busdReserve = token0.toLowerCase() === BUSD.toLowerCase() ? reserve0 : reserve1;
      liquidityUsd += Number(ethers.formatEther(busdReserve)) * 2;
    }
  } catch { /* no BUSD pair */ }

  return { liquidityUsd, isLiquidityLocked, lpTokenBurned };
}

// ─── Honeypot Detection ──────────────────────────────────────

async function detectHoneypot(tokenAddress: string): Promise<{ isHoneypot: boolean; buyTax: number; sellTax: number }> {
  try {
    const res = await fetch(`https://api.honeypot.is/v2/IsHoneypot?address=${encodeURIComponent(tokenAddress)}&chainID=56`, {
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const data = await res.json();
      return {
        isHoneypot: data.honeypotResult?.isHoneypot ?? false,
        buyTax: data.simulationResult?.buyTax ?? 0,
        sellTax: data.simulationResult?.sellTax ?? 0,
      };
    }
  } catch { /* API down */ }
  return { isHoneypot: false, buyTax: 0, sellTax: 0 };
}

// ─── Risk Calculation ────────────────────────────────────────

function calculateRisk(
  basic: { topHolderPercent: number },
  security: { isVerified: boolean; isRenounced: boolean; ownerCanMint: boolean; ownerCanPause: boolean; ownerCanBlacklist: boolean; isProxy: boolean },
  liquidity: { liquidityUsd: number; isLiquidityLocked: boolean; lpTokenBurned: boolean },
  honeypot: { isHoneypot: boolean; buyTax: number; sellTax: number }
): { score: number; flags: string[]; recommendation: "SAFE" | "CAUTION" | "AVOID" | "SCAM" } {
  let score = 0;
  const flags: string[] = [];

  if (honeypot.isHoneypot) return { score: 100, flags: ["HONEYPOT"], recommendation: "SCAM" };

  if (honeypot.buyTax > 50 || honeypot.sellTax > 50) { score += 40; flags.push("EXTREME_TAX"); }
  else if (honeypot.buyTax > 10 || honeypot.sellTax > 10) { score += 20; flags.push("HIGH_TAX"); }
  else if (honeypot.buyTax > 5 || honeypot.sellTax > 5) { score += 10; flags.push("MODERATE_TAX"); }

  if (liquidity.liquidityUsd < 1000) { score += 30; flags.push("CRITICAL_LOW_LIQUIDITY"); }
  else if (liquidity.liquidityUsd < 10000) { score += 20; flags.push("LOW_LIQUIDITY"); }
  else if (liquidity.liquidityUsd < 50000) { score += 5; }

  if (!liquidity.isLiquidityLocked && !liquidity.lpTokenBurned) { score += 15; flags.push("UNLOCKED_LIQUIDITY"); }

  if (security.ownerCanMint) { score += 15; flags.push("MINT_FUNCTION"); }
  if (security.ownerCanPause) { score += 10; flags.push("PAUSE_FUNCTION"); }
  if (security.ownerCanBlacklist) { score += 10; flags.push("BLACKLIST_FUNCTION"); }
  if (security.isProxy) { score += 10; flags.push("PROXY_CONTRACT"); }
  if (security.isRenounced) score -= 10;

  if (basic.topHolderPercent > 50) { score += 20; flags.push("WHALE_DOMINATED"); }
  else if (basic.topHolderPercent > 30) { score += 10; flags.push("HIGH_CONCENTRATION"); }

  score = Math.max(0, Math.min(100, score));

  let recommendation: "SAFE" | "CAUTION" | "AVOID" | "SCAM";
  if (score >= 70) recommendation = "SCAM";
  else if (score >= 40) recommendation = "AVOID";
  else if (score >= 20) recommendation = "CAUTION";
  else recommendation = "SAFE";

  return { score, flags, recommendation };
}

// ─── Safe Token Fast Path ────────────────────────────────────

async function safeScan(tokenAddress: string, provider: ethers.JsonRpcProvider, startTime: number): Promise<TokenRiskReport> {
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
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
    holderCount: 0, topHolderPercent: 0, ownerBalance: 0,
    liquidityUsd: 0, isLiquidityLocked: true, lpTokenBurned: false,
    isVerified: true, isRenounced: true,
    ownerCanMint: false, ownerCanPause: false, ownerCanBlacklist: false, isProxy: false,
    isHoneypot: false, buyTax: 0, sellTax: 0,
    scanTimestamp: Date.now(),
    scanDuration: Date.now() - startTime,
    topHolders: [], lpLockedPercent: 100, lpLockEndDate: 0,
    creatorPercent: 0, ownerAddress: "", isAntiWhale: false,
    canTakeBackOwnership: false, hiddenOwner: false,
    transferPausable: false, tradingCooldown: false, personalSlippageModifiable: false,
  };
}

// ─── Upstash Redis Persistence (Global Scan Store) ──────────
// Uses Upstash REST API — no SDK needed, just fetch().
// Free tier: 10K commands/day, 256MB storage.
// Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Vercel env vars.

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL || "";
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || "";
const SCANS_KEY = "aegis:scans";
const MAX_SCANS = 5000;

export interface GlobalScanRecord {
  address: string;
  name: string;
  symbol: string;
  riskScore: number;
  recommendation: string; // SAFE | CAUTION | AVOID | SCAM
  flags: string[];
  isHoneypot: boolean;
  buyTax: number;
  sellTax: number;
  holderCount: number;
  topHolderPercent: number;
  liquidityUsd: number;
  isLiquidityLocked: boolean;
  lpLockedPercent: number;
  ownerCanMint: boolean;
  isVerified: boolean;
  isRenounced: boolean;
  hiddenOwner: boolean;
  source: string; // "api" | "guardian" | "bot"
  scannedAt: number; // unix ms
}

// ─── Low-level Redis command ─────────────────────────────────

export function isRedisConfigured(): boolean {
  return !!(UPSTASH_URL && UPSTASH_TOKEN);
}

async function redis(command: string[]): Promise<unknown> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return null;
  try {
    const res = await fetch(UPSTASH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${UPSTASH_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.result;
  } catch {
    return null;
  }
}

// ─── Write ───────────────────────────────────────────────────

export async function redisSaveScan(
  report: Record<string, unknown>,
  source = "api"
): Promise<void> {
  const record: GlobalScanRecord = {
    address: String(report.address || "").toLowerCase(),
    name: String(report.name || "Unknown"),
    symbol: String(report.symbol || "???"),
    riskScore: Number(report.riskScore || 0),
    recommendation: String(report.recommendation || report.riskLevel || "unknown"),
    flags: Array.isArray(report.flags) ? report.flags : [],
    isHoneypot: Boolean(report.isHoneypot),
    buyTax: Number(report.buyTax || 0),
    sellTax: Number(report.sellTax || 0),
    holderCount: Number(report.holderCount || 0),
    topHolderPercent: Number(report.topHolderPercent || 0),
    liquidityUsd: Number(report.liquidityUsd || 0),
    isLiquidityLocked: Boolean(report.isLiquidityLocked),
    lpLockedPercent: Number(report.lpLockedPercent || 0),
    ownerCanMint: Boolean(report.ownerCanMint),
    isVerified: Boolean(report.isVerified),
    isRenounced: Boolean(report.isRenounced),
    hiddenOwner: Boolean(report.hiddenOwner),
    source,
    scannedAt: Date.now(),
  };
  await redis(["LPUSH", SCANS_KEY, JSON.stringify(record)]);
  await redis(["LTRIM", SCANS_KEY, "0", String(MAX_SCANS - 1)]);
}

// ─── Read ────────────────────────────────────────────────────

export async function redisGetAllScans(): Promise<GlobalScanRecord[]> {
  const result = await redis(["LRANGE", SCANS_KEY, "0", "-1"]);
  if (!Array.isArray(result)) return [];
  return result.map((s: unknown) => JSON.parse(String(s)));
}

export async function redisGetRecentScans(
  limit = 50
): Promise<GlobalScanRecord[]> {
  const result = await redis([
    "LRANGE",
    SCANS_KEY,
    "0",
    String(limit - 1),
  ]);
  if (!Array.isArray(result)) return [];
  return result.map((s: unknown) => JSON.parse(String(s)));
}

export async function redisGetScanCount(): Promise<number> {
  const result = await redis(["LLEN", SCANS_KEY]);
  return typeof result === "number" ? result : 0;
}

// ─── Analytics (computed from all scans) ─────────────────────

export async function redisGetAnalytics() {
  const scans = await redisGetAllScans();

  const breakdown = { safe: 0, caution: 0, avoid: 0, scam: 0 };
  let honeypots = 0;
  let rugRisks = 0;
  let totalRisk = 0;
  const tokenMap = new Map<
    string,
    { count: number; latest: GlobalScanRecord }
  >();
  const flagCount: Record<string, number> = {};
  const hourly: number[] = new Array(24).fill(0);

  for (const s of scans) {
    // Risk breakdown
    const level = s.recommendation.toUpperCase();
    if (level === "SAFE" || s.riskScore <= 30) breakdown.safe++;
    else if (level === "CAUTION" || s.riskScore <= 55) breakdown.caution++;
    else if (level === "AVOID" || s.riskScore <= 79) breakdown.avoid++;
    else breakdown.scam++;

    if (s.isHoneypot) honeypots++;
    if (s.riskScore >= 70) rugRisks++;
    totalRisk += s.riskScore;

    // Token tracking
    const addr = s.address.toLowerCase();
    const existing = tokenMap.get(addr);
    if (!existing) {
      tokenMap.set(addr, { count: 1, latest: s });
    } else {
      existing.count++;
    }

    // Flags
    if (s.flags) {
      for (const f of s.flags) {
        flagCount[f] = (flagCount[f] || 0) + 1;
      }
    }

    // Hourly
    const h = new Date(s.scannedAt).getHours();
    if (!isNaN(h)) hourly[h]++;
  }

  const topScannedTokens = [...tokenMap.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([addr, d]) => ({
      address: addr,
      name: d.latest.name,
      symbol: d.latest.symbol,
      count: d.count,
      latestRisk: d.latest.riskScore,
    }));

  const flagFrequency: Record<string, number> = {};
  Object.entries(flagCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .forEach(([flag, count]) => {
      flagFrequency[flag] = count;
    });

  const scansByHour = hourly.map((count, i) => ({
    hour: `${i.toString().padStart(2, "0")}:00`,
    count,
  }));

  return {
    totalScans: scans.length,
    uniqueTokens: tokenMap.size,
    avgRiskScore: scans.length ? Math.round(totalRisk / scans.length) : 0,
    honeypotCount: honeypots,
    rugPullRiskCount: rugRisks,
    riskBreakdown: breakdown,
    topScannedTokens,
    flagFrequency,
    scansByHour,
    recentScans: scans.slice(0, 50),
  };
}

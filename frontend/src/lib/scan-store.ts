// ─── Client-side Scan History (localStorage) ────────────────
// Persists scan results in the browser so analytics survive
// Vercel serverless cold starts.

const STORAGE_KEY = "aegis_scan_history";
const MAX_RECORDS = 500;

export interface StoredScan {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  riskScore: number;
  recommendation: string;
  flags: string[];
  isHoneypot: boolean;
  buyTax: number;
  sellTax: number;
  liquidityUsd: number;
  isLiquidityLocked: boolean;
  lpLockedPercent: number;
  lpTokenBurned: boolean;
  holderCount: number;
  topHolderPercent: number;
  creatorPercent: number;
  ownerCanMint: boolean;
  ownerCanPause: boolean;
  ownerCanBlacklist: boolean;
  isRenounced: boolean;
  isProxy: boolean;
  isVerified: boolean;
  hiddenOwner: boolean;
  canTakeBackOwnership: boolean;
  transferPausable: boolean;
  tradingCooldown: boolean;
  personalSlippageModifiable: boolean;
  isAntiWhale: boolean;
  ownerAddress: string;
  totalSupply: string;
  topHolders: { address: string; percent: number; isContract: boolean }[];
  lpLockEndDate: number;
  scanTimestamp: number;
  scanDuration: number;
  scannedAt: number;
}

function readStore(): StoredScan[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeStore(records: StoredScan[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, MAX_RECORDS)));
  } catch { /* storage full — graceful degradation */ }
}

/** Save a scan result from the API response */
export function saveScan(data: Record<string, unknown>): void {
  const records = readStore();
  const record: StoredScan = {
    address: String(data.address || ""),
    symbol: String(data.symbol || ""),
    name: String(data.name || ""),
    decimals: Number(data.decimals || 18),
    riskScore: Number(data.riskScore || 0),
    recommendation: String(data.recommendation || "CAUTION"),
    flags: Array.isArray(data.flags) ? data.flags as string[] : [],
    isHoneypot: Boolean(data.isHoneypot),
    buyTax: Number(data.buyTax || 0),
    sellTax: Number(data.sellTax || 0),
    liquidityUsd: Number(data.liquidityUsd || 0),
    isLiquidityLocked: Boolean(data.isLiquidityLocked),
    lpLockedPercent: Number(data.lpLockedPercent || 0),
    lpTokenBurned: Boolean(data.lpTokenBurned),
    holderCount: Number(data.holderCount || 0),
    topHolderPercent: Number(data.topHolderPercent || 0),
    creatorPercent: Number(data.creatorPercent || 0),
    ownerCanMint: Boolean(data.ownerCanMint),
    ownerCanPause: Boolean(data.ownerCanPause),
    ownerCanBlacklist: Boolean(data.ownerCanBlacklist),
    isRenounced: Boolean(data.isRenounced),
    isProxy: Boolean(data.isProxy),
    isVerified: Boolean(data.isVerified),
    hiddenOwner: Boolean(data.hiddenOwner),
    canTakeBackOwnership: Boolean(data.canTakeBackOwnership),
    transferPausable: Boolean(data.transferPausable),
    tradingCooldown: Boolean(data.tradingCooldown),
    personalSlippageModifiable: Boolean(data.personalSlippageModifiable),
    isAntiWhale: Boolean(data.isAntiWhale),
    ownerAddress: String(data.ownerAddress || ""),
    totalSupply: String(data.totalSupply || "0"),
    topHolders: Array.isArray(data.topHolders) ? data.topHolders as StoredScan["topHolders"] : [],
    lpLockEndDate: Number(data.lpLockEndDate || 0),
    scanTimestamp: Number(data.scanTimestamp || Date.now()),
    scanDuration: Number(data.scanDuration || 0),
    scannedAt: Date.now(),
  };

  // Add to front, keep newest first
  records.unshift(record);
  writeStore(records);
}

/** Save multiple scans (e.g. from a guardian wallet scan) */
export function saveScans(scans: Record<string, unknown>[]): void {
  for (const s of scans) saveScan(s);
}

/** Get all stored scans */
export function getStoredScans(): StoredScan[] {
  return readStore();
}

/** Get unique tokens (latest scan per token) */
export function getUniqueTokenScans(): StoredScan[] {
  const records = readStore();
  const seen = new Map<string, StoredScan>();
  for (const r of records) {
    const key = r.address.toLowerCase();
    if (!seen.has(key)) seen.set(key, r);
  }
  return Array.from(seen.values());
}

/** Compute analytics from stored scans */
export function computeLocalAnalytics(): {
  totalScans: number;
  uniqueTokens: number;
  riskBreakdown: { safe: number; caution: number; avoid: number; scam: number };
  honeypotCount: number;
  rugPullRiskCount: number;
  avgRiskScore: number;
  topScannedTokens: { symbol: string; address: string; count: number }[];
  flagFrequency: Record<string, number>;
  recentScans: StoredScan[];
  scansByHour: { hour: string; count: number }[];
} {
  const records = readStore();
  const unique = getUniqueTokenScans();

  const riskBreakdown = { safe: 0, caution: 0, avoid: 0, scam: 0 };
  let totalRisk = 0;
  let honeypotCount = 0;
  let rugPullRiskCount = 0;
  const flagFreq: Record<string, number> = {};

  for (const r of unique) {
    if (r.recommendation === "SAFE") riskBreakdown.safe++;
    else if (r.recommendation === "CAUTION") riskBreakdown.caution++;
    else if (r.recommendation === "AVOID") riskBreakdown.avoid++;
    else if (r.recommendation === "SCAM") riskBreakdown.scam++;
    totalRisk += r.riskScore;
    if (r.isHoneypot) honeypotCount++;
    if (r.ownerCanMint || r.hiddenOwner || r.canTakeBackOwnership || r.creatorPercent > 30) rugPullRiskCount++;
    for (const f of r.flags) flagFreq[f] = (flagFreq[f] || 0) + 1;
  }

  // Token scan counts
  const countMap = new Map<string, { symbol: string; count: number }>();
  for (const r of records) {
    const key = r.address.toLowerCase();
    const entry = countMap.get(key) || { symbol: r.symbol, count: 0 };
    entry.count++;
    countMap.set(key, entry);
  }
  const topScannedTokens = Array.from(countMap.entries())
    .map(([address, { symbol, count }]) => ({ symbol, address, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Hourly chart (last 24h)
  const now = Date.now();
  const hourBuckets = new Map<string, number>();
  for (let i = 23; i >= 0; i--) {
    const d = new Date(now - i * 3600_000);
    const key = `${d.getUTCHours().toString().padStart(2, "0")}:00`;
    hourBuckets.set(key, 0);
  }
  for (const r of records) {
    if (now - r.scannedAt > 86400_000) continue;
    const d = new Date(r.scannedAt);
    const key = `${d.getUTCHours().toString().padStart(2, "0")}:00`;
    hourBuckets.set(key, (hourBuckets.get(key) || 0) + 1);
  }

  return {
    totalScans: records.length,
    uniqueTokens: unique.length,
    riskBreakdown,
    honeypotCount,
    rugPullRiskCount,
    avgRiskScore: unique.length > 0 ? Math.round(totalRisk / unique.length) : 0,
    topScannedTokens,
    flagFrequency: flagFreq,
    recentScans: records.slice(0, 50),
    scansByHour: Array.from(hourBuckets.entries()).map(([hour, count]) => ({ hour, count })),
  };
}

/** Clear all stored scan data */
export function clearStoredScans(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

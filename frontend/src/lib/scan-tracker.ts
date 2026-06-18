// ─── Scan History Tracker ────────────────────────────────────
// Persists every token scan for analytics & data reference.
// Uses globalThis in-memory store (survives across requests in same process).
// Also writes to /tmp/aegis-scan-history.json as backup (persists across cold starts on some hosts).

import { readFileSync, writeFileSync, existsSync } from "fs";

const STORE_FILE = "/tmp/aegis-scan-history.json";
const MAX_RECORDS = 5000; // keep last 5000 scans to bound memory

// ─── Types ───────────────────────────────────────────────────

export interface ScanRecord {
  // Token identity
  address: string;
  symbol: string;
  name: string;
  decimals: number;

  // Risk assessment
  riskScore: number;
  recommendation: string;
  flags: string[];

  // Security
  isHoneypot: boolean;
  buyTax: number;
  sellTax: number;
  isVerified: boolean;
  isRenounced: boolean;
  ownerCanMint: boolean;
  ownerCanPause: boolean;
  ownerCanBlacklist: boolean;
  isProxy: boolean;
  hiddenOwner: boolean;
  canTakeBackOwnership: boolean;
  transferPausable: boolean;
  tradingCooldown: boolean;
  personalSlippageModifiable: boolean;
  isAntiWhale: boolean;

  // Liquidity
  liquidityUsd: number;
  isLiquidityLocked: boolean;
  lpTokenBurned: boolean;
  lpLockedPercent: number;
  lpLockEndDate: number;

  // Distribution
  totalSupply: string;
  holderCount: number;
  topHolderPercent: number;
  creatorPercent: number;
  ownerAddress: string;
  topHolders: { address: string; percent: number; isContract: boolean }[];

  // Metadata
  scannedAt: number;       // unix ms
  scanDuration: number;    // ms
  scanSource: "api" | "guardian" | "bot"; // who triggered the scan
}

// ─── Global Store ────────────────────────────────────────────

interface ScanStore {
  records: ScanRecord[];       // all scans, newest first
  byToken: Map<string, ScanRecord[]>; // grouped by address
  totalScans: number;
}

function getStore(): ScanStore {
  const g = globalThis as Record<string, unknown>;
  if (g.__aegisScanStore) return g.__aegisScanStore as ScanStore;

  // Try to load from disk
  let records: ScanRecord[] = [];
  try {
    if (existsSync(STORE_FILE)) {
      const raw = readFileSync(STORE_FILE, "utf-8");
      records = JSON.parse(raw) as ScanRecord[];
    }
  } catch { /* fresh start */ }

  const byToken = new Map<string, ScanRecord[]>();
  for (const r of records) {
    const key = r.address.toLowerCase();
    const arr = byToken.get(key) || [];
    arr.push(r);
    byToken.set(key, arr);
  }

  const store: ScanStore = { records, byToken, totalScans: records.length };
  g.__aegisScanStore = store;
  return store;
}

function persistToDisk(store: ScanStore): void {
  try {
    writeFileSync(STORE_FILE, JSON.stringify(store.records), "utf-8");
  } catch { /* disk write failed, store remains in memory */ }
}

// ─── Public API ──────────────────────────────────────────────

/** Record a new scan result */
export function trackScan(report: Record<string, unknown>, source: ScanRecord["scanSource"] = "api"): void {
  const store = getStore();
  const r = report as Record<string, unknown>;

  const record: ScanRecord = {
    address: String(r.address || ""),
    symbol: String(r.symbol || ""),
    name: String(r.name || ""),
    decimals: Number(r.decimals || 18),
    riskScore: Number(r.riskScore || 0),
    recommendation: String(r.recommendation || "CAUTION"),
    flags: Array.isArray(r.flags) ? r.flags as string[] : [],
    isHoneypot: Boolean(r.isHoneypot),
    buyTax: Number(r.buyTax || 0),
    sellTax: Number(r.sellTax || 0),
    isVerified: Boolean(r.isVerified),
    isRenounced: Boolean(r.isRenounced),
    ownerCanMint: Boolean(r.ownerCanMint),
    ownerCanPause: Boolean(r.ownerCanPause),
    ownerCanBlacklist: Boolean(r.ownerCanBlacklist),
    isProxy: Boolean(r.isProxy),
    hiddenOwner: Boolean(r.hiddenOwner),
    canTakeBackOwnership: Boolean(r.canTakeBackOwnership),
    transferPausable: Boolean(r.transferPausable),
    tradingCooldown: Boolean(r.tradingCooldown),
    personalSlippageModifiable: Boolean(r.personalSlippageModifiable),
    isAntiWhale: Boolean(r.isAntiWhale),
    liquidityUsd: Number(r.liquidityUsd || 0),
    isLiquidityLocked: Boolean(r.isLiquidityLocked),
    lpTokenBurned: Boolean(r.lpTokenBurned),
    lpLockedPercent: Number(r.lpLockedPercent || 0),
    lpLockEndDate: Number(r.lpLockEndDate || 0),
    totalSupply: String(r.totalSupply || "0"),
    holderCount: Number(r.holderCount || 0),
    topHolderPercent: Number(r.topHolderPercent || 0),
    creatorPercent: Number(r.creatorPercent || 0),
    ownerAddress: String(r.ownerAddress || ""),
    topHolders: Array.isArray(r.topHolders)
      ? (r.topHolders as { address: string; percent: number; isContract: boolean }[])
      : [],
    scannedAt: Date.now(),
    scanDuration: Number(r.scanDuration || 0),
    scanSource: source,
  };

  // Add to front
  store.records.unshift(record);
  store.totalScans++;

  // Index by token
  const key = record.address.toLowerCase();
  const arr = store.byToken.get(key) || [];
  arr.unshift(record);
  store.byToken.set(key, arr);

  // Trim to MAX_RECORDS
  if (store.records.length > MAX_RECORDS) {
    store.records = store.records.slice(0, MAX_RECORDS);
  }

  // Persist async (fire-and-forget)
  persistToDisk(store);
}

/** Get all scan records */
export function getAllScans(): ScanRecord[] {
  return getStore().records;
}

/** Get scan history for a specific token */
export function getTokenHistory(address: string): ScanRecord[] {
  return getStore().byToken.get(address.toLowerCase()) || [];
}

/** Get unique tokens scanned */
export function getUniqueTokens(): { address: string; symbol: string; name: string; lastScan: ScanRecord; scanCount: number }[] {
  const store = getStore();
  const result: { address: string; symbol: string; name: string; lastScan: ScanRecord; scanCount: number }[] = [];

  for (const [address, scans] of store.byToken.entries()) {
    const lastScan = scans[0]; // newest first
    result.push({
      address,
      symbol: lastScan.symbol,
      name: lastScan.name,
      lastScan,
      scanCount: scans.length,
    });
  }

  // Sort by most recently scanned
  result.sort((a, b) => b.lastScan.scannedAt - a.lastScan.scannedAt);
  return result;
}

/** Get analytics summary */
export function getAnalytics(): {
  totalScans: number;
  uniqueTokens: number;
  riskBreakdown: { safe: number; caution: number; avoid: number; scam: number };
  honeypotCount: number;
  rugPullRiskCount: number;
  avgRiskScore: number;
  topScannedTokens: { symbol: string; address: string; count: number }[];
  flagFrequency: Record<string, number>;
  recentScans: ScanRecord[];
  scansByHour: { hour: string; count: number }[];
} {
  const store = getStore();
  const records = store.records;

  // Risk breakdown (use latest scan per token)
  const latestByToken = new Map<string, ScanRecord>();
  for (const r of records) {
    const key = r.address.toLowerCase();
    if (!latestByToken.has(key)) latestByToken.set(key, r);
  }
  const latest = Array.from(latestByToken.values());

  const riskBreakdown = { safe: 0, caution: 0, avoid: 0, scam: 0 };
  let totalRisk = 0;
  let honeypotCount = 0;
  let rugPullRiskCount = 0;
  const flagFreq: Record<string, number> = {};

  for (const r of latest) {
    if (r.recommendation === "SAFE") riskBreakdown.safe++;
    else if (r.recommendation === "CAUTION") riskBreakdown.caution++;
    else if (r.recommendation === "AVOID") riskBreakdown.avoid++;
    else if (r.recommendation === "SCAM") riskBreakdown.scam++;

    totalRisk += r.riskScore;
    if (r.isHoneypot) honeypotCount++;
    if (r.ownerCanMint || r.hiddenOwner || r.canTakeBackOwnership || r.creatorPercent > 30) {
      rugPullRiskCount++;
    }

    for (const f of r.flags) {
      flagFreq[f] = (flagFreq[f] || 0) + 1;
    }
  }

  // Top scanned tokens
  const tokenCounts: { symbol: string; address: string; count: number }[] = [];
  for (const [addr, scans] of store.byToken.entries()) {
    tokenCounts.push({ symbol: scans[0].symbol, address: addr, count: scans.length });
  }
  tokenCounts.sort((a, b) => b.count - a.count);

  // Scans by hour (last 24h)
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
    totalScans: store.totalScans,
    uniqueTokens: latestByToken.size,
    riskBreakdown,
    honeypotCount,
    rugPullRiskCount,
    avgRiskScore: latest.length > 0 ? Math.round(totalRisk / latest.length) : 0,
    topScannedTokens: tokenCounts.slice(0, 10),
    flagFrequency: flagFreq,
    recentScans: records.slice(0, 50),
    scansByHour: Array.from(hourBuckets.entries()).map(([hour, count]) => ({ hour, count })),
  };
}

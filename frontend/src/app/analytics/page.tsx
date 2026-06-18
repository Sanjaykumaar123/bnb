"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { type GlobalScanRecord } from "../../lib/redis-store";
import {
  BarChart3, Shield, AlertTriangle, Skull, CheckCircle, Activity,
  TrendingUp, Eye, Search, Download, RefreshCw, ExternalLink,
  Droplets, Lock, Users,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────

interface Analytics {
  totalScans: number;
  uniqueTokens: number;
  riskBreakdown: { safe: number; caution: number; avoid: number; scam: number };
  honeypotCount: number;
  rugPullRiskCount: number;
  avgRiskScore: number;
  topScannedTokens: { symbol: string; address: string; count: number }[];
  flagFrequency: Record<string, number>;
  recentScans: GlobalScanRecord[];
  scansByHour: { hour: string; count: number }[];
}

// ─── Helpers ─────────────────────────────────────────────────

function riskColor(score: number): string {
  if (score < 30) return "var(--green)";
  if (score < 60) return "#facc15";
  if (score < 80) return "#f97316";
  return "#ef4444";
}

function recBadge(rec: string): { bg: string; text: string; icon: typeof CheckCircle } {
  switch (rec) {
    case "SAFE": return { bg: "rgba(52,211,153,0.1)", text: "var(--green)", icon: CheckCircle };
    case "CAUTION": return { bg: "rgba(250,204,21,0.1)", text: "#facc15", icon: AlertTriangle };
    case "AVOID": return { bg: "rgba(249,115,22,0.1)", text: "#f97316", icon: AlertTriangle };
    case "SCAM": return { bg: "rgba(239,68,68,0.1)", text: "#ef4444", icon: Skull };
    default: return { bg: "rgba(255,255,255,0.05)", text: "var(--text-muted)", icon: Shield };
  }
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return `${Math.floor(diff / 86400_000)}d ago`;
}

// ─── Component ───────────────────────────────────────────────

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<"all" | "SAFE" | "CAUTION" | "AVOID" | "SCAM">("all");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/analytics?view=dashboard");
      if (res.ok) {
        const analytics = await res.json();
        setData(analytics as Analytics);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleExport = async () => {
    try {
      const res = await fetch("/api/analytics?view=export");
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `aegis-scan-data-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* fail silently */ }
  };

  const filteredScans = data?.recentScans.filter(
    (s) => filter === "all" || s.recommendation === filter
  ) || [];

  // Max for the hourly bar chart
  const maxHourly = data ? Math.max(...data.scansByHour.map((h) => h.count), 1) : 1;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white flex items-center gap-3">
            <BarChart3 className="w-8 h-8" style={{ color: "var(--accent)" }} />
            Scan Analytics
          </h1>
          <p className="text-base mt-1" style={{ color: "var(--text-secondary)" }}>
            Global tracking data from every token scanned across all users
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchData} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={{ background: "var(--bg-raised)", color: "var(--text-muted)", border: "1px solid var(--border-subtle)" }}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={{ background: "var(--bg-raised)", color: "var(--text-muted)", border: "1px solid var(--border-subtle)" }}>
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-6 h-6 animate-spin" style={{ color: "var(--accent)" }} />
          <span className="ml-3 text-sm" style={{ color: "var(--text-muted)" }}>Loading global analytics...</span>
        </div>
      ) : error ? (
        <div className="card p-12 text-center">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4" style={{ color: "#f97316" }} />
          <h2 className="text-lg font-semibold text-white mb-2">Failed to load analytics</h2>
          <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
            Could not connect to the analytics server. Try again.
          </p>
          <button onClick={fetchData} className="btn-primary inline-flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      ) : !data || data.totalScans === 0 ? (
        <div className="card p-12 text-center">
          <BarChart3 className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--text-muted)" }} />
          <h2 className="text-lg font-semibold text-white mb-2">No scan data yet</h2>
          <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
            Scan tokens using the Scanner to start building the global analytics database. Every scan from any user contributes.
          </p>
          <Link href="/scanner" className="btn-primary inline-flex items-center gap-2">
            <Search className="w-4 h-4" />
            Go to Scanner
          </Link>
        </div>
      ) : (
        <>
          {/* ═══ STAT CARDS ═══ */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            <StatCard label="Total Scans" value={data.totalScans.toLocaleString()} icon={Activity} color="var(--accent)" />
            <StatCard label="Unique Tokens" value={data.uniqueTokens.toLocaleString()} icon={Eye} color="var(--purple)" />
            <StatCard label="Avg Risk Score" value={`${data.avgRiskScore}/100`} icon={Shield} color={riskColor(data.avgRiskScore)} />
            <StatCard label="Honeypots Found" value={data.honeypotCount.toLocaleString()} icon={Skull} color="#ef4444" />
          </div>

          {/* ═══ RISK BREAKDOWN + HOURLY CHART ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
            {/* Risk Breakdown */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <Shield className="w-4 h-4" style={{ color: "var(--accent)" }} />
                Risk Breakdown
              </h3>
              <div className="space-y-3">
                <RiskBar label="Safe" count={data.riskBreakdown.safe} total={data.uniqueTokens} color="var(--green)" />
                <RiskBar label="Caution" count={data.riskBreakdown.caution} total={data.uniqueTokens} color="#facc15" />
                <RiskBar label="Avoid" count={data.riskBreakdown.avoid} total={data.uniqueTokens} color="#f97316" />
                <RiskBar label="Scam" count={data.riskBreakdown.scam} total={data.uniqueTokens} color="#ef4444" />
              </div>
              <div className="mt-4 pt-3 border-t flex items-center gap-4 text-xs" style={{ borderColor: "var(--border-subtle)", color: "var(--text-muted)" }}>
                <span className="flex items-center gap-1"><Skull className="w-3 h-3" style={{ color: "#ef4444" }} /> {data.honeypotCount} honeypots</span>
                <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3" style={{ color: "#f97316" }} /> {data.rugPullRiskCount} rug risks</span>
              </div>
            </div>

            {/* Scans per Hour */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" style={{ color: "var(--accent)" }} />
                Scan Activity (24h)
              </h3>
              <div className="flex items-end gap-[3px] h-32">
                {data.scansByHour.map((h) => (
                  <div key={h.hour} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                    <div className="absolute -top-6 opacity-0 group-hover:opacity-100 transition-opacity text-[9px] text-white bg-black/80 px-1.5 py-0.5 rounded whitespace-nowrap z-10">
                      {h.hour}: {h.count} scans
                    </div>
                    <div
                      className="w-full rounded-t transition-all"
                      style={{
                        height: `${Math.max((h.count / maxHourly) * 100, 2)}%`,
                        background: h.count > 0 ? "var(--accent)" : "var(--bg-elevated)",
                        opacity: h.count > 0 ? 0.8 : 0.3,
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-2 text-[9px]" style={{ color: "var(--text-muted)" }}>
                <span>{data.scansByHour[0]?.hour}</span>
                <span>Now</span>
              </div>
            </div>
          </div>

          {/* ═══ TOP SCANNED TOKENS + FLAG FREQUENCY ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
            {/* Top Scanned */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <Search className="w-4 h-4" style={{ color: "var(--purple)" }} />
                Most Scanned Tokens
              </h3>
              {data.topScannedTokens.length === 0 ? (
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>No data yet</p>
              ) : (
                <div className="space-y-2">
                  {data.topScannedTokens.slice(0, 8).map((t, i) => (
                    <Link key={t.address} href={`/scan/${t.address}`}
                      className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/[0.03] transition-colors">
                      <div className="flex items-center gap-2.5">
                        <span className="text-[10px] font-bold w-4 text-center" style={{ color: "var(--text-muted)" }}>{i + 1}</span>
                        <span className="text-sm font-medium text-white">{t.symbol}</span>
                        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                          {t.address.slice(0, 6)}...{t.address.slice(-4)}
                        </span>
                      </div>
                      <span className="text-xs font-mono" style={{ color: "var(--accent)" }}>{t.count} scans</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Flag Frequency */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" style={{ color: "#f97316" }} />
                Common Risk Flags
              </h3>
              {Object.keys(data.flagFrequency).length === 0 ? (
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>No flags detected yet</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(data.flagFrequency)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 15)
                    .map(([flag, count]) => (
                      <span key={flag} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium"
                        style={{
                          background: flag.includes("HONEYPOT") || flag.includes("SCAM")
                            ? "rgba(239,68,68,0.1)" : flag.includes("SAFE") || flag.includes("VERIFIED")
                            ? "rgba(52,211,153,0.1)" : "rgba(250,204,21,0.08)",
                          color: flag.includes("HONEYPOT") || flag.includes("SCAM")
                            ? "#ef4444" : flag.includes("SAFE") || flag.includes("VERIFIED")
                            ? "var(--green)" : "#facc15",
                        }}>
                        {flag}
                        <span className="font-mono opacity-70">({count})</span>
                      </span>
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* ═══ RECENT SCANS TABLE ═══ */}
          <div className="card p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Activity className="w-4 h-4" style={{ color: "var(--accent)" }} />
                Recent Scans ({filteredScans.length})
              </h3>
              <div className="flex gap-1.5">
                {(["all", "SAFE", "CAUTION", "AVOID", "SCAM"] as const).map((f) => (
                  <button key={f} onClick={() => setFilter(f)}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all"
                    style={{
                      background: filter === f ? "var(--accent-muted)" : "var(--bg-elevated)",
                      color: filter === f ? "var(--accent)" : "var(--text-muted)",
                      border: `1px solid ${filter === f ? "var(--accent-border)" : "transparent"}`,
                    }}>
                    {f === "all" ? "All" : f}
                  </button>
                ))}
              </div>
            </div>

            {filteredScans.length === 0 ? (
              <p className="text-xs text-center py-8" style={{ color: "var(--text-muted)" }}>No scans match this filter</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                      <th className="pb-3 pr-4">Token</th>
                      <th className="pb-3 pr-4">Risk</th>
                      <th className="pb-3 pr-4 hidden sm:table-cell">Liquidity</th>
                      <th className="pb-3 pr-4 hidden md:table-cell">Top Holder</th>
                      <th className="pb-3 pr-4 hidden md:table-cell">Tax</th>
                      <th className="pb-3 pr-4 hidden lg:table-cell">Flags</th>
                      <th className="pb-3 text-right">When</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: "var(--border-subtle)" }}>
                    {filteredScans.slice(0, 30).map((scan, i) => {
                      const badge = recBadge(scan.recommendation);
                      const BadgeIcon = badge.icon;
                      return (
                        <tr key={`${scan.address}-${i}`} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-2.5 pr-4">
                            <Link href={`/scan/${scan.address}`} className="flex items-center gap-2 group">
                              <span className="text-sm font-medium text-white group-hover:underline">{scan.symbol}</span>
                              <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>
                                {scan.address.slice(0, 6)}...{scan.address.slice(-4)}
                              </span>
                              <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                            </Link>
                          </td>
                          <td className="py-2.5 pr-4">
                            <div className="flex items-center gap-1.5">
                              <div className="w-8 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-elevated)" }}>
                                <div className="h-full rounded-full" style={{ width: `${scan.riskScore}%`, background: riskColor(scan.riskScore) }} />
                              </div>
                              <span className="text-xs font-mono" style={{ color: riskColor(scan.riskScore) }}>{scan.riskScore}</span>
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium"
                                style={{ background: badge.bg, color: badge.text }}>
                                <BadgeIcon className="w-2.5 h-2.5" />
                                {scan.recommendation}
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 pr-4 hidden sm:table-cell">
                            <div className="flex items-center gap-1">
                              <Droplets className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
                              <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
                                ${scan.liquidityUsd >= 1000 ? `${(scan.liquidityUsd / 1000).toFixed(1)}K` : scan.liquidityUsd.toFixed(0)}
                              </span>
                              {scan.isLiquidityLocked && <Lock className="w-2.5 h-2.5" style={{ color: "var(--green)" }} />}
                            </div>
                          </td>
                          <td className="py-2.5 pr-4 hidden md:table-cell">
                            <div className="flex items-center gap-1">
                              <Users className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
                              <span className="text-xs font-mono" style={{ color: scan.topHolderPercent > 30 ? "#f97316" : "var(--text-secondary)" }}>
                                {scan.topHolderPercent.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 pr-4 hidden md:table-cell">
                            <span className="text-xs font-mono" style={{ color: scan.sellTax > 10 ? "#ef4444" : "var(--text-secondary)" }}>
                              {scan.buyTax}/{scan.sellTax}%
                            </span>
                          </td>
                          <td className="py-2.5 pr-4 hidden lg:table-cell">
                            <div className="flex flex-wrap gap-1">
                              {scan.isHoneypot && <FlagPill label="HONEYPOT" color="#ef4444" />}
                              {scan.hiddenOwner && <FlagPill label="HIDDEN OWNER" color="#f97316" />}
                              {scan.ownerCanMint && <FlagPill label="MINT" color="#f97316" />}
                              {!scan.isVerified && <FlagPill label="UNVERIFIED" color="#facc15" />}
                              {scan.isRenounced && <FlagPill label="RENOUNCED" color="var(--green)" />}
                            </div>
                          </td>
                          <td className="py-2.5 text-right">
                            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{timeAgo(scan.scannedAt)}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color }: {
  label: string; value: string; icon: typeof Activity; color: string;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4" style={{ color }} />
        <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{label}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  );
}

function RiskBar({ label, count, total, color }: {
  label: string; count: number; total: number; color: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium" style={{ color }}>{label}</span>
        <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>{count} ({pct.toFixed(0)}%)</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-elevated)" }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

function FlagPill({ label, color }: { label: string; color: string }) {
  return (
    <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide"
      style={{ background: `${color}15`, color }}>
      {label}
    </span>
  );
}

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Search, Shield, AlertTriangle, Skull, CheckCircle,
  ExternalLink, Loader2, Copy, Share2, ArrowLeft,
  Lock, Droplets, Eye, X, ChevronDown, ChevronUp,
} from "lucide-react";
import toast from "react-hot-toast";
import { saveScan } from "../../../lib/scan-store";

// ─── Types ───────────────────────────────────────────────────

interface ScanResult {
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
}

// ─── Helpers ─────────────────────────────────────────────────

function riskColor(score: number) {
  if (score >= 70) return "#ef4444";
  if (score >= 40) return "#f97316";
  if (score >= 20) return "#eab308";
  return "#22c55e";
}

function riskBg(score: number) {
  if (score >= 70) return "rgba(239, 68, 68, 0.08)";
  if (score >= 40) return "rgba(249, 115, 22, 0.08)";
  if (score >= 20) return "rgba(234, 179, 8, 0.08)";
  return "rgba(34, 197, 94, 0.08)";
}

function flagLabel(flag: string) {
  const map: Record<string, string> = {
    HONEYPOT: "Honeypot Trap",
    EXTREME_TAX: "Extreme Tax (>50%)",
    HIGH_TAX: "High Tax (>10%)",
    MODERATE_TAX: "Notable Tax (>5%)",
    CRITICAL_LOW_LIQUIDITY: "No Liquidity (<$1K)",
    LOW_LIQUIDITY: "Low Liquidity (<$10K)",
    UNLOCKED_LIQUIDITY: "LP Not Locked",
    MINT_FUNCTION: "Owner Can Mint",
    PAUSE_FUNCTION: "Owner Can Pause",
    BLACKLIST_FUNCTION: "Can Blacklist",
    PROXY_CONTRACT: "Upgradeable Proxy",
    WHALE_DOMINATED: "Whale Dominated (>50%)",
    HIGH_CONCENTRATION: "High Concentration (>30%)",
  };
  return map[flag] || flag;
}

function formatUsd(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

// ─── Page ────────────────────────────────────────────────────

export default function ScanResultPage({ params }: { params: { address: string } }) {
  const { address } = params;
  const [result, setResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/scan?address=${encodeURIComponent(address)}`);
        if (!res.ok) throw new Error("Scan failed");
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setResult(data);
        saveScan(data as unknown as Record<string, unknown>);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to scan token");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [address]);

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    toast.success("Scan link copied!");
  };

  const shareTwitter = () => {
    if (!result) return;
    const emoji = result.riskScore >= 70 ? "🚨" : result.riskScore >= 40 ? "⚠️" : result.riskScore >= 20 ? "🟡" : "✅";
    const topFlags = result.flags.slice(0, 3).map((f) => flagLabel(f)).join(" · ");
    const lines = [
      `${emoji} $${result.symbol} — Risk Score: ${result.riskScore}/100 (${result.recommendation})`,
      topFlags ? `\nFlags: ${topFlags}` : "",
      `\nTax: ${result.buyTax.toFixed(1)}% buy / ${result.sellTax.toFixed(1)}% sell`,
      `\nLiquidity: ${formatUsd(result.liquidityUsd)}`,
      `\n\nScanned with @uniq_minds 🛡️`,
    ].filter(Boolean).join("");
    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(lines)}&url=${encodeURIComponent(shareUrl)}`, "_blank", "noopener,noreferrer");
  };

  const shareTelegram = () => {
    if (!result) return;
    const emoji = result.riskScore >= 70 ? "🚨" : result.riskScore >= 40 ? "⚠️" : result.riskScore >= 20 ? "🟡" : "✅";
    const topFlags = result.flags.slice(0, 3).map((f) => flagLabel(f)).join(" · ");
    const lines = [
      `${emoji} $${result.symbol} Token Scan`,
      `\nRisk: ${result.riskScore}/100 (${result.recommendation})`,
      topFlags ? `\nFlags: ${topFlags}` : "",
      `\nTax: ${result.buyTax.toFixed(1)}% buy / ${result.sellTax.toFixed(1)}% sell`,
      `\nLiquidity: ${formatUsd(result.liquidityUsd)}`,
      `\n\n🛡️ Scanned with Aegis Protocol`,
    ].filter(Boolean).join("");
    window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(lines)}`, "_blank", "noopener,noreferrer");
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-20 text-center">
        <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4" style={{ color: "var(--accent)" }} />
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Scanning token...</p>
        <p className="text-xs font-mono mt-2" style={{ color: "var(--text-muted)" }}>{address}</p>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-20 text-center">
        <AlertTriangle className="w-10 h-10 mx-auto mb-4" style={{ color: "#f87171" }} />
        <p className="text-lg font-semibold text-white mb-2">Scan Failed</p>
        <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>{error || "Could not scan this token"}</p>
        <Link href="/scanner" className="btn-primary inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Back to Scanner
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Back Link */}
      <Link href="/scanner" className="inline-flex items-center gap-1.5 text-sm mb-6 transition-colors hover:text-white"
        style={{ color: "var(--text-muted)" }}>
        <ArrowLeft className="w-4 h-4" /> Back to Scanner
      </Link>

      {/* Main Card */}
      <div className="card p-6 sm:p-8 animate-fade-in">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-5">
            <div className="w-24 h-24 rounded-2xl flex flex-col items-center justify-center"
              style={{ background: riskBg(result.riskScore), border: `2px solid ${riskColor(result.riskScore)}30` }}>
              <span className="text-4xl font-bold" style={{ color: riskColor(result.riskScore) }}>
                {result.riskScore}
              </span>
              <span className="text-[11px] font-semibold" style={{ color: riskColor(result.riskScore) }}>
                {result.recommendation}
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{result.name}</h1>
              <p className="text-base font-mono mt-0.5" style={{ color: "var(--text-muted)" }}>${result.symbol}</p>
              <div className="flex items-center gap-2 mt-2">
                <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                  {result.address.slice(0, 10)}...{result.address.slice(-8)}
                </p>
                <a href={`https://bscscan.com/token/${result.address}`} target="_blank" rel="noopener noreferrer"
                  className="text-[11px] flex items-center gap-0.5" style={{ color: "var(--accent)" }}>
                  <ExternalLink className="w-2.5 h-2.5" /> BSCScan
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Flags */}
        {result.flags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-6">
            {result.flags.map((flag) => (
              <span key={flag} className="text-[11px] font-semibold px-2.5 py-1 rounded-md flex items-center gap-1"
                style={{ background: riskBg(result.riskScore), color: riskColor(result.riskScore) }}>
                <AlertTriangle className="w-3 h-3" />
                {flagLabel(flag)}
              </span>
            ))}
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Buy Tax", value: `${result.buyTax.toFixed(1)}%`, bad: result.buyTax > 5 },
            { label: "Sell Tax", value: `${result.sellTax.toFixed(1)}%`, bad: result.sellTax > 5 },
            { label: "Liquidity", value: formatUsd(result.liquidityUsd), bad: result.liquidityUsd < 10000 },
            { label: "Top Holder", value: `${result.topHolderPercent.toFixed(1)}%`, bad: result.topHolderPercent > 30 },
          ].map((stat) => (
            <div key={stat.label} className="p-3 rounded-lg" style={{ background: "var(--bg-elevated)" }}>
              <p className="text-[11px] uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>{stat.label}</p>
              <p className="text-base font-semibold" style={{ color: stat.bad ? "#f87171" : "var(--text-primary)" }}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Security Checks */}
        <button onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg transition-colors mb-4"
          style={{ color: "var(--text-muted)", background: "var(--bg-elevated)" }}>
          {expanded ? "Hide" : "Show"} Security Details
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {expanded && (
          <div className="space-y-3 mb-6 animate-fade-in">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { label: "Honeypot", ok: !result.isHoneypot, icon: Skull },
                { label: "Source Verified", ok: result.isVerified, icon: Eye },
                { label: "Ownership Renounced", ok: result.isRenounced, icon: Lock },
                { label: "LP Locked/Burned", ok: result.isLiquidityLocked || result.lpTokenBurned, icon: Droplets },
                { label: "No Mint Function", ok: !result.ownerCanMint, icon: Shield },
                { label: "No Pause Function", ok: !result.ownerCanPause, icon: Shield },
                { label: "No Blacklist", ok: !result.ownerCanBlacklist, icon: Shield },
                { label: "Not Proxy", ok: !result.isProxy, icon: Shield },
              ].map((check) => (
                <div key={check.label} className="flex items-center gap-2 p-2.5 rounded-lg" style={{ background: "var(--bg-elevated)" }}>
                  {check.ok
                    ? <CheckCircle className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--green)" }} />
                    : <X className="w-3.5 h-3.5 shrink-0" style={{ color: "#f87171" }} />}
                  <span className="text-xs" style={{ color: check.ok ? "var(--text-secondary)" : "#f87171" }}>{check.label}</span>
                </div>
              ))}
            </div>

            <div className="p-3 rounded-lg" style={{ background: "var(--bg-elevated)" }}>
              <p className="text-[11px] uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Total Supply</p>
              <p className="text-sm font-mono" style={{ color: "var(--text-primary)" }}>{Number(result.totalSupply).toLocaleString()}</p>
            </div>
          </div>
        )}

        {/* Share Section */}
        <div className="pt-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
          <p className="text-xs font-semibold mb-3" style={{ color: "var(--text-muted)" }}>SHARE THIS SCAN</p>
          <div className="flex gap-2">
            <button onClick={shareTwitter}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium transition-colors"
              style={{ background: "rgba(29, 155, 240, 0.1)", color: "#1d9bf0", border: "1px solid rgba(29, 155, 240, 0.2)" }}>
              <Share2 className="w-3.5 h-3.5" />
              Share on X
            </button>
            <button onClick={shareTelegram}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium transition-colors"
              style={{ background: "rgba(0, 136, 204, 0.1)", color: "#0088cc", border: "1px solid rgba(0, 136, 204, 0.2)" }}>
              Share on Telegram
            </button>
            <button onClick={copyLink}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium transition-colors"
              style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}>
              <Copy className="w-3.5 h-3.5" />
              Copy Link
            </button>
          </div>
        </div>
      </div>

      {/* Scan Another */}
      <div className="mt-8 text-center">
        <Link href="/scanner" className="btn-secondary inline-flex items-center gap-2 text-sm">
          <Search className="w-4 h-4" />
          Scan Another Token
        </Link>
      </div>

      {/* Powered by */}
      <p className="text-center text-[11px] mt-8" style={{ color: "var(--text-muted)" }}>
        Powered by Aegis Protocol · honeypot.is · GoPlusLabs · PancakeSwap
      </p>
    </div>
  );
}

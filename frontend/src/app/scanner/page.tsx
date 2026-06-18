"use client";

import { useState, useCallback } from "react";
import { ethers } from "ethers";
import { useWalletContext } from "../../lib/WalletContext";
import Link from "next/link";
import {
  Search, Shield, AlertTriangle, Skull, CheckCircle,
  ExternalLink, Loader2, Copy, Share2, ArrowRight,
  Lock, Droplets, Eye, X, ChevronDown, ChevronUp,
  Wallet, Activity,
} from "lucide-react";
import toast from "react-hot-toast";
import { saveScan, saveScans } from "../../lib/scan-store";

// ─── Types ───────────────────────────────────────────────────

type ScanMode = "token" | "wallet";

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

interface WalletToken {
  address: string;
  symbol: string;
  name: string;
  balance: string;
  decimals: number;
  isKnownSafe: boolean;
}

interface TokenScan {
  address: string;
  symbol: string;
  name: string;
  riskScore: number;
  recommendation: string;
  flags: string[];
  isHoneypot: boolean;
  buyTax: number;
  sellTax: number;
  liquidityUsd: number;
  isLiquidityLocked: boolean;
  isRenounced: boolean;
  ownerCanMint: boolean;
  ownerCanPause: boolean;
  ownerCanBlacklist: boolean;
  isProxy: boolean;
  topHolderPercent: number;
}

interface WalletScanResult {
  address: string;
  bnbBalance: string;
  holdings: WalletToken[];
  scans: TokenScan[];
  alerts: { id: string; severity: "critical" | "warning" | "info"; title: string; description: string; token: string; tokenAddress: string; timestamp: number }[];
  overallRisk: "SAFE" | "AT_RISK" | "DANGEROUS";
  maxRiskScore: number;
  aiSummary: string;
  tokenCount: number;
  alertCount: number;
  scannedAt: number;
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

function formatBalance(bal: string) {
  const n = parseFloat(bal);
  if (isNaN(n)) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  if (n >= 1) return n.toFixed(4);
  return n.toPrecision(4);
}

// ─── Single Token Scan Result Card ───────────────────────────

function ScanResultCard({ result, showShare = true }: { result: ScanResult; showShare?: boolean }) {
  const [expanded, setExpanded] = useState(false);

  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/scan/${result.address}`
    : "";

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    toast.success("Scan link copied!");
  };

  const shareTwitter = () => {
    const emoji = result.riskScore >= 70 ? "🚨" : result.riskScore >= 40 ? "⚠️" : result.riskScore >= 20 ? "🟡" : "✅";
    const topFlags = result.flags.slice(0, 3).map((f) => flagLabel(f)).join(" · ");
    const lines = [
      `${emoji} $${result.symbol} — Risk Score: ${result.riskScore}/100 (${result.recommendation})`,
      topFlags ? `\nFlags: ${topFlags}` : "",
      `\nTax: ${result.buyTax.toFixed(1)}% buy / ${result.sellTax.toFixed(1)}% sell`,
      `\nLiquidity: ${formatUsd(result.liquidityUsd)}`,
      `\n\nScanned with @uniq_minds 🛡️`,
    ].filter(Boolean).join("");
    const url = `https://x.com/intent/tweet?text=${encodeURIComponent(lines)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const shareTelegram = () => {
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
    const url = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(lines)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="card p-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          {/* Risk Score Circle */}
          <div className="w-20 h-20 rounded-2xl flex flex-col items-center justify-center"
            style={{ background: riskBg(result.riskScore), border: `2px solid ${riskColor(result.riskScore)}30` }}>
            <span className="text-3xl font-bold" style={{ color: riskColor(result.riskScore) }}>
              {result.riskScore}
            </span>
            <span className="text-[10px] font-semibold" style={{ color: riskColor(result.riskScore) }}>
              {result.recommendation}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-white">{result.name}</h3>
              <span className="text-sm font-mono" style={{ color: "var(--text-muted)" }}>${result.symbol}</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
                {result.address.slice(0, 8)}...{result.address.slice(-6)}
              </p>
              <a href={`https://bscscan.com/token/${result.address}`} target="_blank" rel="noopener noreferrer"
                className="text-[10px] flex items-center gap-0.5" style={{ color: "var(--accent)" }}>
                <ExternalLink className="w-2.5 h-2.5" /> BSCScan
              </a>
            </div>
            <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
              Scanned in {result.scanDuration}ms
            </p>
          </div>
        </div>

        {showShare && (
          <div className="flex items-center gap-1.5">
            <button onClick={copyLink} className="p-2 rounded-lg transition-colors hover:bg-white/5" title="Copy link">
              <Copy className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
            </button>
            <button onClick={shareTwitter} className="p-2 rounded-lg transition-colors hover:bg-white/5" title="Share on X">
              <Share2 className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
            </button>
          </div>
        )}
      </div>

      {/* Flags */}
      {result.flags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-5">
          {result.flags.map((flag) => (
            <span key={flag} className="text-[11px] font-semibold px-2.5 py-1 rounded-md flex items-center gap-1"
              style={{ background: riskBg(result.riskScore), color: riskColor(result.riskScore) }}>
              <AlertTriangle className="w-3 h-3" />
              {flagLabel(flag)}
            </span>
          ))}
        </div>
      )}

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: "Buy Tax", value: `${result.buyTax.toFixed(1)}%`, bad: result.buyTax > 5 },
          { label: "Sell Tax", value: `${result.sellTax.toFixed(1)}%`, bad: result.sellTax > 5 },
          { label: "Liquidity", value: formatUsd(result.liquidityUsd), bad: result.liquidityUsd < 10000 },
          { label: "Top Holder", value: `${result.topHolderPercent.toFixed(1)}%`, bad: result.topHolderPercent > 30 },
        ].map((stat) => (
          <div key={stat.label} className="p-3 rounded-lg" style={{ background: "var(--bg-elevated)" }}>
            <p className="text-[11px] uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>{stat.label}</p>
            <p className="text-sm font-semibold" style={{ color: stat.bad ? "#f87171" : "var(--text-primary)" }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Expandable Details */}
      <button onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg transition-colors"
        style={{ color: "var(--text-muted)", background: "var(--bg-elevated)" }}>
        {expanded ? "Hide" : "Show"} Details
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {expanded && (
        <div className="mt-4 space-y-3 animate-fade-in">
          {/* Security Checks */}
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

          {/* Supply Info */}
          <div className="p-3 rounded-lg" style={{ background: "var(--bg-elevated)" }}>
            <p className="text-[11px] uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Total Supply</p>
            <p className="text-sm font-mono" style={{ color: "var(--text-primary)" }}>{Number(result.totalSupply).toLocaleString()}</p>
          </div>

          {/* Share Actions */}
          {showShare && (
            <div className="flex gap-2 pt-2">
              <button onClick={shareTwitter}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium transition-colors"
                style={{ background: "rgba(29, 155, 240, 0.1)", color: "#1d9bf0", border: "1px solid rgba(29, 155, 240, 0.2)" }}>
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
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Scanner Page ───────────────────────────────────────

export default function ScannerPage() {
  const { address, isConnected, connect, isConnecting } = useWalletContext();
  const [mode, setMode] = useState<ScanMode>("token");

  // Token scan state
  const [tokenInput, setTokenInput] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState("");
  const [recentScans, setRecentScans] = useState<ScanResult[]>([]);

  // Wallet scan state
  const [walletScanning, setWalletScanning] = useState(false);
  const [walletResult, setWalletResult] = useState<WalletScanResult | null>(null);
  const [walletError, setWalletError] = useState("");

  const scanToken = useCallback(async (addr?: string) => {
    const target = addr || tokenInput.trim();
    if (!target) return;

    if (!ethers.isAddress(target)) {
      setScanError("Invalid BSC token address");
      return;
    }

    setScanning(true);
    setScanError("");
    setScanResult(null);

    try {
      const res = await fetch(`/api/scan?address=${encodeURIComponent(target)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Scan failed" }));
        throw new Error(err.error || "Scan failed");
      }
      const result: ScanResult = await res.json();
      setScanResult(result);
      saveScan(result as unknown as Record<string, unknown>);
      setRecentScans((prev) => {
        const filtered = prev.filter((s) => s.address.toLowerCase() !== result.address.toLowerCase());
        return [result, ...filtered].slice(0, 10);
      });
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }, [tokenInput]);

  const scanWallet = useCallback(async (addr: string) => {
    setWalletScanning(true);
    setWalletError("");
    setWalletResult(null);
    try {
      const res = await fetch(`/api/guardian?address=${encodeURIComponent(addr)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Scan failed (${res.status})`);
      }
      const data: WalletScanResult = await res.json();
      setWalletResult(data);
      if (data.scans) saveScans(data.scans as unknown as Record<string, unknown>[]);
      toast.success(`Wallet scanned — ${data.alertCount} issues found`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Wallet scan failed";
      setWalletError(msg);
      toast.error(msg);
    } finally {
      setWalletScanning(false);
    }
  }, []);

  const sortedScans = walletResult?.scans
    ? [...walletResult.scans].sort((a, b) => b.riskScore - a.riskScore)
    : [];
  const riskyScans = sortedScans.filter((s) => s.riskScore >= 40);
  const safeScans = sortedScans.filter((s) => s.riskScore < 40);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-3">
          Token Scanner
        </h1>
        <p className="text-base" style={{ color: "var(--text-secondary)" }}>
          Scan any token before you buy — or scan your entire wallet to find dangerous holdings.
        </p>
      </div>

      {/* ── Mode Tabs ── */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setMode("token")}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
          style={{
            background: mode === "token" ? "var(--accent-muted)" : "var(--bg-raised)",
            color: mode === "token" ? "var(--accent)" : "var(--text-muted)",
            border: `1px solid ${mode === "token" ? "var(--accent-border)" : "var(--border-subtle)"}`,
          }}>
          <Search className="w-4 h-4" />
          Scan a Token
        </button>
        <button
          onClick={() => setMode("wallet")}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
          style={{
            background: mode === "wallet" ? "rgba(167, 139, 250, 0.08)" : "var(--bg-raised)",
            color: mode === "wallet" ? "var(--purple)" : "var(--text-muted)",
            border: `1px solid ${mode === "wallet" ? "rgba(167, 139, 250, 0.2)" : "var(--border-subtle)"}`,
          }}>
          <Wallet className="w-4 h-4" />
          Scan Your Wallet
        </button>
      </div>

      {/* ════════════════════════════════════════════════
          TOKEN SCAN MODE
          ════════════════════════════════════════════════ */}
      {mode === "token" && (
        <div className="space-y-6">
          {/* Search Bar */}
          <div className="relative">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: "var(--text-muted)" }} />
                <input
                  type="text"
                  value={tokenInput}
                  onChange={(e) => { setTokenInput(e.target.value); setScanError(""); }}
                  onKeyDown={(e) => e.key === "Enter" && scanToken()}
                  placeholder="Paste BSC token address (0x...)"
                  className="w-full pl-12 pr-4 py-4 rounded-xl text-sm font-mono bg-transparent outline-none transition-colors"
                  style={{
                    background: "var(--bg-raised)",
                    border: `1px solid ${scanError ? "rgba(239, 68, 68, 0.4)" : "var(--border-subtle)"}`,
                    color: "var(--text-primary)",
                  }}
                  spellCheck={false}
                />
              </div>
              <button
                onClick={() => scanToken()}
                disabled={scanning || !tokenInput.trim()}
                className="btn-primary flex items-center gap-2 !px-6 !py-4 shrink-0"
              >
                {scanning ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                {scanning ? "Scanning..." : "Scan"}
              </button>
            </div>
            {scanError && (
              <p className="text-xs mt-2 flex items-center gap-1" style={{ color: "#f87171" }}>
                <AlertTriangle className="w-3 h-3" /> {scanError}
              </p>
            )}
          </div>

          {/* Scan Result */}
          {scanResult && (
            <>
              <ScanResultCard result={scanResult} />

              {/* Journey CTA: Wallet Scan */}
              <button onClick={() => setMode("wallet")}
                className="w-full card p-4 flex items-center gap-4 group hover:border-[var(--border-hover)] transition-all text-left">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "rgba(167, 139, 250, 0.08)", border: "1px solid rgba(167, 139, 250, 0.15)" }}>
                  <Wallet className="w-5 h-5" style={{ color: "var(--purple)" }} />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-white">Scan your entire wallet</div>
                  <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Connect your wallet and scan ALL your tokens at once — find every dangerous holding
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 shrink-0 transition-transform group-hover:translate-x-1" style={{ color: "var(--purple)" }} />
              </button>
            </>
          )}

          {/* Recent Scans */}
          {recentScans.length > 0 && !scanResult && (
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">Recent Scans</h3>
              <div className="space-y-2">
                {recentScans.map((scan) => (
                  <button key={scan.address} onClick={() => { setTokenInput(scan.address); scanToken(scan.address); }}
                    className="w-full card p-3 flex items-center gap-3 text-left transition-colors hover:border-[var(--border-hover)]">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: riskBg(scan.riskScore), border: `1px solid ${riskColor(scan.riskScore)}20` }}>
                      <span className="text-sm font-bold" style={{ color: riskColor(scan.riskScore) }}>{scan.riskScore}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white flex items-center gap-2">
                        {scan.symbol}
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                          style={{ background: riskBg(scan.riskScore), color: riskColor(scan.riskScore) }}>
                          {scan.recommendation}
                        </span>
                      </p>
                      <p className="text-xs font-mono truncate" style={{ color: "var(--text-muted)" }}>{scan.address}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {!scanResult && recentScans.length === 0 && (
            <div className="space-y-6">
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: "var(--accent-muted)", border: "1px solid var(--accent-border)" }}>
                  <Search className="w-7 h-7" style={{ color: "var(--accent)" }} />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Scan Before You Buy</h3>
                <p className="text-sm max-w-md mx-auto mb-4" style={{ color: "var(--text-muted)" }}>
                  Paste any BSC token contract address above. We&apos;ll check for honeypot traps,
                  hidden taxes, liquidity issues, and contract vulnerabilities.
                </p>
                <button onClick={() => setMode("wallet")} className="text-xs font-medium inline-flex items-center gap-1" style={{ color: "var(--purple)" }}>
                  Or scan your entire wallet <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              {/* Try These Tokens */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-muted)" }}>
                  Try scanning these tokens
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { symbol: "CAKE", name: "PancakeSwap", address: "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82", safe: true },
                    { symbol: "UNIQ", name: "UnIQ Minds", address: "0xdd5f3e8c2cfc8444fac46744d0a4a85df03d7777", safe: true },
                    { symbol: "XVS", name: "Venus", address: "0xcF6BB5389c92Bdda8a3747Ddb454cB7a64626C63", safe: true },
                    { symbol: "FLOKI", name: "Floki Inu", address: "0xfb5B838b6cfEEdC2873aB27866079AC55363D37E", safe: true },
                  ].map((token) => (
                    <button key={token.address} onClick={() => { setTokenInput(token.address); scanToken(token.address); }}
                      className="card p-3 flex items-center gap-3 text-left transition-colors hover:border-[var(--border-hover)]">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: token.safe ? "rgba(34, 197, 94, 0.08)" : "rgba(239, 68, 68, 0.08)" }}>
                        <span className="text-xs font-bold" style={{ color: token.safe ? "var(--green)" : "#ef4444" }}>${token.symbol}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">{token.name}</p>
                        <p className="text-[10px] font-mono truncate" style={{ color: "var(--text-muted)" }}>{token.address}</p>
                      </div>
                      <ArrowRight className="w-4 h-4 shrink-0" style={{ color: "var(--text-muted)" }} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Trust Indicators */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: "8", label: "Risk Vectors", desc: "Checked per scan" },
                  { value: "< 5s", label: "Scan Speed", desc: "Average time" },
                  { value: "100%", label: "On-Chain", desc: "Real data only" },
                ].map((stat) => (
                  <div key={stat.label} className="card p-4 text-center">
                    <div className="text-lg font-bold text-white">{stat.value}</div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--accent)" }}>{stat.label}</div>
                    <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>{stat.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════
          WALLET SCAN MODE
          ════════════════════════════════════════════════ */}
      {mode === "wallet" && (
        <div className="space-y-6">

          {/* Not Connected */}
          {!isConnected && (
            <div className="card p-8 sm:p-10 text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{ background: "rgba(167, 139, 250, 0.08)", border: "1px solid rgba(167, 139, 250, 0.15)" }}>
                <Wallet className="w-8 h-8" style={{ color: "var(--purple)" }} />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">
                Scan Your Entire Wallet
              </h2>
              <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: "var(--text-muted)" }}>
                Connect your wallet — we&apos;ll scan every token you hold and flag the dangerous ones.
                Read-only, no transaction access.
              </p>
              <button onClick={connect} disabled={isConnecting}
                className="btn-primary inline-flex items-center gap-2">
                <Wallet className="w-4 h-4" />
                {isConnecting ? "Connecting..." : "Connect & Scan Wallet"}
              </button>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8">
                {[
                  { icon: Skull, label: "Honeypot Detection" },
                  { icon: AlertTriangle, label: "Tax Analysis" },
                  { icon: Droplets, label: "Liquidity Check" },
                  { icon: Shield, label: "Contract Security" },
                ].map((f) => (
                  <div key={f.label} className="p-3 rounded-lg text-center" style={{ background: "var(--bg-elevated)" }}>
                    <f.icon className="w-4 h-4 mx-auto mb-1.5" style={{ color: "var(--accent)" }} />
                    <div className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>{f.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Connected — Ready / Scanning / Results */}
          {isConnected && !walletResult && !walletScanning && !walletError && (
            <div className="card p-8 text-center">
              <Wallet className="w-10 h-10 mx-auto mb-4" style={{ color: "var(--purple)" }} />
              <h2 className="text-lg font-semibold text-white mb-2">
                Wallet Connected
              </h2>
              <p className="text-xs font-mono mb-4" style={{ color: "var(--text-muted)" }}>
                {address?.slice(0, 8)}...{address?.slice(-6)}
              </p>
              <button onClick={() => address && scanWallet(address)}
                className="btn-primary inline-flex items-center gap-2">
                <Search className="w-4 h-4" />
                Scan All My Tokens
              </button>
            </div>
          )}

          {/* Loading */}
          {walletScanning && (
            <div className="card p-12 text-center">
              <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4" style={{ color: "var(--purple)" }} />
              <h2 className="text-lg font-semibold text-white mb-2">Scanning Your Wallet</h2>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Checking each token for honeypots, hidden taxes, whale risks, and rug pull signals...
              </p>
              <div className="mt-4 flex items-center justify-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                <Activity className="w-3.5 h-3.5 animate-pulse" />
                This takes 15-30 seconds
              </div>
            </div>
          )}

          {/* Error */}
          {walletError && !walletScanning && (
            <div className="card p-8 text-center" style={{ borderColor: "rgba(239, 68, 68, 0.2)" }}>
              <Skull className="w-10 h-10 mx-auto mb-3" style={{ color: "#ef4444" }} />
              <h2 className="text-lg font-semibold text-white mb-2">Scan Failed</h2>
              <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>{walletError}</p>
              {address && (
                <button onClick={() => scanWallet(address)} className="btn-primary inline-flex items-center gap-2">
                  <Search className="w-4 h-4" /> Retry
                </button>
              )}
            </div>
          )}

          {/* Wallet Scan Results */}
          {walletResult && !walletScanning && (
            <div className="space-y-6">

              {/* Overall Verdict */}
              {(() => {
                const color = walletResult.overallRisk === "DANGEROUS" ? "#ef4444"
                  : walletResult.overallRisk === "AT_RISK" ? "#f97316" : "#22c55e";
                const bg = walletResult.overallRisk === "DANGEROUS" ? "rgba(239, 68, 68, 0.08)"
                  : walletResult.overallRisk === "AT_RISK" ? "rgba(249, 115, 22, 0.08)" : "rgba(34, 197, 94, 0.08)";
                const label = walletResult.overallRisk === "DANGEROUS" ? "Dangerous"
                  : walletResult.overallRisk === "AT_RISK" ? "At Risk" : "Safe";
                const critCount = walletResult.alerts.filter((a) => a.severity === "critical").length;
                const warnCount = walletResult.alerts.filter((a) => a.severity === "warning").length;
                return (
                  <div className="card p-6" style={{ borderColor: `${color}22` }}>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 mb-5">
                      <div className="w-20 h-20 rounded-2xl flex flex-col items-center justify-center shrink-0"
                        style={{ background: bg, border: `2px solid ${color}30` }}>
                        <span className="text-3xl font-bold" style={{ color }}>
                          {walletResult.maxRiskScore}
                        </span>
                        <span className="text-[10px] font-semibold" style={{ color }}>/100</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {walletResult.overallRisk === "DANGEROUS" ? <Skull className="w-5 h-5" style={{ color }} />
                            : walletResult.overallRisk === "AT_RISK" ? <AlertTriangle className="w-5 h-5" style={{ color }} />
                            : <CheckCircle className="w-5 h-5" style={{ color }} />}
                          <span className="text-xl font-bold" style={{ color }}>{label}</span>
                        </div>
                        <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
                          {walletResult.tokenCount} tokens scanned · {parseFloat(walletResult.bnbBalance).toFixed(4)} BNB
                        </div>
                        {critCount > 0 && (
                          <div className="text-xs mt-1" style={{ color: "#ef4444" }}>
                            {critCount} critical issue{critCount > 1 ? "s" : ""} — {warnCount > 0 ? `${warnCount} warnings · ` : ""}review below
                          </div>
                        )}
                      </div>
                      <button onClick={() => address && scanWallet(address)}
                        className="btn-secondary flex items-center gap-2 text-xs shrink-0 !px-3 !py-2">
                        <Search className="w-3.5 h-3.5" /> Re-scan
                      </button>
                    </div>

                    <div className="grid grid-cols-4 gap-3">
                      {[
                        { label: "BNB Balance", value: parseFloat(walletResult.bnbBalance).toFixed(4), color: "#f0b90b" },
                        { label: "Tokens Held", value: String(walletResult.tokenCount), color: "var(--accent)" },
                        { label: "Dangerous", value: String(riskyScans.length), color: riskyScans.length > 0 ? "#ef4444" : "var(--green)" },
                        { label: "Safe", value: String(safeScans.length), color: "var(--green)" },
                      ].map((s) => (
                        <div key={s.label} className="p-3 rounded-xl text-center" style={{ background: "var(--bg-elevated)" }}>
                          <div className="text-[10px] mb-1" style={{ color: "var(--text-muted)" }}>{s.label}</div>
                          <div className="text-sm font-bold" style={{ color: s.color }}>{s.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Alerts */}
              {walletResult.alerts.length > 0 && (
                <div className="card p-5">
                  <h3 className="text-sm font-semibold mb-4 flex items-center gap-2 text-white">
                    <AlertTriangle className="w-4 h-4" style={{ color: "#f87171" }} />
                    Alerts ({walletResult.alerts.length})
                  </h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {walletResult.alerts.map((alert) => (
                      <div key={alert.id} className="flex items-start gap-3 p-3 rounded-lg" style={{
                        background: alert.severity === "critical" ? "rgba(239, 68, 68, 0.05)"
                          : alert.severity === "warning" ? "rgba(249, 115, 22, 0.05)"
                          : "rgba(0, 212, 245, 0.03)",
                        borderLeft: `3px solid ${alert.severity === "critical" ? "#ef4444" : alert.severity === "warning" ? "#f97316" : "var(--accent)"}`,
                      }}>
                        {alert.severity === "critical" ? <Skull className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#ef4444" }} />
                          : alert.severity === "warning" ? <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#f97316" }} />
                          : <Eye className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--accent)" }} />}
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold" style={{
                            color: alert.severity === "critical" ? "#ef4444" : alert.severity === "warning" ? "#f97316" : "var(--text-secondary)",
                          }}>{alert.title}</div>
                          <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: "var(--text-muted)" }}>{alert.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Risky Tokens */}
              {riskyScans.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: "#f87171" }}>
                    <Skull className="w-4 h-4" />
                    Dangerous Tokens ({riskyScans.length})
                  </h3>
                  <div className="space-y-2">
                    {riskyScans.map((scan) => {
                      const holding = walletResult.holdings.find(
                        (h) => h.address.toLowerCase() === scan.address.toLowerCase()
                      );
                      return (
                        <div key={scan.address} className="card p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-14 h-14 rounded-xl flex flex-col items-center justify-center shrink-0"
                              style={{ background: riskBg(scan.riskScore), border: `1.5px solid ${riskColor(scan.riskScore)}30` }}>
                              <span className="text-xl font-bold" style={{ color: riskColor(scan.riskScore) }}>{scan.riskScore}</span>
                              <span className="text-[9px] font-semibold" style={{ color: riskColor(scan.riskScore) }}>{scan.recommendation}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-semibold text-white truncate">{scan.name}</span>
                                <span className="text-xs font-mono shrink-0" style={{ color: "var(--text-muted)" }}>${scan.symbol}</span>
                              </div>
                              {holding && (
                                <div className="text-xs mb-1.5" style={{ color: "var(--text-secondary)" }}>
                                  Balance: {formatBalance(holding.balance)} · Buy {scan.buyTax.toFixed(1)}% · Sell {scan.sellTax.toFixed(1)}%
                                </div>
                              )}
                              <div className="flex flex-wrap gap-1">
                                {scan.flags.slice(0, 4).map((f) => (
                                  <span key={f} className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                                    style={{ background: riskBg(scan.riskScore), color: riskColor(scan.riskScore) }}>
                                    {flagLabel(f)}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <a href={`https://bscscan.com/token/${scan.address}`} target="_blank" rel="noopener noreferrer"
                              className="shrink-0 flex items-center gap-1 text-xs font-medium px-3 py-2 rounded-lg transition-colors hover:bg-white/5"
                              style={{ background: "var(--bg-elevated)", color: "var(--accent)" }}>
                              BSCScan <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Safe Holdings */}
              {safeScans.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--green)" }}>
                    <CheckCircle className="w-4 h-4" />
                    Safe Holdings ({safeScans.length})
                  </h3>
                  <div className="card overflow-hidden">
                    {safeScans.map((scan, i) => {
                      const holding = walletResult.holdings.find(
                        (h) => h.address.toLowerCase() === scan.address.toLowerCase()
                      );
                      return (
                        <a key={scan.address} href={`https://bscscan.com/token/${scan.address}`}
                          target="_blank" rel="noopener noreferrer"
                          className={`flex items-center justify-between px-4 py-3 transition-colors hover:bg-white/[0.02] ${i < safeScans.length - 1 ? "border-b" : ""}`}
                          style={{ borderColor: "var(--border-subtle)" }}>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                              style={{ background: riskBg(scan.riskScore), border: `1px solid ${riskColor(scan.riskScore)}20` }}>
                              <span className="text-xs font-bold" style={{ color: riskColor(scan.riskScore) }}>{scan.riskScore}</span>
                            </div>
                            <div>
                              <span className="text-sm font-medium text-white">{scan.symbol}</span>
                              <span className="text-xs ml-2" style={{ color: "var(--text-muted)" }}>{scan.name}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {holding && (
                              <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>
                                {formatBalance(holding.balance)}
                              </span>
                            )}
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                              style={{ background: riskBg(scan.riskScore), color: riskColor(scan.riskScore) }}>{scan.recommendation}</span>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* No scannable tokens */}
              {sortedScans.length === 0 && walletResult.tokenCount > 0 && (
                <div className="card p-8 text-center">
                  <CheckCircle className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--green)" }} />
                  <h3 className="text-base font-semibold text-white mb-1">All Clear</h3>
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    Your wallet only holds known-safe tokens (BNB, stables, blue chips).
                  </p>
                </div>
              )}

              {/* Journey CTAs */}
              <div className="grid sm:grid-cols-2 gap-4 pt-2">
                <Link href="/guardian"
                  className="card p-5 group hover:border-[var(--border-hover)] transition-all duration-300">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: "var(--accent-muted)", border: "1px solid var(--accent-border)" }}>
                      <Shield className="w-5 h-5" style={{ color: "var(--accent)" }} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white mb-1">Want Continuous Monitoring?</div>
                      <div className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                        Guardian Shield watches your wallet 24/7 with real-time alerts for rug pulls, whale dumps, and liquidity pulls.
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 shrink-0 mt-1 transition-transform group-hover:translate-x-1" style={{ color: "var(--accent)" }} />
                  </div>
                </Link>
                <Link href="/vault"
                  className="card p-5 group hover:border-[var(--border-hover)] transition-all duration-300">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: "rgba(52, 211, 153, 0.08)", border: "1px solid rgba(52, 211, 153, 0.15)" }}>
                      <Lock className="w-5 h-5" style={{ color: "var(--green)" }} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white mb-1">Earn Yield, Stay Protected</div>
                      <div className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                        Deposit BNB into the Aegis Vault — earn yield via Venus Protocol while AI auto-protects your position.
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 shrink-0 mt-1 transition-transform group-hover:translate-x-1" style={{ color: "var(--green)" }} />
                  </div>
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useWalletContext } from "../../lib/WalletContext";
import { CONTRACTS, HOLDER_TIER_BENEFITS } from "../../lib/constants";
import Link from "next/link";
import { GuardianPolicy, StructuredRule } from "../../lib/policy-store";
import { DecisionTimeline } from "../../lib/decision-timeline-store";
import {
  AlertTriangle, Skull, CheckCircle, Loader2,
  Wallet, Eye, RefreshCw, ArrowRight,
  ExternalLink, Activity, Bot, Shield,
  Crown, Clock, TrendingUp, Lock,
  Zap, ChevronDown, ChevronUp, Send,
  Target, ShieldAlert, ShieldCheck, Crosshair,
  GitBranch, BarChart3, Layers,
} from "lucide-react";
import toast from "react-hot-toast";

// ─── Types ───────────────────────────────────────────────────

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

interface Alert {
  id: string;
  severity: "critical" | "warning" | "info";
  category: "threat" | "monitoring";
  title: string;
  description: string;
  token: string;
  tokenAddress: string;
  timestamp: number;
  minTier: "Free" | "Bronze" | "Silver" | "Gold";
}

interface AiAnalysis {
  summary: string;
  riskRating: "SAFE" | "CAUTION" | "AT_RISK" | "DANGEROUS";
  topThreats: string[];
  actions: string[];
  holdingBreakdown: { symbol: string; verdict: string }[];
}

interface GuardianResult {
  address: string;
  bnbBalance: string;
  holdings: WalletToken[];
  scans: TokenScan[];
  alerts: Alert[];
  overallRisk: "SAFE" | "AT_RISK" | "DANGEROUS";
  maxRiskScore: number;
  aiSummary: string;
  aiAnalysis: AiAnalysis;
  tier: string;
  uniqBalance: number;
  tokenCount: number;
  alertCount: number;
  scannedAt: number;
}

// ─── Helpers ─────────────────────────────────────────────────

const TIER_COLORS: Record<string, string> = {
  Free: "#6b7280",
  Bronze: "#cd7f32",
  Silver: "#c0c0c0",
  Gold: "#ffd700",
};

function riskColor(score: number) {
  if (score >= 70) return "#ef4444";
  if (score >= 40) return "#f97316";
  if (score >= 20) return "#eab308";
  return "#22c55e";
}

function overallBadge(risk: string) {
  switch (risk) {
    case "DANGEROUS":
      return { color: "#ef4444", bg: "rgba(239, 68, 68, 0.06)", label: "Dangerous", icon: Skull };
    case "AT_RISK":
      return { color: "#f97316", bg: "rgba(249, 115, 22, 0.06)", label: "At Risk", icon: AlertTriangle };
    default:
      return { color: "#22c55e", bg: "rgba(34, 197, 94, 0.06)", label: "Secure", icon: ShieldCheck };
  }
}

function aiRatingStyle(rating: string) {
  switch (rating) {
    case "DANGEROUS":
      return { color: "#ef4444", bg: "rgba(239, 68, 68, 0.06)", border: "rgba(239, 68, 68, 0.15)" };
    case "AT_RISK":
      return { color: "#f97316", bg: "rgba(249, 115, 22, 0.06)", border: "rgba(249, 115, 22, 0.15)" };
    case "CAUTION":
      return { color: "#eab308", bg: "rgba(234, 179, 8, 0.06)", border: "rgba(234, 179, 8, 0.15)" };
    default:
      return { color: "#22c55e", bg: "rgba(34, 197, 94, 0.06)", border: "rgba(34, 197, 94, 0.15)" };
  }
}

function formatBalance(bal: string) {
  const n = parseFloat(bal);
  if (isNaN(n)) return "0";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  if (n >= 1) return n.toFixed(4);
  return n.toPrecision(4);
}

function formatFlag(flag: string) {
  const map: Record<string, string> = {
    HONEYPOT: "Honeypot",
    EXTREME_TAX: "Extreme Tax",
    HIGH_TAX: "High Tax",
    MODERATE_TAX: "Notable Tax",
    CRITICAL_LOW_LIQUIDITY: "No Liquidity",
    LOW_LIQUIDITY: "Low Liquidity",
    UNLOCKED_LIQUIDITY: "LP Unlocked",
    MINT_FUNCTION: "Can Mint",
    PAUSE_FUNCTION: "Can Pause",
    BLACKLIST_FUNCTION: "Can Blacklist",
    PROXY_CONTRACT: "Proxy",
    WHALE_DOMINATED: "Whale Risk",
    HIGH_CONCENTRATION: "Concentrated",
  };
  return map[flag] || flag;
}

const REFRESH_INTERVAL = 60;

// ─── Main Component ──────────────────────────────────────────

export default function GuardianShieldPage() {
  const { address, isConnected, connect, isConnecting } = useWalletContext();
  const [result, setResult] = useState<GuardianResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const [expandedToken, setExpandedToken] = useState<string | null>(null);
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [tgChatId, setTgChatId] = useState("");
  const [tgConnected, setTgConnected] = useState(false);
  const [tgLoading, setTgLoading] = useState(false);

  // Guardian Policies State
  const [policies, setPolicies] = useState<GuardianPolicy[]>([]);
  const [policyInput, setPolicyInput] = useState("");
  const [previewRule, setPreviewRule] = useState<StructuredRule | null>(null);
  const [policyLoading, setPolicyLoading] = useState(false);

  // Decision Timeline State
  const [timelines, setTimelines] = useState<DecisionTimeline[]>([]);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [expandedCycle, setExpandedCycle] = useState<string | null>(null);

  const fetchPolicies = useCallback(async () => {
    try {
      const res = await fetch("/api/policies");
      const data = await res.json();
      if (data.success) {
        setPolicies(data.policies || []);
      }
    } catch (err) {
      console.error("Error fetching policies", err);
    }
  }, []);

  const fetchTimelines = useCallback(async () => {
    try {
      const res = await fetch("/api/timeline?limit=5");
      const data = await res.json();
      if (data.success) setTimelines(data.timelines || []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchPolicies();
    fetchTimelines();
  }, [fetchPolicies, fetchTimelines]);

  const handleCreatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!policyInput.trim()) return;
    setPolicyLoading(true);
    try {
      const res = await fetch("/api/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction: policyInput }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Guardian policy added successfully!");
        setPolicyInput("");
        setPreviewRule(null);
        fetchPolicies();
      } else {
        toast.error(data.error || "Failed to create policy");
      }
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to create policy");
    } finally {
      setPolicyLoading(false);
    }
  };

  const handlePreviewPolicy = async () => {
    if (!policyInput.trim()) return;
    setPolicyLoading(true);
    setPreviewRule(null);
    try {
      const res = await fetch("/api/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction: policyInput, previewOnly: true }),
      });
      const data = await res.json();
      if (data.success) {
        setPreviewRule(data.rule);
      } else {
        toast.error(data.error || "Failed to parse instruction");
      }
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to parse instruction");
    } finally {
      setPolicyLoading(false);
    }
  };

  const handleTogglePolicy = async (id: string, currentEnabled: boolean) => {
    try {
      const res = await fetch("/api/policies", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, enabled: !currentEnabled }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Policy ${!currentEnabled ? "enabled" : "disabled"}`);
        fetchPolicies();
      } else {
        toast.error(data.error || "Failed to update policy");
      }
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to update policy");
    }
  };

  const handleDeletePolicy = async (id: string) => {
    try {
      const res = await fetch(`/api/policies?id=${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Policy deleted");
        fetchPolicies();
      } else {
        toast.error(data.error || "Failed to delete policy");
      }
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to delete policy");
    }
  };

  const scanWallet = useCallback(async (addr: string, silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/guardian?address=" + encodeURIComponent(addr));
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Scan failed (" + res.status + ")");
      }
      const data: GuardianResult = await res.json();
      setResult(data);
      setCountdown(REFRESH_INTERVAL);
      if (!silent) toast.success("Scan complete — " + data.alertCount + " issues found");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Scan failed";
      if (!silent) {
        setError(msg);
        toast.error(msg);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isConnected && address && !result && !loading) {
      scanWallet(address);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address]);

  useEffect(() => {
    if (!result || !address) return;
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          scanWallet(address, true);
          return REFRESH_INTERVAL;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [result, address, scanWallet]);

  useEffect(() => {
    if (!isConnected || !address) return;
    fetch("/api/telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "status", address }),
    })
      .then((r) => r.json())
      .then((d) => setTgConnected(!!d.registered))
      .catch(() => {});
  }, [isConnected, address]);

  const connectTelegram = async () => {
    if (!address || !tgChatId.trim()) return;
    setTgLoading(true);
    try {
      const res = await fetch("/api/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "register", address, chatId: tgChatId.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setTgConnected(true);
        toast.success("Telegram alerts activated!");
      } else {
        toast.error(data.error || "Registration failed");
      }
    } catch {
      toast.error("Failed to connect Telegram");
    } finally {
      setTgLoading(false);
    }
  };

  const disconnectTelegram = async () => {
    if (!address) return;
    setTgLoading(true);
    try {
      const res = await fetch("/api/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unregister", address }),
      });
      const data = await res.json();
      if (data.success) {
        setTgConnected(false);
        setTgChatId("");
        toast.success("Telegram alerts deactivated");
      }
    } catch {
      toast.error("Failed to disconnect");
    } finally {
      setTgLoading(false);
    }
  };

  const tierRank: Record<string, number> = { Free: 0, Bronze: 1, Silver: 2, Gold: 3 };
  const userRank = tierRank[result?.tier ?? "Free"] ?? 0;
  const critAlerts = result?.alerts.filter((a) => a.severity === "critical") || [];
  const warnAlerts = result?.alerts.filter((a) => a.severity === "warning") || [];
  const infoAlerts = result?.alerts.filter((a) => a.severity === "info") || [];
  const sortedScans = result?.scans ? [...result.scans].sort((a, b) => b.riskScore - a.riskScore) : [];
  const tierColor = result ? (TIER_COLORS[result.tier] || TIER_COLORS.Free) : TIER_COLORS.Free;
  const badge = overallBadge(result?.overallRisk ?? "SAFE");
  const BadgeIcon = badge.icon;
  const ai = result?.aiAnalysis;
  const aiStyle = aiRatingStyle(ai?.riskRating || "SAFE");
  const isGold = result?.tier === "Gold";

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-base)" }}>
      <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12">

        {/* NOT CONNECTED */}
        {!isConnected && (
          <div className="space-y-10">
            <div className="text-center pt-8 pb-2">
              <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium"
                  style={{ background: "var(--accent-muted)", border: "1px solid var(--accent-border)", color: "var(--accent)" }}>
                  <Activity className="w-3.5 h-3.5" />
                  AI Wallet Security Scanner
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                  style={{ background: "rgba(59,130,246,0.08)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.15)" }}>
                  Wallet Provider: {process.env.NEXT_PUBLIC_TWAK_ENABLED === "true" ? "Trust Wallet" : "Legacy"}
                </div>
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-4">
                Guardian Shield
              </h1>
              <p className="text-base sm:text-lg max-w-2xl mx-auto leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                Connect your wallet and Aegis will scan every token you hold
                for rug pulls, honeypots, whale dumps, and contract risks.
                Enable Telegram alerts to get notified when new risks are detected.
                Read-only. No signatures required.
              </p>
              <button onClick={connect} disabled={isConnecting}
                className="btn-primary inline-flex items-center gap-2 mt-8 text-base px-8 py-3.5">
                <Wallet className="w-5 h-5" />
                {isConnecting ? "Connecting..." : "Connect Wallet"}
              </button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { icon: Skull, label: "Rug Pull Detection", desc: "Mint capabilities, owner dumps, LP pulls", color: "#ef4444" },
                { icon: Activity, label: "Whale Tracking", desc: "Large holder concentration & movements", color: "var(--accent)" },
                { icon: Zap, label: "Honeypot Scanner", desc: "Simulated sells to detect trapped tokens", color: "#f97316" },
                { icon: Eye, label: "Contract Analysis", desc: "Pause, blacklist, proxy, upgrade detection", color: "var(--purple)" },
              ].map((f) => (
                <div key={f.label} className="card p-5">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <f.icon className="w-5 h-5" style={{ color: f.color }} />
                  </div>
                  <div className="text-sm font-semibold text-white mb-1">{f.label}</div>
                  <div className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{f.desc}</div>
                </div>
              ))}
            </div>

            <div className="card p-6">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <Crown className="w-4 h-4" style={{ color: "#ffd700" }} />
                $UNIQ Holder Tiers
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {([
                  { tier: "Free", req: "0 $UNIQ", color: "#6b7280" },
                  { tier: "Bronze", req: "10K $UNIQ", color: "#cd7f32" },
                  { tier: "Silver", req: "100K $UNIQ", color: "#c0c0c0" },
                  { tier: "Gold", req: "1M $UNIQ", color: "#ffd700" },
                ] as const).map((t) => (
                  <div key={t.tier} className="p-4 rounded-xl" style={{ background: "var(--bg-elevated)", border: "1px solid " + t.color + "15" }}>
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="w-4 h-4" style={{ color: t.color }} />
                      <span className="text-sm font-bold" style={{ color: t.color }}>{t.tier}</span>
                      <span className="text-[10px] font-mono ml-auto" style={{ color: "var(--text-muted)" }}>{t.req}</span>
                    </div>
                    <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      {HOLDER_TIER_BENEFITS[t.tier].features}
                    </p>
                  </div>
                ))}
              </div>
              <a href={"https://flap.sh/bnb/" + CONTRACTS.UNIQ_TOKEN} target="_blank" rel="noopener noreferrer"
                className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium transition-colors"
                style={{ background: "rgba(167, 139, 250, 0.08)", color: "var(--purple)", border: "1px solid rgba(167, 139, 250, 0.15)" }}>
                Get $UNIQ to Unlock Features <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="text-center">
              <p className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>Want a quick one-time scan?</p>
              <Link href="/scanner" className="text-xs font-medium inline-flex items-center gap-1" style={{ color: "var(--accent)" }}>
                Open Token Scanner <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        )}

        {/* LOADING */}
        {isConnected && loading && (
          <div className="card p-16 text-center">
            <Loader2 className="w-12 h-12 animate-spin mx-auto mb-5" style={{ color: "var(--accent)" }} />
            <h2 className="text-xl font-semibold text-white mb-2">Scanning Your Wallet</h2>
            <p className="text-sm max-w-md mx-auto" style={{ color: "var(--text-muted)" }}>
              Checking each token for honeypots, hidden taxes, whale risks, and rug pull signals...
            </p>
            <div className="mt-6 flex items-center justify-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
              <Activity className="w-3.5 h-3.5 animate-pulse" />
              This takes 15-30 seconds
            </div>
          </div>
        )}

        {/* ERROR */}
        {isConnected && error && !loading && (
          <div className="card p-12 text-center" style={{ borderColor: "rgba(239, 68, 68, 0.15)" }}>
            <Skull className="w-12 h-12 mx-auto mb-4" style={{ color: "#ef4444" }} />
            <h2 className="text-xl font-semibold text-white mb-2">Scan Failed</h2>
            <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>{error}</p>
            {address && (
              <button onClick={() => scanWallet(address)} className="btn-primary inline-flex items-center gap-2">
                <RefreshCw className="w-4 h-4" /> Retry Scan
              </button>
            )}
          </div>
        )}

        {/* DASHBOARD */}
        {isConnected && result && !loading && (
          <div className="animate-fade-in space-y-6">

            {/* Header Bar */}
            <div className="sticky top-16 z-40 -mx-4 px-4 py-3 backdrop-blur-xl"
              style={{ background: "rgba(9,9,11,0.92)", borderBottom: "1px solid var(--border-subtle)" }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white">Guardian Shield</h1>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                    style={{ background: tierColor + "18", color: tierColor, border: "1px solid " + tierColor + "35" }}>
                    {result.tier}
                  </span>
                  <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium"
                    style={{ background: "rgba(52,211,153,0.08)", color: "var(--green)", border: "1px solid rgba(52,211,153,0.15)" }}>
                    <span className="w-1.5 h-1.5 rounded-full pulse-live" style={{ background: "var(--green)" }} />
                    Live
                  </div>
                  <div className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium"
                    style={{ background: "rgba(59,130,246,0.08)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.15)" }}>
                    Wallet Provider: {process.env.NEXT_PUBLIC_TWAK_ENABLED === "true" ? "Trust Wallet" : "Legacy"}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-mono hidden sm:inline" style={{ color: "var(--text-muted)" }}>
                    {address?.slice(0, 6)}...{address?.slice(-4)}
                  </span>
                  <span className="text-[11px] flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                    <Clock className="w-3 h-3" />{countdown}s
                  </span>
                  <button onClick={() => address && scanWallet(address)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all hover:brightness-125"
                    style={{ background: "var(--accent-muted)", color: "var(--accent)", border: "1px solid var(--accent-border)" }}>
                    <RefreshCw className="w-3 h-3" /> Rescan
                  </button>
                </div>
              </div>
            </div>

            {/* Status + Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="card p-5 flex items-center gap-4" style={{ borderColor: badge.color + "15" }}>
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ background: badge.bg, border: "2px solid " + badge.color + "20" }}>
                  <BadgeIcon className="w-8 h-8" style={{ color: badge.color }} />
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest font-medium mb-0.5" style={{ color: "var(--text-muted)" }}>
                    Security Status
                  </div>
                  <div className="text-2xl font-bold tracking-tight" style={{ color: badge.color }}>
                    {badge.label}
                  </div>
                </div>
              </div>
              <div className="lg:col-span-2 grid grid-cols-4 gap-3">
                {[
                  { label: "Tokens", value: String(result.tokenCount), color: "var(--accent)", icon: Activity },
                  { label: "Critical", value: String(critAlerts.length), color: critAlerts.length > 0 ? "#ef4444" : "var(--green)", icon: Skull },
                  { label: "Warnings", value: String(warnAlerts.length), color: warnAlerts.length > 0 ? "#f97316" : "var(--green)", icon: AlertTriangle },
                  { label: "BNB", value: parseFloat(result.bnbBalance).toFixed(4), color: "#f0b90b", icon: Wallet },
                ].map((s) => (
                  <div key={s.label} className="card p-4 flex flex-col items-center justify-center text-center">
                    <s.icon className="w-4 h-4 mb-1.5" style={{ color: s.color }} />
                    <div className="text-xl font-bold leading-none" style={{ color: s.color }}>{s.value}</div>
                    <div className="text-[10px] uppercase tracking-wider mt-1" style={{ color: "var(--text-muted)" }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 2-Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

              {/* LEFT: AI Analysis + Alerts */}
              <div className="lg:col-span-3 space-y-6">
                {ai && (
                  <div className="card overflow-hidden" style={{ borderColor: aiStyle.border }}>
                    <div className="px-6 py-4 flex items-center justify-between"
                      style={{ background: aiStyle.bg, borderBottom: "1px solid " + aiStyle.border }}>
                      <div className="flex items-center gap-3">
                        <Bot className="w-5 h-5" style={{ color: aiStyle.color }} />
                        <div>
                          <h2 className="text-sm font-semibold text-white">
                            {isGold ? "AI Security Analysis" : "Security Analysis"}
                          </h2>
                          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                            {isGold ? "Enhanced with LLM reasoning" : "Rule-based analysis"}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider"
                          style={{ background: aiStyle.bg, color: aiStyle.color, border: "1px solid " + aiStyle.border }}>
                          {ai.riskRating.replace("_", " ")}
                        </span>
                        {isGold && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                            style={{ background: "rgba(255,215,0,0.1)", color: "#ffd700", border: "1px solid rgba(255,215,0,0.2)" }}>
                            AI
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-6 space-y-5">
                      <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                        {ai.summary}
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {ai.topThreats.length > 0 && (
                          <div className="p-4 rounded-xl" style={{ background: "var(--bg-elevated)" }}>
                            <h3 className="text-xs font-semibold text-white mb-3 flex items-center gap-2">
                              <Target className="w-3.5 h-3.5" style={{ color: "#ef4444" }} />
                              Top Threats
                            </h3>
                            <div className="space-y-2">
                              {ai.topThreats.map((threat, i) => (
                                <div key={i} className="flex items-start gap-2">
                                  <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold mt-0.5"
                                    style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>{i + 1}</span>
                                  <span className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{threat}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {ai.actions.length > 0 && (
                          <div className="p-4 rounded-xl" style={{ background: "var(--bg-elevated)" }}>
                            <h3 className="text-xs font-semibold text-white mb-3 flex items-center gap-2">
                              <Crosshair className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
                              Recommended Actions
                            </h3>
                            <div className="space-y-2">
                              {ai.actions.map((action, i) => (
                                <div key={i} className="flex items-start gap-2">
                                  <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "var(--accent)" }} />
                                  <span className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{action}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {ai.holdingBreakdown.length > 0 && (
                        <div>
                          <h3 className="text-xs font-semibold text-white mb-3 flex items-center gap-2">
                            <Wallet className="w-3.5 h-3.5" style={{ color: "var(--purple)" }} />
                            Token-by-Token Verdict
                          </h3>
                          <div className="space-y-2">
                            {ai.holdingBreakdown.map((h, i) => {
                              const vl = h.verdict.toLowerCase();
                              const vColor = vl.includes("honeypot") || vl.includes("exit") || vl.includes("dangerous") ? "#ef4444"
                                : vl.includes("high risk") || vl.includes("consider selling") ? "#f97316"
                                : vl.includes("moderate") || vl.includes("monitor") ? "#eab308" : "#22c55e";
                              return (
                                <div key={i} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: "var(--bg-elevated)" }}>
                                  <span className="text-xs font-bold text-white min-w-[48px] shrink-0 pt-0.5">{h.symbol}</span>
                                  <span className="text-[11px] leading-relaxed" style={{ color: vColor }}>{h.verdict}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {!isGold && (
                      <div className="px-6 py-3 flex items-center justify-between"
                        style={{ background: "rgba(255,215,0,0.03)", borderTop: "1px solid rgba(255,215,0,0.08)" }}>
                        <div className="flex items-center gap-2">
                          <Crown className="w-3.5 h-3.5" style={{ color: "#ffd700" }} />
                          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                            Upgrade to <span style={{ color: "#ffd700" }} className="font-semibold">Gold</span> for AI-powered analysis
                          </span>
                        </div>
                        <a href={"https://flap.sh/bnb/" + CONTRACTS.UNIQ_TOKEN} target="_blank" rel="noopener noreferrer"
                          className="text-[10px] font-medium px-2.5 py-1 rounded-md flex items-center gap-1"
                          style={{ background: "rgba(255,215,0,0.08)", color: "#ffd700", border: "1px solid rgba(255,215,0,0.12)" }}>
                          Get $UNIQ <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {/* Security Alerts */}
                <div className="card overflow-hidden">
                  <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4" style={{ color: critAlerts.length > 0 ? "#ef4444" : "#f97316" }} />
                      Security Alerts
                    </h2>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                      style={{ background: critAlerts.length > 0 ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.04)", color: critAlerts.length > 0 ? "#ef4444" : "var(--text-muted)" }}>
                      {critAlerts.length + warnAlerts.length} issue{critAlerts.length + warnAlerts.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {critAlerts.map((alert) => (
                    <div key={alert.id} className="border-l-[3px] hover:bg-white/[0.015] transition-colors"
                      style={{ borderLeftColor: "#ef4444", borderBottom: "1px solid var(--border-subtle)" }}>
                      <button onClick={() => setExpandedAlert(expandedAlert === alert.id ? null : alert.id)}
                        className="w-full px-5 py-3.5 flex items-start gap-3 text-left">
                        <Skull className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#ef4444" }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold" style={{ color: "#ef4444" }}>{alert.title}</div>
                          <div className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{alert.token}</div>
                        </div>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0"
                          style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444" }}>CRITICAL</span>
                        {expandedAlert === alert.id
                          ? <ChevronUp className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }} />
                          : <ChevronDown className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }} />}
                      </button>
                      {expandedAlert === alert.id && (
                        <div className="pl-12 pr-5 pb-4 animate-fade-in">
                          <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{alert.description}</p>
                          <a href={"https://bscscan.com/token/" + alert.tokenAddress} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] font-medium mt-2 hover:underline" style={{ color: "var(--accent)" }}>
                            View on BscScan <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                    </div>
                  ))}

                  {warnAlerts.map((alert) => (
                    <div key={alert.id} className="border-l-[3px] hover:bg-white/[0.015] transition-colors"
                      style={{ borderLeftColor: "#f97316", borderBottom: "1px solid var(--border-subtle)" }}>
                      <button onClick={() => setExpandedAlert(expandedAlert === alert.id ? null : alert.id)}
                        className="w-full px-5 py-3.5 flex items-start gap-3 text-left">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#f97316" }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold" style={{ color: "#f97316" }}>{alert.title}</div>
                          <div className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{alert.token}</div>
                        </div>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0"
                          style={{ background: "rgba(249,115,22,0.1)", color: "#f97316" }}>WARN</span>
                        {expandedAlert === alert.id
                          ? <ChevronUp className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }} />
                          : <ChevronDown className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "var(--text-muted)" }} />}
                      </button>
                      {expandedAlert === alert.id && (
                        <div className="pl-12 pr-5 pb-4 animate-fade-in">
                          <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{alert.description}</p>
                          <a href={"https://bscscan.com/token/" + alert.tokenAddress} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] font-medium mt-2 hover:underline" style={{ color: "var(--accent)" }}>
                            View on BscScan <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                    </div>
                  ))}

                  {infoAlerts.filter(a => userRank >= (tierRank[a.minTier] ?? 0)).map((alert) => (
                    <div key={alert.id} className="border-l-[3px] hover:bg-white/[0.015] transition-colors"
                      style={{ borderLeftColor: "var(--accent)", borderBottom: "1px solid var(--border-subtle)" }}>
                      <button onClick={() => setExpandedAlert(expandedAlert === alert.id ? null : alert.id)}
                        className="w-full px-5 py-3 flex items-start gap-3 text-left">
                        <Eye className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--accent)" }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{alert.title}</div>
                          <div className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>{alert.token}</div>
                        </div>
                        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded shrink-0"
                          style={{ background: "var(--accent-muted)", color: "var(--accent)" }}>INFO</span>
                      </button>
                      {expandedAlert === alert.id && (
                        <div className="pl-12 pr-5 pb-3 animate-fade-in">
                          <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>{alert.description}</p>
                        </div>
                      )}
                    </div>
                  ))}

                  {(() => {
                    const locked = infoAlerts.filter(a => userRank < (tierRank[a.minTier] ?? 0));
                    if (locked.length === 0) return null;
                    return (
                      <div className="px-5 py-2.5 flex items-center justify-between" style={{ background: "rgba(255,255,255,0.01)" }}>
                        <div className="flex items-center gap-2">
                          <Lock className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>+{locked.length} more with higher tier</span>
                        </div>
                        <a href={"https://flap.sh/bnb/" + CONTRACTS.UNIQ_TOKEN} target="_blank" rel="noopener noreferrer"
                          className="text-[10px] font-medium flex items-center gap-1" style={{ color: "var(--purple)" }}>
                          <Zap className="w-3 h-3" /> Upgrade
                        </a>
                      </div>
                    );
                  })()}

                  {result.alerts.length === 0 && (
                    <div className="px-5 py-12 text-center">
                      <CheckCircle className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--green)" }} />
                      <h3 className="text-sm font-semibold text-white mb-1">All Clear</h3>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>No threats detected.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT: Holdings + Sidebar */}
              <div className="lg:col-span-2 space-y-6">
                <div className="card overflow-hidden">
                  <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Wallet className="w-4 h-4" style={{ color: "var(--accent)" }} />
                      Holdings
                    </h2>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(255,255,255,0.04)", color: "var(--text-muted)" }}>
                      {sortedScans.length} token{sortedScans.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {sortedScans.length > 0 ? sortedScans.map((scan) => {
                    const holding = result.holdings.find((h) => h.address.toLowerCase() === scan.address.toLowerCase());
                    const isExpanded = expandedToken === scan.address;
                    const color = riskColor(scan.riskScore);
                    return (
                      <div key={scan.address} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                        <button onClick={() => setExpandedToken(isExpanded ? null : scan.address)}
                          className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-white/[0.02] transition-colors">
                          <span className="w-9 h-7 rounded-lg text-xs font-bold flex items-center justify-center shrink-0"
                            style={{ background: color + "10", color: color, border: "1px solid " + color + "15" }}>
                            {scan.riskScore}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-white">{scan.symbol}</div>
                            {scan.flags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-0.5">
                                {scan.flags.slice(0, 2).map((f) => (
                                  <span key={f} className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
                                    style={{ background: color + "10", color: color }}>{formatFlag(f)}</span>
                                ))}
                                {scan.flags.length > 2 && (
                                  <span className="text-[9px] px-1 py-0.5" style={{ color: "var(--text-muted)" }}>+{scan.flags.length - 2}</span>
                                )}
                              </div>
                            )}
                          </div>
                          <span className="text-xs font-mono shrink-0" style={{ color: "var(--text-secondary)" }}>
                            {holding ? formatBalance(holding.balance) : "\u2014"}
                          </span>
                          {isExpanded
                            ? <ChevronUp className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
                            : <ChevronDown className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />}
                        </button>
                        {isExpanded && (
                          <div className="px-4 pb-4 pt-1 animate-fade-in" style={{ background: "var(--bg-elevated)" }}>
                            <div className="grid grid-cols-2 gap-2 mb-3">
                              {[
                                { label: "Buy Tax", val: scan.buyTax.toFixed(1) + "%", warn: scan.buyTax > 10 },
                                { label: "Sell Tax", val: scan.sellTax.toFixed(1) + "%", warn: scan.sellTax > 10 },
                                { label: "Liquidity", val: "$" + (scan.liquidityUsd >= 1000 ? (scan.liquidityUsd / 1000).toFixed(1) + "K" : scan.liquidityUsd.toFixed(0)), warn: scan.liquidityUsd < 1000 },
                                { label: "Top Holder", val: scan.topHolderPercent + "%", warn: scan.topHolderPercent > 30 },
                              ].map((m) => (
                                <div key={m.label} className="p-2 rounded-lg text-center" style={{ background: "var(--bg-raised)" }}>
                                  <div className="text-[9px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{m.label}</div>
                                  <div className="text-sm font-bold mt-0.5" style={{ color: m.warn ? "#f97316" : "var(--text-primary)" }}>{m.val}</div>
                                </div>
                              ))}
                            </div>
                            <div className="flex flex-wrap gap-1 mb-3">
                              {scan.flags.map((f) => (
                                <span key={f} className="text-[9px] font-semibold px-1.5 py-0.5 rounded" style={{ background: color + "10", color: color }}>{formatFlag(f)}</span>
                              ))}
                              {scan.isHoneypot && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444" }}>HONEYPOT</span>}
                              {scan.isLiquidityLocked && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded" style={{ background: "rgba(34,197,94,0.1)", color: "var(--green)" }}>LP Locked</span>}
                              {scan.isRenounced && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded" style={{ background: "rgba(34,197,94,0.1)", color: "var(--green)" }}>Renounced</span>}
                            </div>
                            <a href={"https://bscscan.com/token/" + scan.address} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-medium hover:underline" style={{ color: "var(--accent)" }}>
                              View on BscScan <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  }) : (
                    <div className="px-5 py-10 text-center">
                      <CheckCircle className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--green)" }} />
                      <p className="text-sm font-medium text-white mb-1">
                        {result.tokenCount > 0 ? "Only Safe Tokens" : "No Tokens Found"}
                      </p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                        {result.tokenCount > 0 ? "Recognized safe tokens only." : "No token holdings."}
                      </p>
                    </div>
                  )}
                </div>

                {/* Guardian Policies */}
                <div className="card p-5 space-y-4">
                  <div className="flex items-center gap-2 pb-2" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <Shield className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-semibold text-white">Guardian Policies</span>
                    <span className="ml-auto text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      AI Parser
                    </span>
                  </div>

                  <form onSubmit={handleCreatePolicy} className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase tracking-wider font-semibold text-zinc-400">
                        Define Rule in Natural Language
                      </label>
                      <textarea
                        value={policyInput}
                        onChange={(e) => setPolicyInput(e.target.value)}
                        placeholder='e.g., "Protect my portfolio if volatility exceeds 15%."'
                        rows={2}
                        className="w-full text-xs px-3 py-2 rounded-lg outline-none resize-none leading-relaxed"
                        style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }}
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handlePreviewPolicy}
                        disabled={policyLoading || !policyInput.trim()}
                        className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold border border-zinc-700 hover:bg-zinc-800 text-zinc-300 transition-colors disabled:opacity-40"
                      >
                        Preview Parse
                      </button>
                      <button
                        type="submit"
                        disabled={policyLoading || !policyInput.trim()}
                        className="flex-1 btn-primary py-2 rounded-lg text-xs font-semibold disabled:opacity-40"
                      >
                        {policyLoading ? "Saving..." : "Add Policy"}
                      </button>
                    </div>
                  </form>

                  {previewRule && (
                    <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-950/40 space-y-2 text-xs">
                      <div className="font-semibold text-zinc-400 uppercase tracking-wider text-[9px]">
                        AI Parser Output:
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px]">
                        <span className="text-zinc-500">Action:</span>
                        <span className="text-zinc-300 font-bold">{previewRule.action}</span>
                        <span className="text-zinc-500">Condition:</span>
                        <span className="text-emerald-400 font-bold">{previewRule.condition}</span>
                        <span className="text-zinc-500">Threshold:</span>
                        <span className="text-amber-400 font-bold">
                          {previewRule.condition.includes("liquidity") 
                            ? `$${(previewRule.threshold / 1e6).toFixed(1)}M` 
                            : `${previewRule.threshold}${previewRule.condition.includes("market") ? "" : "%"}`}
                        </span>
                        <span className="text-zinc-500">Target:</span>
                        <span className="text-purple-400 font-bold">{previewRule.target}</span>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2.5 pt-2">
                    <div className="text-[10px] uppercase tracking-wider font-semibold text-zinc-400">
                      Active Policies ({policies.length})
                    </div>
                    {policies.length === 0 ? (
                      <div className="text-xs text-zinc-500 py-3 text-center bg-zinc-950/20 rounded-lg border border-dashed border-zinc-800">
                        No custom policies configured.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                        {policies.map((policy) => {
                          const rule = policy.parsedRepresentation;
                          return (
                            <div key={policy.id} className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/40 flex flex-col gap-2 relative">
                              <div className="flex items-start justify-between gap-4">
                                <div className="text-xs text-white font-medium leading-normal pr-12">
                                  &quot;{policy.originalInstruction}&quot;
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleDeletePolicy(policy.id)}
                                  className="absolute top-3 right-3 text-zinc-500 hover:text-red-400 p-1 rounded transition-colors"
                                  title="Delete Policy"
                                >
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              <div className="flex flex-wrap gap-1.5 items-center">
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                                  {rule.action}
                                </span>
                                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                                  {rule.condition}: {rule.condition.includes("liquidity") ? `$${(rule.threshold / 1e6).toFixed(1)}M` : rule.threshold}
                                </span>
                                {policy.executionCount > 0 && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                    Triggered: {policy.executionCount}x
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center justify-between pt-1 border-t border-zinc-800/60 mt-1">
                                <span className="text-[9px] text-zinc-500">
                                  Created: {new Date(policy.createdTimestamp).toLocaleDateString()}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[9px] text-zinc-400">
                                    {policy.enabled ? "Enabled" : "Disabled"}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleTogglePolicy(policy.id, policy.enabled)}
                                    className={`w-7 h-4 rounded-full transition-colors relative flex items-center px-0.5 ${
                                      policy.enabled ? "bg-emerald-500" : "bg-zinc-700"
                                    }`}
                                  >
                                    <span
                                      className={`w-3 h-3 rounded-full bg-white shadow-sm transform transition-transform ${
                                        policy.enabled ? "translate-x-3" : "translate-x-0"
                                      }`}
                                    />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Telegram */}
                <div className="card p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Send className="w-4 h-4" style={{ color: "#229ED9" }} />
                    <span className="text-sm font-semibold text-white">Telegram Alerts</span>
                    {tgConnected && (
                      <span className="ml-auto flex items-center gap-1 text-[9px] font-medium" style={{ color: "var(--green)" }}>
                        <span className="w-1.5 h-1.5 rounded-full pulse-live" style={{ background: "var(--green)" }} /> Active
                      </span>
                    )}
                  </div>
                  {userRank >= 2 ? (
                    tgConnected ? (
                      <div className="flex items-center justify-between">
                        <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Push alerts active</span>
                        <button onClick={disconnectTelegram} disabled={tgLoading}
                          className="text-[10px] font-medium px-2 py-0.5 rounded hover:bg-white/5"
                          style={{ color: "#ef4444" }}>
                          {tgLoading ? "..." : "Disconnect"}
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex gap-1.5">
                          <input type="text" value={tgChatId} onChange={(e) => setTgChatId(e.target.value)}
                            placeholder="Your Chat ID"
                            className="flex-1 text-[11px] px-2.5 py-2 rounded-lg outline-none min-w-0"
                            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", color: "var(--text-primary)" }} />
                          <button onClick={connectTelegram} disabled={tgLoading || !tgChatId.trim()}
                            className="px-3 py-2 rounded-lg text-[11px] font-medium disabled:opacity-40 shrink-0"
                            style={{ background: "#229ED9", color: "#fff" }}>
                            {tgLoading ? "..." : "Connect"}
                          </button>
                        </div>
                        <a href="https://t.me/aegis_protocol_bot" target="_blank" rel="noopener noreferrer"
                          className="text-[10px] mt-2 inline-flex items-center gap-1 hover:underline" style={{ color: "#229ED9" }}>
                          Get ID from @aegis_protocol_bot <ExternalLink className="w-3 h-3" />
                        </a>
                      </>
                    )
                  ) : (
                    <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: "var(--bg-elevated)" }}>
                      <Lock className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                      <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                        Requires <span className="font-semibold" style={{ color: "#c0c0c0" }}>Silver</span> tier (100K $UNIQ)
                      </span>
                    </div>
                  )}
                </div>

                {/* AI Decision Timeline */}
                {timelines.length > 0 && (
                  <div className="card overflow-hidden">
                    <button
                      onClick={() => setTimelineOpen(!timelineOpen)}
                      className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/[0.015] transition-colors"
                      style={{ borderBottom: timelineOpen ? "1px solid var(--border-subtle)" : undefined }}
                    >
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4" style={{ color: "var(--accent)" }} />
                        <span className="text-sm font-semibold text-white">AI Decision Timeline</span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider"
                          style={{ background: "rgba(52,211,153,0.08)", color: "var(--green)", border: "1px solid rgba(52,211,153,0.15)" }}>
                          {timelines.length} cycles
                        </span>
                      </div>
                      {timelineOpen
                        ? <ChevronUp className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                        : <ChevronDown className="w-4 h-4" style={{ color: "var(--text-muted)" }} />}
                    </button>

                    {timelineOpen && (
                      <div className="divide-y animate-fade-in" style={{ borderColor: "var(--border-subtle)" }}>
                        {timelines.map((tl) => {
                          const isExp = expandedCycle === tl.id;
                          const card = tl.decisionCard;
                          const actionColor = card.decision === "MONITOR" || card.decision === "NONE"
                            ? "#22c55e"
                            : card.decision === "ALERT"
                              ? "#eab308"
                              : "#ef4444";
                          return (
                            <div key={tl.id}>
                              {/* Cycle header row */}
                              <button
                                onClick={() => setExpandedCycle(isExp ? null : tl.id)}
                                className="w-full px-5 py-3.5 flex items-center gap-3 text-left hover:bg-white/[0.02] transition-colors"
                              >
                                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                                  style={{ background: actionColor + "12", border: "1px solid " + actionColor + "20" }}>
                                  <BarChart3 className="w-3.5 h-3.5" style={{ color: actionColor }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold" style={{ color: actionColor }}>
                                      {card.decision}
                                    </span>
                                    <span className="text-[9px] px-1.5 py-0.5 rounded font-mono"
                                      style={{ background: "rgba(255,255,255,0.04)", color: "var(--text-muted)" }}>
                                      Cycle #{tl.cycleNumber}
                                    </span>
                                    {tl.multiAgentEnabled && (
                                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                                        style={{ background: "rgba(139,92,246,0.1)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.2)" }}>
                                        Multi-Agent
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                                    {new Date(tl.startTimestamp).toLocaleTimeString()} · Risk {card.riskScore}/100 · {card.confidence}% conf
                                  </div>
                                </div>
                                {isExp
                                  ? <ChevronUp className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />
                                  : <ChevronDown className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--text-muted)" }} />}
                              </button>

                              {/* Expanded detail */}
                              {isExp && (
                                <div className="px-5 pb-5 pt-1 animate-fade-in space-y-4" style={{ background: "var(--bg-elevated)" }}>
                                  {/* Decision Card */}
                                  <div className="p-3 rounded-xl space-y-2.5" style={{ background: "var(--bg-raised)", border: "1px solid " + actionColor + "18" }}>
                                    <div className="text-[9px] uppercase tracking-widest font-semibold" style={{ color: "var(--text-muted)" }}>Decision Card</div>
                                    <div className="grid grid-cols-2 gap-2">
                                      {[
                                        { label: "Decision", val: card.decision, color: actionColor },
                                        { label: "Confidence", val: card.confidence + "%", color: "var(--text-primary)" },
                                        { label: "Risk Score", val: card.riskScore + " / 100", color: riskColor(card.riskScore) },
                                        { label: "TX Status", val: card.transactionStatus, color: card.transactionStatus === "executed" ? "#22c55e" : "var(--text-muted)" },
                                      ].map((m) => (
                                        <div key={m.label} className="p-2 rounded-lg" style={{ background: "var(--bg-elevated)" }}>
                                          <div className="text-[9px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{m.label}</div>
                                          <div className="text-xs font-bold mt-0.5" style={{ color: m.color }}>{m.val}</div>
                                        </div>
                                      ))}
                                    </div>
                                    <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                                      Provider: <span className="text-white font-medium">{card.executionProvider}</span>
                                    </div>
                                    {card.triggeredPolicy && (
                                      <div className="text-[10px] p-2 rounded-lg" style={{ background: "rgba(239,68,68,0.06)", color: "#f87171", border: "1px solid rgba(239,68,68,0.12)" }}>
                                        <span className="font-semibold">Policy: </span>{card.triggeredPolicy.slice(0, 80)}
                                      </div>
                                    )}
                                  </div>

                                  {/* Agent Steps Timeline */}
                                  <div>
                                    <div className="text-[9px] uppercase tracking-widest font-semibold mb-2" style={{ color: "var(--text-muted)" }}>Agent Pipeline</div>
                                    <div className="space-y-1.5">
                                      {tl.steps.map((step, idx) => (
                                        <div key={step.step + idx} className="flex items-start gap-2.5">
                                          <div className="flex flex-col items-center shrink-0" style={{ width: 20 }}>
                                            <div className="w-2 h-2 rounded-full mt-1" style={{ background: "var(--accent)", flexShrink: 0 }} />
                                            {idx < tl.steps.length - 1 && (
                                              <div className="w-px flex-1 mt-0.5" style={{ background: "var(--border-subtle)", minHeight: 12 }} />
                                            )}
                                          </div>
                                          <div className="pb-1.5 flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5">
                                              <span className="text-[11px] font-semibold text-white">{step.label}</span>
                                              <span className="text-[9px] font-mono" style={{ color: "var(--text-muted)" }}>
                                                {new Date(step.timestamp).toLocaleTimeString()}
                                              </span>
                                            </div>
                                            <div className="text-[10px] leading-relaxed mt-0.5" style={{ color: "var(--text-secondary)" }}>
                                              {step.summary}
                                            </div>
                                            {step.debugOutput && (
                                              <div className="text-[9px] font-mono mt-1 px-2 py-1 rounded"
                                                style={{ background: "rgba(255,255,255,0.03)", color: "var(--text-muted)", border: "1px solid var(--border-subtle)" }}>
                                                {step.debugOutput.slice(0, 120)}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Reasoning Hash */}
                                  <div className="flex items-center gap-1.5">
                                    <GitBranch className="w-3 h-3 shrink-0" style={{ color: "var(--text-muted)" }} />
                                    <span className="text-[9px] font-mono truncate" style={{ color: "var(--text-muted)" }}>
                                      {tl.reasoningHash.slice(0, 32)}...
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Quick Links */}
                <div className="grid grid-cols-2 gap-3">
                  <Link href="/vault" className="card card-action p-4 group">
                    <TrendingUp className="w-4 h-4 mb-2" style={{ color: "var(--green)" }} />
                    <span className="text-xs font-semibold text-white block">Protected Vault</span>
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Earn yield with AI guard</span>
                  </Link>
                  <Link href="/scanner" className="card card-action p-4 group">
                    <Shield className="w-4 h-4 mb-2" style={{ color: "var(--accent)" }} />
                    <span className="text-xs font-semibold text-white block">Token Scanner</span>
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Scan any BSC token</span>
                  </Link>
                </div>

                {/* Tier Badge */}
                {result.tier === "Gold" ? (
                  <div className="card p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Crown className="w-4 h-4" style={{ color: "#ffd700" }} />
                      <span className="text-sm font-semibold" style={{ color: "#ffd700" }}>Gold Tier</span>
                    </div>
                    <p className="text-[11px] mb-2" style={{ color: "var(--text-muted)" }}>
                      All features unlocked. {result.uniqBalance >= 1_000_000 ? (result.uniqBalance / 1_000_000).toFixed(1) + "M" : (result.uniqBalance / 1_000).toFixed(0) + "K"} $UNIQ
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {["AI Analysis", "Telegram", "Priority Alerts", "40% Fee Discount"].map(f => (
                        <span key={f} className="text-[9px] font-medium px-1.5 py-0.5 rounded"
                          style={{ background: "rgba(255,215,0,0.08)", color: "#ffd700" }}>{f}</span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <a href={"https://flap.sh/bnb/" + CONTRACTS.UNIQ_TOKEN} target="_blank" rel="noopener noreferrer"
                    className="card card-action p-4 block">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="w-4 h-4" style={{ color: "var(--purple)" }} />
                      <span className="text-xs font-semibold text-white">Upgrade Tier</span>
                      <ExternalLink className="w-3 h-3 ml-auto" style={{ color: "var(--text-muted)" }} />
                    </div>
                    <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                      Hold $UNIQ for AI analysis, alerts, and fee discounts.
                    </p>
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

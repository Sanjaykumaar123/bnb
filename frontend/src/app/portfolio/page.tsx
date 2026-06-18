"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useWalletContext } from "../../lib/WalletContext";
import { DecisionTimeline } from "../../lib/decision-timeline-store";
import {
  TrendingUp, Shield, ShieldCheck, Award, Activity, Wallet,
  PieChart, BarChart3, Clock, AlertTriangle, Layers,
  RefreshCw, ChevronRight, ArrowRight, ShieldAlert,
  Fingerprint, Sparkles, Server
} from "lucide-react";

interface AnalyticsData {
  enabled: boolean;
  metrics?: {
    protectedCapital: number;
    avoidedLosses: number;
    currentPortfolioValue: number;
    allocation: {
      bnb: number;
      stablecoins: number;
      other: number;
    };
    protectionEvents: number;
    rebalances: number;
    policyTriggers: number;
    decisionsExecuted: number;
    successRate: number;
    avgRiskScore: number;
    highestRisk: number;
    reputation: number;
    totalTransactions: number;
    activeProvider: string;
    health: {
      status: string;
      score: number;
      uptime: number;
      policiesEvaluated: number;
    };
  };
  protectionHistory?: Array<{
    timestamp: number;
    riskScore: number;
    action: string;
    reason: string;
    provider: string;
    status: string;
    id: string;
  }>;
  recentExecutions?: DecisionTimeline[];
}

export default function PortfolioAnalyticsPage() {
  const { address, isConnected } = useWalletContext();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const addrParam = address ? `?address=${encodeURIComponent(address)}` : "";
      const res = await fetch(`/api/portfolio${addrParam}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    }
    setLoading(false);
  }, [address]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Format currency helpers
  const formatUSD = (val: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0
    }).format(val);
  };

  const getRiskColor = (score: number) => {
    if (score < 30) return "var(--green)";
    if (score < 60) return "var(--yellow)";
    if (score < 80) return "#f97316";
    return "var(--red)";
  };

  const getHealthColor = (status: string) => {
    switch (status) {
      case "Excellent": return "var(--green)";
      case "Good": return "var(--accent)";
      case "Moderate": return "var(--yellow)";
      default: return "var(--red)";
    }
  };

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <RefreshCw className="w-8 h-8 animate-spin" style={{ color: "var(--accent)" }} />
        <span className="mt-4 text-sm" style={{ color: "var(--text-secondary)" }}>Analyzing Guardian intelligence...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="card p-12">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--red)" }} />
          <h2 className="text-xl font-bold text-white mb-2">Failed to load Portfolio Analytics</h2>
          <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
            Could not fetch data from the analytics API. Please try again.
          </p>
          <button onClick={fetchAnalytics} className="btn-primary inline-flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      </div>
    );
  }

  if (data.enabled === false) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="card p-12">
          <ShieldAlert className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--yellow)" }} />
          <h2 className="text-xl font-bold text-white mb-2">Portfolio Analytics Disabled</h2>
          <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
            The Portfolio Analytics Dashboard is currently disabled via the environment configuration.
          </p>
          <Link href="/guardian" className="btn-primary inline-flex items-center gap-2">
            Return to Shield <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  const metrics = data.metrics!;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 animate-fade-in">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{ background: "var(--accent-muted)", color: "var(--accent)", border: "1px solid var(--accent-border)" }}>
              Guardian Intelligence
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{ background: "rgba(52,211,153,0.08)", color: "var(--green)", border: "1px solid rgba(52,211,153,0.15)" }}>
              Active
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white flex items-center gap-3">
            <TrendingUp className="w-8 h-8" style={{ color: "var(--accent)" }} />
            Portfolio Analytics
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
            Evaluate the financial value, safety rating, and protection performance of the Aegis Guardian AI.
          </p>
        </div>
        <div>
          <button onClick={fetchAnalytics} disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{ background: "var(--bg-raised)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Sync Dashboard
          </button>
        </div>
      </div>

      {/* TOP PRIMARY METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="card p-5 relative overflow-hidden group hover:border-white/[0.12] transition-colors">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/[0.01] rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "var(--accent-muted)", border: "1px solid var(--accent-border)" }}>
              <Wallet className="w-5 h-5" style={{ color: "var(--accent)" }} />
            </div>
            <span className="text-[10px] font-semibold text-white/50 uppercase tracking-widest">Total Value</span>
          </div>
          <div className="text-2xl font-bold text-white mb-1">{formatUSD(metrics.currentPortfolioValue)}</div>
          <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
            {isConnected ? "Live Wallet Balance" : "Demo Simulation Portfolio"}
          </p>
        </div>

        <div className="card p-5 relative overflow-hidden group hover:border-white/[0.12] transition-colors">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/[0.01] rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.15)" }}>
              <ShieldCheck className="w-5 h-5" style={{ color: "var(--green)" }} />
            </div>
            <span className="text-[10px] font-semibold text-white/50 uppercase tracking-widest">Protected Capital</span>
          </div>
          <div className="text-2xl font-bold text-white mb-1">{formatUSD(metrics.protectedCapital)}</div>
          <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
            Actively covered by Guardian policies
          </p>
        </div>

        <div className="card p-5 relative overflow-hidden group hover:border-white/[0.12] transition-colors">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/[0.01] rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.15)" }}>
              <Award className="w-5 h-5" style={{ color: "var(--purple)" }} />
            </div>
            <span className="text-[10px] font-semibold text-white/50 uppercase tracking-widest">Avoided Losses</span>
          </div>
          <div className="text-2xl font-bold text-white mb-1" style={{ color: "var(--purple)" }}>{formatUSD(metrics.avoidedLosses)}</div>
          <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
            Estimated losses mitigated by AI
          </p>
        </div>

        <div className="card p-5 relative overflow-hidden group hover:border-white/[0.12] transition-colors">
          <div className="absolute top-0 right-0 w-24 h-24 bg-white/[0.01] rounded-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.15)" }}>
              <Activity className="w-5 h-5" style={{ color: "var(--yellow)" }} />
            </div>
            <span className="text-[10px] font-semibold text-white/50 uppercase tracking-widest">Success Rate</span>
          </div>
          <div className="text-2xl font-bold text-white mb-1">{metrics.successRate}%</div>
          <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
            Of autonomous monitoring cycles
          </p>
        </div>
      </div>

      {/* MAIN LAYOUT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT TWO COLUMNS (occupies 2 cols on desktop) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* GUARDIAN HEALTH & REPUTATION */}
          <div className="card p-6">
            <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4" style={{ color: "var(--accent)" }} />
              Guardian Reputation & System Status
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              {/* Health Score Circle */}
              <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white/[0.01] border border-white/[0.03]">
                <div className="relative flex items-center justify-center w-24 h-24 rounded-full border-4"
                  style={{ borderColor: getHealthColor(metrics.health.status) + "22", borderTopColor: getHealthColor(metrics.health.status) }}>
                  <div className="text-center">
                    <span className="text-3xl font-bold text-white">{metrics.health.score}</span>
                    <span className="text-[10px] block text-white/40">SCORE</span>
                  </div>
                </div>
                <span className="text-sm font-bold mt-3" style={{ color: getHealthColor(metrics.health.status) }}>
                  {metrics.health.status} Health
                </span>
              </div>

              {/* System Stats */}
              <div className="space-y-4 md:col-span-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] uppercase text-white/40 block">Guardian Reputation</span>
                    <span className="text-lg font-bold text-white">{metrics.reputation} / 100</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-white/40 block">System Uptime</span>
                    <span className="text-lg font-bold text-white">{metrics.health.uptime}%</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-white/40 block">Wallet Provider</span>
                    <span className="text-sm font-bold text-white truncate max-w-[150px] block">{metrics.activeProvider}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-white/40 block">Guardian Policies</span>
                    <span className="text-lg font-bold text-white">{metrics.health.policiesEvaluated} Evaluated</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl text-xs bg-white/[0.02] border border-white/[0.03] flex items-center gap-2.5">
                  <Server className="w-4 h-4 text-white/40 shrink-0" />
                  <span style={{ color: "var(--text-secondary)" }}>
                    Multi-agent supervisor active. Auto-monitoring for liquidity pulls, slippage spikes, and whale selling.
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* PORTFOLIO ALLOCATION */}
          <div className="card p-6">
            <h3 className="text-base font-semibold text-white mb-5 flex items-center gap-2">
              <PieChart className="w-4 h-4" style={{ color: "var(--accent)" }} />
              Portfolio Value Distribution
            </h3>

            <div className="space-y-4">
              {/* CSS Bar Chart representation */}
              <div className="h-6 rounded-full overflow-hidden flex w-full border border-white/[0.05]">
                <div className="h-full transition-all duration-500" style={{ width: `${metrics.allocation.bnb}%`, background: "var(--bnb)" }} title="BNB" />
                <div className="h-full transition-all duration-500" style={{ width: `${metrics.allocation.stablecoins}%`, background: "var(--green)" }} title="Stablecoins" />
                <div className="h-full transition-all duration-500" style={{ width: `${metrics.allocation.other}%`, background: "var(--purple)" }} title="Other Assets" />
              </div>

              {/* Legends with percentages */}
              <div className="grid grid-cols-3 gap-4 pt-2">
                <div className="p-3 rounded-xl bg-white/[0.015] border border-white/[0.03]">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--bnb)" }} />
                    <span className="text-xs font-semibold text-white/60">BNB</span>
                  </div>
                  <span className="text-xl font-bold text-white">{metrics.allocation.bnb}%</span>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.015] border border-white/[0.03]">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--green)" }} />
                    <span className="text-xs font-semibold text-white/60">Stablecoins</span>
                  </div>
                  <span className="text-xl font-bold text-white">{metrics.allocation.stablecoins}%</span>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.015] border border-white/[0.03]">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--purple)" }} />
                    <span className="text-xs font-semibold text-white/60">Other Assets</span>
                  </div>
                  <span className="text-xl font-bold text-white">{metrics.allocation.other}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* DETAILED KEY METRICS GRID */}
          <div className="card p-6">
            <h3 className="text-base font-semibold text-white mb-5 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" style={{ color: "var(--accent)" }} />
              Guardian Performance Benchmarks
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Protection Events", value: metrics.protectionEvents, desc: "Mitigations executed", color: "var(--red)" },
                { label: "Asset Rebalances", value: metrics.rebalances, desc: "Portfolio reallocations", color: "var(--bnb)" },
                { label: "Policy Triggers", value: metrics.policyTriggers, desc: "User policies verified", color: "var(--green)" },
                { label: "AI Decisions", value: metrics.decisionsExecuted, desc: "Executed cycle tasks", color: "var(--accent)" },
                { label: "Avg Risk score", value: `${metrics.avgRiskScore}/100`, desc: "Risk index average", color: getRiskColor(metrics.avgRiskScore) },
                { label: "Peak Risk index", value: `${metrics.highestRisk}/100`, desc: "Highest recorded risk", color: getRiskColor(metrics.highestRisk) },
                { label: "Total TXs", value: metrics.totalTransactions, desc: "On-chain operations", color: "var(--text-primary)" },
                { label: "Uptime Rate", value: `${metrics.health.uptime}%`, desc: "24/7 Agent loop online", color: "var(--green)" },
              ].map((m, idx) => (
                <div key={idx} className="p-3.5 rounded-xl bg-white/[0.01] border border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                  <span className="text-[10px] uppercase text-white/40 block font-semibold tracking-wider">{m.label}</span>
                  <span className="text-xl font-bold block my-1" style={{ color: m.color }}>{m.value}</span>
                  <span className="text-[9px]" style={{ color: "var(--text-secondary)" }}>{m.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (occupies 1 col on desktop) */}
        <div className="space-y-6">
          
          {/* PROTECTION HISTORY LIST */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Shield className="w-4 h-4" style={{ color: "var(--red)" }} />
                Protection Log
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-white/[0.05] text-white/60">
                {data.protectionHistory?.length || 0} Events
              </span>
            </h3>

            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
              {!data.protectionHistory || data.protectionHistory.length === 0 ? (
                <div className="text-center py-12 text-xs" style={{ color: "var(--text-muted)" }}>
                  <Shield className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  No protection events recorded yet.
                </div>
              ) : (
                data.protectionHistory.map((item, idx) => (
                  <div key={item.id || idx} className="p-3 rounded-xl bg-white/[0.015] border border-white/[0.03] space-y-2 hover:border-white/[0.08] transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-white/50">
                        {new Date(item.timestamp).toLocaleDateString()} {new Date(item.timestamp).toLocaleTimeString()}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                        style={{ background: getRiskColor(item.riskScore) + "18", color: getRiskColor(item.riskScore) }}>
                        Risk {item.riskScore}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold uppercase" style={{ color: "var(--red)" }}>
                        {item.action}
                      </span>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/[0.04] text-white/40">
                        {item.provider}
                      </span>
                    </div>

                    <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
                      {item.reason}
                    </p>

                    <div className="flex items-center justify-between pt-1.5 border-t border-white/[0.02]">
                      <span className="text-[9px] font-semibold flex items-center gap-1">
                        Status:{" "}
                        <span style={{ color: item.status === "executed" ? "var(--green)" : "var(--text-muted)" }}>
                          {item.status}
                        </span>
                      </span>
                      <Link href="/guardian" className="text-[9px] text-white/50 hover:text-white flex items-center gap-0.5">
                        View timeline <ChevronRight className="w-2.5 h-2.5" />
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* RECENT CYCLES LIST */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4" style={{ color: "var(--accent)" }} />
              Monitoring Cycles
            </h3>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {!data.recentExecutions || data.recentExecutions.length === 0 ? (
                <div className="text-center py-12 text-xs" style={{ color: "var(--text-muted)" }}>
                  <Layers className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  No agent cycles recorded yet.
                </div>
              ) : (
                data.recentExecutions.slice(0, 5).map((tl, idx) => (
                  <div key={tl.id || idx} className="p-3 rounded-xl bg-white/[0.015] border border-white/[0.03] hover:border-white/[0.08] transition-colors">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-bold text-white">
                        Cycle #{tl.cycleNumber}
                      </span>
                      <span className="text-[9px] text-white/40">
                        {new Date(tl.startTimestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span style={{ color: "var(--text-secondary)" }}>
                        Decision:{" "}
                        <span className="font-semibold text-white">
                          {tl.decisionCard.decision}
                        </span>
                      </span>
                      <span style={{ color: "var(--text-secondary)" }}>
                        Confidence:{" "}
                        <span className="font-semibold text-white">
                          {tl.decisionCard.confidence}%
                        </span>
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* INFO CARD */}
          <div className="card p-5" style={{ background: "var(--accent-muted)", border: "1px solid var(--accent-border)" }}>
            <div className="flex gap-2.5 items-start">
              <Fingerprint className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "var(--accent)" }} />
              <div>
                <h4 className="text-xs font-semibold text-white">Cryptographic Reasoning Hash</h4>
                <p className="text-[10px] mt-1 leading-relaxed text-white/60">
                  Every decision cycle triggers a multi-agent validation process, creating a unique reasoning chain hashed cryptographically for verified security audits.
                </p>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}

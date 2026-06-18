"use client";
import { useState, useEffect, useCallback } from "react";
import { Bot, Brain, Zap, Shield, Activity, TrendingUp, CheckCircle, Clock, Cpu, Network, BarChart3, GitBranch, RefreshCw, AlertTriangle, Eye, Droplets, Users, Server } from "lucide-react";
import { DecisionTimeline, AgentStep } from "../../lib/decision-timeline-store";

// ─── Real API types ─────────────────────────────────────────────
interface HealthCheck { name: string; status: "ok"|"error"|"unconfigured"; latencyMs?: number; error?: string; }
interface HealthData { status: string; checks: HealthCheck[]; timestamp: number; chain: string; version: string; }

// ─── Helpers ────────────────────────────────────────────────────
function stepColor(step: string) {
  if (step.includes("market")) return "#00d4f5";
  if (step.includes("liquidity")) return "#22c55e";
  if (step.includes("whale")) return "#f59e0b";
  if (step.includes("sentiment")) return "#ec4899";
  if (step.includes("risk")) return "#ef4444";
  if (step.includes("supervisor") || step.includes("guardian")) return "#a855f7";
  if (step.includes("execution") || step.includes("transaction")) return "#22c55e";
  return "#00d4f5";
}
function stepIcon(step: string) {
  if (step.includes("market")) return TrendingUp;
  if (step.includes("liquidity")) return Droplets;
  if (step.includes("whale")) return Users;
  if (step.includes("sentiment")) return Brain;
  if (step.includes("risk")) return Shield;
  if (step.includes("supervisor") || step.includes("guardian")) return GitBranch;
  if (step.includes("execution")) return Zap;
  if (step.includes("transaction")) return CheckCircle;
  return Eye;
}
function riskColor(score: number) {
  if (score >= 70) return "#ef4444";
  if (score >= 45) return "#f59e0b";
  return "#22c55e";
}
function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  return `${Math.floor(s/3600)}h ago`;
}

// ─── Main Page ──────────────────────────────────────────────────
export default function AgentBrainPage() {
  const [timelines, setTimelines] = useState<DecisionTimeline[]>([]);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [selectedCycle, setSelectedCycle] = useState<DecisionTimeline | null>(null);
  const [uptime, setUptime] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      const [tlRes, hRes] = await Promise.all([
        fetch("/api/timeline?limit=10"),
        fetch("/api/health"),
      ]);
      const tlData = await tlRes.json();
      const hData = await hRes.json();
      if (tlData.success) {
        setTimelines(tlData.timelines || []);
        if (tlData.timelines?.length > 0 && !selectedCycle) {
          setSelectedCycle(tlData.timelines[0]);
        }
      }
      setHealth(hData);
    } catch {
      // silent — health endpoint may vary
    } finally {
      setLoading(false);
      setLastRefresh(Date.now());
    }
  }, [selectedCycle]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000); // poll every 15s
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    const t = setInterval(() => setUptime(u => u + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const latest = timelines[0];
  const latestCard = latest?.decisionCard;
  const allSteps: AgentStep[] = selectedCycle?.steps || [];

  // Derive real metrics from timeline data
  const avgRisk = timelines.length > 0
    ? Math.round(timelines.reduce((a, t) => a + (t.decisionCard?.riskScore || 0), 0) / timelines.length)
    : 0;
  const avgConf = timelines.length > 0
    ? Math.round(timelines.reduce((a, t) => a + (t.decisionCard?.confidence || 0), 0) / timelines.length)
    : 0;
  const threatsFound = timelines.filter(t => t.decisionCard?.triggeredPolicy).length;
  const isMultiAgent = latest?.multiAgentEnabled ?? false;

  return (
    <div style={{ minHeight: "100vh", background: "#0a0e17", padding: "24px 16px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>

        {/* ── Header ── */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "rgba(0,212,245,0.06)", border: "1px solid rgba(0,212,245,0.2)", borderRadius: 100, padding: "8px 20px", marginBottom: 16 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 8px #22c55e", animation: "pulse 1.5s infinite" }} />
            <span style={{ color: "#00d4f5", fontSize: 12, fontWeight: 700, letterSpacing: 2, fontFamily: "monospace" }}>AEGIS GUARDIAN — REAL-TIME AI BRAIN</span>
          </div>
          <h1 style={{ fontSize: 38, fontWeight: 800, color: "white", margin: 0 }}>
            Live Agent <span style={{ background: "linear-gradient(135deg,#00d4f5,#a855f7)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Intelligence</span>
          </h1>
          <p style={{ color: "#64748b", fontSize: 13, marginTop: 6 }}>
            {loading ? "Loading agent data…" : timelines.length > 0
              ? `${timelines.length} real decision cycles loaded · Refreshes every 15s · Last: ${timeAgo(lastRefresh)}`
              : "Waiting for agent cycles — backend is running on Render"}
          </p>
          <button onClick={fetchData} style={{ marginTop: 10, background: "rgba(0,212,245,0.08)", border: "1px solid rgba(0,212,245,0.2)", color: "#00d4f5", padding: "6px 16px", borderRadius: 8, cursor: "pointer", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <RefreshCw style={{ width: 12, height: 12 }} /> Refresh Now
          </button>
        </div>

        {/* ── Live Stats from Real Data ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 24 }}>
          {[
            { label: "Agent Status", value: health ? (health.status === "healthy" ? "ONLINE" : health.status === "degraded" ? "DEGRADED" : "PARTIAL") : "CHECKING", color: health?.status === "healthy" ? "#22c55e" : "#f59e0b", icon: Activity },
            { label: "Decision Cycles", value: timelines.length > 0 ? `${timelines.length} real` : "0 yet", color: "#00d4f5", icon: Cpu },
            { label: "Avg Risk Score", value: timelines.length > 0 ? `${avgRisk}/100` : "—", color: riskColor(avgRisk), icon: Shield },
            { label: "Avg Confidence", value: timelines.length > 0 ? `${avgConf}%` : "—", color: "#a855f7", icon: CheckCircle },
            { label: "Threats Found", value: timelines.length > 0 ? `${threatsFound}` : "—", color: threatsFound > 0 ? "#ef4444" : "#22c55e", icon: AlertTriangle },
            { label: "Multi-Agent", value: isMultiAgent ? "ACTIVE" : "LEGACY", color: isMultiAgent ? "#00d4f5" : "#64748b", icon: Network },
          ].map((s) => (
            <div key={s.label} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <s.icon style={{ width: 12, height: 12, color: s.color }} />
                <span style={{ color: "#475569", fontSize: 9, textTransform: "uppercase", letterSpacing: 1.5, fontFamily: "monospace" }}>{s.label}</span>
              </div>
              <div style={{ color: s.color, fontSize: 18, fontWeight: 800, fontFamily: "monospace" }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* ── No Data State ── */}
        {!loading && timelines.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, marginBottom: 24 }}>
            <Bot style={{ width: 48, height: 48, color: "#334155", margin: "0 auto 16px" }} />
            <h3 style={{ color: "white", fontSize: 18, margin: "0 0 8px" }}>Agent is Running — No Cycles Logged Yet</h3>
            <p style={{ color: "#64748b", fontSize: 13, margin: 0 }}>The Render backend is live. Decision timelines are stored in Upstash Redis.<br />The first cycle data will appear here within 30 seconds of agent startup.</p>
            <div style={{ marginTop: 16, display: "inline-flex", alignItems: "center", gap: 8, color: "#00d4f5", fontSize: 12, fontFamily: "monospace" }}>
              <Server style={{ width: 14, height: 14 }} />
              Render agent: <a href="https://jarvis-agent-lho3.onrender.com" target="_blank" rel="noreferrer" style={{ color: "#00d4f5" }}>jarvis-agent-lho3.onrender.com</a>
            </div>
          </div>
        )}

        {timelines.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 20, marginBottom: 20 }}>

            {/* LEFT — Cycle Selector + Latest Decision */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Latest Decision Card */}
              {latestCard && (
                <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 20 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                    <BarChart3 style={{ width: 15, height: 15, color: "#f59e0b" }} />
                    <span style={{ color: "white", fontSize: 13, fontWeight: 700 }}>Latest Supervisor Decision</span>
                    <span style={{ marginLeft: "auto", color: "#64748b", fontSize: 10, fontFamily: "monospace" }}>{timeAgo(latest.endTimestamp)}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {[
                      { label: "Decision", value: latestCard.decision, color: "#00d4f5" },
                      { label: "Risk Score", value: `${latestCard.riskScore}/100`, color: riskColor(latestCard.riskScore) },
                      { label: "Confidence", value: `${latestCard.confidence}%`, color: "#a855f7" },
                      { label: "Execution", value: latestCard.executionProvider, color: "#22c55e" },
                      { label: "Tx Status", value: latestCard.transactionStatus.toUpperCase(), color: latestCard.transactionStatus === "executed" ? "#22c55e" : latestCard.transactionStatus === "dry_run" ? "#00d4f5" : "#64748b" },
                    ].map(row => (
                      <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "rgba(255,255,255,0.02)", borderRadius: 8 }}>
                        <span style={{ color: "#64748b", fontSize: 11 }}>{row.label}</span>
                        <span style={{ color: row.color, fontSize: 12, fontWeight: 700, fontFamily: "monospace" }}>{row.value}</span>
                      </div>
                    ))}
                    {latestCard.triggeredPolicy && (
                      <div style={{ padding: "10px 12px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8 }}>
                        <div style={{ color: "#ef4444", fontSize: 9, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>⚠ Policy Triggered</div>
                        <div style={{ color: "#f87171", fontSize: 10 }}>{latestCard.triggeredPolicy}</div>
                      </div>
                    )}
                    {latestCard.transactionHash && latestCard.transactionHash !== "dry-run-tx" && (
                      <div style={{ padding: "8px 12px", background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)", borderRadius: 8 }}>
                        <div style={{ color: "#22c55e", fontSize: 9, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>On-Chain Hash</div>
                        <div style={{ color: "#4ade80", fontSize: 10, fontFamily: "monospace", wordBreak: "break-all" }}>{latestCard.transactionHash}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Cycle Selector */}
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 16 }}>
                <div style={{ color: "#64748b", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, fontFamily: "monospace" }}>
                  All Real Cycles ({timelines.length})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 280, overflowY: "auto" }}>
                  {timelines.map((tl) => {
                    const isSelected = selectedCycle?.id === tl.id;
                    const rc = riskColor(tl.decisionCard?.riskScore || 0);
                    return (
                      <button key={tl.id} onClick={() => setSelectedCycle(tl)} style={{
                        display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, cursor: "pointer", textAlign: "left",
                        background: isSelected ? "rgba(0,212,245,0.08)" : "rgba(255,255,255,0.02)",
                        border: `1px solid ${isSelected ? "rgba(0,212,245,0.3)" : "rgba(255,255,255,0.04)"}`,
                      }}>
                        <div style={{ width: 32, height: 28, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: `${rc}15`, border: `1px solid ${rc}30`, color: rc, fontSize: 11, fontWeight: 700, fontFamily: "monospace", flexShrink: 0 }}>
                          #{tl.cycleNumber}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ color: "white", fontSize: 11, fontWeight: 600 }}>{tl.decisionCard?.decision || "MONITOR"}</div>
                          <div style={{ color: "#475569", fontSize: 9, fontFamily: "monospace" }}>{timeAgo(tl.startTimestamp)} · {tl.steps.length} steps</div>
                        </div>
                        <div style={{ color: rc, fontSize: 11, fontWeight: 700, fontFamily: "monospace", flexShrink: 0 }}>{tl.decisionCard?.riskScore}/100</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* RIGHT — Real Step-by-Step Agent Trace */}
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <Network style={{ width: 15, height: 15, color: "#00d4f5" }} />
                <span style={{ color: "white", fontSize: 13, fontWeight: 700 }}>
                  Agent Execution Trace — Cycle #{selectedCycle?.cycleNumber ?? "—"}
                </span>
                {selectedCycle?.multiAgentEnabled && (
                  <span style={{ marginLeft: "auto", fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 100, background: "rgba(168,85,247,0.1)", color: "#a855f7", border: "1px solid rgba(168,85,247,0.2)" }}>MULTI-AGENT</span>
                )}
              </div>

              {allSteps.length === 0 ? (
                <div style={{ color: "#475569", fontSize: 12, textAlign: "center", padding: "40px 0" }}>Select a cycle to view its execution trace</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 520, overflowY: "auto" }}>
                  {allSteps.map((step, i) => {
                    const color = stepColor(step.step);
                    const Icon = stepIcon(step.step);
                    return (
                      <div key={i} style={{
                        padding: "12px 14px", borderRadius: 12,
                        background: `${color}06`,
                        border: `1px solid ${color}25`,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: step.debugOutput ? 6 : 0 }}>
                          <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: `${color}15`, border: `1px solid ${color}30`, flexShrink: 0 }}>
                            <Icon style={{ width: 13, height: 13, color }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ color, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, fontFamily: "monospace" }}>{step.label}</span>
                              {step.durationMs && <span style={{ color: "#334155", fontSize: 9, fontFamily: "monospace" }}>{step.durationMs}ms</span>}
                            </div>
                            <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 2 }}>{step.summary}</div>
                          </div>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: step.status === "complete" ? "#22c55e" : step.status === "running" ? "#00d4f5" : "#334155", flexShrink: 0 }} />
                        </div>
                        {step.debugOutput && (
                          <div style={{ marginTop: 6, padding: "6px 10px", background: "rgba(0,0,0,0.3)", borderRadius: 8, fontFamily: "monospace", fontSize: 10, color: "#64748b", lineHeight: 1.6 }}>
                            {step.debugOutput}
                          </div>
                        )}
                        {Object.keys(step.details).length > 0 && (
                          <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {Object.entries(step.details).slice(0, 5).map(([k, v]) => (
                              <span key={k} style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: "rgba(255,255,255,0.04)", color: "#64748b", fontFamily: "monospace" }}>
                                {k}: <span style={{ color: "#94a3b8" }}>{String(v)}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Health Dashboard ── */}
        {health && (
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 20, marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <Server style={{ width: 15, height: 15, color: "#00d4f5" }} />
              <span style={{ color: "white", fontSize: 13, fontWeight: 700 }}>Live Infrastructure Health</span>
              <span style={{ marginLeft: "auto", padding: "3px 10px", borderRadius: 100, fontSize: 10, fontWeight: 700,
                background: health.status === "healthy" ? "rgba(34,197,94,0.1)" : "rgba(245,158,11,0.1)",
                color: health.status === "healthy" ? "#22c55e" : "#f59e0b",
                border: `1px solid ${health.status === "healthy" ? "rgba(34,197,94,0.2)" : "rgba(245,158,11,0.2)"}`,
              }}>{health.status.toUpperCase()}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
              {health.checks.map((c) => (
                <div key={c.name} style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(255,255,255,0.02)", border: `1px solid ${c.status === "ok" ? "rgba(34,197,94,0.15)" : c.status === "error" ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.05)"}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: c.status === "ok" ? "#22c55e" : c.status === "error" ? "#ef4444" : "#64748b" }} />
                    <span style={{ color: "white", fontSize: 11, fontWeight: 600 }}>{c.name}</span>
                  </div>
                  <div style={{ color: "#475569", fontSize: 10, fontFamily: "monospace" }}>
                    {c.latencyMs ? `${c.latencyMs}ms` : c.status}
                    {c.error && <span style={{ color: "#ef4444" }}> · {c.error.slice(0, 40)}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Tech Stack ── */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
          {["Groq LLaMA-3", "CoinMarketCap AI Hub", "Trust Wallet Agent Kit", "BNB Smart Chain", "PancakeSwap V3", "Venus Protocol", "Upstash Redis", "Render (Backend)", "Vercel (Frontend)"].map(t => (
            <span key={t} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "#64748b", fontSize: 10, padding: "4px 10px", borderRadius: 100 }}>{t}</span>
          ))}
        </div>
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>
    </div>
  );
}

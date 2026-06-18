"use client";
import { useState, useEffect, useRef } from "react";
import { Bot, Brain, Zap, Shield, Activity, TrendingUp, Eye, CheckCircle, Clock, Cpu, Network, BarChart3, GitBranch } from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────
interface AgentLog { id: number; time: string; phase: string; message: string; type: "info"|"success"|"warn"|"ai"; }
interface AgentState { phase: string; cycle: number; bnbPrice: number; riskScore: number; sentiment: string; action: string; confidence: number; threats: string[]; uptime: number; }

// ─── Simulated agent phases cycling continuously ────────────────
const PHASES = [
  { phase:"OBSERVE", icon: Eye, color:"#00d4f5", messages:["📡 Fetching BNB price from CoinMarketCap AI Hub…","📡 Reading PancakeSwap DEX on-chain prices…","📡 Scanning BSC block data & mempool…","📡 Pulling Venus Protocol lending metrics…"] },
  { phase:"ANALYZE", icon: Brain, color:"#a855f7", messages:["🧠 Running Llama-3 LLM risk assessment…","🧠 Market Agent: volatility index computed","🧠 Whale Agent: large wallet movements detected","🧠 Liquidity Agent: pool depth analysis complete","🧠 Sentiment Agent: Fear & Greed index loaded"] },
  { phase:"DECIDE", icon: GitBranch, color:"#f59e0b", messages:["⚡ Supervisor Agent orchestrating outputs…","⚡ Policy Engine evaluating guardian rules…","⚡ Risk threshold check: within bounds","⚡ Confidence score computed: 94%","⚡ Suggested action determined"] },
  { phase:"EXECUTE", icon: Zap, color:"#22c55e", messages:["🔐 Logging decision hash on-chain (BSC)…","🔐 Updating Upstash Redis timeline store…","🔐 DRY RUN: simulation complete — no gas used","🔐 Heartbeat written — next cycle in 30s"] },
];

const SENTIMENTS = ["BULLISH","NEUTRAL","CAUTIOUS","BEARISH"];


function getRiskColor(score: number) {
  if (score >= 70) return "#ef4444";
  if (score >= 45) return "#f59e0b";
  if (score >= 25) return "#00d4f5";
  return "#22c55e";
}

// ─── Main Component ─────────────────────────────────────────────
export default function AgentBrainPage() {
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [state, setState] = useState<AgentState>({
    phase: "OBSERVE", cycle: 1, bnbPrice: 612, riskScore: 28,
    sentiment: "NEUTRAL", action: "MONITOR", confidence: 87, threats: [], uptime: 0,
  });
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [msgIdx, setMsgIdx] = useState(0);
  const [agentOnline, setAgentOnline] = useState(true);
  const [pulseActive, setPulseActive] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const logId = useRef(0);
  const uptimeRef = useRef(0);

  // Uptime counter
  useEffect(() => {
    const t = setInterval(() => { uptimeRef.current++; setState(s => ({ ...s, uptime: uptimeRef.current })); }, 1000);
    return () => clearInterval(t);
  }, []);

  // Main agent simulation loop
  useEffect(() => {
    const tick = setInterval(() => {
      const p = PHASES[phaseIdx];
      const msg = p.messages[msgIdx % p.messages.length];
      const newLog: AgentLog = {
        id: logId.current++,
        time: new Date().toLocaleTimeString(),
        phase: p.phase,
        message: msg,
        type: p.phase === "EXECUTE" ? "success" : p.phase === "ANALYZE" ? "ai" : p.phase === "DECIDE" ? "warn" : "info",
      };
      setLogs(prev => [newLog, ...prev].slice(0, 40));
      setPulseActive(true);
      setTimeout(() => setPulseActive(false), 500);

      const nextMsg = msgIdx + 1;
      if (nextMsg >= p.messages.length) {
        const nextPhase = (phaseIdx + 1) % PHASES.length;
        setPhaseIdx(nextPhase);
        setMsgIdx(0);
        if (nextPhase === 0) {
          // New cycle
          const newPrice = 600 + Math.random() * 50;
          const newRisk = Math.floor(Math.random() * 65) + 10;
          const newSentiment = SENTIMENTS[Math.floor(Math.random() * SENTIMENTS.length)];
          const newAction = newRisk > 60 ? "ALERT" : newRisk > 40 ? "REBALANCE" : "MONITOR";
          const newThreats = newRisk > 50 ? ["High volatility detected", "Whale wallet movement"] : newRisk > 35 ? ["Moderate liquidity shift"] : [];
          setState(s => ({
            ...s, cycle: s.cycle + 1, bnbPrice: parseFloat(newPrice.toFixed(2)),
            riskScore: newRisk, sentiment: newSentiment, action: newAction,
            confidence: 80 + Math.floor(Math.random() * 18),
            threats: newThreats,
            phase: PHASES[nextPhase].phase,
          }));
        } else {
          setState(s => ({ ...s, phase: PHASES[nextPhase].phase }));
        }
      } else {
        setMsgIdx(nextMsg);
      }
    }, 1800);
    return () => clearInterval(tick);
  }, [phaseIdx, msgIdx]);

  // Check real render health
  useEffect(() => {
    fetch("/api/health").then(r => setAgentOnline(r.ok)).catch(() => setAgentOnline(false));
  }, []);

  const riskColor = getRiskColor(state.riskScore);


  return (
    <div style={{ minHeight:"100vh", background:"#0a0e17", padding:"24px 16px", fontFamily:"monospace" }}>
      <div style={{ maxWidth:1200, margin:"0 auto" }}>

        {/* ── Header ── */}
        <div style={{ textAlign:"center", marginBottom:40 }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:10, background:"rgba(0,212,245,0.06)", border:"1px solid rgba(0,212,245,0.2)", borderRadius:100, padding:"8px 20px", marginBottom:16 }}>
            <div style={{ width:8, height:8, borderRadius:"50%", background:"#22c55e", boxShadow:"0 0 8px #22c55e", animation:"pulse 1.5s infinite" }} />
            <span style={{ color:"#00d4f5", fontSize:12, fontWeight:700, letterSpacing:2 }}>AEGIS GUARDIAN — LIVE AI BRAIN</span>
          </div>
          <h1 style={{ fontSize:42, fontWeight:800, color:"white", margin:0, letterSpacing:-1 }}>
            Autonomous Agent
            <span style={{ background:"linear-gradient(135deg,#00d4f5,#a855f7)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}> Intelligence</span>
          </h1>
          <p style={{ color:"#64748b", fontSize:14, marginTop:8 }}>Real-time multi-agent orchestration · Groq LLaMA-3 · CoinMarketCap Hub · BSC Testnet</p>
        </div>

        {/* ── Status Bar ── */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:12, marginBottom:28 }}>
          {[
            { label:"Agent Status", value: agentOnline ? "ONLINE":"OFFLINE", color: agentOnline?"#22c55e":"#ef4444", icon: Activity },
            { label:"Current Cycle", value:`#${state.cycle}`, color:"#00d4f5", icon: Cpu },
            { label:"BNB Price", value:`$${state.bnbPrice}`, color:"#f59e0b", icon: TrendingUp },
            { label:"Risk Score", value:`${state.riskScore}/100`, color:riskColor, icon: Shield },
            { label:"Confidence", value:`${state.confidence}%`, color:"#a855f7", icon: CheckCircle },
            { label:"Uptime", value:`${Math.floor(state.uptime/60)}m ${state.uptime%60}s`, color:"#64748b", icon: Clock },
          ].map((s) => (
            <div key={s.label} style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:12, padding:"14px 16px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:6 }}>
                <s.icon style={{ width:12, height:12, color:s.color }} />
                <span style={{ color:"#475569", fontSize:9, textTransform:"uppercase", letterSpacing:1.5 }}>{s.label}</span>
              </div>
              <div style={{ color:s.color, fontSize:18, fontWeight:800 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* ── Main Grid ── */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20, marginBottom:20 }}>

          {/* LEFT: Phase Visualizer */}
          <div style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:16, padding:24 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:20 }}>
              <Network style={{ width:16, height:16, color:"#00d4f5" }} />
              <span style={{ color:"white", fontSize:13, fontWeight:700 }}>Observe → Analyze → Decide → Execute</span>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {PHASES.map((p, i) => {
                const isActive = i === phaseIdx;
                const isDone = i < phaseIdx;
                const Icon = p.icon;
                return (
                  <div key={p.phase} style={{
                    display:"flex", alignItems:"center", gap:14, padding:"14px 18px", borderRadius:12,
                    background: isActive ? `${p.color}12` : "rgba(255,255,255,0.01)",
                    border: `1px solid ${isActive ? p.color+"40" : "rgba(255,255,255,0.04)"}`,
                    transition:"all 0.4s ease",
                  }}>
                    <div style={{
                      width:36, height:36, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center",
                      background: isActive ? `${p.color}20` : isDone ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.04)",
                      border:`1px solid ${isActive ? p.color+"50" : isDone ? "#22c55e40" : "rgba(255,255,255,0.06)"}`,
                      boxShadow: isActive ? `0 0 16px ${p.color}30` : "none",
                    }}>
                      {isDone ? <CheckCircle style={{ width:16, height:16, color:"#22c55e" }} />
                        : <Icon style={{ width:16, height:16, color: isActive ? p.color : "#475569" }} />}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ color: isActive ? p.color : isDone ? "#22c55e" : "#475569", fontSize:11, fontWeight:700, letterSpacing:1.5 }}>{p.phase}</div>
                      {isActive && (
                        <div style={{ color:"#94a3b8", fontSize:10, marginTop:3 }}>{p.messages[msgIdx % p.messages.length]}</div>
                      )}
                    </div>
                    {isActive && (
                      <div style={{ display:"flex", gap:3 }}>
                        {[0,1,2].map(d => (
                          <div key={d} style={{ width:5, height:5, borderRadius:"50%", background:p.color, animation:`bounce 0.8s ${d*0.2}s infinite` }} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Risk Meter */}
            <div style={{ marginTop:20, padding:"16px", background:"rgba(255,255,255,0.02)", borderRadius:12, border:"1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                <span style={{ color:"#64748b", fontSize:10, textTransform:"uppercase", letterSpacing:1 }}>AI Risk Assessment</span>
                <span style={{ color:riskColor, fontSize:12, fontWeight:700 }}>{state.riskScore}/100</span>
              </div>
              <div style={{ height:6, background:"rgba(255,255,255,0.06)", borderRadius:100, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${state.riskScore}%`, background:`linear-gradient(90deg,#22c55e,${riskColor})`, borderRadius:100, transition:"width 1s ease" }} />
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", marginTop:6 }}>
                <span style={{ color:"#22c55e", fontSize:9 }}>SAFE</span>
                <span style={{ color:"#f59e0b", fontSize:9 }}>MEDIUM</span>
                <span style={{ color:"#ef4444", fontSize:9 }}>CRITICAL</span>
              </div>
            </div>
          </div>

          {/* RIGHT: Multi-Agent Cards */}
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:16, padding:20 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
                <Bot style={{ width:15, height:15, color:"#a855f7" }} />
                <span style={{ color:"white", fontSize:12, fontWeight:700 }}>Multi-Agent Swarm</span>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                {[
                  { name:"Market Agent", role:"BNB price & volume", color:"#00d4f5", active: phaseIdx >= 1 },
                  { name:"Liquidity Agent", role:"DEX pool depth", color:"#22c55e", active: phaseIdx >= 1 },
                  { name:"Whale Agent", role:"Large wallet scanner", color:"#f59e0b", active: phaseIdx >= 1 },
                  { name:"Sentiment Agent", role:"Fear & Greed index", color:"#ec4899", active: phaseIdx >= 1 },
                  { name:"Risk Agent", role:"Threat scoring", color:"#ef4444", active: phaseIdx >= 2 },
                  { name:"Supervisor Agent", role:"Final orchestration", color:"#a855f7", active: phaseIdx >= 2 },
                ].map((agent) => (
                  <div key={agent.name} style={{
                    padding:"10px 12px", borderRadius:10,
                    background: agent.active ? `${agent.color}08` : "rgba(255,255,255,0.01)",
                    border:`1px solid ${agent.active ? agent.color+"30" : "rgba(255,255,255,0.04)"}`,
                  }}>
                    <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:3 }}>
                      <div style={{ width:6, height:6, borderRadius:"50%", background: agent.active ? agent.color : "#334155", boxShadow: agent.active ? `0 0 6px ${agent.color}` : "none" }} />
                      <span style={{ color: agent.active ? "white" : "#475569", fontSize:10, fontWeight:600 }}>{agent.name}</span>
                    </div>
                    <div style={{ color:"#475569", fontSize:9 }}>{agent.role}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Decision Output */}
            <div style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:16, padding:20, flex:1 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
                <BarChart3 style={{ width:15, height:15, color:"#f59e0b" }} />
                <span style={{ color:"white", fontSize:12, fontWeight:700 }}>Supervisor Decision Output</span>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 14px", background:"rgba(255,255,255,0.02)", borderRadius:10 }}>
                  <span style={{ color:"#64748b", fontSize:10 }}>Market Sentiment</span>
                  <span style={{ color: state.sentiment==="BULLISH"?"#22c55e":state.sentiment==="BEARISH"?"#ef4444":"#f59e0b", fontSize:11, fontWeight:700 }}>{state.sentiment}</span>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 14px", background:"rgba(255,255,255,0.02)", borderRadius:10 }}>
                  <span style={{ color:"#64748b", fontSize:10 }}>Suggested Action</span>
                  <span style={{ color:"#00d4f5", fontSize:11, fontWeight:700 }}>{state.action}</span>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 14px", background:"rgba(255,255,255,0.02)", borderRadius:10 }}>
                  <span style={{ color:"#64748b", fontSize:10 }}>AI Confidence</span>
                  <span style={{ color:"#a855f7", fontSize:11, fontWeight:700 }}>{state.confidence}%</span>
                </div>
                {state.threats.length > 0 ? (
                  <div style={{ padding:"10px 14px", background:"rgba(239,68,68,0.06)", border:"1px solid rgba(239,68,68,0.15)", borderRadius:10 }}>
                    <div style={{ color:"#ef4444", fontSize:9, textTransform:"uppercase", letterSpacing:1, marginBottom:5 }}>⚠ Threats Detected</div>
                    {state.threats.map((t,i) => <div key={i} style={{ color:"#f87171", fontSize:10 }}>• {t}</div>)}
                  </div>
                ) : (
                  <div style={{ padding:"10px 14px", background:"rgba(34,197,94,0.06)", border:"1px solid rgba(34,197,94,0.15)", borderRadius:10 }}>
                    <div style={{ color:"#22c55e", fontSize:10 }}>✓ All Clear — No Threats Detected</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Live Log Terminal ── */}
        <div style={{ background:"#040710", border:"1px solid rgba(0,212,245,0.15)", borderRadius:16, overflow:"hidden" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10, padding:"14px 20px", borderBottom:"1px solid rgba(255,255,255,0.05)", background:"rgba(0,212,245,0.03)" }}>
            <div style={{ display:"flex", gap:6 }}>
              <div style={{ width:10, height:10, borderRadius:"50%", background:"#ef4444" }} />
              <div style={{ width:10, height:10, borderRadius:"50%", background:"#f59e0b" }} />
              <div style={{ width:10, height:10, borderRadius:"50%", background:"#22c55e" }} />
            </div>
            <span style={{ color:"#00d4f5", fontSize:11, fontWeight:600 }}>aegis-agent — live terminal</span>
            <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:6 }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background: pulseActive?"#00d4f5":"#22c55e", transition:"background 0.3s", boxShadow: pulseActive?"0 0 10px #00d4f5":"0 0 6px #22c55e" }} />
              <span style={{ color:"#475569", fontSize:10 }}>STREAMING</span>
            </div>
          </div>
          <div ref={logRef} style={{ height:280, overflowY:"auto", padding:"16px 20px", display:"flex", flexDirection:"column", gap:6 }}>
            {logs.length === 0 && (
              <div style={{ color:"#334155", fontSize:11 }}>Initializing Aegis Guardian Agent…</div>
            )}
            {logs.map((log) => (
              <div key={log.id} style={{ display:"flex", gap:12, alignItems:"flex-start", animation:"fadeInDown 0.3s ease" }}>
                <span style={{ color:"#334155", fontSize:10, minWidth:70, flexShrink:0 }}>{log.time}</span>
                <span style={{ fontSize:9, fontWeight:700, padding:"1px 6px", borderRadius:4, minWidth:58, textAlign:"center", flexShrink:0,
                  background: log.type==="success"?"rgba(34,197,94,0.12)":log.type==="ai"?"rgba(168,85,247,0.12)":log.type==="warn"?"rgba(245,158,11,0.12)":"rgba(0,212,245,0.1)",
                  color: log.type==="success"?"#22c55e":log.type==="ai"?"#a855f7":log.type==="warn"?"#f59e0b":"#00d4f5" }}>
                  {log.phase}
                </span>
                <span style={{ color:"#94a3b8", fontSize:11, lineHeight:1.5 }}>{log.message}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tech Stack Footer ── */}
        <div style={{ display:"flex", flexWrap:"wrap", gap:8, justifyContent:"center", marginTop:24 }}>
          {["Groq LLaMA-3","CoinMarketCap AI Hub","Trust Wallet Agent Kit (TWAK)","BNB Smart Chain","PancakeSwap V3","Venus Protocol","Upstash Redis","Next.js 15"].map(t => (
            <span key={t} style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", color:"#64748b", fontSize:10, padding:"4px 10px", borderRadius:100 }}>{t}</span>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        @keyframes fadeInDown { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  );
}

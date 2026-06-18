"use client";

import Link from "next/link";
import { useLiveMarketData } from "../lib/useLiveMarket";
import { CONTRACTS } from "../lib/constants";
import { useScrollReveal, useStaggerReveal } from "../lib/useScrollReveal";
import {
  Shield,
  Zap, ArrowRight, ExternalLink,
  Lock, Search, Skull, Droplets,
  Eye, ChevronRight, Share2,
  TrendingUp, Code2, CheckCircle,
  Sparkles, Globe, Layers, Activity,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════
   Scroll Section Wrapper
   ═══════════════════════════════════════════════════════════════ */

function RevealSection({
  children,
  className = "",
  variant = "reveal",
}: {
  children: React.ReactNode;
  className?: string;
  variant?: "reveal" | "reveal-left" | "reveal-right" | "reveal-scale";
}) {
  const { ref, isVisible } = useScrollReveal();
  return (
    <div ref={ref} className={`${variant} ${isVisible ? "visible" : ""} ${className}`}>
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Landing Page
   ═══════════════════════════════════════════════════════════════ */

export default function Home() {
  const liveMarket = useLiveMarketData(30000);

  const stepsStagger = useStaggerReveal(3, 120);
  const featuresStagger = useStaggerReveal(6, 100);
  const contractsStagger = useStaggerReveal(5, 100);
  const techStagger = useStaggerReveal(5, 80);

  return (
    <div className="min-h-screen relative z-10 flex flex-col overflow-hidden">
      {/* ──────────────────────────────────────────────
          HERO SECTION
          ────────────────────────────────────────────── */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-20 sm:pt-28 pb-20 w-full">
        <div className="hero-glow" />

        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-8 backdrop-blur-sm animate-fade-in"
          style={{ background: "rgba(0, 212, 245, 0.06)", border: "1px solid rgba(0, 212, 245, 0.15)", color: "var(--accent)" }}>
          <Zap className="w-3.5 h-3.5" />
          #6 of Top 10 — BNB Chain Hackathon · 200 Projects
        </div>

        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] mb-6 animate-fade-in">
          <span className="text-white">Your DeFi</span>
          <br />
          <span className="text-shimmer">Guardian.</span>
        </h1>

        <p className="text-lg sm:text-xl leading-relaxed mb-10 max-w-2xl animate-fade-in" style={{ color: "var(--text-secondary)" }}>
          Scan any token or your entire wallet for honeypots, rug pulls, and hidden taxes.
          Activate Guardian Shield for AI-powered wallet monitoring with Telegram alerts. Deposit into the Protected Vault
          to earn Venus Protocol yield with autonomous stop-loss protection.
        </p>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-16 animate-fade-in">
          <Link href="/scanner" className="btn-primary flex items-center gap-2 text-base px-7 py-3">
            <Search className="w-4 h-4" />
            Scan a Token
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/guardian" className="btn-secondary flex items-center gap-2 text-base px-7 py-3">
            <Shield className="w-4 h-4" />
            Guardian Shield
          </Link>
          <Link href="/vault" className="btn-secondary flex items-center gap-2 text-base px-7 py-3">
            <Lock className="w-4 h-4" />
            Protected Vault
          </Link>
        </div>

        {/* Live Market Ticker */}
        {!liveMarket.isLoading && liveMarket.bnbPriceCoinGecko > 0 && (
          <RevealSection>
            <div className="flex items-center gap-3 flex-wrap">
              {[
                { label: "BNB/USD", value: `$${liveMarket.bnbPriceCoinGecko.toFixed(2)}`, extra: `${liveMarket.priceChange24h >= 0 ? "+" : ""}${liveMarket.priceChange24h.toFixed(2)}%`, extraColor: liveMarket.priceChange24h >= 0 ? "var(--green)" : "var(--red)", live: true },
                { label: "Volume 24h", value: `$${(liveMarket.volume24h / 1e9).toFixed(2)}B` },
                { label: "BSC TVL", value: `$${(liveMarket.bscTvl / 1e9).toFixed(2)}B` },
                { label: "Oracle", value: liveMarket.oracleStatus === "consistent" ? "Consistent" : liveMarket.oracleStatus === "warning" ? "Divergence" : "Critical", valueColor: liveMarket.oracleStatus === "consistent" ? "var(--green)" : liveMarket.oracleStatus === "warning" ? "var(--yellow)" : "var(--red)" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 px-3.5 py-2 rounded-lg" style={{ background: "var(--bg-raised)", border: "1px solid var(--border-subtle)" }}>
                  {item.live && <span className="w-1.5 h-1.5 rounded-full pulse-live" style={{ background: "var(--green)" }} />}
                  <span className="text-[11px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{item.label}</span>
                  <span className="text-xs font-mono font-semibold" style={{ color: item.valueColor || "var(--text-primary)" }}>{item.value}</span>
                  {item.extra && <span className="text-[11px] font-mono" style={{ color: item.extraColor }}>{item.extra}</span>}
                </div>
              ))}
            </div>
          </RevealSection>
        )}
      </section>

      <div className="section-divider" />

      {/* ──────────────────────────────────────────────
          HOW IT WORKS
          ────────────────────────────────────────────── */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 py-24 w-full">
        <RevealSection>
          <div className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: "var(--accent)" }}>How It Works</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
              Protect Yourself in <span className="text-gradient">Three Steps</span>
            </h2>
          </div>
        </RevealSection>

        <div ref={stepsStagger.ref} className={`stagger-parent ${stepsStagger.isVisible ? "visible" : ""} grid md:grid-cols-3 gap-6`}>
          {[
            { num: "01", icon: Search, title: "Token Scanner", desc: "Paste any BSC token address for a full risk report — or connect your wallet to scan ALL your holdings at once. Honeypot detection, tax analysis, liquidity checks, and contract security.", href: "/scanner", color: "var(--accent)" },
            { num: "02", icon: Shield, title: "Guardian Shield", desc: "Activate always-on monitoring. Guardian Shield auto-refreshes every 60 seconds, watching for rug pull signals, whale dumps, liquidity pulls, and dev wallet movements.", href: "/guardian", color: "var(--purple)" },
            { num: "03", icon: Lock, title: "Protected Vault", desc: "Deposit BNB into the Aegis Vault. Earn yield from Venus Protocol lending with AI-powered stop-loss protection. Every decision logged on-chain for full transparency.", href: "/vault", color: "var(--green)" },
          ].map((step, i) => (
            <Link key={i} href={step.href}
              className="stagger-child group relative card p-8 hover:border-[var(--border-hover)] transition-all duration-300"
              style={stepsStagger.getDelay(i)}>
              <span className="text-[80px] font-bold leading-none absolute top-4 right-6 select-none"
                style={{ color: "rgba(255,255,255,0.02)" }}>{step.num}</span>

              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110"
                style={{ background: `color-mix(in srgb, ${step.color} 8%, transparent)`, border: `1px solid color-mix(in srgb, ${step.color} 15%, transparent)` }}>
                <step.icon className="w-5 h-5" style={{ color: step.color }} />
              </div>

              <h3 className="text-xl font-semibold text-white mb-3 flex items-center gap-2">
                {step.title}
                <ChevronRight className="w-4 h-4 opacity-0 -translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0" style={{ color: step.color }} />
              </h3>

              <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{step.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      <div className="section-divider" />

      {/* ──────────────────────────────────────────────
          TOKEN SCANNER SHOWCASE
          ────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-24 w-full">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <RevealSection variant="reveal-left">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: "var(--accent)" }}>Token Scanner</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-5">
              Scan Before <span className="text-gradient">You Buy</span>
            </h2>
            <p className="text-base leading-relaxed mb-8" style={{ color: "var(--text-secondary)" }}>
              Paste a single token address for a detailed risk report — or connect
              your wallet to scan every token you hold at once. We check honeypot traps,
              buy/sell taxes, liquidity depth, LP lock status, whale concentration, and
              contract security from on-chain data.
            </p>

            <div className="space-y-4 mb-8">
              {[
                { label: "Honeypot Detection", desc: "Simulates sell transactions to find traps" },
                { label: "Tax Analysis", desc: "Reads actual buy/sell taxes from bytecode" },
                { label: "Liquidity Check", desc: "PancakeSwap LP depth & burn status" },
                { label: "Contract Audit", desc: "Mint, pause, blacklist function detection" },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--green)" }} />
                  <div>
                    <p className="text-sm font-medium text-white">{item.label}</p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <Link href="/scanner" className="btn-primary inline-flex items-center gap-2">
              <Search className="w-4 h-4" />
              Try Token Scanner
              <ArrowRight className="w-4 h-4" />
            </Link>
          </RevealSection>

          {/* Risk Score Demo */}
          <RevealSection variant="reveal-right">
            <div className="card p-8 relative overflow-hidden">
              <div className="absolute inset-0 opacity-30"
                style={{ background: "radial-gradient(ellipse at top right, rgba(0, 212, 245, 0.06) 0%, transparent 60%)" }} />

              <div className="relative">
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-xs font-mono px-2 py-1 rounded" style={{ background: "var(--bg-elevated)", color: "var(--text-muted)" }}>
                    Example Scan
                  </span>
                </div>

                <div className="flex items-center gap-8 mb-8">
                  <div className="w-28 h-28 rounded-2xl flex flex-col items-center justify-center"
                    style={{ background: "rgba(239, 68, 68, 0.08)", border: "2px solid rgba(239, 68, 68, 0.2)" }}>
                    <span className="text-4xl font-bold" style={{ color: "#ef4444" }}>87</span>
                    <span className="text-xs font-semibold" style={{ color: "#ef4444" }}>CRITICAL</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white mb-1">SUS_TOKEN</p>
                    <p className="text-xs font-mono mb-3" style={{ color: "var(--text-muted)" }}>0x1234...abcd</p>
                    <div className="flex flex-wrap gap-1.5">
                      {["HONEYPOT", "HIGH_TAX", "LOW_LIQ"].map((flag) => (
                        <span key={flag} className="text-[10px] font-semibold px-2 py-0.5 rounded"
                          style={{ background: "rgba(239, 68, 68, 0.1)", color: "#f87171" }}>{flag}</span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {[
                    { label: "SAFE", range: "0-19", color: "#10b981", width: "20%" },
                    { label: "LOW", range: "20-39", color: "#22c55e", width: "20%" },
                    { label: "MEDIUM", range: "40-59", color: "#eab308", width: "20%" },
                    { label: "HIGH", range: "60-79", color: "#f97316", width: "20%" },
                    { label: "CRITICAL", range: "80-100", color: "#ef4444", width: "20%", active: true },
                  ].map((level) => (
                    <div key={level.label} className="flex items-center gap-3">
                      <span className="text-[10px] font-semibold w-16 text-right" style={{ color: level.active ? level.color : "var(--text-muted)" }}>{level.label}</span>
                      <div className="flex-1 h-1.5 rounded-full" style={{ background: "var(--bg-elevated)" }}>
                        <div className="h-full rounded-full transition-all duration-1000"
                          style={{ width: level.active ? "87%" : level.width, background: level.color, opacity: level.active ? 1 : 0.3 }} />
                      </div>
                      <span className="text-[10px] font-mono w-10" style={{ color: "var(--text-muted)" }}>{level.range}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </RevealSection>
        </div>
      </section>

      <div className="section-divider" />

      {/* ──────────────────────────────────────────────
          PROTECTED VAULT SHOWCASE
          ────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-24 w-full">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Vault Demo Card */}
          <RevealSection variant="reveal-left">
            <div className="card p-8 relative overflow-hidden">
              <div className="absolute inset-0 opacity-30"
                style={{ background: "radial-gradient(ellipse at bottom right, rgba(52, 211, 153, 0.06) 0%, transparent 60%)" }} />

              <div className="relative">
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-xs font-mono px-2 py-1 rounded" style={{ background: "var(--bg-elevated)", color: "var(--text-muted)" }}>
                    Vault Dashboard Preview
                  </span>
                </div>

                <div className="flex items-center gap-6 mb-6">
                  <div className="w-20 h-20 rounded-2xl flex flex-col items-center justify-center"
                    style={{ background: "rgba(52, 211, 153, 0.08)", border: "2px solid rgba(52, 211, 153, 0.2)" }}>
                    <Lock className="w-6 h-6 mb-1" style={{ color: "var(--green)" }} />
                    <span className="text-[10px] font-semibold" style={{ color: "var(--green)" }}>ACTIVE</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white mb-1">Your Position</p>
                    <p className="text-2xl font-bold text-white">1.25 BNB</p>
                    <p className="text-xs" style={{ color: "var(--green)" }}>+4.2% APY (net)</p>
                  </div>
                </div>

                <div className="space-y-2 mb-6">
                  {[
                    { label: "Yield Earned", value: "0.0052 BNB", color: "var(--green)" },
                    { label: "AI Protection", value: "Active · Telegram Alerts", color: "var(--green)" },
                    { label: "$UNIQ Tier", value: "Gold · 40% fee discount", color: "#ffd700" },
                    { label: "On-Chain Logs", value: "12 decisions recorded", color: "var(--purple)" },
                  ].map((row, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2.5 rounded-lg" style={{ background: "var(--bg-elevated)" }}>
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>{row.label}</span>
                      <span className="text-xs font-semibold" style={{ color: row.color }}>{row.value}</span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  {["Liquidation Guard", "Exploit Shield", "Stop-Loss", "Whale Alert"].map((feature) => (
                    <span key={feature} className="text-[10px] font-semibold px-2 py-0.5 rounded"
                      style={{ background: "rgba(52, 211, 153, 0.08)", color: "var(--green)" }}>{feature}</span>
                  ))}
                </div>
              </div>
            </div>
          </RevealSection>

          <RevealSection variant="reveal-right">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: "var(--green)" }}>Protected Vault</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-5">
              Earn Yield. <span style={{ color: "var(--green)" }}>Stay Protected.</span>
            </h2>
            <p className="text-base leading-relaxed mb-8" style={{ color: "var(--text-secondary)" }}>
              Deposit BNB into the Aegis Vault. Your funds earn real yield from Venus Protocol lending.
              Smart contracts include stop-loss protection and AI agent authorization.
              Every protection decision is immutably logged on-chain.
            </p>

            <div className="space-y-4 mb-8">
              {[
                { label: "Venus Yield", desc: "Earn yield from Venus Protocol lending on deposited BNB" },
                { label: "Stop-Loss Protection", desc: "BNB → USDT auto-swap via PancakeSwap when price drops (mainnet)" },
                { label: "On-Chain Audit Trail", desc: "Every AI decision immutably logged via DecisionLogger" },
                { label: "$UNIQ Fee Discounts", desc: "Gold holders pay up to 40% less in performance fees" },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--green)" }} />
                  <div>
                    <p className="text-sm font-medium text-white">{item.label}</p>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <Link href="/vault" className="btn-primary inline-flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Open Vault
              <ArrowRight className="w-4 h-4" />
            </Link>
          </RevealSection>
        </div>
      </section>

      <div className="section-divider" />

      {/* ──────────────────────────────────────────────
          FEATURES GRID
          ────────────────────────────────────────────── */}
      <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 py-24 w-full">
        <RevealSection>
          <div className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: "var(--accent)" }}>Features</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
              Built with <span className="text-gradient">On-Chain Data</span>
            </h2>
            <p className="text-base mt-4 max-w-xl mx-auto" style={{ color: "var(--text-secondary)" }}>
              Six layers of analysis working together to give you the full picture before you trade.
            </p>
          </div>
        </RevealSection>

        <div ref={featuresStagger.ref} className={`stagger-parent ${featuresStagger.isVisible ? "visible" : ""} grid sm:grid-cols-2 lg:grid-cols-3 gap-5`}>
          {[
            { icon: Skull, title: "Honeypot Detection", desc: "Simulates sell transactions via honeypot.is to find tokens that trap your funds.", color: "#ef4444", href: "/scanner" },
            { icon: Search, title: "8-Vector Risk Scoring", desc: "Real-time risk scoring: contract security, tax analysis, liquidity, whale concentration, and more.", color: "var(--accent)", href: "/scanner" },
            { icon: Eye, title: "Source Verification", desc: "GoPlusLabs integration checks if contract source code is verified and open-source.", color: "var(--purple)", href: "/scanner" },
            { icon: Droplets, title: "Liquidity Analysis", desc: "PancakeSwap reserve depth, LP burn verification, and liquidity lock status.", color: "var(--bnb)", href: "/scanner" },
            { icon: Lock, title: "Contract Security", desc: "Detects mint, pause, blacklist functions, proxy patterns, and ownership status in bytecode.", color: "var(--green)", href: "/scanner" },
            { icon: Share2, title: "Shareable Reports", desc: "Every scan gets a unique link. Share on Twitter or Telegram to warn your community.", color: "var(--accent)", href: "/scanner" },
          ].map((f, i) => (
            <Link key={i} href={f.href}
              className="stagger-child group card p-6 hover:border-[var(--border-hover)] transition-all duration-300 hover:-translate-y-1"
              style={featuresStagger.getDelay(i)}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110"
                style={{ background: `color-mix(in srgb, ${f.color} 8%, transparent)`, border: `1px solid color-mix(in srgb, ${f.color} 12%, transparent)` }}>
                <f.icon className="w-5 h-5" style={{ color: f.color }} />
              </div>
              <h3 className="text-base font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{f.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      <div className="section-divider" />

      {/* ──────────────────────────────────────────────
          SMART CONTRACTS
          ────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-24 w-full">
        <RevealSection>
          <div className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: "var(--accent)" }}>On-Chain</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
              Verified <span className="text-gradient">Smart Contracts</span>
            </h2>
            <p className="text-base mt-4 max-w-xl mx-auto" style={{ color: "var(--text-secondary)" }}>
              5 contracts deployed on BSC Testnet. Source-verified via Sourcify. Every decision logged on-chain.
            </p>
          </div>
        </RevealSection>

        <div ref={contractsStagger.ref} className={`stagger-parent ${contractsStagger.isVisible ? "visible" : ""} grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8`}>
          {[
            { name: "AegisRegistry", address: CONTRACTS.REGISTRY, desc: "ERC-721 agent identity NFTs with 4-tier reputation", color: "var(--accent)", lines: "557" },
            { name: "AegisVault", address: CONTRACTS.VAULT, desc: "Non-custodial vault with agent authorization + stop-loss", color: "var(--purple)", lines: "677" },
            { name: "DecisionLogger", address: CONTRACTS.DECISION_LOGGER, desc: "Immutable AI decision audit trail on-chain", color: "var(--green)", lines: "337" },
            { name: "AegisScanner", address: CONTRACTS.SCANNER, desc: "On-chain token risk registry for BSC tokens", color: "#f97316", lines: "181" },
            { name: "AegisTokenGate", address: CONTRACTS.TOKEN_GATE, desc: "$UNIQ tier-based access control with fee discounts", color: "#fbbf24", lines: "236" },
          ].map((c, i) => (
            <div key={i} className="stagger-child card p-5 group hover:border-[var(--border-hover)] transition-all duration-300"
              style={contractsStagger.getDelay(i)}>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />
                <span className="font-mono text-xs font-semibold" style={{ color: c.color }}>{c.name}</span>
              </div>
              <p className="text-xs mb-4 leading-relaxed" style={{ color: "var(--text-secondary)" }}>{c.desc}</p>
              <p className="font-mono text-[10px] break-all mb-4 p-2 rounded" style={{ background: "var(--bg-base)", color: "var(--text-muted)" }}>
                {c.address}
              </p>
              <div className="flex items-center gap-2">
                <a href={`https://testnet.bscscan.com/address/${c.address}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[10px] font-medium px-2.5 py-1.5 rounded transition-colors"
                  style={{ color: "var(--accent)", background: "var(--accent-muted)" }}>
                  <ExternalLink className="w-2.5 h-2.5" /> BSCScan
                </a>
                <span className="text-[10px] font-mono ml-auto" style={{ color: "var(--text-muted)" }}>{c.lines} LOC</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="section-divider" />

      {/* ──────────────────────────────────────────────
          KEY METRICS
          ────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-24 w-full">
        <RevealSection variant="reveal-scale">
          <div className="card p-10 sm:p-14 text-center relative overflow-hidden">
            <div className="absolute inset-0"
              style={{ background: "radial-gradient(ellipse at center, rgba(0, 212, 245, 0.03) 0%, transparent 70%)" }} />

            <div className="relative">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] mb-8" style={{ color: "var(--accent)" }}>
                The Numbers
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 sm:gap-12">
                {[
                  { value: "207", label: "Tests Passing", icon: CheckCircle },
                  { value: "7", label: "Smart Contracts", icon: Code2 },
                  { value: "14,245", label: "Lines of Code", icon: Layers },
                  { value: "#6", label: "of 200 Projects", icon: TrendingUp },
                ].map((stat, i) => (
                  <div key={i} className="flex flex-col items-center">
                    <stat.icon className="w-5 h-5 mb-3" style={{ color: "var(--accent)" }} />
                    <span className="text-3xl sm:text-4xl font-bold text-white stat-glow tracking-tight">{stat.value}</span>
                    <span className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>{stat.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </RevealSection>
      </section>

      <div className="section-divider" />

      {/* ──────────────────────────────────────────────
          $UNIQ TOKEN
          ────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-24 w-full">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <RevealSection variant="reveal-right">
            <div className="card p-8 relative overflow-hidden">
              <div className="absolute inset-0 opacity-30"
                style={{ background: "radial-gradient(ellipse at bottom left, rgba(167, 139, 250, 0.06) 0%, transparent 60%)" }} />

              <div className="relative">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: "rgba(167, 139, 250, 0.1)", border: "1px solid rgba(167, 139, 250, 0.2)" }}>
                    <Sparkles className="w-5 h-5" style={{ color: "var(--purple)" }} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">$UNIQ</p>
                    <p className="text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>BNB Smart Chain</p>
                  </div>
                  <div className="ml-auto flex gap-1">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded" style={{ background: "rgba(52, 211, 153, 0.1)", color: "var(--green)" }}>RENOUNCED</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded" style={{ background: "rgba(52, 211, 153, 0.1)", color: "var(--green)" }}>LP LOCKED</span>
                  </div>
                </div>

                <div className="space-y-3">
                  {[
                    { tier: "Bronze", req: "10K", discount: "10%", fee: "Wallet monitoring + personal alerts", color: "#cd7f32" },
                    { tier: "Silver", req: "100K", discount: "25%", fee: "Priority alerts + Telegram", color: "#c0c0c0" },
                    { tier: "Gold", req: "1M", discount: "40%", fee: "AI analysis + all alerts", color: "#ffd700" },
                  ].map((t) => (
                    <div key={t.tier} className="flex items-center gap-4 p-3 rounded-lg" style={{ background: "var(--bg-elevated)" }}>
                      <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${t.color}15`, border: `1px solid ${t.color}30` }}>
                        <Shield className="w-4 h-4" style={{ color: t.color }} />
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-semibold" style={{ color: t.color }}>{t.tier}</p>
                        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>Hold {t.req} $UNIQ</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-white">{t.discount} off fees</p>
                        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{t.fee}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </RevealSection>

          <RevealSection variant="reveal-left">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: "var(--purple)" }}>Utility Token</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-5">
              Real Utility. <span style={{ color: "var(--purple)" }}>Not Hype.</span>
            </h2>
            <p className="text-base leading-relaxed mb-8" style={{ color: "var(--text-secondary)" }}>
              $UNIQ isn&apos;t a memecoin — it&apos;s a protocol access key. Hold it, pay less.
              Fee discounts are hardcoded in the smart contracts. Ownership renounced, LP locked.
            </p>

            <div className="grid grid-cols-2 gap-4 mb-8">
              {[
                { label: "Supply", value: "1B" },
                { label: "Tax", value: "3%" },
                { label: "Max Discount", value: "40%" },
                { label: "Holders", value: "185+" },
              ].map((s, i) => (
                <div key={i} className="p-3 rounded-lg" style={{ background: "var(--bg-raised)", borderLeft: "2px solid var(--purple)" }}>
                  <p className="text-lg font-bold text-white">{s.value}</p>
                  <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{s.label}</p>
                </div>
              ))}
            </div>

            <a href={`https://flap.sh/bnb/${CONTRACTS.UNIQ_TOKEN}`} target="_blank" rel="noopener noreferrer"
              className="btn-secondary inline-flex items-center gap-2">
              Buy $UNIQ on flap.sh
              <ExternalLink className="w-4 h-4" />
            </a>
          </RevealSection>
        </div>
      </section>

      <div className="section-divider" />

      {/* ──────────────────────────────────────────────
          POWERED BY
          ────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-24 w-full">
        <RevealSection>
          <div className="text-center mb-12">
            <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>Powered By</p>
          </div>
        </RevealSection>

        <div ref={techStagger.ref} className={`stagger-parent ${techStagger.isVisible ? "visible" : ""} flex flex-wrap justify-center gap-4`}>
          {[
            { name: "BNB Chain", icon: Globe, color: "var(--bnb)" },
            { name: "Venus Protocol", icon: TrendingUp, color: "var(--green)" },
            { name: "PancakeSwap", icon: Activity, color: "var(--accent)" },
            { name: "GoPlusLabs", icon: Shield, color: "var(--purple)" },
            { name: "Honeypot.is", icon: Skull, color: "#ef4444" },
            { name: "OpenZeppelin", icon: Lock, color: "var(--text-primary)" },
          ].map((tech, i) => (
            <div key={i} className="stagger-child flex items-center gap-2.5 px-5 py-3 rounded-lg transition-colors duration-200 hover:border-[var(--border-hover)]"
              style={{ background: "var(--bg-raised)", border: "1px solid var(--border-subtle)", ...techStagger.getDelay(i) }}>
              <tech.icon className="w-4 h-4" style={{ color: tech.color }} />
              <span className="text-sm font-medium text-white">{tech.name}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="section-divider" />

      {/* ──────────────────────────────────────────────
          FINAL CTA
          ────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-24 w-full">
        <RevealSection variant="reveal-scale">
          <div className="text-center relative">
            <div className="absolute inset-0 -z-10"
              style={{ background: "radial-gradient(ellipse at center, rgba(0, 212, 245, 0.04) 0%, transparent 60%)" }} />

            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-5">
              Scan. Shield. <span className="text-gradient">Vault.</span>
            </h2>
            <p className="text-base max-w-lg mx-auto mb-10" style={{ color: "var(--text-secondary)" }}>
              Scan tokens and wallets for free. Activate Guardian Shield for AI monitoring with Telegram alerts.
              Deposit into the Protected Vault to earn Venus Protocol yield.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/scanner" className="btn-primary flex items-center gap-2 text-base px-8 py-3.5">
                <Search className="w-5 h-5" />
                Launch Scanner
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link href="/vault" className="btn-secondary flex items-center gap-2 text-base px-8 py-3.5">
                <Lock className="w-5 h-5" />
                Protected Vault
              </Link>
            </div>

            <div className="flex items-center justify-center gap-6 mt-10">
              <a href="https://x.com/uniq_minds" target="_blank" rel="noopener noreferrer"
                className="text-sm transition-colors hover:text-white" style={{ color: "var(--text-muted)" }}>Twitter</a>
              <a href="https://github.com/Tonyflam/aegis-protocol" target="_blank" rel="noopener noreferrer"
                className="text-sm transition-colors hover:text-white" style={{ color: "var(--text-muted)" }}>GitHub</a>
              <a href={`https://bscscan.com/token/${CONTRACTS.UNIQ_TOKEN}`} target="_blank" rel="noopener noreferrer"
                className="text-sm transition-colors hover:text-white" style={{ color: "var(--text-muted)" }}>$UNIQ on BSCScan</a>
            </div>
          </div>
        </RevealSection>
      </section>
    </div>
  );
}
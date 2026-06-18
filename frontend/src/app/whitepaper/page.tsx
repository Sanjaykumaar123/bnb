// Aegis Protocol — Whitepaper page (renders /whitepaper)

export const metadata = {
  title: "Aegis Protocol Whitepaper | AI-Native DeFi Security on BNB Chain",
  description:
    "The technical and economic design of Aegis Protocol — Scanner, Guardian, Vault, $UNIQ token, and the autonomous AI agent securing DeFi on BNB Chain.",
  openGraph: {
    title: "Aegis Protocol Whitepaper",
    description: "AI-Native DeFi Security on BNB Chain — full technical paper.",
    url: "https://aegisguardian.xyz/whitepaper",
    siteName: "Aegis Protocol",
    type: "article",
  },
};

const h2 = "text-2xl font-bold text-white mt-12 mb-4 pb-2 border-b border-white/10";
const h3 = "text-lg font-semibold text-white mt-6 mb-3";
const p = "text-sm leading-relaxed mb-4";
const list = "text-sm leading-relaxed mb-4 ml-6 list-disc space-y-1";
const olist = "text-sm leading-relaxed mb-4 ml-6 list-decimal space-y-1";
const codeStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  padding: "1px 6px",
  borderRadius: "4px",
  fontFamily: "monospace",
  fontSize: "0.85em",
};

export default function WhitepaperPage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16" style={{ color: "var(--text-secondary)" }}>
      <header className="mb-12 text-center">
        <div className="text-xs tracking-[0.2em] uppercase mb-3" style={{ color: "var(--text-muted)" }}>
          Whitepaper · v1.0 · April 2026
        </div>
        <h1 className="text-4xl font-bold mb-3 text-white">Aegis Protocol</h1>
        <p className="text-lg" style={{ color: "var(--text-muted)" }}>
          AI-Native DeFi Security Infrastructure on BNB Chain
        </p>
        <div className="text-xs mt-4" style={{ color: "var(--text-muted)" }}>
          UnIQ Minds Labs · aegisguardian.xyz
        </div>
        <div className="mt-6 flex justify-center gap-3 text-xs">
          <a href="/" className="underline" style={{ color: "var(--bnb)" }}>← Back to App</a>
          <span style={{ color: "var(--text-muted)" }}>·</span>
          <a href="https://github.com/Tonyflam/aegis-protocol" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "var(--bnb)" }}>GitHub</a>
        </div>
      </header>

      <section>
        <h2 className={h2}>Abstract</h2>
        <p className={p}>
          Decentralized finance on BNB Chain processes billions in daily volume yet remains hostile to
          non-expert users. Rug pulls, honeypots, malicious contract upgrades, and protocol exploits drained
          an estimated $2B+ across BSC in 2024–2025 alone. Aegis Protocol introduces the first AI-native,
          fully on-chain security layer for BNB Chain DeFi: an autonomous agent that detects threats,
          monitors wallets continuously, and protects user capital — with all decisions cryptographically
          anchored on-chain.
        </p>
        <p className={p}>
          Aegis is composed of three integrated products (<strong className="text-white">Scanner</strong>,{" "}
          <strong className="text-white">Guardian</strong>, <strong className="text-white">Vault</strong>),
          powered by a single off-chain AI agent and a suite of smart contracts gated by the{" "}
          <strong className="text-white">$UNIQ</strong> utility token. The system is non-custodial,
          transparent, and designed to make BNB Chain the safest high-throughput chain for retail DeFi.
        </p>
      </section>

      <section>
        <h2 className={h2}>1. Problem Statement</h2>
        <h3 className={h3}>1.1 The Trust Crisis in DeFi</h3>
        <p className={p}>
          BNB Chain hosts more retail DeFi activity than any other EVM chain, but the same low fees that
          attract users also attract bad actors. Common threats include:
        </p>
        <ul className={list}>
          <li><strong className="text-white">Honeypots</strong> — tokens that allow buying but block selling</li>
          <li><strong className="text-white">Mint backdoors</strong> — owner can dilute holders at will</li>
          <li><strong className="text-white">Liquidity pulls</strong> — LP unlocked, deployer drains pool</li>
          <li><strong className="text-white">Tax manipulation</strong> — sell tax silently raised post-launch</li>
          <li><strong className="text-white">Proxy upgrades</strong> — logic swapped to malicious implementation</li>
          <li><strong className="text-white">Protocol exploits</strong> — lending platforms compromised</li>
        </ul>
        <h3 className={h3}>1.2 Why Existing Solutions Fall Short</h3>
        <ul className={list}>
          <li><strong className="text-white">Centralized scanners</strong> rely on heuristics and require manual checking per token.</li>
          <li><strong className="text-white">Wallet alerts</strong> only fire after damage occurs.</li>
          <li><strong className="text-white">Audit firms</strong> are reactive and price-prohibitive for retail users.</li>
          <li><strong className="text-white">No solution acts.</strong> Every existing tool ends at notification; capital still depends on the user being awake, online, and decisive.</li>
        </ul>
        <p className={p}>
          The market needs continuous, autonomous, on-chain protection that a retail user can access for the
          cost of one PancakeSwap trade.
        </p>
      </section>

      <section>
        <h2 className={h2}>2. Aegis Architecture</h2>
        <p className={p}>
          Aegis is a layered system: smart contracts on BNB Chain provide the trust anchor, an AI agent
          provides reasoning and execution, and a Next.js frontend provides UX. Every premium feature is
          gated by on-chain $UNIQ balance via the <code style={codeStyle}>AegisTokenGate</code> contract.
        </p>

        <h3 className={h3}>2.1 On-Chain Layer</h3>
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-2 pr-4 text-white">Contract</th>
                <th className="text-left py-2 pr-4 text-white">Address</th>
                <th className="text-left py-2 text-white">Role</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-white/5"><td className="py-2 pr-4"><code style={codeStyle}>AegisRegistry</code></td><td className="py-2 pr-4"><code style={codeStyle}>0xb29f…e0B9</code></td><td className="py-2">Wallet enrollment & agent registration</td></tr>
              <tr className="border-b border-white/5"><td className="py-2 pr-4"><code style={codeStyle}>AegisLogger</code></td><td className="py-2 pr-4"><code style={codeStyle}>0x51Be…Da86</code></td><td className="py-2">Immutable alert & decision log</td></tr>
              <tr className="border-b border-white/5"><td className="py-2 pr-4"><code style={codeStyle}>AegisTokenGate</code></td><td className="py-2 pr-4"><code style={codeStyle}>0xabbd…a715</code></td><td className="py-2">$UNIQ tier resolution & fee discounts</td></tr>
              <tr className="border-b border-white/5"><td className="py-2 pr-4"><code style={codeStyle}>AegisScanner</code></td><td className="py-2 pr-4"><code style={codeStyle}>0x26D6…2b5D</code></td><td className="py-2">On-chain scan-result caching</td></tr>
              <tr className="border-b border-white/5"><td className="py-2 pr-4"><code style={codeStyle}>AegisVault</code></td><td className="py-2 pr-4"><code style={codeStyle}>0x9f60…0C06</code></td><td className="py-2">BNB deposit + Venus integration + AI guard</td></tr>
              <tr><td className="py-2 pr-4"><code style={codeStyle}>$UNIQ</code></td><td className="py-2 pr-4"><code style={codeStyle}>0xdd5f…7777</code></td><td className="py-2">Tier-gating utility token</td></tr>
            </tbody>
          </table>
        </div>
        <p className={p} style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>All contracts are verified on BscScan and licensed MIT.</p>

        <h3 className={h3}>2.2 Off-Chain Agent Layer</h3>
        <p className={p}>The Aegis Agent is a Node.js service. Every 30 seconds it:</p>
        <ol className={olist}>
          <li>Reads the wallet enrollment list from <code style={codeStyle}>AegisRegistry</code></li>
          <li>Fetches token holdings via BscScan + multicall</li>
          <li>Calls the <strong className="text-white">Scanner pipeline</strong> for each asset (liquidity, ownership, taxes, honeypot simulation, holder concentration)</li>
          <li>Sends structured findings to <strong className="text-white">Groq Llama-3.3-70B</strong> for cross-correlation reasoning</li>
          <li>Writes alerts on-chain via <code style={codeStyle}>AegisLogger.logAlert()</code></li>
          <li>Pushes critical/warning alerts to subscribed Telegram chat IDs</li>
          <li>For Vault depositors: monitors Venus protocol health and harvests yield when economical</li>
        </ol>

        <h3 className={h3}>2.3 Data Flow</h3>
        <pre className="text-xs p-4 rounded-xl overflow-x-auto" style={{ background: "var(--bg-elevated)", border: "1px solid rgba(255,255,255,0.06)" }}>
{`User ─► Frontend (Next.js) ─► API routes ─► Smart contracts
                                  │
                                  ├─► PancakeSwap (liquidity)
                                  ├─► Venus Protocol (yield)
                                  ├─► BscScan (verification)
                                  └─► Groq LLM (reasoning)
                                          │
                Aegis Agent ◄─────────────┘
                  │
                  ├─► AegisLogger (on-chain alerts)
                  └─► Telegram Bot (push delivery)`}
        </pre>
      </section>

      <section>
        <h2 className={h2}>3. Product Pillars</h2>

        <h3 className={h3}>3.1 Scanner — Pre-Trade Risk Detection</h3>
        <p className={p}>
          Public, free, no wallet required. Users paste any BSC token address and receive a 0–100 risk
          score within five seconds. Scanner combines:
        </p>
        <ul className={list}>
          <li>Bytecode analysis (proxy detection, mint functions, blacklist functions)</li>
          <li>Liquidity-lock verification (PinkSale, Unicrypt, Mudra)</li>
          <li>PancakeSwap pair simulation for honeypot detection</li>
          <li>Holder concentration via top-50 holder heuristics</li>
          <li>Sell-tax measurement via simulated swap</li>
          <li>LLM-written summary for Silver+ tier users</li>
        </ul>
        <p className={p}>Results are cached on-chain in <code style={codeStyle}>AegisScanner</code> to amortize cost across users.</p>

        <h3 className={h3}>3.2 Guardian — Continuous Wallet Monitoring</h3>
        <p className={p}>
          Users connect a wallet; their address is registered to <code style={codeStyle}>AegisRegistry</code>.
          From that moment forward — even with the website closed — the off-chain agent watches their
          holdings every 30 seconds. Detected events:
        </p>
        <ul className={list}>
          <li>Whale dumps (top-holder balance change &gt; threshold)</li>
          <li>Liquidity pulls (TVL drop &gt; 20%)</li>
          <li>Sell-tax raises</li>
          <li>Proxy implementation upgrades</li>
          <li>Owner privilege exercise (mint, blacklist additions)</li>
          <li>New honeypot classification on previously safe tokens</li>
        </ul>
        <p className={p}>
          Critical-severity events trigger Telegram alerts to subscribed chat IDs (Bronze tier+). All events
          are written to <code style={codeStyle}>AegisLogger</code> regardless of tier, providing a free
          on-chain audit trail.
        </p>

        <h3 className={h3}>3.3 Vault — AI-Guarded Yield</h3>
        <p className={p}>
          Users deposit BNB to <code style={codeStyle}>AegisVault</code>. Eighty percent is auto-supplied
          to <strong className="text-white">Venus Protocol</strong> via <code style={codeStyle}>mintNative()</code> for
          real lending APY (~2–4%); twenty percent is retained as an instant-withdrawal buffer. The agent
          monitors Venus protocol health and may:
        </p>
        <ul className={list}>
          <li><strong className="text-white">Harvest yield</strong> when accrued interest exceeds gas cost</li>
          <li><strong className="text-white">Emergency-withdraw from Venus</strong> on protocol risk signals</li>
          <li><strong className="text-white">Pause new deposits</strong> if integrated dependencies fail</li>
        </ul>
        <p className={p}>
          The vault is non-custodial: users withdraw any amount up to their share at any time. Fees:
          0.50% base, reduced by holder tier (down to 0.10% for Gold). Vault fees fund a treasury used for
          $UNIQ buybacks and operational costs.
        </p>
      </section>

      <section>
        <h2 className={h2}>4. The $UNIQ Token</h2>
        <p className={p}>
          $UNIQ is a fixed-supply BEP-20 utility token deployed at{" "}
          <code style={codeStyle}>0xdd5f3e8c2cfc8444fac46744d0a4a85df03d7777</code>. It has no governance
          claim and no expectation of profit; its sole utility is gating premium Aegis features.
        </p>

        <h3 className={h3}>4.1 Tier System</h3>
        <p className={p}>The <code style={codeStyle}>AegisTokenGate</code> contract reads $UNIQ balance and resolves a tier:</p>
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-2 pr-4 text-white">Tier</th>
                <th className="text-left py-2 pr-4 text-white">Threshold</th>
                <th className="text-left py-2 text-white">Benefits</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-white/5"><td className="py-2 pr-4">Free</td><td className="py-2 pr-4">0 $UNIQ</td><td className="py-2">Scanner, dashboard alerts (read-only)</td></tr>
              <tr className="border-b border-white/5"><td className="py-2 pr-4">Bronze</td><td className="py-2 pr-4">10,000 $UNIQ</td><td className="py-2">+ Telegram alert delivery</td></tr>
              <tr className="border-b border-white/5"><td className="py-2 pr-4">Silver</td><td className="py-2 pr-4">100,000 $UNIQ</td><td className="py-2">+ LLM summaries, deeper monitoring</td></tr>
              <tr><td className="py-2 pr-4">Gold</td><td className="py-2 pr-4">1,000,000 $UNIQ</td><td className="py-2">+ Full LLM narrative, priority alerts, 80% vault fee discount</td></tr>
            </tbody>
          </table>
        </div>

        <h3 className={h3}>4.2 Value Capture</h3>
        <p className={p}>$UNIQ accrues value through three mechanisms:</p>
        <ol className={olist}>
          <li><strong className="text-white">Demand-side gating</strong> — premium users must hold (not spend) $UNIQ, removing supply from float</li>
          <li><strong className="text-white">Fee buyback</strong> — a portion of vault revenue programmatically purchases $UNIQ on PancakeSwap</li>
          <li><strong className="text-white">Future staking</strong> (planned) — staked $UNIQ earns a share of vault fees</li>
        </ol>

        <h3 className={h3}>4.3 Distribution</h3>
        <ul className={list}>
          <li>Total supply: fixed at deployment, fully circulating</li>
          <li>Initial liquidity: locked on PancakeSwap V2</li>
          <li>No team allocation, no presale, no vesting cliffs — fair launch</li>
          <li>LP renounced / locked (verifiable on-chain)</li>
        </ul>
      </section>

      <section>
        <h2 className={h2}>5. Security Model</h2>
        <h3 className={h3}>5.1 Non-Custodial Guarantees</h3>
        <p className={p}>
          The Aegis Agent operates only via permissioned contract methods. Specifically, the agent can:
          harvest Venus yield, emergency-withdraw from Venus into the vault, and toggle deposit pause. The
          agent <strong className="text-white">cannot</strong> withdraw user funds to any external address.
          Users withdraw to themselves at any time via <code style={codeStyle}>vault.withdraw()</code>.
        </p>

        <h3 className={h3}>5.2 Transparency</h3>
        <p className={p}>
          Every alert is written to <code style={codeStyle}>AegisLogger</code> with a structured event
          including the AI&apos;s reasoning hash, severity, and category. This creates an immutable,
          queryable audit trail for any user to verify the agent&apos;s decisions.
        </p>

        <h3 className={h3}>5.3 Failure Modes</h3>
        <ul className={list}>
          <li><strong className="text-white">Agent offline</strong> — alerts pause; users can still withdraw and use Scanner</li>
          <li><strong className="text-white">Groq LLM offline</strong> — fall back to rule-based analysis (deterministic)</li>
          <li><strong className="text-white">Venus exploited</strong> — agent calls emergency withdraw; protocol-level losses still possible if exploit is faster than detection</li>
          <li><strong className="text-white">Telegram outage</strong> — alerts persist on-chain; users see them on next dashboard load</li>
        </ul>

        <h3 className={h3}>5.4 Audit Status</h3>
        <p className={p}>
          All contracts pass an internal 170-test suite. External audit is in progress; results will be
          published at <code style={codeStyle}>aegisguardian.xyz/audits</code> upon completion.
        </p>
      </section>

      <section>
        <h2 className={h2}>6. Roadmap</h2>
        <div className="overflow-x-auto mb-4">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-2 pr-4 text-white">Phase</th>
                <th className="text-left py-2 pr-4 text-white">Date</th>
                <th className="text-left py-2 text-white">Deliverables</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-white/5"><td className="py-2 pr-4">Hackathon win</td><td className="py-2 pr-4">Feb 2026</td><td className="py-2">Top-10 in BNB Chain &quot;Good Vibes Only&quot;</td></tr>
              <tr className="border-b border-white/5"><td className="py-2 pr-4">Phase 1 testnet</td><td className="py-2 pr-4">Mar 2026</td><td className="py-2">Scanner, basic Guardian, $UNIQ launched</td></tr>
              <tr className="border-b border-white/5"><td className="py-2 pr-4">Phase 2 testnet</td><td className="py-2 pr-4">Mar 2026</td><td className="py-2">TokenGate, tier system, Vault prototype</td></tr>
              <tr className="border-b border-white/5"><td className="py-2 pr-4 font-semibold text-white">Mainnet launch</td><td className="py-2 pr-4 font-semibold text-white">Apr 28, 2026</td><td className="py-2 font-semibold text-white">All three pillars live, Venus integration, Telegram bot</td></tr>
              <tr className="border-b border-white/5"><td className="py-2 pr-4">Phase 3</td><td className="py-2 pr-4">Q3 2026</td><td className="py-2">Stablecoin vault, $UNIQ staking, external audit</td></tr>
              <tr className="border-b border-white/5"><td className="py-2 pr-4">Phase 4</td><td className="py-2 pr-4">Q4 2026</td><td className="py-2">Multi-protocol vaults (Aave, Stargate), mobile app</td></tr>
              <tr><td className="py-2 pr-4">Phase 5</td><td className="py-2 pr-4">2027</td><td className="py-2">Cross-chain expansion (opBNB, Greenfield)</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className={h2}>7. Team</h2>
        <p className={p}>
          Aegis is built by <strong className="text-white">UnIQ Minds Labs</strong>, currently a
          solo-founder operation led by <strong className="text-white">David Praise</strong> (Ghana). The
          project was bootstrapped from a hackathon win and has chosen a slow, code-first growth path over
          paid marketing. The team welcomes contributors — see the GitHub repository.
        </p>
      </section>

      <section>
        <h2 className={h2}>8. Disclaimers</h2>
        <p className={p}>
          $UNIQ is a utility token. It is not a security, not an investment contract, and confers no
          profit expectation, governance right, or claim on protocol revenue beyond the explicit
          fee-discount mechanism described in §4. Users transact at their own risk; smart contracts carry
          inherent risk despite testing and audit. Always do your own research. This document is technical
          disclosure, not financial advice.
        </p>
      </section>

      <section>
        <h2 className={h2}>9. Resources</h2>
        <ul className={list}>
          <li>Website: <a href="https://aegisguardian.xyz" className="underline" style={{ color: "var(--bnb)" }}>aegisguardian.xyz</a></li>
          <li>GitHub: <a href="https://github.com/Tonyflam/aegis-protocol" className="underline" style={{ color: "var(--bnb)" }}>github.com/Tonyflam/aegis-protocol</a></li>
          <li>Telegram: <a href="https://t.me/UnIQMindsAegis" className="underline" style={{ color: "var(--bnb)" }}>t.me/UnIQMindsAegis</a></li>
          <li>Bot: <a href="https://t.me/aegis_protocol_bot" className="underline" style={{ color: "var(--bnb)" }}>t.me/aegis_protocol_bot</a></li>
          <li>X: <a href="https://x.com/uniq_minds" className="underline" style={{ color: "var(--bnb)" }}>@uniq_minds</a></li>
          <li>$UNIQ on BscScan: <a href="https://bscscan.com/token/0xdd5f3e8c2cfc8444fac46744d0a4a85df03d7777" className="underline" style={{ color: "var(--bnb)" }}>View token</a></li>
        </ul>
      </section>

      <footer className="mt-16 pt-8 border-t border-white/10 text-center text-xs" style={{ color: "var(--text-muted)" }}>
        Aegis Protocol Whitepaper · v1.0 · Published April 26, 2026 · © UnIQ Minds Labs · MIT Licensed
      </footer>
    </article>
  );
}

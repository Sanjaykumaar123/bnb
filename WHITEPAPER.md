# Aegis Protocol Whitepaper

**Version 1.0 · April 2026**
**AI-Native DeFi Security Infrastructure on BNB Chain**

UnIQ Minds Labs · [aegisguardian.xyz](https://aegisguardian.xyz)

---

## Abstract

Decentralized finance on BNB Chain processes billions in daily volume yet remains hostile to non-expert users. Rug pulls, honeypots, malicious contract upgrades, and protocol exploits drained an estimated $2B+ across BSC in 2024–2025 alone. Aegis Protocol introduces the first AI-native, fully on-chain security layer for BNB Chain DeFi: an autonomous agent that detects threats, monitors wallets continuously, and protects user capital — with all decisions cryptographically anchored on-chain.

Aegis is composed of three integrated products (**Scanner**, **Guardian**, **Vault**), powered by a single off-chain AI agent and a suite of smart contracts gated by the **$UNIQ** utility token. The system is non-custodial, transparent, and designed to make BNB Chain the safest high-throughput chain for retail DeFi.

---

## 1. Problem Statement

### 1.1 The Trust Crisis in DeFi

BNB Chain hosts more retail DeFi activity than any other EVM chain, but the same low fees that attract users also attract bad actors. Common threats include:

- **Honeypots** — tokens that allow buying but block selling
- **Mint backdoors** — owner can dilute holders at will
- **Liquidity pulls** — LP unlocked, deployer drains pool
- **Tax manipulation** — sell tax silently raised post-launch
- **Proxy upgrades** — logic swapped to malicious implementation
- **Protocol exploits** — lending platforms compromised

### 1.2 Why Existing Solutions Fall Short

- **Centralized scanners** rely on heuristics and require manual checking per token
- **Wallet alerts** only fire after damage occurs
- **Audit firms** are reactive and price-prohibitive for retail users
- **No solution acts.** Every existing tool ends at notification; capital still depends on the user being awake, online, and decisive.

The market needs continuous, autonomous, on-chain protection that a retail user can access for the cost of one PancakeSwap trade.

---

## 2. Aegis Architecture

Aegis is a layered system: smart contracts on BNB Chain provide the trust anchor, an AI agent provides reasoning and execution, and a Next.js frontend provides UX. Every premium feature is gated by on-chain $UNIQ balance via the `AegisTokenGate` contract.

### 2.1 On-Chain Layer

| Contract | Address | Role |
|---|---|---|
| `AegisRegistry` | `0xb29f289D89921Ea784c8E8FDc04ced20cEcbE0B9` | Wallet enrollment & agent registration |
| `AegisLogger` | `0x51Be618E3CA0b0B19FA0cC6c10960fF62783Da86` | Immutable alert & decision log |
| `AegisTokenGate` | `0xabbd2E13d5eda2D75D1599A7539a3083dfaba715` | $UNIQ tier resolution & fee discounts |
| `AegisScanner` | `0x26D61a9cE682c051cD8DA343acE97a9C88Cf2b5D` | On-chain scan-result caching |
| `AegisVault` | `0x9f605D46b07d9BBBF18528BE4D8546A993c30C06` | BNB deposit + Venus integration + AI guard |
| `$UNIQ` | `0xdd5f3e8c2cfc8444fac46744d0a4a85df03d7777` | Tier-gating utility token |

All contracts are verified on BscScan and licensed MIT.

### 2.2 Off-Chain Agent Layer

The Aegis Agent is a Node.js service. Every 30 seconds it:

1. Reads the wallet enrollment list from `AegisRegistry`
2. Fetches token holdings via BscScan + multicall
3. Calls the **Scanner pipeline** for each asset (liquidity, ownership, taxes, honeypot simulation, holder concentration)
4. Sends structured findings to **Groq Llama-3.3-70B** for cross-correlation reasoning
5. Writes alerts on-chain via `AegisLogger.logAlert()`
6. Pushes critical/warning alerts to subscribed Telegram chat IDs
7. For Vault depositors: monitors Venus protocol health and harvests yield when economical

### 2.3 Data Flow

```
User ─► Frontend (Next.js) ─► API routes ─► Smart contracts
                                  │
                                  ├─► PancakeSwap (liquidity)
                                  ├─► Venus Protocol (yield)
                                  ├─► BscScan (verification)
                                  └─► Groq LLM (reasoning)
                                          │
                Aegis Agent ◄─────────────┘
                  │
                  ├─► AegisLogger (on-chain alerts)
                  └─► Telegram Bot (push delivery)
```

---

## 3. Product Pillars

### 3.1 Scanner — Pre-Trade Risk Detection

Public, free, no wallet required. Users paste any BSC token address and receive a 0–100 risk score within five seconds. Scanner combines:

- Bytecode analysis (proxy detection, mint functions, blacklist functions)
- Liquidity-lock verification (PinkSale, Unicrypt, Mudra)
- PancakeSwap pair simulation for honeypot detection
- Holder concentration via top-50 holder heuristics
- Sell-tax measurement via simulated swap
- LLM-written summary for Silver+ tier users

Results are cached on-chain in `AegisScanner` to amortize cost across users.

### 3.2 Guardian — Continuous Wallet Monitoring

Users connect a wallet; their address is registered to `AegisRegistry`. From that moment forward — even with the website closed — the off-chain agent watches their holdings every 30 seconds. Detected events:

- Whale dumps (top-holder balance change > threshold)
- Liquidity pulls (TVL drop > 20%)
- Sell-tax raises
- Proxy implementation upgrades
- Owner privilege exercise (mint, blacklist additions)
- New honeypot classification on previously safe tokens

Critical-severity events trigger Telegram alerts to subscribed chat IDs (Bronze tier+). All events are written to `AegisLogger` regardless of tier, providing a free on-chain audit trail.

### 3.3 Vault — AI-Guarded Yield

Users deposit BNB to `AegisVault`. Eighty percent is auto-supplied to **Venus Protocol** via `mintNative()` for real lending APY (~2–4%); twenty percent is retained as an instant-withdrawal buffer. The agent monitors Venus protocol health and may:

- **Harvest yield** when accrued interest exceeds gas cost
- **Emergency-withdraw from Venus** on protocol risk signals
- **Pause new deposits** if integrated dependencies fail

The vault is non-custodial: users withdraw any amount up to their share at any time. Fees: 0.50% base, reduced by holder tier (down to 0.10% for Gold). Vault fees fund a treasury used for $UNIQ buybacks and operational costs.

---

## 4. The $UNIQ Token

$UNIQ is a fixed-supply BEP-20 utility token deployed at `0xdd5f3e8c2cfc8444fac46744d0a4a85df03d7777`. It has no governance claim and no expectation of profit; its sole utility is gating premium Aegis features.

### 4.1 Tier System

The `AegisTokenGate` contract reads $UNIQ balance and resolves a tier:

| Tier | Threshold | Benefits |
|---|---|---|
| Free | 0 $UNIQ | Scanner, dashboard alerts (read-only) |
| Bronze | 10,000 $UNIQ | + Telegram alert delivery |
| Silver | 100,000 $UNIQ | + LLM summaries, deeper monitoring |
| Gold | 1,000,000 $UNIQ | + Full LLM narrative, priority alerts, 80% vault fee discount |

### 4.2 Value Capture

$UNIQ accrues value through three mechanisms:

1. **Demand-side gating** — premium users must hold (not spend) $UNIQ, removing supply from float
2. **Fee buyback** — a portion of vault revenue programmatically purchases $UNIQ on PancakeSwap
3. **Future staking** (planned) — staked $UNIQ earns a share of vault fees

### 4.3 Distribution

- Total supply: fixed at deployment, fully circulating
- Initial liquidity: locked on PancakeSwap V2
- No team allocation, no presale, no vesting cliffs — fair launch
- LP renounced / locked (verifiable on-chain)

---

## 5. Security Model

### 5.1 Non-Custodial Guarantees

The Aegis Agent operates only via permissioned contract methods. Specifically, the agent can: harvest Venus yield, emergency-withdraw from Venus into the vault, and toggle deposit pause. The agent **cannot** withdraw user funds to any external address. Users withdraw to themselves at any time via `vault.withdraw()`.

### 5.2 Transparency

Every alert is written to `AegisLogger` with a structured event including the AI's reasoning hash, severity, and category. This creates an immutable, queryable audit trail for any user to verify the agent's decisions.

### 5.3 Failure Modes

- **Agent offline** — alerts pause; users can still withdraw and use Scanner
- **Groq LLM offline** — fall back to rule-based analysis (deterministic)
- **Venus exploited** — agent calls emergency withdraw; protocol-level losses still possible if exploit is faster than detection
- **Telegram outage** — alerts persist on-chain; users see them on next dashboard load

### 5.4 Audit Status

All contracts pass an internal 170-test suite. External audit is in progress; results will be published at `aegisguardian.xyz/audits` upon completion.

---

## 6. Roadmap

| Phase | Date | Deliverables |
|---|---|---|
| Hackathon win | Feb 2026 | Top-10 in BNB Chain "Good Vibes Only" |
| Phase 1 testnet | Mar 2026 | Scanner, basic Guardian, $UNIQ launched |
| Phase 2 testnet | Mar 2026 | TokenGate, tier system, Vault prototype |
| **Mainnet launch** | **Apr 28, 2026** | **All three pillars live, Venus integration, Telegram bot** |
| Phase 3 | Q3 2026 | Stablecoin vault, $UNIQ staking, external audit |
| Phase 4 | Q4 2026 | Multi-protocol vaults (Aave, Stargate), mobile app |
| Phase 5 | 2027 | Cross-chain expansion (opBNB, Greenfield) |

---

## 7. Team

Aegis is built by **UnIQ Minds Labs**, currently a solo-founder operation led by **David Praise** (Ghana). The project was bootstrapped from a hackathon win and has chosen a slow, code-first growth path over paid marketing. The team welcomes contributors — see the GitHub repository.

---

## 8. Disclaimers

$UNIQ is a utility token. It is not a security, not an investment contract, and confers no profit expectation, governance right, or claim on protocol revenue beyond the explicit fee-discount mechanism described in §4. Users transact at their own risk; smart contracts carry inherent risk despite testing and audit. Always do your own research. This document is technical disclosure, not financial advice.

---

## 9. Resources

- Website: [aegisguardian.xyz](https://aegisguardian.xyz)
- GitHub: [github.com/Tonyflam/aegis-protocol](https://github.com/Tonyflam/aegis-protocol)
- Telegram: [t.me/UnIQMindsAegis](https://t.me/UnIQMindsAegis)
- Bot: [t.me/aegis_protocol_bot](https://t.me/aegis_protocol_bot)
- X: [@uniq_minds](https://x.com/uniq_minds)
- $UNIQ on BscScan: [View token](https://bscscan.com/token/0xdd5f3e8c2cfc8444fac46744d0a4a85df03d7777)

---

*Aegis Protocol Whitepaper · v1.0 · Published April 26, 2026 · © UnIQ Minds Labs · MIT Licensed*

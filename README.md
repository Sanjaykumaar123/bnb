<div align="center">

# 🛡️ Aegis Protocol

### DeFi Security Toolkit for BNB Chain — Scan, Monitor, Protect

[![Built for BNB Chain](https://img.shields.io/badge/Built_for-BNB_Chain-F0B90B?style=for-the-badge&logo=binance)](https://www.bnbchain.org/)
[![Good Vibes Only](https://img.shields.io/badge/Good_Vibes_Only-Top_10_Winner-00e0ff?style=for-the-badge)](https://openclaw.xyz)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636?style=for-the-badge&logo=solidity)](https://soliditylang.org/)
[![Tests](https://img.shields.io/badge/Tests-184%2F184_Passing-22c55e?style=for-the-badge)](./test/)
[![Deployed](https://img.shields.io/badge/BSC_Testnet-Deployed_%26_Verified-F0B90B?style=for-the-badge)](https://testnet.bscscan.com/address/0xfa80515136Fc8CB2db3b25C317A1c9a04bcD3536)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](./LICENSE)

*Scan any token for rug pulls. Monitor your entire wallet 24/7. Deposit into a protected vault earning Venus yield. All powered by real on-chain data + AI analysis.*

**🌐 [Live App](https://aegis-protocol-1.vercel.app/) · 🎥 [Demo Video](https://youtu.be/zEeFEduh6eg) · 📜 [Verified Contracts](https://testnet.bscscan.com/address/0xfa80515136Fc8CB2db3b25C317A1c9a04bcD3536) · 🐦 [Twitter](https://x.com/aegisguardian_)**

</div>

---

## What Is Aegis Protocol?

Aegis Protocol is a **DeFi security toolkit** built on BNB Chain. It started as a hackathon concept for autonomous DeFi protection (**#6 in BNB Chain Good Vibes Only Hackathon, top 200**), and we're shipping it as a real product in phases — starting with the tools you can use **today**.

### What's Live Right Now

| Product | Status | What It Does |
|---------|--------|-------------|
| **🔍 Token Scanner** | ✅ **LIVE** | Paste any BSC token address → instant risk score, honeypot detection, tax analysis, liquidity depth, holder concentration. Shareable results. |
| **🛡️ Guardian Shield** | ✅ **LIVE** | Connect wallet → scans ALL your tokens → generates real-time security alerts every 60 seconds. Critical/warning/info alerts tier-gated by $UNIQ holdings. AI analysis for Gold tier via Groq LLM. |
| **📱 Telegram Alerts** | ✅ **LIVE** | Link your Telegram via @aegis_protocol_bot → receive push alerts when Guardian Shield detects threats. Silver+ tier required. |
| **🏦 Protected Vault** | 🧪 **Testnet** | Deposit BNB → Venus Protocol yield → stop-loss via PancakeSwap. Smart contracts deployed & tested (184/184 passing). Mainnet launch in Phase 4. |
| **🤖 AI Agent Engine** | 🔧 **Built** | 3,473 LOC autonomous monitoring engine (5-vector risk scoring, LLM reasoning, on-chain execution). Running in Phase 4 after security audit. |

### What's Coming (Phase 4: Mainnet)

The autonomous protection features the community knows about — **stop-loss execution, Venus yield harvesting, AI-driven auto-protection, on-chain decision logging** — are fully coded and tested. They go live when we launch on BSC Mainnet after the security audit. Nothing was removed. We're shipping it in the right order: **detect first, protect next**.

---

## 🚶 How It Works

```
1. SCAN A TOKEN       →  Paste any BSC address → instant risk score + flags     (FREE)
2. SCAN YOUR WALLET   →  Connect wallet → scan ALL holdings at once             (FREE)
3. GUARDIAN SHIELD     →  24/7 monitoring with auto-refresh alerts              (FREEMIUM)
4. TELEGRAM ALERTS     →  Push notifications when threats are found             (SILVER+)
5. AI RISK ANALYSIS    →  LLM-powered portfolio summary                        (GOLD)
6. PROTECTED VAULT     →  Deposit BNB → Venus yield + AI protection            (COMING)
```

| Route | Page | Description |
|-------|------|-------------|
| `/scanner` | Token Scanner | Scan a single token OR connect wallet to scan all holdings |
| `/guardian` | Guardian Shield | 24/7 wallet monitoring with auto-refresh alerts |
| `/vault` | Protected Vault | Deposit BNB → Venus yield + stop-loss + AI monitoring |
| `/scan/[address]` | Token Details | Deep-dive risk profile for a specific token (shareable link) |

---

## 🔍 Token Scanner (LIVE)

The core product. Scan any BSC token using real multi-source data:

| Check | Source | What It Detects |
|-------|--------|-----------------|
| Honeypot | Simulated buy/sell | Tokens you can buy but can't sell |
| Tax Analysis | Bytecode + simulation | Hidden buy/sell taxes (>10% = warning) |
| Liquidity | PancakeSwap V2 on-chain | Pool depth, LP lock status |
| Holder Concentration | GoPlusLabs API | Whale dominance %, top holder risk |
| Contract Verification | BSCScan + GoPlusLabs | Unverified/malicious bytecode |
| Mint/Pause/Blacklist | Bytecode analysis | Owner can mint, pause trading, or blacklist |

**Risk score: 0-100** (LOW / MEDIUM / HIGH / CRITICAL)

Every scan result is shareable via Twitter and Telegram with formatted risk summaries.

---

## 🛡️ Guardian Shield (LIVE)

Connect your wallet and get **continuous 24/7 monitoring** with auto-refresh every 60 seconds:

**What It Monitors:**
- All tokens in your wallet, re-scanned every cycle
- Honeypot status changes
- Tax rate changes (sudden increases = rug signal)
- Liquidity movements (LP unlocked/drained)
- Wallet concentration shifts
- Contract verification status

**Alert Severity Levels:**

| Severity | Examples | Tier Requirement |
|----------|---------|-----------------|
| 🔴 Critical | Honeypot detected, extreme tax (>50%), owner can mint | Free (always shown) |
| 🟠 Warning | High tax (10-50%), whale concentration (>20%), LP unlocked | Free (always shown) |
| 🔵 Info | Not verified, moderate tax, monitoring updates | Tier-gated |

**AI Analysis (Gold Tier):** Groq LLM generates a portfolio-level risk summary analyzing all your holdings together.

**Telegram Alerts (Silver+):** Critical/warning alerts are pushed directly to your Telegram. Throttled to prevent spam (1hr cooldown + alert fingerprinting).

---

## 🏦 Protected Vault (Testnet — Mainnet Coming)

Smart contracts are deployed, tested, and verified on BSC Testnet:

| Feature | Status | Description |
|---------|--------|-------------|
| BNB Deposits | ✅ Working (testnet) | Non-custodial, emergency withdraw always available |
| Venus Protocol Yield | ✅ Working (testnet mock) | BNB → vBNB lending, configurable allocation |
| Stop-Loss | ✅ Working (testnet) | BNB → USDT via PancakeSwap when price drops past threshold |
| Per-User Risk Profiles | ✅ Working (testnet) | Slippage tolerance, stop-loss threshold, auto-swap toggle |
| Agent Authorization | ✅ Working (testnet) | Users explicitly authorize which AI agents can act |
| Fee Discounts | ✅ Working (testnet) | $UNIQ holders get 10-40% reduced performance fees |

**Mainnet addresses ready:**
- Venus vBNB: `0xA07c5b74C9B40447a954e1466938b865b6BBea36`
- PancakeSwap Router: `0x10ED43C718714eb63d5aA57B78B54704E256024E`

---

## 🤖 AI Agent Engine (Built — Deploying in Phase 4)

3,473 lines of production-ready code for autonomous DeFi monitoring:

```
OBSERVE → ANALYZE → AI REASON → DEX VERIFY → DECIDE → EXECUTE
```

| Module | LOC | Function |
|--------|-----|----------|
| `ai-engine.ts` | — | LLM reasoning via Groq (Llama 3.3 70B) or OpenAI (GPT-4o) |
| `analyzer.ts` | — | 5-vector weighted risk scoring |
| `executor.ts` | — | On-chain transaction execution |
| `stop-loss.ts` | — | BNB → USDT swap via PancakeSwap |
| `venus-monitor.ts` | — | Venus yield harvesting |
| `whale-tracker.ts` | — | Large transfer monitoring |
| `market-provider.ts` | — | CoinGecko + DeFiLlama feeds |

### 5-Vector Risk Scoring

| Vector | Weight | Description |
|--------|--------|-------------|
| Price Volatility | 30% | 24h price change magnitude |
| Liquidity Health | 25% | Pool liquidity changes and depth |
| Volume Analysis | 15% | Trading volume anomalies |
| Holder Concentration | 15% | Whale ownership risk |
| Momentum Analysis | 15% | Combined trend signals |

Every AI decision will be hashed (keccak256) and stored on-chain via DecisionLogger — immutable proof of reasoning.

---

## ⛓️ Smart Contracts (7 Contracts · 2,660 LOC)

All deployed and verified on BSC Testnet. 184/184 tests passing.

| Contract | LOC | Purpose |
|----------|-----|---------|
| **AegisVault** | 1,164 | Protected vault + Venus yield + PancakeSwap stop-loss + per-user risk profiles |
| **AegisRegistry** | 557 | ERC-721 agent identity NFTs + 4-tier reputation system |
| **DecisionLogger** | 337 | On-chain AI decision audit trail (keccak256 reasoning hashes) |
| **AegisScanner** | 181 | Token risk registry (agents push scan results, users query scores) |
| **AegisTokenGate** | 200 | $UNIQ holder tiers (Bronze/Silver/Gold) + fee discounts |
| **Interfaces** | 72 | IVenusBNB, IPancakeRouter |
| **MockVenusBNB** | 130 | Testnet Venus simulator |

### Deployed Addresses (BSC Testnet)

| Contract | Address |
|----------|---------|
| AegisRegistry | [`0x806677bAb187157Ba567820e857e321c92E6C1EF`](https://testnet.bscscan.com/address/0x806677bAb187157Ba567820e857e321c92E6C1EF) |
| AegisVault | [`0xfa80515136Fc8CB2db3b25C317A1c9a04bcD3536`](https://testnet.bscscan.com/address/0xfa80515136Fc8CB2db3b25C317A1c9a04bcD3536) |
| DecisionLogger | [`0x978308DF80FE3AEDf228D58c3625db49e50FE51B`](https://testnet.bscscan.com/address/0x978308DF80FE3AEDf228D58c3625db49e50FE51B) |
| AegisScanner | [`0x8fa659D8edeffF0bBdEC37cB2c16C2f85491C840`](https://testnet.bscscan.com/address/0x8fa659D8edeffF0bBdEC37cB2c16C2f85491C840) |
| AegisTokenGate | [`0x0F998bb1B3866B73CAaBc54B7A84156b8F9f7543`](https://testnet.bscscan.com/address/0x0F998bb1B3866B73CAaBc54B7A84156b8F9f7543) |

---

## 💎 $UNIQ Token

| Property | Details |
|----------|---------|
| **Contract** | [`0xdd5f3e8c2cfc8444fac46744d0a4a85df03d7777`](https://bscscan.com/token/0xdd5f3e8c2cfc8444fac46744d0a4a85df03d7777) |
| **Chain** | BNB Smart Chain (Mainnet) |
| **Supply** | 1,000,000,000 (1B) |
| **Tax** | 3% |
| **Ownership** | Renounced |
| **LP** | Locked |

### Holder Tiers

| Tier | $UNIQ Required | Perks |
|------|---------------|-------|
| Free | 0 | Token Scanner + basic Guardian alerts |
| Bronze | 10,000 | Extended monitoring alerts + 10% vault fee discount |
| Silver | 100,000 | Telegram push alerts + 25% vault fee discount |
| Gold | 1,000,000 | AI analysis + all alerts + 40% vault fee discount |

**Links**: [BSCScan](https://bscscan.com/token/0xdd5f3e8c2cfc8444fac46744d0a4a85df03d7777) · [Buy on flap.sh](https://flap.sh/bnb/0xdd5f3e8c2cfc8444fac46744d0a4a85df03d7777) · [Twitter](https://x.com/aegisguardian_)

---

## 🗺️ Roadmap

| Phase | Status | What |
|-------|--------|------|
| Phase 1 — Foundation | ✅ Done | Smart contracts (7), AI agent engine, 184 tests passing |
| Phase 2 — Hackathon | ✅ Done | BNB Chain Good Vibes Only #6/200, BSC Testnet deployment |
| Phase 3 — Live Tools | ✅ **NOW** | Token Scanner, Guardian Shield, Telegram alerts, $UNIQ tiers |
| Phase 4 — Mainnet | 🔜 Next | Security audit → BSC Mainnet → Venus yield → stop-loss → AI agent service |
| Phase 5 — Scale | 📋 Planned | Multi-chain, staking rewards, agent marketplace |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Smart Contracts | Solidity 0.8.24, OpenZeppelin 5.6.1, Hardhat 2.22.17 |
| DeFi | Venus Protocol (lending/yield), PancakeSwap V2 (stop-loss/price oracle) |
| AI | Groq (Llama 3.1 8B) for Guardian analysis, 5-vector heuristic scoring |
| Frontend | Next.js 14, Tailwind CSS, ethers.js v6, Vercel |
| Data Sources | GoPlusLabs, Honeypot.is, CoinGecko, PancakeSwap on-chain, BSCScan |
| Alerts | Telegram Bot API (push notifications), In-app real-time alerts |
| Blockchain | BNB Smart Chain (Testnet + Mainnet ready) |
| Testing | Hardhat + Chai (184 tests) |

---

## 🔒 Security

- **Non-Custodial** — Emergency withdrawal always available
- **Agent Authorization** — Users explicitly authorize agents
- **Per-User Risk Profiles** — Configurable slippage, stop-loss, caps
- **On-Chain Audit Trail** — Decision hashes stored in DecisionLogger
- **ReentrancyGuard** — All fund-moving functions protected
- **OpenZeppelin 5.6.1** — Battle-tested contract libraries
- **184 Tests** — Full contract coverage

---

## 🚀 Quick Start

```bash
# Clone
git clone https://github.com/Tonyflam/aegis-protocol.git
cd aegis-protocol && npm install --legacy-peer-deps

# Run tests (184 passing)
npx hardhat test

# Start Frontend
cd frontend && npm install && npm run dev
# Open http://localhost:3000

# (Optional) Deploy contracts
cp .env.example .env  # Add PRIVATE_KEY
npx hardhat run scripts/deploy.ts --network bscTestnet
```

---

## 📂 Project Structure

```
aegis-protocol/
├── contracts/           # 7 Solidity contracts (2,660 LOC)
├── agent/               # AI agent engine (3,473 LOC)
├── bot/                 # Telegram bot (554 LOC)
├── frontend/            # Next.js 14 app (5,241 LOC)
│   └── src/app/
│       ├── scanner/     # Token Scanner
│       ├── guardian/    # Guardian Shield
│       ├── vault/       # Protected Vault
│       └── api/         # guardian, scan, vault, telegram, wallet
├── test/                # 184 tests (2,317 LOC)
└── scripts/             # Deploy + demo scripts
```

**Total: 14,245 LOC**

---

<div align="center">

**Aegis Protocol by [Uniq Minds](https://x.com/uniq_minds) · 🏆 #6 — BNB Chain Good Vibes Only Hackathon**

*Scan it. Monitor it. Protect it. — DeFi security for BNB Chain.*

[Live App](https://aegis-protocol-1.vercel.app/) · [$UNIQ Token](https://bscscan.com/token/0xdd5f3e8c2cfc8444fac46744d0a4a85df03d7777) · [Twitter](https://x.com/aegisguardian_) · [Telegram Bot](https://t.me/aegis_protocol_bot) · [Roadmap](./ROADMAP.md)

</div>

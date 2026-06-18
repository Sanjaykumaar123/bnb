// ═══════════════════════════════════════════════════════════════
// Aegis Protocol — Telegram Alert Bot
// Push notifications for scans, whale alerts, vault updates
// ═══════════════════════════════════════════════════════════════

import TelegramBot from "node-telegram-bot-api";
import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config({ path: "../../.env" });
dotenv.config({ path: "../.env" });

// ─── Configuration ────────────────────────────────────────────

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const RPC_URL = process.env.BSC_TESTNET_RPC || "https://data-seed-prebsc-1-s1.bnbchain.org:8545";

// Contract addresses (from latest deployment)
const VAULT_ADDRESS = process.env.VAULT_ADDRESS || "0xfa80515136Fc8CB2db3b25C317A1c9a04bcD3536";
const SCANNER_ADDRESS = process.env.SCANNER_ADDRESS || "0x8fa659D8edeffF0bBdEC37cB2c16C2f85491C840";
const TOKEN_GATE_ADDRESS = process.env.TOKEN_GATE_ADDRESS || "0x0F998bb1B3866B73CAaBc54B7A84156b8F9f7543";

const VAULT_ABI = [
  "function getPosition(address user) view returns (tuple(uint256 bnbBalance, uint256 depositTimestamp, uint256 lastActionTimestamp, bool isActive, uint256 authorizedAgentId, bool agentAuthorized, tuple(uint256 maxSlippage, uint256 stopLossThreshold, uint256 maxSingleActionValue, bool allowAutoWithdraw, bool allowAutoSwap) riskProfile))",
  "function getVenusInfo() view returns (uint256 deployed, uint256 currentValue, uint256 pendingYield, uint256 allocationBps, bool enabled)",
  "function getStablecoinBalance(address user) view returns (uint256)",
  "function getVaultStats() view returns (uint256 totalBnbDeposited, uint256 totalActionsExecuted, uint256 totalValueProtected)",
  "function getYieldInfo(address user) view returns (uint256 grossYieldEarned, uint256 netYieldEarned, uint256 pendingInPosition, uint256 effectivePerformanceFeeBps)",
];

const TOKEN_GATE_ABI = [
  "function getHolderTier(address user) view returns (uint8)",
  "function isHolder(address user) view returns (bool)",
];

// ─── Subscriber Store ─────────────────────────────────────────

interface Subscriber {
  chatId: number;
  wallet?: string;
  tier: number; // 0=None, 1=Bronze, 2=Silver, 3=Gold
  alertsEnabled: boolean;
  whaleAlerts: boolean;
  priceAlerts: boolean;
  lastBnbPrice: number;
  priceAlertThreshold: number; // % change to trigger
}

const subscribers = new Map<number, Subscriber>();

// ─── Provider ─────────────────────────────────────────────────

const provider = new ethers.JsonRpcProvider(RPC_URL);
const vault = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, provider);
const tokenGate = new ethers.Contract(TOKEN_GATE_ADDRESS, TOKEN_GATE_ABI, provider);

// ─── Helper Functions ─────────────────────────────────────────

const TIER_NAMES = ["None", "Bronze 🥉", "Silver 🥈", "Gold 🥇"];
const TIER_EMOJIS = ["⬜", "🥉", "🥈", "🥇"];

function formatBNB(wei: bigint): string {
  return parseFloat(ethers.formatEther(wei)).toFixed(4);
}

function shortenAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

async function getBnbPrice(): Promise<number> {
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd");
    const data = await res.json() as { binancecoin?: { usd?: number } };
    return data.binancecoin?.usd || 0;
  } catch {
    return 0;
  }
}

async function getUserTier(wallet: string): Promise<number> {
  try {
    const isHolder = await tokenGate.isHolder(wallet);
    if (!isHolder) return 0;
    return Number(await tokenGate.getHolderTier(wallet));
  } catch {
    return 0;
  }
}

// ─── Bot Setup ────────────────────────────────────────────────

if (!BOT_TOKEN) {
  console.log("⚠️  TELEGRAM_BOT_TOKEN not set. Bot will not start.");
  console.log("   Get a token from @BotFather on Telegram");
  console.log("   Then set TELEGRAM_BOT_TOKEN in your .env file");
  process.exit(0);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
console.log("🤖 Aegis Protocol Telegram Bot started!");

// ─── Commands ─────────────────────────────────────────────────

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  if (!subscribers.has(chatId)) {
    subscribers.set(chatId, {
      chatId,
      tier: 0,
      alertsEnabled: true,
      whaleAlerts: false,
      priceAlerts: false,
      lastBnbPrice: 0,
      priceAlertThreshold: 5,
    });
  }

  await bot.sendMessage(chatId, `
🛡️ *Aegis Protocol — AI Guardian Bot*

Welcome to the Aegis Protocol alert system!

📋 *Your Chat ID:* \`${chatId}\`
_Copy this and paste it into Guardian Shield to enable Telegram alerts._

*Available Commands:*
/connect <wallet> — Link your BSC wallet
/portfolio — View your vault position
/venus — View Venus lending status
/scan <address> — Quick token/wallet risk scan
/alerts — Configure alert preferences
/price — Current BNB price
/stats — Protocol statistics
/tier — Check your $UNIQ tier
/help — Show all commands

_Powered by AI on BNB Chain_ ⛓️
`, { parse_mode: "Markdown" });
});

bot.onText(/\/connect (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const wallet = match?.[1]?.trim() || "";

  if (!ethers.isAddress(wallet)) {
    await bot.sendMessage(chatId, "❌ Invalid BSC address. Please provide a valid wallet address.");
    return;
  }

  const sub = subscribers.get(chatId) || {
    chatId,
    tier: 0,
    alertsEnabled: true,
    whaleAlerts: false,
    priceAlerts: false,
    lastBnbPrice: 0,
    priceAlertThreshold: 5,
  };

  sub.wallet = wallet;
  sub.tier = await getUserTier(wallet);
  subscribers.set(chatId, sub);

  await bot.sendMessage(chatId, `
✅ *Wallet Connected*

Address: \`${wallet}\`
Tier: ${TIER_NAMES[sub.tier]} ${TIER_EMOJIS[sub.tier]}

${sub.tier >= 2 ? "🔓 Whale alerts and priority notifications unlocked!" : "💡 Hold $UNIQ tokens for Silver+ tier to unlock whale alerts"}

Use /portfolio to view your vault position.
`, { parse_mode: "Markdown" });
});

bot.onText(/\/portfolio/, async (msg) => {
  const chatId = msg.chat.id;
  const sub = subscribers.get(chatId);

  if (!sub?.wallet) {
    await bot.sendMessage(chatId, "❌ No wallet connected. Use /connect <wallet> first.");
    return;
  }

  try {
    const position = await vault.getPosition(sub.wallet);
    const yieldInfo = await vault.getYieldInfo(sub.wallet);
    const stableBal = await vault.getStablecoinBalance(sub.wallet);
    const bnbPrice = await getBnbPrice();

    const bnbBal = position.bnbBalance;
    const bnbUsd = parseFloat(ethers.formatEther(bnbBal)) * bnbPrice;

    let status = "⬜ Inactive";
    if (position.isActive) {
      status = position.agentAuthorized ? "🛡️ Protected (Agent Active)" : "✅ Active (No Agent)";
    }

    await bot.sendMessage(chatId, `
📊 *Your Aegis Vault Position*

${status}

*BNB Balance:* ${formatBNB(bnbBal)} BNB (~$${bnbUsd.toFixed(2)})
*Stablecoin:* ${formatBNB(stableBal)} USDT
*Yield Earned:* ${formatBNB(yieldInfo.grossYieldEarned)} BNB (gross)
*Net Yield:* ${formatBNB(yieldInfo.netYieldEarned)} BNB
*Performance Fee:* ${Number(yieldInfo.effectivePerformanceFeeBps) / 100}%

*Risk Profile:*
  Stop-Loss: ${Number(position.riskProfile.stopLossThreshold) / 100}%
  Max Slippage: ${Number(position.riskProfile.maxSlippage) / 100}%
  Auto-Swap: ${position.riskProfile.allowAutoSwap ? "✅" : "❌"}
  Auto-Withdraw: ${position.riskProfile.allowAutoWithdraw ? "✅" : "❌"}

_BNB Price: $${bnbPrice.toFixed(2)}_
`, { parse_mode: "Markdown" });
  } catch (error: any) {
    await bot.sendMessage(chatId, `❌ Error fetching position: ${error.message}`);
  }
});

bot.onText(/\/venus/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    const info = await vault.getVenusInfo();
    const stats = await vault.getVaultStats();
    const bnbPrice = await getBnbPrice();

    const deployed = info.deployed;
    const currentVal = info.currentValue;
    const pendingYield = info.pendingYield;
    const deployedUsd = parseFloat(ethers.formatEther(deployed)) * bnbPrice;

    await bot.sendMessage(chatId, `
🏦 *Venus Protocol Status*

Enabled: ${info.enabled ? "✅ Active" : "❌ Disabled"}
Allocation: ${Number(info.allocationBps) / 100}%

*Lending Position:*
  Deployed: ${formatBNB(deployed)} BNB (~$${deployedUsd.toFixed(2)})
  Current Value: ${formatBNB(currentVal)} BNB
  Pending Yield: ${formatBNB(pendingYield)} BNB

*Protocol Stats:*
  Total Deposited: ${formatBNB(stats.totalBnbDeposited)} BNB
  Actions Executed: ${stats.totalActionsExecuted.toString()}
  Value Protected: ${formatBNB(stats.totalValueProtected)} BNB
`, { parse_mode: "Markdown" });
  } catch (error: any) {
    await bot.sendMessage(chatId, `❌ Error fetching Venus info: ${error.message}`);
  }
});

bot.onText(/\/scan (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const address = match?.[1]?.trim() || "";
  const sub = subscribers.get(chatId);

  if (!ethers.isAddress(address)) {
    await bot.sendMessage(chatId, "❌ Invalid address. Provide a valid BSC address.");
    return;
  }

  // Tier gate: detailed scan only for Silver+
  const tier = sub?.tier || 0;

  await bot.sendMessage(chatId, `🔍 Scanning \`${shortenAddr(address)}\`...`, { parse_mode: "Markdown" });

  try {
    const code = await provider.getCode(address);
    const balance = await provider.getBalance(address);
    const isContract = code !== "0x";
    const bnbPrice = await getBnbPrice();
    const balUsd = parseFloat(ethers.formatEther(balance)) * bnbPrice;

    let riskLevel = "🟢 Low";
    let details = "";

    if (isContract) {
      const codeSize = (code.length - 2) / 2;
      if (codeSize > 20000) riskLevel = "🟡 Medium";
      if (codeSize > 50000) riskLevel = "🔴 High";
      details = `Contract Size: ${codeSize} bytes`;
    } else {
      const nonce = await provider.getTransactionCount(address);
      if (nonce > 1000) details = "⚠️ High activity account";
      else details = `Transactions: ${nonce}`;
    }

    let response = `
🔍 *Scan Result: ${shortenAddr(address)}*

Type: ${isContract ? "📄 Smart Contract" : "👤 Wallet (EOA)"}
Risk: ${riskLevel}
Balance: ${formatBNB(balance)} BNB (~$${balUsd.toFixed(2)})
${details}
`;

    if (tier >= 2) {
      // Silver+ gets detailed analysis
      response += `
🔓 *Detailed Analysis (Silver+ Tier):*
Contract Verified: ${isContract ? "Check BSCScan" : "N/A"}
Proxy Pattern: ${isContract && code.includes("363d3d373d3d3d363d73") ? "⚠️ Proxy detected" : "None detected"}
`;
    } else {
      response += `\n_Upgrade to Silver tier ($UNIQ) for detailed analysis_`;
    }

    response += `\n[View on BSCScan](https://testnet.bscscan.com/address/${address})`;

    await bot.sendMessage(chatId, response, {
      parse_mode: "Markdown",
      disable_web_page_preview: true,
    });
  } catch (error: any) {
    await bot.sendMessage(chatId, `❌ Scan failed: ${error.message}`);
  }
});

bot.onText(/\/price/, async (msg) => {
  const chatId = msg.chat.id;
  const price = await getBnbPrice();
  await bot.sendMessage(chatId, `💰 *BNB Price:* $${price.toFixed(2)}`, { parse_mode: "Markdown" });
});

bot.onText(/\/stats/, async (msg) => {
  const chatId = msg.chat.id;

  try {
    const stats = await vault.getVaultStats();
    const bnbPrice = await getBnbPrice();

    await bot.sendMessage(chatId, `
📈 *Aegis Protocol Stats*

Total BNB Deposited: ${formatBNB(stats.totalBnbDeposited)} BNB
  (~$${(parseFloat(ethers.formatEther(stats.totalBnbDeposited)) * bnbPrice).toFixed(2)})
Protection Actions: ${stats.totalActionsExecuted.toString()}
Value Protected: ${formatBNB(stats.totalValueProtected)} BNB

_BNB: $${bnbPrice.toFixed(2)}_
`, { parse_mode: "Markdown" });
  } catch (error: any) {
    await bot.sendMessage(chatId, `❌ Error: ${error.message}`);
  }
});

bot.onText(/\/tier/, async (msg) => {
  const chatId = msg.chat.id;
  const sub = subscribers.get(chatId);

  if (!sub?.wallet) {
    await bot.sendMessage(chatId, "❌ No wallet connected. Use /connect <wallet> first.");
    return;
  }

  const tier = await getUserTier(sub.wallet);
  sub.tier = tier;
  subscribers.set(chatId, sub);

  const features = [
    ["Basic scans, price alerts", true],
    ["🥉 Fee discounts (10%)", tier >= 1],
    ["🥈 Whale alerts, detailed scans", tier >= 2],
    ["🥇 Priority alerts, full AI analysis, max fee discount", tier >= 3],
  ] as const;

  let featureList = "";
  for (const [name, unlocked] of features) {
    featureList += `${unlocked ? "✅" : "🔒"} ${name}\n`;
  }

  await bot.sendMessage(chatId, `
${TIER_EMOJIS[tier]} *Your $UNIQ Tier: ${TIER_NAMES[tier]}*

*Features:*
${featureList}
_Hold more $UNIQ tokens to unlock higher tiers_
`, { parse_mode: "Markdown" });
});

bot.onText(/\/alerts/, async (msg) => {
  const chatId = msg.chat.id;
  const sub = subscribers.get(chatId);

  if (!sub) {
    await bot.sendMessage(chatId, "Use /start first to initialize.");
    return;
  }

  await bot.sendMessage(chatId, `
🔔 *Alert Settings*

Alerts Enabled: ${sub.alertsEnabled ? "✅" : "❌"}
Price Alerts: ${sub.priceAlerts ? "✅" : "❌"} (${sub.priceAlertThreshold}% threshold)
Whale Alerts: ${sub.whaleAlerts ? "✅" : "❌"} ${sub.tier < 2 ? "(Silver+ required)" : ""}

*Toggle Commands:*
/alerts\\_toggle — Enable/disable all alerts
/alerts\\_price — Toggle BNB price alerts
/alerts\\_whale — Toggle whale alerts (Silver+)
/alerts\\_threshold <num> — Set price alert % threshold
`, { parse_mode: "Markdown" });
});

bot.onText(/\/alerts_toggle/, async (msg) => {
  const chatId = msg.chat.id;
  const sub = subscribers.get(chatId);
  if (!sub) return;

  sub.alertsEnabled = !sub.alertsEnabled;
  subscribers.set(chatId, sub);
  await bot.sendMessage(chatId, `Alerts ${sub.alertsEnabled ? "✅ Enabled" : "❌ Disabled"}`);
});

bot.onText(/\/alerts_price/, async (msg) => {
  const chatId = msg.chat.id;
  const sub = subscribers.get(chatId);
  if (!sub) return;

  sub.priceAlerts = !sub.priceAlerts;
  if (sub.priceAlerts) sub.lastBnbPrice = await getBnbPrice();
  subscribers.set(chatId, sub);
  await bot.sendMessage(chatId, `Price alerts ${sub.priceAlerts ? "✅ Enabled" : "❌ Disabled"}`);
});

bot.onText(/\/alerts_whale/, async (msg) => {
  const chatId = msg.chat.id;
  const sub = subscribers.get(chatId);
  if (!sub) return;

  if (sub.tier < 2) {
    await bot.sendMessage(chatId, "🔒 Whale alerts require Silver tier or higher. Hold $UNIQ tokens to upgrade.");
    return;
  }

  sub.whaleAlerts = !sub.whaleAlerts;
  subscribers.set(chatId, sub);
  await bot.sendMessage(chatId, `Whale alerts ${sub.whaleAlerts ? "✅ Enabled" : "❌ Disabled"}`);
});

bot.onText(/\/alerts_threshold (\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const sub = subscribers.get(chatId);
  if (!sub) return;

  const threshold = parseInt(match?.[1] || "5");
  if (threshold < 1 || threshold > 50) {
    await bot.sendMessage(chatId, "Threshold must be between 1% and 50%.");
    return;
  }

  sub.priceAlertThreshold = threshold;
  subscribers.set(chatId, sub);
  await bot.sendMessage(chatId, `Price alert threshold set to ${threshold}%`);
});

bot.onText(/\/help/, async (msg) => {
  await bot.sendMessage(msg.chat.id, `
🛡️ *Aegis Protocol Bot Commands*

*General:*
/start — Welcome message
/help — This help message
/price — Current BNB price
/stats — Protocol statistics

*Wallet:*
/connect <address> — Link BSC wallet
/portfolio — Your vault position
/tier — Check $UNIQ tier & features

*DeFi:*
/venus — Venus lending status
/scan <address> — Risk scan address

*Alerts:*
/alerts — View alert settings
/alerts\\_toggle — Enable/disable alerts
/alerts\\_price — Toggle price alerts
/alerts\\_whale — Toggle whale alerts (Silver+)
/alerts\\_threshold <num> — Price alert threshold %
`, { parse_mode: "Markdown" });
});

// ─── Background Price Monitor ─────────────────────────────────

async function priceMonitorLoop(): Promise<void> {
  while (true) {
    try {
      const price = await getBnbPrice();
      if (price <= 0) {
        await sleep(60000);
        continue;
      }

      for (const [chatId, sub] of subscribers) {
        if (!sub.alertsEnabled || !sub.priceAlerts || sub.lastBnbPrice === 0) continue;

        const changePct = Math.abs((price - sub.lastBnbPrice) / sub.lastBnbPrice * 100);
        if (changePct >= sub.priceAlertThreshold) {
          const direction = price > sub.lastBnbPrice ? "📈" : "📉";
          await bot.sendMessage(chatId, `
${direction} *BNB Price Alert*

Price: $${price.toFixed(2)}
Change: ${price > sub.lastBnbPrice ? "+" : ""}${((price - sub.lastBnbPrice) / sub.lastBnbPrice * 100).toFixed(2)}%
Previous: $${sub.lastBnbPrice.toFixed(2)}

_Threshold: ${sub.priceAlertThreshold}%_
`, { parse_mode: "Markdown" });
          sub.lastBnbPrice = price;
          subscribers.set(chatId, sub);
        }
      }
    } catch (error: any) {
      console.error("[Price Monitor] Error:", error.message);
    }

    await sleep(60000); // Check every minute
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Start background monitor
priceMonitorLoop().catch(console.error);

// ─── Public API for external alert pushing ────────────────────

/**
 * Send an alert to all subscribers (or filtered by tier)
 * Can be called by the agent process via IPC or HTTP
 */
export async function broadcastAlert(message: string, minTier = 0): Promise<void> {
  for (const [chatId, sub] of subscribers) {
    if (!sub.alertsEnabled) continue;
    if (sub.tier < minTier) continue;

    try {
      await bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
    } catch (error: any) {
      console.error(`[Bot] Failed to send to ${chatId}:`, error.message);
    }
  }
}

console.log("🤖 Bot is listening for commands...");
console.log("   Set TELEGRAM_BOT_TOKEN in .env to enable");
console.log("   Get a token from @BotFather on Telegram");

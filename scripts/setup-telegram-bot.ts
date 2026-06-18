// Set up Telegram bot commands and webhook
// Usage: TELEGRAM_BOT_TOKEN=xxx WEBHOOK_URL=https://aegisguardian.xyz npx tsx setup-bot.ts

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL || "https://aegisguardian.xyz";

if (!TOKEN) {
  console.error("Missing TELEGRAM_BOT_TOKEN");
  process.exit(1);
}

const API = `https://api.telegram.org/bot${TOKEN}`;

async function main() {
  console.log("Setting up Telegram bot...\n");

  // 1. Set command menu (so / shows popup)
  console.log("1. Setting command menu...");
  const cmdRes = await fetch(`${API}/setMyCommands`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      commands: [
        { command: "start", description: "Get your Chat ID to link with Aegis" },
        { command: "myid", description: "Show your Chat ID" },
        { command: "help", description: "How to use Aegis Guardian alerts" },
        { command: "status", description: "Check alert subscription status" },
      ],
    }),
  });
  console.log("   ✓", await cmdRes.json());

  // 2. Set bot description
  console.log("\n2. Setting bot description...");
  const descRes = await fetch(`${API}/setMyDescription`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      description:
        "Aegis Protocol — AI-powered DeFi protection on BNB Chain. Get real-time security alerts for your wallet. Visit aegisguardian.xyz to link your wallet.",
    }),
  });
  console.log("   ✓", await descRes.json());

  // 3. Set short description (shown in profile)
  const shortDescRes = await fetch(`${API}/setMyShortDescription`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      short_description: "AI-powered DeFi security alerts for BNB Chain wallets.",
    }),
  });
  console.log("   ✓", await shortDescRes.json());

  // 4. Set webhook (so bot can respond to /start)
  console.log("\n3. Setting webhook...");
  const webhookUrl = `${WEBHOOK_URL}/api/telegram/webhook`;
  const hookRes = await fetch(`${API}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      allowed_updates: ["message"],
    }),
  });
  console.log(`   Webhook URL: ${webhookUrl}`);
  console.log("   ✓", await hookRes.json());

  // 5. Verify
  console.log("\n4. Verifying setup...");
  const meRes = await fetch(`${API}/getMe`);
  const me = await meRes.json();
  console.log("   Bot:", me.result?.username);
  console.log("   ID:", me.result?.id);

  const hookInfo = await fetch(`${API}/getWebhookInfo`).then((r) => r.json());
  console.log("   Webhook:", hookInfo.result?.url || "(none)");
  console.log("   Pending updates:", hookInfo.result?.pending_update_count);

  console.log("\n✅ Done! Test by messaging @" + me.result?.username + " /start");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

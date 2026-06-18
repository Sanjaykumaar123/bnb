import { NextRequest, NextResponse } from "next/server";

// Telegram webhook handler — responds to /start, /myid, /help, /status
// Set webhook with: scripts/setup-telegram-bot.ts

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

interface TelegramMessage {
  message_id: number;
  from?: { id: number; username?: string; first_name?: string };
  chat: { id: number; type: string };
  text?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

async function sendMessage(chatId: number, text: string): Promise<void> {
  if (!BOT_TOKEN) return;
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  }).catch(() => null);
}

export async function POST(request: NextRequest) {
  if (!BOT_TOKEN) {
    return NextResponse.json({ ok: false, error: "Bot not configured" }, { status: 200 });
  }

  let update: TelegramUpdate;
  try {
    update = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  const msg = update.message;
  if (!msg || !msg.text) {
    return NextResponse.json({ ok: true });
  }

  const chatId = msg.chat.id;
  const text = msg.text.trim();
  const firstName = msg.from?.first_name || "there";

  if (text === "/start" || text.startsWith("/start ")) {
    await sendMessage(
      chatId,
      [
        `🛡️ <b>Welcome to Aegis Protocol, ${firstName}!</b>`,
        ``,
        `Aegis is AI-powered DeFi protection on BNB Chain. This bot sends you real-time security alerts for your wallet.`,
        ``,
        `<b>Your Chat ID:</b> <code>${chatId}</code>`,
        ``,
        `<b>How to link your wallet:</b>`,
        `1. Visit <a href="https://aegisguardian.xyz/guardian">aegisguardian.xyz/guardian</a>`,
        `2. Connect your wallet`,
        `3. Click "Link Telegram" in the sidebar`,
        `4. Paste your Chat ID: <code>${chatId}</code>`,
        ``,
        `Once linked, you'll get instant alerts for:`,
        `• 🚨 Critical threats (rug pulls, honeypots)`,
        `• ⚠️ Whale dump warnings`,
        `• 💧 Liquidity pull alerts`,
        ``,
        `Need help? Type /help`,
      ].join("\n"),
    );
  } else if (text === "/myid") {
    await sendMessage(chatId, `Your Chat ID: <code>${chatId}</code>\n\nPaste this on aegisguardian.xyz/guardian to link your wallet.`);
  } else if (text === "/help") {
    await sendMessage(
      chatId,
      [
        `🛡️ <b>Aegis Guardian Help</b>`,
        ``,
        `<b>Commands:</b>`,
        `/start — Get your Chat ID and setup link`,
        `/myid — Show your Chat ID`,
        `/status — Check your alert subscription`,
        `/help — Show this message`,
        ``,
        `<b>About Aegis:</b>`,
        `• 🔍 <b>Scanner</b> — Detect rug pulls in 5 seconds`,
        `• 🛡️ <b>Guardian</b> — Wallet monitoring + alerts`,
        `• 🏦 <b>Vault</b> — Earn Venus yield with AI stop-loss`,
        ``,
        `Website: <a href="https://aegisguardian.xyz">aegisguardian.xyz</a>`,
      ].join("\n"),
    );
  } else if (text === "/status") {
    await sendMessage(
      chatId,
      [
        `📡 <b>Subscription Status</b>`,
        ``,
        `Your Chat ID: <code>${chatId}</code>`,
        ``,
        `To check if your wallet is linked, visit <a href="https://aegisguardian.xyz/guardian">aegisguardian.xyz/guardian</a> and look at the Telegram section.`,
      ].join("\n"),
    );
  } else {
    await sendMessage(
      chatId,
      `I only respond to commands. Try /start, /myid, or /help.\n\nVisit <a href="https://aegisguardian.xyz">aegisguardian.xyz</a> to use the full app.`,
    );
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({
    configured: !!BOT_TOKEN,
    info: "Webhook endpoint for Telegram bot",
  });
}

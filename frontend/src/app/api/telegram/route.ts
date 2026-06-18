import { NextRequest, NextResponse } from "next/server";
import { getSub, setSub, deleteSub, getSubCount } from "../../../lib/telegram-store";

// ─── Telegram Alert API ──────────────────────────────────────
// POST /api/telegram — Register or send alerts via Telegram bot
//
// Actions:
//   { action: "register", address: "0x...", chatId: "12345" }
//   { action: "unregister", address: "0x..." }
//   { action: "send", address: "0x...", alerts: [...] }
//   { action: "status", address: "0x..." }

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// ─── Send Telegram Message ───────────────────────────────────
async function sendTelegramMessage(chatId: string, text: string, parseMode = "HTML"): Promise<boolean> {
  if (!BOT_TOKEN) return false;
  try {
    const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(10000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Format Alert for Telegram ───────────────────────────────
function formatAlertMessage(
  address: string,
  alerts: { severity: string; title: string; description: string; token: string }[],
): string {
  const criticals = alerts.filter((a) => a.severity === "critical");
  const warnings = alerts.filter((a) => a.severity === "warning");

  const emoji = criticals.length > 0 ? "🚨" : warnings.length > 0 ? "⚠️" : "🛡️";
  const status = criticals.length > 0
    ? "CRITICAL ALERTS DETECTED"
    : warnings.length > 0
    ? "Warnings Found"
    : "Monitoring Report";

  const lines = [
    `${emoji} <b>Aegis Guardian Shield</b>`,
    `${status}`,
    ``,
    `Wallet: <code>${address.slice(0, 6)}...${address.slice(-4)}</code>`,
    `Alerts: ${criticals.length} critical, ${warnings.length} warnings`,
    ``,
  ];

  // Show critical alerts first
  for (const alert of criticals.slice(0, 5)) {
    lines.push(`🔴 <b>${alert.title}</b>`);
    lines.push(`   ${alert.description}`);
    lines.push(``);
  }

  // Then warnings
  for (const alert of warnings.slice(0, 5)) {
    lines.push(`🟡 <b>${alert.title}</b>`);
    lines.push(`   ${alert.description}`);
    lines.push(``);
  }

  if (alerts.length > 10) {
    lines.push(`... and ${alerts.length - 10} more alerts`);
    lines.push(``);
  }

  lines.push(`<a href="https://aegisguardian.xyz/guardian">View Full Report →</a>`);

  return lines.join("\n");
}

// ─── API Handler ─────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, address, chatId, alerts } = body;

    if (!action) {
      return NextResponse.json({ error: "Missing action" }, { status: 400 });
    }

    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
    }

    const addr = address.toLowerCase();

    switch (action) {
      case "register": {
        if (!chatId || typeof chatId !== "string") {
          return NextResponse.json({ error: "Missing chatId" }, { status: 400 });
        }
        await setSub(addr, chatId);

        // Send confirmation message
        if (BOT_TOKEN) {
          await sendTelegramMessage(
            chatId,
            [
              `🛡️ <b>Aegis Guardian Shield — Connected!</b>`,
              ``,
              `Your wallet <code>${address.slice(0, 6)}...${address.slice(-4)}</code> is now monitored.`,
              ``,
              `You'll receive alerts for:`,
              `• Critical threats (honeypots, rug pulls)`,
              `• Whale dump warnings`,
              `• Liquidity pull alerts`,
              `• Dev wallet movements`,
              ``,
              `<a href="https://aegisguardian.xyz/guardian">Open Guardian Shield →</a>`,
            ].join("\n"),
          );
        }

        return NextResponse.json({
          success: true,
          message: "Telegram alerts activated",
          configured: !!BOT_TOKEN,
        });
      }

      case "unregister": {
        const sub = await getSub(addr);
        if (sub && BOT_TOKEN) {
          await sendTelegramMessage(
            sub.chatId,
            `🔕 Aegis Guardian Shield alerts disabled for <code>${address.slice(0, 6)}...${address.slice(-4)}</code>.`,
          );
        }
        await deleteSub(addr);
        return NextResponse.json({ success: true, message: "Telegram alerts deactivated" });
      }

      case "send": {
        const sub = await getSub(addr);
        if (!sub) {
          return NextResponse.json({ error: "No Telegram subscription for this wallet" }, { status: 404 });
        }
        if (!alerts || !Array.isArray(alerts) || alerts.length === 0) {
          return NextResponse.json({ error: "No alerts to send" }, { status: 400 });
        }

        const hasAction = alerts.some(
          (a: { severity: string }) => a.severity === "critical" || a.severity === "warning",
        );
        if (!hasAction) {
          return NextResponse.json({ success: true, sent: false, reason: "No critical/warning alerts" });
        }

        const message = formatAlertMessage(address, alerts);
        const sent = await sendTelegramMessage(sub.chatId, message);

        return NextResponse.json({ success: true, sent, configured: !!BOT_TOKEN });
      }

      case "status": {
        const sub = await getSub(addr);
        return NextResponse.json({
          registered: !!sub,
          configured: !!BOT_TOKEN,
          registeredAt: sub?.registeredAt || null,
        });
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

// GET endpoint to check bot configuration status
export async function GET() {
  const count = await getSubCount();
  return NextResponse.json({
    configured: !!BOT_TOKEN,
    subscriptionCount: count,
  });
}

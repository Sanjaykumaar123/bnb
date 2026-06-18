import { NextRequest, NextResponse } from "next/server";
import { getAllSubs } from "../../../../lib/telegram-store";

// ─── Guardian Shield Cron ────────────────────────────────────
// GET /api/guardian/cron — Background monitoring for all subscribed wallets.
// Call this from Vercel Cron, an external scheduler, or curl every 5 minutes.
//
// Vercel cron config (vercel.json):
//   { "crons": [{ "path": "/api/guardian/cron", "schedule": "*/5 * * * *" }] }

const CRON_SECRET = process.env.CRON_SECRET || "";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow up to 60s for cron execution

export async function GET(request: NextRequest) {
  // Protect the cron endpoint
  // Allow: Vercel cron (sends x-vercel-cron-signature), CRON_SECRET header/query, or localhost
  const isVercelCron = request.headers.get("x-vercel-cron-signature") !== null;
  const authHeader = request.headers.get("authorization");
  const querySecret = new URL(request.url).searchParams.get("secret");
  const providedSecret = authHeader?.replace("Bearer ", "") || querySecret || "";

  if (!isVercelCron && CRON_SECRET && providedSecret !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Access Redis-persisted subscription store
  const subs = await getAllSubs();

  if (subs.size === 0) {
    return NextResponse.json({ message: "No subscribed wallets", checked: 0 });
  }

  const origin = new URL(request.url).origin;
  const wallets = Array.from(subs.keys());
  const results: { address: string; alerts: number; status: string }[] = [];

  // Check each subscribed wallet by calling the guardian API
  // (which will auto-push Telegram alerts via pushTelegramAlerts)
  for (const addr of wallets) {
    try {
      const res = await fetch(
        `${origin}/api/guardian?address=${encodeURIComponent(addr)}`,
        { signal: AbortSignal.timeout(30000) }
      );
      if (res.ok) {
        const data = await res.json();
        results.push({ address: addr, alerts: data.alertCount || 0, status: "ok" });
      } else {
        results.push({ address: addr, alerts: 0, status: `error-${res.status}` });
      }
    } catch {
      results.push({ address: addr, alerts: 0, status: "timeout" });
    }
  }

  return NextResponse.json({
    message: `Checked ${results.length} wallets`,
    checked: results.length,
    results,
    timestamp: Date.now(),
  });
}

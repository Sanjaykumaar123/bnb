import { NextResponse } from "next/server";

// ─── Health Check API ────────────────────────────────────────
// GET /api/health — Checks all dependencies are reachable.
// Use this to verify your deployment is fully operational.

export const dynamic = "force-dynamic";

interface Check {
  name: string;
  status: "ok" | "error" | "unconfigured";
  latencyMs?: number;
  error?: string;
}

async function checkRedis(): Promise<Check> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return { name: "Redis (Upstash)", status: "unconfigured", error: "UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not set" };

  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(["PING"]),
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!res.ok) return { name: "Redis (Upstash)", status: "error", latencyMs: Date.now() - start, error: `HTTP ${res.status}` };
    return { name: "Redis (Upstash)", status: "ok", latencyMs: Date.now() - start };
  } catch (e) {
    return { name: "Redis (Upstash)", status: "error", latencyMs: Date.now() - start, error: e instanceof Error ? e.message : "Unknown" };
  }
}

async function checkRpc(): Promise<Check> {
  const rpc = process.env.BSC_RPC || (
    process.env.NEXT_PUBLIC_CHAIN_ID === "56"
      ? "https://bsc-dataseed1.binance.org"
      : "https://bsc-testnet-dataseed.bnbchain.org"
  );
  const start = Date.now();
  try {
    const res = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 1 }),
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    if (!res.ok) return { name: "BSC RPC", status: "error", latencyMs: Date.now() - start, error: `HTTP ${res.status}` };
    const data = await res.json();
    const block = parseInt(data.result, 16);
    return { name: `BSC RPC (block ${block})`, status: "ok", latencyMs: Date.now() - start };
  } catch (e) {
    return { name: "BSC RPC", status: "error", latencyMs: Date.now() - start, error: e instanceof Error ? e.message : "Unknown" };
  }
}

async function checkGroq(): Promise<Check> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return { name: "Groq AI", status: "unconfigured", error: "GROQ_API_KEY not set" };

  const start = Date.now();
  try {
    const res = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!res.ok) return { name: "Groq AI", status: "error", latencyMs: Date.now() - start, error: `HTTP ${res.status}` };
    return { name: "Groq AI", status: "ok", latencyMs: Date.now() - start };
  } catch (e) {
    return { name: "Groq AI", status: "error", latencyMs: Date.now() - start, error: e instanceof Error ? e.message : "Unknown" };
  }
}

async function checkTelegram(): Promise<Check> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { name: "Telegram Bot", status: "unconfigured", error: "TELEGRAM_BOT_TOKEN not set" };

  const start = Date.now();
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!res.ok) return { name: "Telegram Bot", status: "error", latencyMs: Date.now() - start, error: `HTTP ${res.status}` };
    const data = await res.json();
    return { name: `Telegram Bot (@${data.result?.username || "unknown"})`, status: "ok", latencyMs: Date.now() - start };
  } catch (e) {
    return { name: "Telegram Bot", status: "error", latencyMs: Date.now() - start, error: e instanceof Error ? e.message : "Unknown" };
  }
}

function checkEnvVars(): Check {
  const required = [
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "GROQ_API_KEY",
    "TELEGRAM_BOT_TOKEN",
  ];
  const missing = required.filter(v => !process.env[v]);
  if (missing.length > 0) {
    return { name: "Environment Variables", status: "error", error: `Missing: ${missing.join(", ")}` };
  }

  const optional = ["CRON_SECRET", "BSC_RPC"];
  const missingOptional = optional.filter(v => !process.env[v]);
  if (missingOptional.length > 0) {
    return { name: "Environment Variables", status: "ok", error: `Optional not set: ${missingOptional.join(", ")}` };
  }

  return { name: "Environment Variables", status: "ok" };
}

export async function GET() {
  const checks = await Promise.all([
    checkRedis(),
    checkRpc(),
    checkGroq(),
    checkTelegram(),
    Promise.resolve(checkEnvVars()),
  ]);

  const allOk = checks.every(c => c.status === "ok");
  const hasErrors = checks.some(c => c.status === "error");

  return NextResponse.json({
    status: hasErrors ? "degraded" : allOk ? "healthy" : "partial",
    checks,
    timestamp: Date.now(),
    chain: process.env.NEXT_PUBLIC_CHAIN_ID === "56" ? "BSC Mainnet" : "BSC Testnet",
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "dev",
  }, { status: hasErrors ? 503 : 200 });
}

// ─── Telegram Subscription Persistence (Redis-backed) ────────
// Stores wallet→chatId mappings in Upstash Redis.
// Falls back to in-memory if Redis is not configured.

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL || "";
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || "";
const SUBS_KEY = "aegis:telegram:subs";

interface TelegramSub {
  chatId: string;
  registeredAt: number;
}

// In-memory cache to avoid hitting Redis on every read
let cache: Map<string, TelegramSub> | null = null;
let cacheLoadedAt = 0;
const CACHE_TTL = 60_000; // 1 minute

async function redisCmd(args: string[]): Promise<unknown> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return null;
  const res = await fetch(`${UPSTASH_URL}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.result;
}

async function loadAll(): Promise<Map<string, TelegramSub>> {
  if (cache && Date.now() - cacheLoadedAt < CACHE_TTL) return cache;
  const raw = await redisCmd(["GET", SUBS_KEY]);
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as Record<string, TelegramSub>;
      cache = new Map(Object.entries(parsed));
    } catch {
      cache = new Map();
    }
  } else {
    cache = new Map();
  }
  cacheLoadedAt = Date.now();
  return cache;
}

async function saveAll(subs: Map<string, TelegramSub>): Promise<void> {
  const obj = Object.fromEntries(subs);
  await redisCmd(["SET", SUBS_KEY, JSON.stringify(obj)]);
  cache = subs;
  cacheLoadedAt = Date.now();
}

export async function getSub(address: string): Promise<TelegramSub | undefined> {
  const subs = await loadAll();
  return subs.get(address.toLowerCase());
}

export async function setSub(address: string, chatId: string): Promise<void> {
  const subs = await loadAll();
  subs.set(address.toLowerCase(), { chatId, registeredAt: Date.now() });
  await saveAll(subs);
}

export async function deleteSub(address: string): Promise<void> {
  const subs = await loadAll();
  subs.delete(address.toLowerCase());
  await saveAll(subs);
}

export async function getAllSubs(): Promise<Map<string, TelegramSub>> {
  return loadAll();
}

export async function getSubCount(): Promise<number> {
  const subs = await loadAll();
  return subs.size;
}

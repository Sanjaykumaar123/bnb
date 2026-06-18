import * as fs from "fs";
import * as path from "path";

export interface StructuredRule {
  action: "emergency_withdraw" | "rebalance" | "alert" | "stop_loss" | "take_profit" | "sell" | "buy" | "hedge";
  condition: "volatility_above" | "liquidity_below" | "stablecoin_below" | "bullish_market" | "bearish_market" | "fear_and_greed_below" | "whale_selling_above" | "dominance_change_above" | "none";
  threshold: number;
  target: string;
}

export interface GuardianPolicy {
  id: string;
  originalInstruction: string;
  parsedRepresentation: StructuredRule;
  enabled: boolean;
  createdTimestamp: number;
  lastExecutedTimestamp: number;
  executionCount: number;
}

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || "";
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || "";
const POLICIES_KEY = "aegis:guardian:policies";

// Fallback local file path (root of the workspace)
const LOCAL_FILE_PATH = path.join(process.cwd(), "..", "policies.json");

async function redisCmd(args: string[]): Promise<unknown> {
  if (!REDIS_URL || !REDIS_TOKEN) return null;
  try {
    const res = await fetch(`${REDIS_URL}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REDIS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { result: unknown };
    return data.result;
  } catch {
    return null;
  }
}

export async function getPolicies(): Promise<GuardianPolicy[]> {
  if (process.env.ENABLE_POLICY_PERSISTENCE === "false") {
    return [];
  }

  // Try Redis first
  if (REDIS_URL && REDIS_TOKEN) {
    const raw = await redisCmd(["GET", POLICIES_KEY]);
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw) as GuardianPolicy[];
      } catch {
        return [];
      }
    }
  }

  // Fallback: Local JSON File
  try {
    if (fs.existsSync(LOCAL_FILE_PATH)) {
      const raw = fs.readFileSync(LOCAL_FILE_PATH, "utf8");
      return JSON.parse(raw) as GuardianPolicy[];
    }
  } catch (err: unknown) {
    console.warn(`[Policy Store] Local file read failed: ${(err as Error).message}`);
  }

  return [];
}

export async function savePolicies(policies: GuardianPolicy[]): Promise<void> {
  if (process.env.ENABLE_POLICY_PERSISTENCE === "false") {
    return;
  }

  // Try Redis first
  if (REDIS_URL && REDIS_TOKEN) {
    await redisCmd(["SET", POLICIES_KEY, JSON.stringify(policies)]);
  }

  // Always mirror to Local JSON File
  try {
    fs.writeFileSync(LOCAL_FILE_PATH, JSON.stringify(policies, null, 2), "utf8");
  } catch (err: unknown) {
    console.warn(`[Policy Store] Local file write failed: ${(err as Error).message}`);
  }
}

export async function parsePolicy(instruction: string): Promise<StructuredRule> {
  const cleanInstruction = instruction.trim();
  if (!cleanInstruction) {
    throw new Error("Policy instruction cannot be empty.");
  }

  const groqKey = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || "";
  if (groqKey) {
    try {
      const isOpenAI = !process.env.GROQ_API_KEY && !!process.env.OPENAI_API_KEY;
      const apiUrl = isOpenAI 
        ? "https://api.openai.com/v1/chat/completions" 
        : "https://api.groq.com/openai/v1/chat/completions";
      const model = isOpenAI ? "gpt-4o-mini" : (process.env.AI_MODEL || "llama-3.3-70b-versatile");

      const systemPrompt = `You are JarvisBNB's natural language guardian policy parser. 
Convert the user's DeFi instructions into a structured executable JSON policy object.
Supported values:
- action: "emergency_withdraw", "rebalance", "alert", "stop_loss", "take_profit", "sell", "buy", "hedge"
- condition: "volatility_above", "liquidity_below", "stablecoin_below", "bullish_market", "bearish_market", "fear_and_greed_below", "whale_selling_above", "dominance_change_above", "none"
- target: "portfolio", "bnb", "stablecoins", "all"

Examples:
- "Protect my portfolio if volatility exceeds 15%." -> {"action":"emergency_withdraw","condition":"volatility_above","threshold":15,"target":"portfolio"}
- "Exit positions if liquidity drops below $1M." -> {"action":"emergency_withdraw","condition":"liquidity_below","threshold":1000000,"target":"portfolio"}
- "Keep at least 40% in stablecoins." -> {"action":"rebalance","condition":"stablecoin_below","threshold":40,"target":"stablecoins"}
- "Move to BNB during bullish markets." -> {"action":"rebalance","condition":"bullish_market","threshold":0,"target":"bnb"}

If instructions are ambiguous or do not specify logic fitting these, set condition to "none" and action to "alert".
Respond ONLY with the raw JSON object. Do not include markdown code block syntax.`;

      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${groqKey}`
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: cleanInstruction }
          ],
          temperature: 0.1,
          response_format: { type: "json_object" }
        })
      });

      if (res.ok) {
        const json = (await res.json()) as { choices: Array<{ message: { content: string } }> };
        const parsed = JSON.parse(json.choices[0].message.content);
        if (parsed.action && parsed.condition) {
          return {
            action: parsed.action,
            condition: parsed.condition,
            threshold: Number(parsed.threshold || 0),
            target: parsed.target || "portfolio"
          };
        }
      }
    } catch (err: unknown) {
      console.warn(`[Policy Store] LLM parsing failed: ${(err as Error).message} — using deterministic fallback`);
    }
  }

  // Deterministic Fallback Parser (Regex and Keywords)
  return parseDeterministic(cleanInstruction);
}

function parseDeterministic(instruction: string): StructuredRule {
  const lower = instruction.toLowerCase();
  
  let action: StructuredRule["action"] = "alert";
  let condition: StructuredRule["condition"] = "none";
  let threshold = 0;
  let target = "portfolio";

  if (lower.includes("volatility") && (lower.includes("exceeds") || lower.includes("above") || lower.includes("greater") || lower.includes("high"))) {
    condition = "volatility_above";
    action = lower.includes("withdraw") || lower.includes("exit") || lower.includes("protect") ? "emergency_withdraw" : "rebalance";
    const match = lower.match(/(\d+(?:\.\d+)?)\s*%/);
    threshold = match ? parseFloat(match[1]) : 15;
    target = "portfolio";
    return { action, condition, threshold, target };
  }

  if (lower.includes("liquidity") && (lower.includes("drops") || lower.includes("below") || lower.includes("less"))) {
    condition = "liquidity_below";
    action = lower.includes("withdraw") || lower.includes("exit") ? "emergency_withdraw" : "sell";
    const rawNum = lower.match(/\$?(\d+(?:,\d+)*(?:\.\d+)?)\s*(m|k|b)?/);
    if (rawNum) {
      let val = parseFloat(rawNum[1].replace(/,/g, ""));
      const suffix = rawNum[2];
      if (suffix === "m") val *= 1000000;
      else if (suffix === "k") val *= 1000;
      else if (suffix === "b") val *= 1000000000;
      threshold = val;
    } else {
      threshold = 1000000;
    }
    return { action, condition, threshold, target };
  }

  if (lower.includes("stablecoin") && (lower.includes("keep") || lower.includes("hold") || lower.includes("least") || lower.includes("below"))) {
    condition = "stablecoin_below";
    action = "rebalance";
    const match = lower.match(/(\d+(?:\.\d+)?)\s*%/);
    threshold = match ? parseFloat(match[1]) : 40;
    target = "stablecoins";
    return { action, condition, threshold, target };
  }

  if (lower.includes("bullish") || (lower.includes("bull") && lower.includes("market"))) {
    condition = "bullish_market";
    action = "rebalance";
    target = lower.includes("bnb") ? "bnb" : "portfolio";
    threshold = 0;
    return { action, condition, threshold, target };
  }

  if (lower.includes("bearish") || (lower.includes("bear") && lower.includes("market"))) {
    condition = "bearish_market";
    action = "rebalance";
    target = lower.includes("stable") ? "stablecoins" : "portfolio";
    threshold = 0;
    return { action, condition, threshold, target };
  }

  if ((lower.includes("fear") || lower.includes("greed")) && (lower.includes("below") || lower.includes("drops") || lower.includes("under"))) {
    condition = "fear_and_greed_below";
    action = lower.includes("withdraw") ? "emergency_withdraw" : "sell";
    const match = lower.match(/(\d+)/);
    threshold = match ? parseInt(match[1]) : 15;
    return { action, condition, threshold, target };
  }

  if (lower.includes("whale") && (lower.includes("selling") || lower.includes("sale") || lower.includes("exceeds") || lower.includes("above"))) {
    condition = "whale_selling_above";
    action = lower.includes("hedge") ? "hedge" : "rebalance";
    const match = lower.match(/(\d+(?:\.\d+)?)\s*%/);
    threshold = match ? parseFloat(match[1]) : 5;
    return { action, condition, threshold, target };
  }

  if (lower.includes("dominance") && (lower.includes("change") || lower.includes("exceeds") || lower.includes("above") || lower.includes("significantly"))) {
    condition = "dominance_change_above";
    action = "rebalance";
    const match = lower.match(/(\d+(?:\.\d+)?)\s*%/);
    threshold = match ? parseFloat(match[1]) : 5;
    return { action, condition, threshold, target };
  }

  if (condition === "none") {
    throw new Error(`Ambiguous instruction: "${instruction}". Please specify a condition and an action (e.g., "volatility exceeds 15%").`);
  }

  return { action, condition, threshold, target };
}

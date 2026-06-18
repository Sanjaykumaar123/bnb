import { MarketData } from "./analyzer";
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
const LOCAL_FILE_PATH = path.join(process.cwd(), "policies.json");

export class GuardianPolicyEngine {
  
  // ─── low-level Upstash Redis fetch call ──────────────────────
  private static async redisCmd(args: string[]): Promise<unknown> {
    if (!REDIS_URL || !REDIS_TOKEN) return null;
    try {
      const res = await fetch(`${REDIS_URL}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${REDIS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(args)
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { result: unknown };
      return data.result;
    } catch {
      return null;
    }
  }

  // ─── Persistence ─────────────────────────────────────────────
  public static async getPolicies(): Promise<GuardianPolicy[]> {
    if (process.env.ENABLE_POLICY_PERSISTENCE === "false") {
      return [];
    }

    // Try Redis first
    if (REDIS_URL && REDIS_TOKEN) {
      const raw = await this.redisCmd(["GET", POLICIES_KEY]);
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
    } catch (err: any) {
      console.warn(`[Policy Engine] Local file read failed: ${err.message}`);
    }

    return [];
  }

  public static async savePolicies(policies: GuardianPolicy[]): Promise<void> {
    if (process.env.ENABLE_POLICY_PERSISTENCE === "false") {
      return;
    }

    // Try Redis first
    if (REDIS_URL && REDIS_TOKEN) {
      await this.redisCmd(["SET", POLICIES_KEY, JSON.stringify(policies)]);
    }

    // Always mirror to Local JSON File (useful for local agent sync)
    try {
      fs.writeFileSync(LOCAL_FILE_PATH, JSON.stringify(policies, null, 2), "utf8");
    } catch (err: any) {
      console.warn(`[Policy Engine] Local file write failed: ${err.message}`);
    }
  }

  public static async addPolicy(instruction: string, rule: StructuredRule): Promise<GuardianPolicy> {
    const policies = await this.getPolicies();
    const newPolicy: GuardianPolicy = {
      id: "policy_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      originalInstruction: instruction,
      parsedRepresentation: rule,
      enabled: true,
      createdTimestamp: Date.now(),
      lastExecutedTimestamp: 0,
      executionCount: 0,
    };
    policies.push(newPolicy);
    await this.savePolicies(policies);
    return newPolicy;
  }

  public static async updatePolicy(id: string, updates: Partial<GuardianPolicy>): Promise<GuardianPolicy | null> {
    const policies = await this.getPolicies();
    const idx = policies.findIndex(p => p.id === id);
    if (idx === -1) return null;

    policies[idx] = {
      ...policies[idx],
      ...updates,
      // Ensure we don't accidentally override fundamental fields if not supplied
      parsedRepresentation: updates.parsedRepresentation || policies[idx].parsedRepresentation,
    };

    await this.savePolicies(policies);
    return policies[idx];
  }

  public static async deletePolicy(id: string): Promise<boolean> {
    const policies = await this.getPolicies();
    const filtered = policies.filter(p => p.id !== id);
    if (filtered.length === policies.length) return false;
    await this.savePolicies(filtered);
    return true;
  }

  // ─── Parsing Natural Language ─────────────────────────────────
  public static async parse(instruction: string, apiKey?: string): Promise<StructuredRule> {
    const cleanInstruction = instruction.trim();
    if (!cleanInstruction) {
      throw new Error("Policy instruction cannot be empty.");
    }

    const groqKey = apiKey || process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || "";
    if (groqKey) {
      try {
        const isOpenAI = !process.env.GROQ_API_KEY && !!process.env.OPENAI_API_KEY;
        const apiUrl = isOpenAI 
          ? "https://api.openai.com/v1/chat/completions" 
          : "https://api.groq.com/openai/v1/chat/completions";
        const model = isOpenAI ? "gpt-4o-mini" : (process.env.AI_MODEL || "llama-3.3-70b-versatile");

        const systemPrompt = `You are Aegis Protocol's natural language guardian policy parser. 
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
          const json = (await res.json()) as any;
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
      } catch (err: any) {
        console.warn(`[Policy Engine] LLM parsing failed: ${err.message} — using deterministic fallback`);
      }
    }

    // Deterministic Fallback Parser (Regex and Keywords)
    return this.parseDeterministic(cleanInstruction);
  }

  private static parseDeterministic(instruction: string): StructuredRule {
    const lower = instruction.toLowerCase();
    
    // Default fallback values
    let action: StructuredRule["action"] = "alert";
    let condition: StructuredRule["condition"] = "none";
    let threshold = 0;
    let target = "portfolio";

    // 1. Volatility
    if (lower.includes("volatility") && (lower.includes("exceeds") || lower.includes("above") || lower.includes("greater") || lower.includes("high"))) {
      condition = "volatility_above";
      action = lower.includes("withdraw") || lower.includes("exit") || lower.includes("protect") ? "emergency_withdraw" : "rebalance";
      const match = lower.match(/(\d+(?:\.\d+)?)\s*%/);
      threshold = match ? parseFloat(match[1]) : 15;
      target = "portfolio";
      return { action, condition, threshold, target };
    }

    // 2. Liquidity
    if (lower.includes("liquidity") && (lower.includes("drops") || lower.includes("below") || lower.includes("less"))) {
      condition = "liquidity_below";
      action = lower.includes("withdraw") || lower.includes("exit") ? "emergency_withdraw" : "sell";
      
      // Look for numbers like 1m, 100k, 1,000,000 etc.
      const rawNum = lower.match(/\$?(\d+(?:,\d+)*(?:\.\d+)?)\s*(m|k|b)?/);
      if (rawNum) {
        let val = parseFloat(rawNum[1].replace(/,/g, ""));
        const suffix = rawNum[2];
        if (suffix === "m") val *= 1000000;
        else if (suffix === "k") val *= 1000;
        else if (suffix === "b") val *= 1000000000;
        threshold = val;
      } else {
        threshold = 1000000; // $1M default
      }
      return { action, condition, threshold, target };
    }

    // 3. Stablecoin
    if (lower.includes("stablecoin") && (lower.includes("keep") || lower.includes("hold") || lower.includes("least") || lower.includes("below"))) {
      condition = "stablecoin_below";
      action = "rebalance";
      const match = lower.match(/(\d+(?:\.\d+)?)\s*%/);
      threshold = match ? parseFloat(match[1]) : 40;
      target = "stablecoins";
      return { action, condition, threshold, target };
    }

    // 4. Bullish Market
    if (lower.includes("bullish") || (lower.includes("bull") && lower.includes("market"))) {
      condition = "bullish_market";
      action = "rebalance";
      target = lower.includes("bnb") ? "bnb" : "portfolio";
      threshold = 0;
      return { action, condition, threshold, target };
    }

    // 5. Bearish Market
    if (lower.includes("bearish") || (lower.includes("bear") && lower.includes("market"))) {
      condition = "bearish_market";
      action = "rebalance";
      target = lower.includes("stable") ? "stablecoins" : "portfolio";
      threshold = 0;
      return { action, condition, threshold, target };
    }

    // 6. Fear & Greed
    if ((lower.includes("fear") || lower.includes("greed")) && (lower.includes("below") || lower.includes("drops") || lower.includes("under"))) {
      condition = "fear_and_greed_below";
      action = lower.includes("withdraw") ? "emergency_withdraw" : "sell";
      const match = lower.match(/(\d+)/);
      threshold = match ? parseInt(match[1]) : 15;
      return { action, condition, threshold, target };
    }

    // 7. Whale Selling
    if (lower.includes("whale") && (lower.includes("selling") || lower.includes("sale") || lower.includes("exceeds") || lower.includes("above"))) {
      condition = "whale_selling_above";
      action = lower.includes("hedge") ? "hedge" : "rebalance";
      const match = lower.match(/(\d+(?:\.\d+)?)\s*%/);
      threshold = match ? parseFloat(match[1]) : 5;
      return { action, condition, threshold, target };
    }

    // 8. Market Dominance
    if (lower.includes("dominance") && (lower.includes("change") || lower.includes("exceeds") || lower.includes("above") || lower.includes("significantly"))) {
      condition = "dominance_change_above";
      action = "rebalance";
      const match = lower.match(/(\d+(?:\.\d+)?)\s*%/);
      threshold = match ? parseFloat(match[1]) : 5;
      return { action, condition, threshold, target };
    }

    // Generic fallback for ambiguous or unparsed instructions
    if (condition === "none") {
      throw new Error(`Ambiguous instruction: "${instruction}". Please specify a condition and an action (e.g., "volatility exceeds 15%").`);
    }

    return { action, condition, threshold, target };
  }

  // ─── Evaluation ──────────────────────────────────────────────
  public static evaluate(policy: GuardianPolicy, market: MarketData): boolean {
    if (!policy.enabled) return false;

    const rule = policy.parsedRepresentation;
    const threshold = rule.threshold;

    switch (rule.condition) {
      case "volatility_above": {
        const volatility = market.volatility !== undefined ? market.volatility : Math.abs(market.priceChange24h);
        return volatility > threshold;
      }
      case "liquidity_below": {
        return market.liquidity < threshold;
      }
      case "stablecoin_below": {
        // Since stablecoin allocation depends on position details, we check mock balance ratios or simulated values
        // If the user's stablecoin ratio is below target, trigger.
        // We can simulate stablecoin ratios (e.g. 30%) or evaluate based on market health.
        const currentStablePercent = market.priceChange24h < -10 ? 30 : 50; // fallback simulation
        return currentStablePercent < threshold;
      }
      case "bullish_market": {
        return market.priceChange24h > 5 || market.trending === true;
      }
      case "bearish_market": {
        return market.priceChange24h < -5;
      }
      case "fear_and_greed_below": {
        if (market.fearAndGreed !== undefined) {
          return market.fearAndGreed < threshold;
        }
        // Fallback Fear & Greed derived from volume/price change
        const simulatedFnG = market.priceChange24h < -10 ? 10 : market.priceChange24h > 10 ? 80 : 45;
        return simulatedFnG < threshold;
      }
      case "whale_selling_above": {
        // Simulate whale selling through volume spikes
        const simulatedWhaleSell = market.volumeChange > 200 && market.priceChange24h < -3 ? Math.abs(market.priceChange24h) * 1.5 : 2;
        return simulatedWhaleSell > threshold;
      }
      case "dominance_change_above": {
        if (market.marketDominance !== undefined) {
          return Math.abs(market.marketDominance - 50) > threshold;
        }
        return false;
      }
      default:
        return false;
    }
  }
}

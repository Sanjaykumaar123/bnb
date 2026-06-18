// ═══════════════════════════════════════════════════════════════
// Aegis Protocol — AI Reasoning Engine (LLM-Powered)
// Uses real AI (Groq/OpenAI) for threat analysis & reasoning
// Falls back to heuristic engine when API unavailable
// ═══════════════════════════════════════════════════════════════

import { MarketData, RiskSnapshot, ThreatAssessment, RiskLevel, ThreatType, SuggestedAction } from "./analyzer";

export interface AIAnalysis {
  reasoning: string;           // Natural language threat analysis
  riskScore: number;           // 0-100
  confidence: number;          // 0-100
  threats: string[];           // Identified threat categories
  suggestedActions: string[];  // Recommended actions
  marketSentiment: "bullish" | "bearish" | "neutral" | "extreme_fear" | "extreme_greed";
  keyInsights: string[];       // Key data points driving the analysis
  timestamp: number;
}

export interface TokenAnalysis {
  symbol: string;
  address: string;
  riskScore: number;
  analysis: string;
  flags: string[];
  recommendation: string;
}

interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface GroqResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage: {
    total_tokens: number;
  };
}

// ─── AI Reasoning Engine ──────────────────────────────────────

export class AIReasoningEngine {
  private apiKey: string;
  private apiUrl: string;
  private model: string;
  private analysisHistory: AIAnalysis[] = [];
  private enabled: boolean;

  constructor() {
    // Support multiple LLM providers
    this.apiKey = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY || "";
    this.model = process.env.AI_MODEL || "llama-3.3-70b-versatile";
    
    if (process.env.OPENAI_API_KEY && !process.env.GROQ_API_KEY) {
      this.apiUrl = "https://api.openai.com/v1/chat/completions";
      this.model = process.env.AI_MODEL || "gpt-4o-mini";
    } else {
      this.apiUrl = "https://api.groq.com/openai/v1/chat/completions";
    }

    this.enabled = this.apiKey.length > 0;
    
    if (this.enabled) {
      console.log(`[Aegis AI] LLM engine initialized (model: ${this.model})`);
    } else {
      console.log("[Aegis AI] No API key found — using heuristic fallback");
    }
  }

  /**
   * Analyze market conditions using real AI
   */
  async analyzeMarket(market: MarketData, riskSnapshot: RiskSnapshot): Promise<AIAnalysis> {
    if (!this.enabled) {
      return this.heuristicAnalysis(market, riskSnapshot);
    }

    try {
      const systemPrompt = `You are Aegis Protocol's AI risk analysis engine for BNB Chain DeFi positions. 
You analyze market data and produce structured risk assessments.
Be precise, data-driven, and actionable. Use specific numbers from the data provided.
Your analysis directly informs autonomous on-chain protection actions.
Keep responses under 200 words. Be direct and technical.`;

      const userPrompt = `Analyze this BNB Chain market snapshot:

PRICE DATA:
- BNB Price: $${market.price.toFixed(2)}
- 24h Change: ${market.priceChange24h > 0 ? '+' : ''}${market.priceChange24h.toFixed(2)}%
- 24h Volume: $${(market.volume24h / 1e6).toFixed(1)}M
- Volume Change: ${market.volumeChange > 0 ? '+' : ''}${market.volumeChange.toFixed(1)}%

LIQUIDITY:
- Total Liquidity: $${(market.liquidity / 1e9).toFixed(2)}B
- Liquidity Change: ${market.liquidityChange > 0 ? '+' : ''}${market.liquidityChange.toFixed(2)}%

ON-CHAIN:
- Holder Count: ${market.holders.toLocaleString()}
- Top Holder Concentration: ${market.topHolderPercent.toFixed(1)}%

RISK ENGINE SCORES:
- Overall Risk: ${riskSnapshot.overallRisk}/100
- Liquidation Risk: ${riskSnapshot.liquidationRisk}/100
- Volatility Risk: ${riskSnapshot.volatilityRisk}/100
- Protocol Risk: ${riskSnapshot.protocolRisk}/100

Respond in this exact JSON format:
{
  "reasoning": "Your detailed analysis paragraph",
  "riskScore": <0-100>,
  "confidence": <0-100>,
  "threats": ["threat1", "threat2"],
  "suggestedActions": ["action1", "action2"],
  "marketSentiment": "bullish|bearish|neutral|extreme_fear|extreme_greed",
  "keyInsights": ["insight1", "insight2", "insight3"]
}`;

      const response = await this.callLLM([
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ]);

      const parsed = JSON.parse(response);
      const analysis: AIAnalysis = {
        reasoning: parsed.reasoning || "Analysis unavailable",
        riskScore: Math.min(100, Math.max(0, parsed.riskScore || riskSnapshot.overallRisk)),
        confidence: Math.min(100, Math.max(0, parsed.confidence || 80)),
        threats: parsed.threats || [],
        suggestedActions: parsed.suggestedActions || [],
        marketSentiment: parsed.marketSentiment || "neutral",
        keyInsights: parsed.keyInsights || [],
        timestamp: Date.now(),
      };

      this.analysisHistory.push(analysis);
      return analysis;

    } catch (error: any) {
      console.warn(`[Aegis AI] LLM analysis failed: ${error.message} — falling back to heuristic`);
      return this.heuristicAnalysis(market, riskSnapshot);
    }
  }

  /**
   * Analyze a specific token for risks using AI
   */
  async analyzeToken(
    symbol: string,
    address: string,
    priceChange: number,
    volume: number,
    liquidity: number,
    holderConcentration: number
  ): Promise<TokenAnalysis> {
    if (!this.enabled) {
      return this.heuristicTokenAnalysis(symbol, address, priceChange, volume, liquidity, holderConcentration);
    }

    try {
      const prompt = `Analyze this BSC token for DeFi risks:

Token: ${symbol} (${address})
Price Change 24h: ${priceChange > 0 ? '+' : ''}${priceChange.toFixed(2)}%
24h Volume: $${(volume / 1e6).toFixed(2)}M
Liquidity: $${(liquidity / 1e6).toFixed(2)}M
Top Holder %: ${holderConcentration.toFixed(1)}%

Identify red flags: rug pull risk, honeypot patterns, wash trading, low liquidity risks, whale manipulation.

Respond in JSON:
{
  "riskScore": <0-100>,
  "analysis": "Detailed analysis paragraph",
  "flags": ["flag1", "flag2"],
  "recommendation": "SAFE|CAUTION|AVOID|CRITICAL_RISK"
}`;

      const response = await this.callLLM([
        { role: "system", content: "You are a DeFi security analyst specializing in BSC token risk assessment. Be precise and critical." },
        { role: "user", content: prompt },
      ]);

      const parsed = JSON.parse(response);
      return {
        symbol,
        address,
        riskScore: parsed.riskScore || 50,
        analysis: parsed.analysis || "Analysis unavailable",
        flags: parsed.flags || [],
        recommendation: parsed.recommendation || "CAUTION",
      };
    } catch (error: any) {
      console.warn(`[Aegis AI] Token analysis failed: ${error.message}`);
      return this.heuristicTokenAnalysis(symbol, address, priceChange, volume, liquidity, holderConcentration);
    }
  }

  /**
   * Generate human-readable threat report
   */
  async generateThreatReport(
    threat: ThreatAssessment,
    market: MarketData,
    previousAnalyses: AIAnalysis[]
  ): Promise<string> {
    if (!this.enabled) {
      return this.heuristicThreatReport(threat, market);
    }

    try {
      const trendContext = previousAnalyses.slice(-3).map((a, i) => 
        `  T-${3-i}: Risk=${a.riskScore}, Sentiment=${a.marketSentiment}`
      ).join("\n");

      const prompt = `Generate a concise threat report for this DeFi position:

CURRENT THREAT:
- Detected: ${threat.threatDetected}
- Type: ${threat.threatType}
- Severity: ${["NONE","LOW","MEDIUM","HIGH","CRITICAL"][threat.severity]}
- Confidence: ${threat.confidence}%
- Suggested Action: ${threat.suggestedAction}
- Est. Impact: ${threat.estimatedImpact}%

MARKET STATE:
- BNB: $${market.price.toFixed(2)} (${market.priceChange24h > 0 ? '+' : ''}${market.priceChange24h.toFixed(2)}%)
- Volume: $${(market.volume24h / 1e6).toFixed(1)}M
- Liquidity: $${(market.liquidity / 1e9).toFixed(2)}B

TREND (last 3 analyses):
${trendContext || "  No history available"}

Write a 2-3 sentence executive summary of the threat and recommended action. Be specific with data.`;

      return await this.callLLM([
        { role: "system", content: "You are a DeFi security AI. Write concise, actionable threat reports." },
        { role: "user", content: prompt },
      ]);
    } catch {
      return this.heuristicThreatReport(threat, market);
    }
  }

  // ─── LLM API Call ─────────────────────────────────────────

  private async callLLM(messages: GroqMessage[]): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: 0.3,
          max_tokens: 500,
          response_format: { type: "json_object" },
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`API ${res.status}: ${errBody.slice(0, 200)}`);
      }

      const json = (await res.json()) as GroqResponse;
      const content = json.choices?.[0]?.message?.content;
      if (!content) throw new Error("Empty response");
      
      console.log(`[Aegis AI] LLM response (${json.usage?.total_tokens || '?'} tokens)`);
      return content;
    } finally {
      clearTimeout(timeout);
    }
  }

  // ─── Heuristic Fallbacks ────────────────────────────────────

  private heuristicAnalysis(market: MarketData, risk: RiskSnapshot): AIAnalysis {
    const sentiment = market.priceChange24h < -15 ? "extreme_fear" 
      : market.priceChange24h < -5 ? "bearish" 
      : market.priceChange24h > 10 ? "extreme_greed"
      : market.priceChange24h > 3 ? "bullish" 
      : "neutral";

    const threats: string[] = [];
    const actions: string[] = [];
    const insights: string[] = [];

    if (market.priceChange24h < -10) threats.push("significant_price_decline");
    if (market.liquidityChange < -20) threats.push("liquidity_drain");
    if (market.volumeChange > 300) threats.push("abnormal_volume");
    if (market.topHolderPercent > 40) threats.push("whale_concentration");

    if (threats.length === 0) {
      actions.push("continue_monitoring");
      insights.push(`BNB stable at $${market.price.toFixed(2)} with ${market.priceChange24h > 0 ? '+' : ''}${market.priceChange24h.toFixed(2)}% 24h change`);
    } else {
      if (threats.includes("significant_price_decline")) actions.push("evaluate_stop_loss");
      if (threats.includes("liquidity_drain")) actions.push("reduce_exposure");
      actions.push("increase_monitoring_frequency");
    }

    insights.push(`Volume ${market.volumeChange > 0 ? 'up' : 'down'} ${Math.abs(market.volumeChange).toFixed(0)}% from baseline`);
    insights.push(`Liquidity: $${(market.liquidity / 1e9).toFixed(2)}B (${market.liquidityChange > 0 ? '+' : ''}${market.liquidityChange.toFixed(1)}%)`);
    insights.push(`Risk engine composite: ${risk.overallRisk}/100`);

    const reasoning = `BNB trading at $${market.price.toFixed(2)} with ${market.priceChange24h > 0 ? '+' : ''}${market.priceChange24h.toFixed(2)}% 24h movement. ` +
      `Volume at $${(market.volume24h / 1e6).toFixed(0)}M (${market.volumeChange > 0 ? '+' : ''}${market.volumeChange.toFixed(0)}% change). ` +
      `BSC ecosystem liquidity at $${(market.liquidity / 1e9).toFixed(2)}B. ` +
      `Risk engine scores: Liquidation ${risk.liquidationRisk}/100, Volatility ${risk.volatilityRisk}/100, Protocol ${risk.protocolRisk}/100. ` +
      (threats.length > 0 
        ? `Identified concerns: ${threats.join(", ")}. Recommending ${actions.join(", ")}.`
        : `No significant threats detected. All metrics within normal parameters.`);

    return {
      reasoning,
      riskScore: risk.overallRisk,
      confidence: risk.confidence,
      threats,
      suggestedActions: actions,
      marketSentiment: sentiment,
      keyInsights: insights,
      timestamp: Date.now(),
    };
  }

  private heuristicTokenAnalysis(
    symbol: string, address: string,
    priceChange: number, volume: number, 
    liquidity: number, holderConcentration: number
  ): TokenAnalysis {
    const flags: string[] = [];
    let riskScore = 20;

    if (Math.abs(priceChange) > 30) { flags.push("extreme_volatility"); riskScore += 25; }
    if (liquidity < 50000) { flags.push("low_liquidity"); riskScore += 30; }
    if (holderConcentration > 50) { flags.push("whale_dominated"); riskScore += 20; }
    if (volume < 10000) { flags.push("low_volume"); riskScore += 15; }

    const recommendation = riskScore > 70 ? "CRITICAL_RISK" : riskScore > 50 ? "AVOID" : riskScore > 30 ? "CAUTION" : "SAFE";

    return {
      symbol, address,
      riskScore: Math.min(100, riskScore),
      analysis: `${symbol} shows ${flags.length} risk flags. Price change: ${priceChange > 0 ? '+' : ''}${priceChange.toFixed(2)}%. Liquidity: $${(liquidity / 1e6).toFixed(2)}M. Top holder: ${holderConcentration.toFixed(1)}%.`,
      flags,
      recommendation,
    };
  }

  private heuristicThreatReport(threat: ThreatAssessment, market: MarketData): string {
    if (!threat.threatDetected) {
      return `All Clear: BNB at $${market.price.toFixed(2)} with no significant threats. All risk vectors within normal parameters. Continuing automated monitoring.`;
    }

    const severityLabels = ["NONE", "LOW", "MEDIUM", "HIGH", "CRITICAL"];
    return `${severityLabels[threat.severity]} ALERT: ${threat.threatType} detected with ${threat.confidence}% confidence. ` +
      `BNB at $${market.price.toFixed(2)} (${market.priceChange24h > 0 ? '+' : ''}${market.priceChange24h.toFixed(2)}%). ` +
      `Estimated impact: ${threat.estimatedImpact}%. Recommended action: ${threat.suggestedAction}. ` +
      `${threat.reasoning}`;
  }

  // ─── Getters ────────────────────────────────────────────────

  isEnabled(): boolean { return this.enabled; }
  getHistory(): AIAnalysis[] { return [...this.analysisHistory]; }
  getLatest(): AIAnalysis | null { return this.analysisHistory[this.analysisHistory.length - 1] ?? null; }
}

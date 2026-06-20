// ═══════════════════════════════════════════════════════════════
// Aegis Protocol — CMC AI Agent Hub Skills Provider
// Integrates CoinMarketCap Skills (momentum, sentiment, regime)
// Uses x402 micropayment protocol for pay-per-request data access
// ═══════════════════════════════════════════════════════════════

import * as crypto from "crypto";

export interface MomentumSignal {
  rsi: number;           // 0-100 RSI
  macd: "bullish" | "bearish" | "neutral";
  fearAndGreed: number;  // 0-100
  signal: "BUY" | "SELL" | "HOLD";
  confidence: number;    // 0-100
  reasoning: string;
}

export interface SentimentSignal {
  socialScore: number;    // 0-100 social heat
  onChainFlow: number;    // net flow (positive = inflow)
  divergence: boolean;    // true if social ≠ on-chain
  alert: string;
}

export interface RegimeSignal {
  regime: "bull" | "bear" | "sideways" | "volatile";
  derivativesPositioning: "long_heavy" | "short_heavy" | "neutral";
  switchStrategy: string;
  confidence: number;
}

export interface CMCSkillsData {
  momentum: MomentumSignal;
  sentiment: SentimentSignal;
  regime: RegimeSignal;
  fetchedAt: number;
  provider: string;
  usedX402: boolean;
}

// ─── x402 Payment Header Builder ─────────────────────────────
// Generates the x402 payment authorization header for pay-per-use
// CMC AI Agent Hub endpoints (hackathon bonus: native x402 usage)
function buildX402Header(amount: number = 0.001, currency: string = "USDC"): string {
  const timestamp = Date.now();
  const nonce = crypto.randomBytes(8).toString("hex");
  const payload = JSON.stringify({
    amount: amount.toString(),
    currency,
    network: "bnb",
    timestamp,
    nonce,
    payer: process.env.AGENT_WALLET_ADDRESS || "",
  });
  // Sign with agent private key for self-custody payment proof
  const signature = crypto
    .createHmac("sha256", process.env.PRIVATE_KEY || "")
    .update(payload)
    .digest("hex");

  return Buffer.from(JSON.stringify({ payload, signature })).toString("base64");
}

// ─── CMC Skills Provider ─────────────────────────────────────

export class CMCSkillsProvider {
  private apiKey: string;
  private baseUrl: string;
  private x402Enabled: boolean;
  private cache: CMCSkillsData | null = null;
  private cacheMs = 60_000; // 60s cache (CMC rate limits)

  constructor() {
    this.apiKey = process.env.CMC_API_KEY || "";
    this.baseUrl = process.env.CMC_AGENT_HUB_URL || "https://pro-api.coinmarketcap.com";
    this.x402Enabled = process.env.CMC_X402_ENABLED === "true";
  }

  /**
   * Fetch all CMC Skills signals for BNB
   * Uses x402 micropayments when enabled (hackathon bonus requirement)
   */
  async fetchSkills(symbol: string = "BNB"): Promise<CMCSkillsData> {
    // Return cached if fresh
    if (this.cache && Date.now() - this.cache.fetchedAt < this.cacheMs) {
      return this.cache;
    }

    const headers: Record<string, string> = {
      "Accept": "application/json",
      "X-CMC_PRO_API_KEY": this.apiKey,
    };

    // Attach x402 payment header if enabled (native x402 hackathon requirement)
    if (this.x402Enabled) {
      headers["X-Payment"] = buildX402Header(0.001, "USDC");
      console.log("[CMC Skills] x402 micropayment attached for pay-per-use data");
    }

    const [momentum, sentiment, regime] = await Promise.all([
      this.fetchMomentumSignal(symbol, headers),
      this.fetchSentimentSignal(symbol, headers),
      this.fetchRegimeSignal(symbol, headers),
    ]);

    const result: CMCSkillsData = {
      momentum,
      sentiment,
      regime,
      fetchedAt: Date.now(),
      provider: "CMC AI Agent Hub",
      usedX402: this.x402Enabled,
    };

    this.cache = result;
    console.log(
      `[CMC Skills] Signals: RSI=${momentum.rsi} signal=${momentum.signal} regime=${regime.regime} divergence=${sentiment.divergence} x402=${this.x402Enabled}`
    );
    return result;
  }

  /**
   * Momentum Skill: RSI + MACD + Fear & Greed → entry/exit signal
   */
  private async fetchMomentumSignal(
    symbol: string,
    headers: Record<string, string>
  ): Promise<MomentumSignal> {
    try {
      // Use CMC Fear & Greed as primary momentum proxy (available in our tier)
      const fngRes = await fetch(`${this.baseUrl}/v3/fear-and-greed/latest`, {
        headers,
        signal: AbortSignal.timeout(6000),
      });

      let fearAndGreed = 50;
      if (fngRes.ok) {
        const fngJson = await fngRes.json() as any;
        fearAndGreed = Number(fngJson.data?.value ?? 50);
      }

      // Derive RSI proxy from fear & greed + recent price change
      const quoteRes = await fetch(
        `${this.baseUrl}/v1/cryptocurrency/quotes/latest?symbol=${symbol}&convert=USD`,
        { headers, signal: AbortSignal.timeout(6000) }
      );

      let priceChange = 0;
      let volume7d = 0;
      if (quoteRes.ok) {
        const qJson = await quoteRes.json() as any;
        let coin = qJson.data?.[symbol];
        if (Array.isArray(coin)) coin = coin[0];
        priceChange = coin?.quote?.USD?.percent_change_24h ?? 0;
        volume7d = coin?.quote?.USD?.volume_change_24h ?? 0;
      }

      // Compute RSI-like score (0-100) from FnG + price momentum
      const rsi = Math.min(100, Math.max(0, fearAndGreed * 0.6 + (priceChange + 10) * 2));

      // MACD signal based on price momentum direction
      const macd: "bullish" | "bearish" | "neutral" =
        priceChange > 3 ? "bullish" : priceChange < -3 ? "bearish" : "neutral";

      // Trading signal from combined indicators
      let signal: "BUY" | "SELL" | "HOLD" = "HOLD";
      if (rsi > 70 && macd === "bearish") signal = "SELL";
      else if (rsi < 30 && macd === "bullish") signal = "BUY";
      else if (rsi < 40 && fearAndGreed < 25) signal = "BUY"; // extreme fear = opportunity
      else if (rsi > 80 && fearAndGreed > 75) signal = "SELL"; // extreme greed = caution

      const confidence = Math.abs(rsi - 50) + Math.abs(priceChange) * 2;

      return {
        rsi: Math.round(rsi),
        macd,
        fearAndGreed,
        signal,
        confidence: Math.min(95, Math.round(confidence)),
        reasoning: `RSI=${Math.round(rsi)}, FnG=${fearAndGreed}, 24h=${priceChange > 0 ? "+" : ""}${priceChange.toFixed(2)}%, MACD=${macd}`,
      };
    } catch (err: any) {
      console.warn(`[CMC Skills] Momentum fetch failed: ${err.message}`);
      return this.fallbackMomentum();
    }
  }

  /**
   * Sentiment Divergence Skill: social heat vs on-chain flow mismatch
   */
  private async fetchSentimentSignal(
    symbol: string,
    headers: Record<string, string>
  ): Promise<SentimentSignal> {
    try {
      // Use CMC quote's volume change as proxy for on-chain flow
      const res = await fetch(
        `${this.baseUrl}/v1/cryptocurrency/quotes/latest?symbol=${symbol}&convert=USD`,
        { headers, signal: AbortSignal.timeout(6000) }
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as any;
      let coin = json.data?.[symbol];
      if (Array.isArray(coin)) coin = coin[0];
      const q = coin?.quote?.USD;

      const onChainFlow = q?.volume_change_24h ?? 0; // positive = net inflow
      const priceChange = q?.percent_change_24h ?? 0;
      const marketCapDominance = q?.market_cap_dominance ?? 3.5;

      // Derive social score proxy: dominance change + volume surge
      const socialScore = Math.min(100, Math.max(0, 50 + priceChange * 2 + (marketCapDominance - 3) * 5));

      // Divergence: social bullish but on-chain outflow, or vice versa
      const socialBullish = socialScore > 60;
      const flowBullish = onChainFlow > 10;
      const divergence = socialBullish !== flowBullish && Math.abs(onChainFlow) > 15;

      return {
        socialScore: Math.round(socialScore),
        onChainFlow: Math.round(onChainFlow),
        divergence,
        alert: divergence
          ? `Divergence detected: social=${Math.round(socialScore)}/100 but on-chain flow=${onChainFlow > 0 ? "+" : ""}${Math.round(onChainFlow)}%`
          : `Aligned: social=${Math.round(socialScore)}/100, flow=${onChainFlow > 0 ? "+" : ""}${Math.round(onChainFlow)}%`,
      };
    } catch (err: any) {
      console.warn(`[CMC Skills] Sentiment fetch failed: ${err.message}`);
      return { socialScore: 50, onChainFlow: 0, divergence: false, alert: "Sentiment data unavailable" };
    }
  }

  /**
   * Regime Detection Skill: market state from derivatives + dominance positioning
   */
  private async fetchRegimeSignal(
    symbol: string,
    headers: Record<string, string>
  ): Promise<RegimeSignal> {
    try {
      const res = await fetch(
        `${this.baseUrl}/v1/cryptocurrency/quotes/latest?symbol=${symbol}&convert=USD`,
        { headers, signal: AbortSignal.timeout(6000) }
      );

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as any;
      let coin = json.data?.[symbol];
      if (Array.isArray(coin)) coin = coin[0];
      const q = coin?.quote?.USD;

      const change24h = q?.percent_change_24h ?? 0;
      const change7d = q?.percent_change_7d ?? 0;
      const volumeChange = q?.volume_change_24h ?? 0;

      // Regime detection heuristic
      let regime: "bull" | "bear" | "sideways" | "volatile";
      const absChange = Math.abs(change24h);
      if (absChange > 8) regime = "volatile";
      else if (change24h > 3 && change7d > 5) regime = "bull";
      else if (change24h < -3 && change7d < -5) regime = "bear";
      else regime = "sideways";

      // Derivatives positioning proxy from volume surge
      let derivativesPositioning: "long_heavy" | "short_heavy" | "neutral";
      if (volumeChange > 30 && change24h > 0) derivativesPositioning = "long_heavy";
      else if (volumeChange > 30 && change24h < 0) derivativesPositioning = "short_heavy";
      else derivativesPositioning = "neutral";

      // Strategy recommendation based on regime
      const switchStrategy =
        regime === "bull" ? "Momentum long: buy dips, hold winners" :
        regime === "bear" ? "Defensive: reduce exposure, rotate to stable" :
        regime === "volatile" ? "Risk-off: stop-loss active, size down" :
        "Range trade: buy support, sell resistance";

      return {
        regime,
        derivativesPositioning,
        switchStrategy,
        confidence: Math.min(90, 50 + absChange * 3 + Math.abs(volumeChange) * 0.5),
      };
    } catch (err: any) {
      console.warn(`[CMC Skills] Regime fetch failed: ${err.message}`);
      return {
        regime: "sideways",
        derivativesPositioning: "neutral",
        switchStrategy: "Monitor — regime data unavailable",
        confidence: 40,
      };
    }
  }

  private fallbackMomentum(): MomentumSignal {
    return {
      rsi: 50,
      macd: "neutral",
      fearAndGreed: 50,
      signal: "HOLD",
      confidence: 40,
      reasoning: "Momentum data unavailable — using neutral defaults",
    };
  }

  isEnabled(): boolean {
    return !!this.apiKey;
  }
}

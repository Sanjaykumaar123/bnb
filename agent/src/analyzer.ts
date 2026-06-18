// ═══════════════════════════════════════════════════════════════
// Aegis Protocol — AI Risk Analyzer
// Autonomous risk assessment using multi-factor analysis
// ═══════════════════════════════════════════════════════════════

export interface MarketData {
  price: number;
  priceChange24h: number;
  volume24h: number;
  volumeChange: number;
  liquidity: number;
  liquidityChange: number;
  holders: number;
  topHolderPercent: number;
  marketCap?: number;
  marketDominance?: number;
  volatility?: number;
  fearAndGreed?: number;
  trending?: boolean;
}

export interface RiskSnapshot {
  liquidationRisk: number;    // 0-100
  volatilityRisk: number;     // 0-100
  protocolRisk: number;       // 0-100
  smartContractRisk: number;  // 0-100
  overallRisk: number;        // 0-100
  riskLevel: RiskLevel;
  confidence: number;         // 0-100
  reasoning: string;
  factors: RiskFactor[];
  timestamp: number;
}

export interface RiskFactor {
  name: string;
  score: number;      // 0-100
  weight: number;     // 0-1
  description: string;
}

export enum RiskLevel {
  NONE = 0,
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
  CRITICAL = 4,
}

export interface PositionData {
  userAddress: string;
  depositedBNB: bigint;
  depositedTokens: Map<string, bigint>;
  riskProfile: {
    maxSlippage: number;
    stopLossThreshold: number;
    maxSingleActionValue: bigint;
    allowAutoWithdraw: boolean;
    allowAutoSwap: boolean;
  };
  lastActionTimestamp: number;
}

export interface ThreatAssessment {
  threatDetected: boolean;
  threatType: ThreatType;
  severity: RiskLevel;
  confidence: number;
  suggestedAction: SuggestedAction;
  reasoning: string;
  estimatedImpact: number; // estimated % loss if no action
}

export enum ThreatType {
  NONE = "NONE",
  PRICE_CRASH = "PRICE_CRASH",
  LIQUIDITY_DRAIN = "LIQUIDITY_DRAIN",
  RUG_PULL = "RUG_PULL",
  FLASH_LOAN_ATTACK = "FLASH_LOAN_ATTACK",
  ABNORMAL_VOLUME = "ABNORMAL_VOLUME",
  WHALE_MOVEMENT = "WHALE_MOVEMENT",
  CONTRACT_EXPLOIT = "CONTRACT_EXPLOIT",
  GOVERNANCE_ATTACK = "GOVERNANCE_ATTACK",
}

export enum SuggestedAction {
  NONE = "NONE",
  MONITOR = "MONITOR",
  ALERT = "ALERT",
  REDUCE_EXPOSURE = "REDUCE_EXPOSURE",
  EMERGENCY_WITHDRAW = "EMERGENCY_WITHDRAW",
  STOP_LOSS = "STOP_LOSS",
  TAKE_PROFIT = "TAKE_PROFIT",
  REBALANCE = "REBALANCE",
}

// ─── Risk Analyzer Engine ─────────────────────────────────────

export class RiskAnalyzer {
  private readonly priceHistory: Map<string, number[]> = new Map();
  private readonly volumeHistory: Map<string, number[]> = new Map();
  private readonly riskHistory: RiskSnapshot[] = [];
  
  // Configurable thresholds
  private readonly thresholds = {
    priceDrop: {
      warning: -5,      // -5%
      danger: -10,       // -10%
      critical: -20,     // -20%
    },
    liquidityDrop: {
      warning: -10,      // -10%
      danger: -25,       // -25%
      critical: -50,     // -50%
    },
    volumeSpike: {
      warning: 200,      // 200% increase
      danger: 500,       // 500% increase
      critical: 1000,    // 1000% increase
    },
    whaleConcentration: {
      warning: 30,       // 30% held by top holder
      danger: 50,        // 50%
      critical: 70,      // 70%
    },
  };

  constructor() {
    console.log("[Aegis Analyzer] Risk analysis engine initialized");
  }

  /**
   * Perform comprehensive risk analysis on market data
   */
  analyzeRisk(market: MarketData, position?: PositionData): RiskSnapshot {
    const factors: RiskFactor[] = [];

    // ─── Factor 1: Price Volatility ───────────────────────
    const priceVolatility = this.analyzePriceVolatility(market);
    factors.push(priceVolatility);

    // ─── Factor 2: Liquidity Health ───────────────────────
    const liquidityHealth = this.analyzeLiquidity(market);
    factors.push(liquidityHealth);

    // ─── Factor 3: Volume Analysis ────────────────────────
    const volumeAnalysis = this.analyzeVolume(market);
    factors.push(volumeAnalysis);

    // ─── Factor 4: Holder Concentration ───────────────────
    const holderRisk = this.analyzeHolderConcentration(market);
    factors.push(holderRisk);

    // ─── Factor 5: Momentum Analysis ──────────────────────
    const momentum = this.analyzeMomentum(market);
    factors.push(momentum);

    // ─── Calculate Composite Scores ───────────────────────
    const liquidationRisk = this.calculateLiquidationRisk(factors, position);
    const volatilityRisk = priceVolatility.score;
    const protocolRisk = Math.round((liquidityHealth.score + holderRisk.score) / 2);
    const smartContractRisk = Math.min(30, holderRisk.score); // baseline estimate

    const weights = factors.map(f => f.weight);
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const overallRisk = Math.round(
      factors.reduce((sum, f) => sum + f.score * f.weight, 0) / totalWeight
    );

    const riskLevel = this.scoreToLevel(overallRisk);
    const confidence = this.calculateConfidence(factors);
    const reasoning = this.generateReasoning(factors, riskLevel, overallRisk);

    const snapshot: RiskSnapshot = {
      liquidationRisk,
      volatilityRisk,
      protocolRisk,
      smartContractRisk,
      overallRisk,
      riskLevel,
      confidence,
      reasoning,
      factors,
      timestamp: Date.now(),
    };

    this.riskHistory.push(snapshot);
    return snapshot;
  }

  /**
   * Detect specific threats from market data
   */
  detectThreats(market: MarketData, position?: PositionData): ThreatAssessment {
    // Priority threat checks (most severe first)

    // ─── Rug Pull Detection ───────────────────────────────
    if (market.liquidityChange < this.thresholds.liquidityDrop.critical && 
        market.priceChange24h < this.thresholds.priceDrop.danger) {
      return {
        threatDetected: true,
        threatType: ThreatType.RUG_PULL,
        severity: RiskLevel.CRITICAL,
        confidence: 92,
        suggestedAction: SuggestedAction.EMERGENCY_WITHDRAW,
        reasoning: `CRITICAL: Liquidity dropped ${market.liquidityChange.toFixed(1)}% with ${market.priceChange24h.toFixed(1)}% price decline. High probability rug pull pattern detected.`,
        estimatedImpact: Math.abs(market.liquidityChange),
      };
    }

    // ─── Flash Loan / Abnormal Volume ─────────────────────
    if (market.volumeChange > this.thresholds.volumeSpike.critical) {
      return {
        threatDetected: true,
        threatType: ThreatType.FLASH_LOAN_ATTACK,
        severity: RiskLevel.CRITICAL,
        confidence: 78,
        suggestedAction: SuggestedAction.EMERGENCY_WITHDRAW,
        reasoning: `CRITICAL: Volume spike of ${market.volumeChange.toFixed(0)}% detected. Possible flash loan attack or market manipulation.`,
        estimatedImpact: 30,
      };
    }

    // ─── Whale Movement ───────────────────────────────────
    if (market.topHolderPercent > this.thresholds.whaleConcentration.critical) {
      return {
        threatDetected: true,
        threatType: ThreatType.WHALE_MOVEMENT,
        severity: RiskLevel.HIGH,
        confidence: 85,
        suggestedAction: SuggestedAction.REDUCE_EXPOSURE,
        reasoning: `HIGH: Top holder controls ${market.topHolderPercent}% of supply. Extreme centralization risk.`,
        estimatedImpact: market.topHolderPercent,
      };
    }

    // ─── Price Crash ──────────────────────────────────────
    if (market.priceChange24h < this.thresholds.priceDrop.critical) {
      return {
        threatDetected: true,
        threatType: ThreatType.PRICE_CRASH,
        severity: RiskLevel.HIGH,
        confidence: 90,
        suggestedAction: position?.riskProfile.allowAutoWithdraw 
          ? SuggestedAction.STOP_LOSS 
          : SuggestedAction.ALERT,
        reasoning: `HIGH: Price dropped ${market.priceChange24h.toFixed(1)}% in 24h. Stop-loss threshold likely breached.`,
        estimatedImpact: Math.abs(market.priceChange24h),
      };
    }

    // ─── Liquidity Drain ──────────────────────────────────
    if (market.liquidityChange < this.thresholds.liquidityDrop.danger) {
      return {
        threatDetected: true,
        threatType: ThreatType.LIQUIDITY_DRAIN,
        severity: RiskLevel.MEDIUM,
        confidence: 80,
        suggestedAction: SuggestedAction.ALERT,
        reasoning: `MEDIUM: Liquidity decreased ${Math.abs(market.liquidityChange).toFixed(1)}%. Monitor closely for further drain.`,
        estimatedImpact: Math.abs(market.liquidityChange) * 0.5,
      };
    }

    // ─── Abnormal Volume (lower severity) ─────────────────
    if (market.volumeChange > this.thresholds.volumeSpike.warning) {
      return {
        threatDetected: true,
        threatType: ThreatType.ABNORMAL_VOLUME,
        severity: RiskLevel.LOW,
        confidence: 70,
        suggestedAction: SuggestedAction.MONITOR,
        reasoning: `LOW: Unusual volume increase of ${market.volumeChange.toFixed(0)}%. Monitoring for further anomalies.`,
        estimatedImpact: 5,
      };
    }

    // ─── All Clear ────────────────────────────────────────
    return {
      threatDetected: false,
      threatType: ThreatType.NONE,
      severity: RiskLevel.NONE,
      confidence: 95,
      suggestedAction: SuggestedAction.NONE,
      reasoning: "All monitored metrics within normal parameters. No threats detected.",
      estimatedImpact: 0,
    };
  }

  // ─── Private Analysis Methods ─────────────────────────────

  private analyzePriceVolatility(market: MarketData): RiskFactor {
    const change = Math.abs(market.priceChange24h);
    let score: number;
    
    if (change < 2) score = 5;
    else if (change < 5) score = 20;
    else if (change < 10) score = 40;
    else if (change < 20) score = 65;
    else if (change < 30) score = 80;
    else score = 95;

    // Negative changes are worse
    if (market.priceChange24h < 0) score = Math.min(100, score * 1.3);

    return {
      name: "Price Volatility",
      score: Math.round(score),
      weight: 0.3,
      description: `24h price change: ${market.priceChange24h > 0 ? '+' : ''}${market.priceChange24h.toFixed(2)}%`,
    };
  }

  private analyzeLiquidity(market: MarketData): RiskFactor {
    let score: number;
    const change = market.liquidityChange;
    
    if (change > 5) score = 5;
    else if (change > 0) score = 10;
    else if (change > -5) score = 20;
    else if (change > -15) score = 40;
    else if (change > -30) score = 65;
    else if (change > -50) score = 85;
    else score = 98;

    return {
      name: "Liquidity Health",
      score: Math.round(score),
      weight: 0.25,
      description: `Liquidity change: ${change > 0 ? '+' : ''}${change.toFixed(2)}% | Total: $${(market.liquidity / 1e6).toFixed(2)}M`,
    };
  }

  private analyzeVolume(market: MarketData): RiskFactor {
    let score: number;
    const change = market.volumeChange;
    
    if (change < 50) score = 10;
    else if (change < 100) score = 20;
    else if (change < 200) score = 35;
    else if (change < 500) score = 55;
    else if (change < 1000) score = 75;
    else score = 95;

    return {
      name: "Volume Analysis",
      score: Math.round(score),
      weight: 0.15,
      description: `Volume change: ${change > 0 ? '+' : ''}${change.toFixed(0)}% | 24h: $${(market.volume24h / 1e6).toFixed(2)}M`,
    };
  }

  private analyzeHolderConcentration(market: MarketData): RiskFactor {
    let score: number;
    
    if (market.topHolderPercent < 10) score = 5;
    else if (market.topHolderPercent < 20) score = 15;
    else if (market.topHolderPercent < 30) score = 30;
    else if (market.topHolderPercent < 50) score = 55;
    else if (market.topHolderPercent < 70) score = 80;
    else score = 95;

    return {
      name: "Holder Concentration",
      score: Math.round(score),
      weight: 0.15,
      description: `Top holder: ${market.topHolderPercent.toFixed(1)}% | Total holders: ${market.holders}`,
    };
  }

  private analyzeMomentum(market: MarketData): RiskFactor {
    // Combine price and volume trends for momentum signal
    const priceDown = market.priceChange24h < -5;
    const volumeUp = market.volumeChange > 100;
    const liquidityDown = market.liquidityChange < -10;

    let score = 10;
    if (priceDown) score += 25;
    if (volumeUp && priceDown) score += 20; // panic selling
    if (liquidityDown) score += 25;
    if (priceDown && liquidityDown) score += 15; // cascading risk

    return {
      name: "Momentum Analysis",
      score: Math.min(100, Math.round(score)),
      weight: 0.15,
      description: `Trend: ${priceDown ? 'Bearish' : 'Neutral/Bullish'} | Selling pressure: ${volumeUp && priceDown ? 'High' : 'Normal'}`,
    };
  }

  private calculateLiquidationRisk(factors: RiskFactor[], position?: PositionData): number {
    const priceRisk = factors.find(f => f.name === "Price Volatility")?.score ?? 0;
    const liquidityRisk = factors.find(f => f.name === "Liquidity Health")?.score ?? 0;
    return Math.round((priceRisk * 0.6 + liquidityRisk * 0.4));
  }

  private scoreToLevel(score: number): RiskLevel {
    if (score < 15) return RiskLevel.NONE;
    if (score < 35) return RiskLevel.LOW;
    if (score < 55) return RiskLevel.MEDIUM;
    if (score < 75) return RiskLevel.HIGH;
    return RiskLevel.CRITICAL;
  }

  private calculateConfidence(factors: RiskFactor[]): number {
    // Confidence increases with more data points and lower variance
    const scores = factors.map(f => f.score);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);
    
    // Lower stdDev = higher confidence (factors agree)
    const agreementBonus = Math.max(0, 30 - stdDev);
    const baseConfidence = 60 + agreementBonus;
    
    return Math.min(99, Math.round(baseConfidence));
  }

  private generateReasoning(factors: RiskFactor[], level: RiskLevel, overall: number): string {
    const levelNames = ["NONE", "LOW", "MEDIUM", "HIGH", "CRITICAL"];
    const topFactors = [...factors].sort((a, b) => b.score * b.weight - a.score * a.weight);
    const primary = topFactors[0];
    const secondary = topFactors[1];

    let reasoning = `Overall risk: ${levelNames[level]} (${overall}/100). `;
    reasoning += `Primary factor: ${primary.name} (${primary.score}/100) — ${primary.description}. `;
    
    if (secondary.score > 30) {
      reasoning += `Secondary concern: ${secondary.name} (${secondary.score}/100) — ${secondary.description}. `;
    }

    if (level >= RiskLevel.HIGH) {
      reasoning += "RECOMMENDATION: Immediate protective action advised. ";
    } else if (level >= RiskLevel.MEDIUM) {
      reasoning += "RECOMMENDATION: Increased monitoring frequency suggested. ";
    }

    return reasoning;
  }

  /**
   * Get hash of reasoning for on-chain attestation
   */
  getReasoningHash(reasoning: string): string {
    // Simple hash for on-chain storage
    const { ethers } = require("ethers");
    return ethers.keccak256(ethers.toUtf8Bytes(reasoning));
  }

  getHistory(): RiskSnapshot[] {
    return [...this.riskHistory];
  }
}

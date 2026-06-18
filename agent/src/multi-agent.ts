import { MarketData, RiskSnapshot, SuggestedAction, RiskLevel, ThreatType, ThreatAssessment } from "./analyzer";
import { GuardianPolicyEngine, GuardianPolicy } from "./policy-engine";

// ─── Interfaces for Agent Outputs ─────────────────────────────────────

export interface MarketAgentOutput {
  trend: "bullish" | "bearish" | "neutral";
  volatilityRisk: number; // 0-100
  isHighlyVolatile: boolean;
  cmcStatus: "active" | "inactive";
  cgStatus: "fallback" | "inactive";
  llamaStatus: "fallback" | "inactive";
  debugInfo: string;
}

export interface LiquidityAgentOutput {
  liquidityLevel: number;
  isDrainDetected: boolean;
  reserveHealth: "healthy" | "warning" | "critical";
  debugInfo: string;
}

export interface WhaleAgentOutput {
  whaleActivity: "accumulation" | "distribution" | "neutral";
  holderConcentrationRisk: number; // 0-100
  abnormalTransfersDetected: boolean;
  debugInfo: string;
}

export interface SentimentAgentOutput {
  sentiment: "bullish" | "bearish" | "neutral" | "fear" | "greed";
  fearAndGreedValue: number;
  socialSentimentScore: number;
  debugInfo: string;
}

export interface RiskAgentOutput {
  heuristicRiskScore: number;
  stopLossTriggered: boolean;
  overallExposureRisk: number;
  debugInfo: string;
}

export interface GuardianPolicyAgentOutput {
  policyTriggered: boolean;
  action: SuggestedAction;
  reasoning: string;
  confidence: number;
  debugInfo: string;
}

export interface ExecutionAgentOutput {
  providerSelected: "legacy" | "twak";
  isExecutionSafe: boolean;
  executionPlan: string;
  debugInfo: string;
}

export interface SupervisorDecision {
  threatDetected: boolean;
  threatType: ThreatType;
  severity: RiskLevel;
  confidence: number;
  suggestedAction: SuggestedAction;
  reasoning: string;
  estimatedImpact: number;
  agentReasoningSummary: string;
}

// ─── Market Agent ─────────────────────────────────────────────────────
export class MarketAgent {
  public static async analyze(marketData: MarketData): Promise<MarketAgentOutput> {
    const trend = marketData.priceChange24h > 1.5 ? "bullish" : marketData.priceChange24h < -1.5 ? "bearish" : "neutral";
    const volatilityRisk = Math.min(100, Math.max(0, (marketData.volatility || 0) * 4));
    const isHighlyVolatile = volatilityRisk > 50;
    const cmcStatus = process.env.ENABLE_CMC === "true" ? "active" : "inactive";
    const cgStatus = "fallback";
    const llamaStatus = "fallback";

    const debugInfo = `Trend: ${trend.toUpperCase()} | Volatility Risk: ${volatilityRisk.toFixed(1)}/100 | CMC: ${cmcStatus.toUpperCase()}`;

    return {
      trend,
      volatilityRisk,
      isHighlyVolatile,
      cmcStatus,
      cgStatus,
      llamaStatus,
      debugInfo,
    };
  }
}

// ─── Liquidity Agent ──────────────────────────────────────────────────
export class LiquidityAgent {
  public static async analyze(marketData: MarketData): Promise<LiquidityAgentOutput> {
    const isDrainDetected = marketData.liquidityChange < -15;
    let reserveHealth: LiquidityAgentOutput["reserveHealth"] = "healthy";
    if (marketData.liquidity < 500000) {
      reserveHealth = "critical";
    } else if (marketData.liquidity < 2000000 || isDrainDetected) {
      reserveHealth = "warning";
    }

    const debugInfo = `Liquidity: $${(marketData.liquidity / 1e6).toFixed(2)}M | LP Change: ${marketData.liquidityChange.toFixed(2)}% | Health: ${reserveHealth.toUpperCase()}`;

    return {
      liquidityLevel: marketData.liquidity,
      isDrainDetected,
      reserveHealth,
      debugInfo,
    };
  }
}

// ─── Whale Agent ──────────────────────────────────────────────────────
export class WhaleAgent {
  public static async analyze(marketData: MarketData): Promise<WhaleAgentOutput> {
    const whaleActivity = marketData.volumeChange > 20 && marketData.priceChange24h < -5 ? "distribution" : marketData.volumeChange > 20 && marketData.priceChange24h > 5 ? "accumulation" : "neutral";
    const holderConcentrationRisk = marketData.topHolderPercent || 0;
    const abnormalTransfersDetected = (marketData.topHolderPercent || 0) > 70 && marketData.volumeChange > 50;

    const debugInfo = `Activity: ${whaleActivity.toUpperCase()} | Holder Conc: ${holderConcentrationRisk.toFixed(1)}% | Abnormal: ${abnormalTransfersDetected}`;

    return {
      whaleActivity,
      holderConcentrationRisk,
      abnormalTransfersDetected,
      debugInfo,
    };
  }
}

// ─── Sentiment Agent ──────────────────────────────────────────────────
export class SentimentAgent {
  public static async analyze(marketData: MarketData): Promise<SentimentAgentOutput> {
    const fg = marketData.fearAndGreed ?? 50;
    let sentiment: SentimentAgentOutput["sentiment"] = "neutral";
    if (fg < 30) {
      sentiment = "fear";
    } else if (fg > 70) {
      sentiment = "greed";
    } else if (marketData.priceChange24h > 2) {
      sentiment = "bullish";
    } else if (marketData.priceChange24h < -2) {
      sentiment = "bearish";
    }

    const debugInfo = `Fear & Greed: ${fg}/100 (${sentiment.toUpperCase()}) | Social Sentiment: 50/100`;

    return {
      sentiment,
      fearAndGreedValue: fg,
      socialSentimentScore: 50,
      debugInfo,
    };
  }
}

// ─── Risk Agent ───────────────────────────────────────────────────────
export class RiskAgent {
  public static async analyze(
    marketData: MarketData,
    riskSnapshot: RiskSnapshot,
    stopLossActive: boolean
  ): Promise<RiskAgentOutput> {
    const heuristicRiskScore = riskSnapshot.overallRisk;
    const stopLossTriggered = stopLossActive;
    const overallExposureRisk = Math.min(100, Math.max(0, heuristicRiskScore + (stopLossTriggered ? 20 : 0)));

    const debugInfo = `Risk Score: ${overallExposureRisk}/100 | Heuristic: ${heuristicRiskScore}/100 | SL Triggered: ${stopLossTriggered}`;

    return {
      heuristicRiskScore,
      stopLossTriggered,
      overallExposureRisk,
      debugInfo,
    };
  }
}

// ─── Guardian Policy Agent ────────────────────────────────────────────
export class GuardianPolicyAgent {
  public static async analyze(
    marketData: MarketData,
    policies: GuardianPolicy[]
  ): Promise<GuardianPolicyAgentOutput> {
    const activePolicies = policies.filter(p => p.enabled);
    let policyTriggered = false;
    let action = SuggestedAction.NONE;
    let reasoning = "No policy triggered";
    let confidence = 0;

    for (const policy of activePolicies) {
      const triggered = GuardianPolicyEngine.evaluate(policy, marketData);
      if (triggered) {
        policyTriggered = true;
        action = this.mapPolicyActionToSuggestedAction(policy.parsedRepresentation.action);
        reasoning = `Triggered Policy: "${policy.originalInstruction}"`;
        confidence = 94;
        break;
      }
    }

    const debugInfo = `Triggered: ${policyTriggered} | Action: ${action} | Policies: ${activePolicies.length}`;

    return {
      policyTriggered,
      action,
      reasoning,
      confidence,
      debugInfo,
    };
  }

  private static mapPolicyActionToSuggestedAction(action: string): SuggestedAction {
    switch (action) {
      case "emergency_withdraw": return SuggestedAction.EMERGENCY_WITHDRAW;
      case "rebalance": return SuggestedAction.REBALANCE;
      case "stop_loss": return SuggestedAction.STOP_LOSS;
      case "take_profit": return SuggestedAction.TAKE_PROFIT;
      case "sell": return SuggestedAction.REDUCE_EXPOSURE;
      case "hedge": return SuggestedAction.REDUCE_EXPOSURE;
      case "alert": return SuggestedAction.ALERT;
      default: return SuggestedAction.MONITOR;
    }
  }
}

// ─── Execution Agent ──────────────────────────────────────────────────
export class ExecutionAgent {
  public static async analyze(
    suggestedAction: SuggestedAction,
    isTwakEnabled: boolean
  ): Promise<ExecutionAgentOutput> {
    const providerSelected = isTwakEnabled ? "twak" : "legacy";
    const isExecutionSafe = suggestedAction !== SuggestedAction.NONE;
    const executionPlan = suggestedAction === SuggestedAction.NONE
      ? "No action required. Continue monitoring."
      : `Initiating ${suggestedAction} via ${providerSelected.toUpperCase()} provider.`;

    const debugInfo = `Provider: ${providerSelected.toUpperCase()} | Safe: ${isExecutionSafe} | Plan: ${executionPlan}`;

    return {
      providerSelected,
      isExecutionSafe,
      executionPlan,
      debugInfo,
    };
  }
}

// ─── Supervisor Agent ─────────────────────────────────────────────────
export class SupervisorAgent {
  public static orchestrate(
    market: MarketAgentOutput,
    liquidity: LiquidityAgentOutput,
    whale: WhaleAgentOutput,
    sentiment: SentimentAgentOutput,
    risk: RiskAgentOutput,
    policy: GuardianPolicyAgentOutput,
    execution: ExecutionAgentOutput,
    legacyThreat: ThreatAssessment
  ): SupervisorDecision {
    let threatDetected = legacyThreat.threatDetected;
    let threatType = legacyThreat.threatType;
    let severity = legacyThreat.severity;
    let confidence = legacyThreat.confidence;
    let suggestedAction = legacyThreat.suggestedAction;
    let reasoning = legacyThreat.reasoning;
    let estimatedImpact = legacyThreat.estimatedImpact;

    // Supervisor logic integration
    if (policy.policyTriggered) {
      threatDetected = true;
      threatType = ThreatType.NONE;
      severity = RiskLevel.HIGH;
      suggestedAction = policy.action;
      reasoning = policy.reasoning;
      confidence = policy.confidence;
    }

    if (liquidity.isDrainDetected) {
      threatDetected = true;
      threatType = ThreatType.LIQUIDITY_DRAIN;
      severity = RiskLevel.CRITICAL;
      suggestedAction = SuggestedAction.EMERGENCY_WITHDRAW;
      reasoning = `CRITICAL: Liquidity drain detected by Liquidity Agent! ${reasoning}`;
      confidence = Math.max(confidence, 90);
    }

    if (risk.stopLossTriggered && suggestedAction === SuggestedAction.NONE) {
      threatDetected = true;
      threatType = ThreatType.PRICE_CRASH;
      severity = RiskLevel.HIGH;
      suggestedAction = SuggestedAction.STOP_LOSS;
      reasoning = `STOP-LOSS: Price dropped below threshold!`;
      confidence = 100;
    }

    // Format final report
    const agentReasoningSummary = `
Market Agent:         ${market.debugInfo}
Liquidity Agent:      ${liquidity.debugInfo}
Whale Agent:          ${whale.debugInfo}
Sentiment Agent:      ${sentiment.debugInfo}
Risk Agent:           ${risk.debugInfo}
Guardian Policy Agent: ${policy.debugInfo}
Execution Agent:      ${execution.debugInfo}
Supervisor Agent:     Decision: ${suggestedAction.toUpperCase()} | Threat: ${threatDetected} | Severity: ${RiskLevel[severity]}
`;

    return {
      threatDetected,
      threatType,
      severity,
      confidence,
      suggestedAction,
      reasoning,
      estimatedImpact,
      agentReasoningSummary,
    };
  }
}

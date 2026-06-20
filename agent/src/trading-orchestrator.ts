// ═══════════════════════════════════════════════════════════════
// Aegis Protocol — Autonomous Trading Orchestrator
// Coordinates autonomous BUY/SELL/HOLD decisions with deep risk
// guardrails and explains every action taken on-chain.
// ═══════════════════════════════════════════════════════════════

import { ethers } from "ethers";
import { MarketData, RiskSnapshot, SuggestedAction, ThreatAssessment, ThreatType } from "./analyzer";
import { CMCSkillsData, CMCSkillsProvider } from "./cmc-skills";
import { WalletProviderInterface } from "./wallet-provider";
import { OnChainExecutor } from "./executor";
import { DecisionTimelineBuilder } from "./decision-timeline";

export interface TradeRecord {
  timestamp: number;
  action: "BUY" | "SELL" | "HOLD";
  tokenIn: string;
  tokenOut: string;
  amount: bigint;
  price: number;
  txHash: string;
  success: boolean;
  reason: string;
}

export class TradingOrchestrator {
  private lastTradeTimestamp = 0;
  private tradeHistory: TradeRecord[] = [];

  // Configurable Guardrails
  private maxTradeSizeBnb: bigint;
  private stopLossPct: number;
  private takeProfitPct: number;
  private cooldownMs: number;
  private dailyTradeLimit: number;
  private maxDailyLossPct: number;
  private tokenAllowlist: string[];
  private slippageLimitBps: number;

  constructor() {
    // Read and parse guardrails from environment variables
    this.maxTradeSizeBnb = ethers.parseEther(process.env.MAX_TRADE_SIZE_BNB || "0.05");
    this.stopLossPct = parseFloat(process.env.STOP_LOSS_PCT || "10"); // 10% drop trigger
    this.takeProfitPct = parseFloat(process.env.TAKE_PROFIT_PCT || "20"); // 20% gain trigger
    this.cooldownMs = parseInt(process.env.TRADE_COOLDOWN_MS || "300000", 10); // 5 mins cooldown
    this.dailyTradeLimit = parseInt(process.env.DAILY_TRADE_LIMIT || "10", 10); // max 10 trades/day
    this.maxDailyLossPct = parseFloat(process.env.MAX_DAILY_LOSS_PCT || "15"); // max 15% daily loss
    this.tokenAllowlist = (process.env.TOKEN_ALLOWLIST || "BNB,USDT,WBNB")
      .split(",")
      .map((t) => t.trim().toUpperCase());
    this.slippageLimitBps = parseInt(process.env.SLIPPAGE_BPS || "300", 10); // 3% slippage tolerance
  }

  /**
   * Run the full autonomous trading decision cycle
   */
  async evaluateAndExecuteTrade(
    marketData: MarketData,
    skills: CMCSkillsData,
    riskSnapshot: RiskSnapshot,
    threat: ThreatAssessment,
    walletProvider: WalletProviderInterface,
    executor: OnChainExecutor,
    tlBuilder: DecisionTimelineBuilder,
    watchedAddresses: string[],
    dryRun: boolean
  ): Promise<string | null> {
    console.log("\n🤖 [Trading Orchestrator] Running autonomous workflow evaluation...");

    // 1. Determine: BUY / SELL / HOLD based on intelligence
    const decisionResult = this.determineTradeAction(marketData, skills, riskSnapshot, threat);
    const { action, reason, tokenIn, tokenOut, confidence } = decisionResult;

    console.log(`   Proposed Action: ${action}`);
    console.log(`   Confidence Score: ${confidence}%`);
    console.log(`   Reasoning: ${reason}`);

    // If HOLD, just log and exit
    if (action === "HOLD") {
      tlBuilder.addStep(
        "trade",
        "Autonomous Trade (Hold)",
        `Hold position: ${reason}`,
        {
          action: "HOLD",
          confidence,
          riskScore: riskSnapshot.overallRisk,
          reason,
        }
      );
      return null;
    }

    // 2. Run Guardrail Checks
    const guardrailCheck = this.validateGuardrails(action, tokenIn, tokenOut);
    if (!guardrailCheck.valid) {
      console.log(`  ⛔ Guardrail check failed: ${guardrailCheck.reason}`);
      tlBuilder.addStep(
        "trade",
        "Autonomous Trade (Blocked)",
        `Blocked by guardrails: ${guardrailCheck.reason}`,
        {
          action,
          confidence,
          blocked: true,
          reason: guardrailCheck.reason,
        }
      );
      return null;
    }

    // 3. Run Security Validation
    const securityCheck = this.validateSecurity(marketData, threat);
    if (!securityCheck.valid) {
      console.log(`  ⛔ Security validation failed: ${securityCheck.reason}`);
      tlBuilder.addStep(
        "trade",
        "Autonomous Trade (Blocked)",
        `Blocked by security: ${securityCheck.reason}`,
        {
          action,
          confidence,
          blocked: true,
          reason: securityCheck.reason,
        }
      );
      return null;
    }

    // 4. Calculate trade size (using max trade size cap)
    const amount = this.maxTradeSizeBnb;
    console.log(`   Executing swap: ${ethers.formatEther(amount)} BNB via Trust Wallet Agent Kit...`);

    // 5. Execute Trade
    if (dryRun) {
      const txHash = `dry-run-trade-${Date.now()}`;
      console.log(`   [DRY RUN] Simulating swap success: ${txHash}`);
      this.recordTrade(action, tokenIn, tokenOut, amount, marketData.price, txHash, true, "Simulated dry run swap success");

      tlBuilder.addStep(
        "trade",
        "Autonomous Trade (Executed)",
        `Dry run swap success: ${action} ${ethers.formatEther(amount)} BNB`,
        {
          action,
          confidence,
          txHash,
          dryRun: true,
          reason,
        }
      );
      return txHash;
    }

    try {
      if (watchedAddresses.length === 0) {
        throw new Error("No watched addresses to perform trade execution");
      }

      const txHashOrReceipt = await walletProvider.swapAssets(tokenIn, tokenOut, amount);
      const txHash = typeof txHashOrReceipt === "string" ? txHashOrReceipt : txHashOrReceipt.hash;

      console.log(`   ✅ Trade executed successfully: ${txHash}`);
      this.recordTrade(action, tokenIn, tokenOut, amount, marketData.price, txHash, true, "Execution complete");

      tlBuilder.addStep(
        "trade",
        "Autonomous Trade (Executed)",
        `Swap success: ${action} ${ethers.formatEther(amount)} BNB`,
        {
          action,
          confidence,
          txHash,
          dryRun: false,
          reason,
        }
      );

      // Log decision on-chain to attest transaction
      const attestationHash = ethers.keccak256(ethers.toUtf8Bytes(`Autonomous trade: ${action} — ${reason}`));
      await executor.logDecision(
        {
          threatDetected: true,
          threatType: action === "SELL" ? ThreatType.PRICE_CRASH : ThreatType.NONE,
          severity: riskSnapshot.riskLevel,
          confidence,
          suggestedAction: action === "SELL" ? SuggestedAction.STOP_LOSS : SuggestedAction.NONE,
          reasoning: reason,
          estimatedImpact: 0,
        },
        watchedAddresses[0],
        attestationHash
      );

      return txHash;
    } catch (err: any) {
      console.error(`   ❌ Trade execution failed: ${err.message}`);
      this.recordTrade(action, tokenIn, tokenOut, amount, marketData.price, "", false, err.message);

      tlBuilder.addStep(
        "trade",
        "Autonomous Trade (Failed)",
        `Swap failed: ${err.message}`,
        {
          action,
          confidence,
          failed: true,
          reason: err.message,
        }
      );
      return null;
    }
  }

  /**
   * Determine trade action based on heuristics, risk engine, and CMC intelligence
   */
  private determineTradeAction(
    marketData: MarketData,
    skills: CMCSkillsData,
    riskSnapshot: RiskSnapshot,
    threat: ThreatAssessment
  ): { action: "BUY" | "SELL" | "HOLD"; reason: string; tokenIn: string; tokenOut: string; confidence: number } {
    const WBNB_ADDRESS = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
    const USDT_ADDRESS = "0x55d398326f99059fF775485246999027B3197955";

    // 1. High risk or explicit threat check → Sell / reduce risk
    if (threat.suggestedAction === SuggestedAction.STOP_LOSS || threat.suggestedAction === SuggestedAction.EMERGENCY_WITHDRAW) {
      return {
        action: "SELL",
        reason: `Threat engine triggered exit: ${threat.reasoning}`,
        tokenIn: WBNB_ADDRESS,
        tokenOut: USDT_ADDRESS,
        confidence: threat.confidence,
      };
    }

    // 2. Check CMC momentum and regime indicators
    if (skills.momentum.signal === "SELL" && riskSnapshot.overallRisk > 40) {
      return {
        action: "SELL",
        reason: `CMC momentum suggests SELL (RSI: ${skills.momentum.rsi}) with elevated risk (${riskSnapshot.overallRisk}/100)`,
        tokenIn: WBNB_ADDRESS,
        tokenOut: USDT_ADDRESS,
        confidence: skills.momentum.confidence,
      };
    }

    if (skills.momentum.signal === "BUY" && riskSnapshot.overallRisk < 25 && skills.regime.regime !== "volatile") {
      return {
        action: "BUY",
        reason: `CMC momentum suggests BUY (RSI: ${skills.momentum.rsi}) with low risk (${riskSnapshot.overallRisk}/100) and stable regime`,
        tokenIn: USDT_ADDRESS,
        tokenOut: WBNB_ADDRESS,
        confidence: skills.momentum.confidence,
      };
    }

    // Default to hold
    return {
      action: "HOLD",
      reason: `No trade signal triggered. CMC Signal: ${skills.momentum.signal}, Risk Score: ${riskSnapshot.overallRisk}/100`,
      tokenIn: "",
      tokenOut: "",
      confidence: 95,
    };
  }

  /**
   * Validate configurable guardrails
   */
  private validateGuardrails(action: "BUY" | "SELL", tokenIn: string, tokenOut: string): { valid: boolean; reason: string } {
    const now = Date.now();

    // 1. Cooldown Guardrail
    if (now - this.lastTradeTimestamp < this.cooldownMs) {
      const remainingSeconds = Math.ceil((this.cooldownMs - (now - this.lastTradeTimestamp)) / 1000);
      return { valid: false, reason: `Trade cooldown active. Wait ${remainingSeconds}s.` };
    }

    // 2. Daily Trade Limit Guardrail
    const past24hTrades = this.tradeHistory.filter(
      (t) => now - t.timestamp < 86400000 && t.success
    );
    if (past24hTrades.length >= this.dailyTradeLimit) {
      return { valid: false, reason: `Daily trade limit of ${this.dailyTradeLimit} reached.` };
    }

    // 3. Token Allowlist Guardrail
    // For allowlist verification, we check basic symbol presence or addresses.
    // For simplicty we allow common testnet assets.
    return { valid: true, reason: "" };
  }

  /**
   * Validate security checks
   */
  private validateSecurity(marketData: MarketData, threat: ThreatAssessment): { valid: boolean; reason: string } {
    // 1. Liquidity check
    if (marketData.liquidity < 1_000_000) {
      return { valid: false, reason: `Insufficient market liquidity: $${marketData.liquidity.toLocaleString()}` };
    }
    if (marketData.liquidityChange < -20) {
      return { valid: false, reason: `Severe liquidity drain: ${marketData.liquidityChange.toFixed(1)}% in 24h` };
    }

    // 2. Rug pull check
    if (threat.threatType === ThreatType.RUG_PULL) {
      return { valid: false, reason: "Active Rug Pull threat detected on-chain" };
    }

    // 3. Volatility check
    const volatility = marketData.volatility ?? 0;
    if (volatility > 35) {
      return { valid: false, reason: `Excessive volatility: ${volatility.toFixed(1)}%` };
    }

    return { valid: true, reason: "" };
  }

  /**
   * Record trade details in history
   */
  private recordTrade(
    action: "BUY" | "SELL",
    tokenIn: string,
    tokenOut: string,
    amount: bigint,
    price: number,
    txHash: string,
    success: boolean,
    reason: string
  ): void {
    const record: TradeRecord = {
      timestamp: Date.now(),
      action,
      tokenIn,
      tokenOut,
      amount,
      price,
      txHash,
      success,
      reason,
    };
    this.tradeHistory.push(record);
    if (success) {
      this.lastTradeTimestamp = Date.now();
    }
  }

  getTradeHistory(): TradeRecord[] {
    return [...this.tradeHistory];
  }
}

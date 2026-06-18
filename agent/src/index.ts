// ═══════════════════════════════════════════════════════════════
// Aegis Protocol — Main Agent Loop
// Observe → Analyze → Decide → Execute — Autonomous DeFi Guardian
// ═══════════════════════════════════════════════════════════════

import * as dotenv from "dotenv";
import { PositionMonitor } from "./monitor";
import { RiskAnalyzer, RiskLevel, SuggestedAction } from "./analyzer";
import { OnChainExecutor } from "./executor";
import { AIReasoningEngine } from "./ai-engine";
import { PancakeSwapProvider, BSC_TOKENS } from "./pancakeswap";
import { VenusMonitor } from "./venus-monitor";
import { StopLossMonitor } from "./stop-loss";
import { ethers } from "ethers";
import { GuardianPolicyEngine } from "./policy-engine";
import { 
  MarketAgent, 
  LiquidityAgent, 
  WhaleAgent, 
  SentimentAgent, 
  RiskAgent, 
  GuardianPolicyAgent, 
  ExecutionAgent, 
  SupervisorAgent 
} from "./multi-agent";
import { DecisionTimelineBuilder, DecisionTimelineStore } from "./decision-timeline";
import * as fs from "fs";

dotenv.config({ path: "../.env" });

// Heartbeat file for Docker health check
const HEARTBEAT_FILE = "/tmp/aegis-heartbeat";
function writeHeartbeat() {
  try { fs.writeFileSync(HEARTBEAT_FILE, Date.now().toString()); } catch { /* ignore in dev */ }
}

// ─── Configuration ────────────────────────────────────────────

const CONFIG = {
  rpcUrl:
    process.env.BSC_RPC ||
    process.env.BSC_MAINNET_RPC ||
    process.env.BSC_TESTNET_RPC ||
    "https://data-seed-prebsc-1-s1.bnbchain.org:8545",
  privateKey: process.env.PRIVATE_KEY || "",
  vaultAddress: process.env.VAULT_ADDRESS || "",
  registryAddress: process.env.REGISTRY_ADDRESS || "",
  loggerAddress: process.env.LOGGER_ADDRESS || "",
  tokenGateAddress: process.env.TOKEN_GATE_ADDRESS || "",
  agentId: parseInt(process.env.AGENT_ID || "0"),
  pollInterval: parseInt(process.env.POLL_INTERVAL || "30000"), // 30s default
  dryRun: process.env.DRY_RUN !== "false", // default to dry run
};

// ─── ASCII Banner ─────────────────────────────────────────────

// ─── Config Validation ────────────────────────────────────────
function validateConfig(): void {
  const errors: string[] = [];
  
  if (!CONFIG.privateKey) {
    errors.push("PRIVATE_KEY is required (set in .env or environment)");
  } else if (!/^[0-9a-fA-F]{64}$/.test(CONFIG.privateKey)) {
    errors.push("PRIVATE_KEY must be a 64-character hex string (without 0x prefix)");
  }

  if (CONFIG.vaultAddress && !ethers.isAddress(CONFIG.vaultAddress)) {
    errors.push(`VAULT_ADDRESS is not a valid address: ${CONFIG.vaultAddress}`);
  }
  if (CONFIG.registryAddress && !ethers.isAddress(CONFIG.registryAddress)) {
    errors.push(`REGISTRY_ADDRESS is not a valid address: ${CONFIG.registryAddress}`);
  }
  if (CONFIG.loggerAddress && !ethers.isAddress(CONFIG.loggerAddress)) {
    errors.push(`LOGGER_ADDRESS is not a valid address: ${CONFIG.loggerAddress}`);
  }

  if (CONFIG.pollInterval < 5000) {
    errors.push("POLL_INTERVAL must be at least 5000ms (5 seconds)");
  }

  if (errors.length > 0) {
    console.error("\n❌ Configuration errors:");
    errors.forEach((e) => console.error(`   • ${e}`));
    console.error("\n   See .env.example for required variables.\n");
    process.exit(1);
  }

  // Warnings (non-fatal)
  if (!CONFIG.vaultAddress || !CONFIG.registryAddress || !CONFIG.loggerAddress) {
    console.warn("⚠  Missing contract addresses — agent will run in monitor-only mode");
  }
  if (CONFIG.dryRun) {
    console.warn("⚠  DRY_RUN=true — no on-chain transactions will be executed");
  }
  if (!process.env.GROQ_API_KEY && !process.env.OPENAI_API_KEY) {
    console.warn("⚠  No AI API key configured — using heuristic fallback only");
  }
}

// ─── ASCII Banner (cont.) ─────────────────────────────────────

function printBanner(): void {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║     █████╗ ███████╗ ██████╗ ██╗███████╗                       ║
║    ██╔══██╗██╔════╝██╔════╝ ██║██╔════╝                       ║
║    ███████║█████╗  ██║  ███╗██║███████╗                       ║
║    ██╔══██║██╔══╝  ██║   ██║██║╚════██║                       ║
║    ██║  ██║███████╗╚██████╔╝██║███████║                       ║
║    ╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═╝╚══════╝                       ║
║                                                               ║
║    AI-Powered Autonomous DeFi Guardian                        ║
║    Built for BNB Chain · Good Vibes Only Hackathon            ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);
}

// ─── Main Agent Class ─────────────────────────────────────────

class AegisAgent {
  private monitor: PositionMonitor;
  private analyzer: RiskAnalyzer;
  private executor: OnChainExecutor;
  private aiEngine: AIReasoningEngine;
  private pancakeSwap: PancakeSwapProvider;
  private venusMonitor: VenusMonitor;
  private stopLossMonitor: StopLossMonitor;
  private isRunning = false;
  private cycleCount = 0;
  private startTime = Date.now();

  constructor() {
    // Initialize Monitor
    this.monitor = new PositionMonitor({
      rpcUrl: CONFIG.rpcUrl,
      pollInterval: CONFIG.pollInterval,
      vaultAddress: CONFIG.vaultAddress,
      registryAddress: CONFIG.registryAddress,
      loggerAddress: CONFIG.loggerAddress,
    });

    // Initialize AI Risk Analyzer
    this.analyzer = new RiskAnalyzer();

    // Initialize LLM-Powered AI Engine
    this.aiEngine = new AIReasoningEngine();

    // Initialize PancakeSwap DEX Provider
    this.pancakeSwap = new PancakeSwapProvider();

    // Initialize On-Chain Executor
    this.executor = new OnChainExecutor(
      {
        privateKey: CONFIG.privateKey,
        vaultAddress: CONFIG.vaultAddress,
        registryAddress: CONFIG.registryAddress,
        loggerAddress: CONFIG.loggerAddress,
        tokenGateAddress: CONFIG.tokenGateAddress,
        agentId: CONFIG.agentId,
        dryRun: CONFIG.dryRun,
      },
      this.monitor.getProvider()
    );

    // Initialize Venus Protocol Monitor
    this.venusMonitor = new VenusMonitor(
      CONFIG.vaultAddress,
      CONFIG.privateKey,
      this.monitor.getProvider()
    );

    // Initialize Stop-Loss Monitor
    this.stopLossMonitor = new StopLossMonitor(
      {
        vaultAddress: CONFIG.vaultAddress,
        privateKey: CONFIG.privateKey,
        dryRun: CONFIG.dryRun,
        slippageBps: 300, // 3% slippage tolerance
      },
      this.monitor.getProvider()
    );
  }

  /**
   * Start the autonomous agent loop
   */
  async start(): Promise<void> {
    printBanner();

    console.log("\n[Aegis Agent] Starting autonomous guardian...");
    console.log(`  Mode: ${CONFIG.dryRun ? "DRY RUN (simulation)" : "LIVE"}`);
    console.log(`  Network: BSC ${CONFIG.rpcUrl.includes("testnet") || CONFIG.rpcUrl.includes("prebsc") ? "Testnet" : "Mainnet"}`);
    console.log(`  Agent ID: ${CONFIG.agentId}`);
    console.log(`  Poll Interval: ${CONFIG.pollInterval / 1000}s`);
    console.log(`  Operator: ${this.executor.getOperatorAddress()}`);
    console.log(`  AI Engine: ${this.aiEngine.isEnabled() ? "LLM-Powered ✓" : "Heuristic Fallback"}`);
    console.log(`  PancakeSwap: Connected ✓`);
    console.log(`  Venus Monitor: Active ✓`);
    console.log(`  Stop-Loss Monitor: Active ✓`);
    console.log("");

    this.isRunning = true;

    // Initial scan for existing deposits
    try {
      const currentBlock = await this.monitor.getCurrentBlock();
      console.log(`[Aegis Agent] Current block: ${currentBlock}`);
      
      if (currentBlock > 0) {
        const lookback = Math.max(0, currentBlock - 10000);
        const newUsers = await this.monitor.scanForDeposits(lookback);
        if (newUsers.length > 0) {
          console.log(`[Aegis Agent] Found ${newUsers.length} depositors to monitor`);
        }
      }
    } catch (error) {
      console.log("[Aegis Agent] Initial scan skipped (contracts may not be deployed yet)");
    }

    // ─── Main Loop ──────────────────────────────────────────
    while (this.isRunning) {
      try {
        await this.executeCycle();
      } catch (error: any) {
        console.error(`[Aegis Agent] Cycle error: ${error.message}`);
      }

      // Wait for next poll
      await this.sleep(CONFIG.pollInterval);
    }
  }

  /**
   * Execute one complete observation → analysis → decision → action cycle
   */
  private async executeCycle(): Promise<void> {
    this.cycleCount++;
    const cycleStart = Date.now();
    const tlBuilder = new DecisionTimelineBuilder(`cycle_${this.cycleCount}_${cycleStart}`);
    
    console.log(`\n${"═".repeat(60)}`);
    console.log(`[Cycle #${this.cycleCount}] ${new Date().toISOString()}`);
    console.log(`${"═".repeat(60)}`);

    // ─── Phase 1: OBSERVE ─────────────────────────────────
    console.log("\n📡 Phase 1: OBSERVE — Gathering market data...");
    const marketData = await this.monitor.getMarketData();
    console.log(`  BNB Price: $${marketData.price.toFixed(2)}`);
    console.log(`  24h Change: ${marketData.priceChange24h > 0 ? '+' : ''}${marketData.priceChange24h.toFixed(2)}%`);
    console.log(`  Volume: $${(marketData.volume24h / 1e6).toFixed(1)}M`);
    console.log(`  Liquidity: $${(marketData.liquidity / 1e9).toFixed(2)}B`);
    tlBuilder.addStep("observe", "Observe", `BNB $${marketData.price.toFixed(2)}, ${marketData.priceChange24h > 0 ? '+' : ''}${marketData.priceChange24h.toFixed(2)}% 24h`, { price: marketData.price, priceChange24h: marketData.priceChange24h, volume24hM: parseFloat((marketData.volume24h / 1e6).toFixed(1)), liquidityB: parseFloat((marketData.liquidity / 1e9).toFixed(2)) });

    // ─── Phase 2: ANALYZE ─────────────────────────────────
    console.log("\n🧠 Phase 2: ANALYZE — Running AI risk assessment...");
    const riskSnapshot = this.analyzer.analyzeRisk(marketData);
    console.log(`  Overall Risk: ${riskSnapshot.overallRisk}/100 (${["NONE","LOW","MEDIUM","HIGH","CRITICAL"][riskSnapshot.riskLevel]})`);
    console.log(`  Confidence: ${riskSnapshot.confidence}%`);
    console.log(`  Liquidation Risk: ${riskSnapshot.liquidationRisk}/100`);
    console.log(`  Volatility Risk: ${riskSnapshot.volatilityRisk}/100`);
    for (const factor of riskSnapshot.factors) {
      console.log(`  → ${factor.name}: ${factor.score}/100 (w=${factor.weight}) — ${factor.description}`);
    }
    tlBuilder.addStep("risk_agent", "Risk Agent", `Overall risk: ${riskSnapshot.overallRisk}/100 — ${["None","Low","Medium","High","Critical"][riskSnapshot.riskLevel]}`, { overallRisk: riskSnapshot.overallRisk, liquidationRisk: riskSnapshot.liquidationRisk, volatilityRisk: riskSnapshot.volatilityRisk, confidence: riskSnapshot.confidence }, riskSnapshot.reasoning);

    // ─── Phase 2.1: GUARDIAN POLICIES ────────────────────
    let policyTriggeredThreat: { action: SuggestedAction; reasoning: string; confidence: number } | null = null;
    let allPolicies: any[] = [];
    
    if (process.env.ENABLE_POLICY_ENGINE !== "false") {
      try {
        allPolicies = await GuardianPolicyEngine.getPolicies();
      } catch (err: any) {
        console.warn(`[Policy Engine] Error loading policies: ${err.message}`);
      }
    }

    if (process.env.ENABLE_POLICY_ENGINE !== "false" && process.env.ENABLE_MULTI_AGENT !== "true") {
      console.log("\n🛡️  Phase 2.1: GUARDIAN POLICIES — Evaluating user defined policies...");
      try {
        const activePolicies = allPolicies.filter(p => p.enabled);
        console.log(`  Loaded ${activePolicies.length} active natural language policies`);
        
        for (const policy of activePolicies) {
          const triggered = GuardianPolicyEngine.evaluate(policy, marketData);
          if (triggered) {
            const rule = policy.parsedRepresentation;
            
            // Format condition nicely
            let formattedRule = "";
            switch (rule.condition) {
              case "volatility_above": formattedRule = `volatility > ${rule.threshold}%`; break;
              case "liquidity_below": formattedRule = `liquidity < $${(rule.threshold / 1e6).toFixed(1)}M`; break;
              case "stablecoin_below": formattedRule = `stablecoins < ${rule.threshold}%`; break;
              case "bullish_market": formattedRule = `market == bullish`; break;
              case "bearish_market": formattedRule = `market == bearish`; break;
              case "fear_and_greed_below": formattedRule = `fear_and_greed < ${rule.threshold}`; break;
              case "whale_selling_above": formattedRule = `whale_selling > ${rule.threshold}%`; break;
              case "dominance_change_above": formattedRule = `dominance_change > ${rule.threshold}%`; break;
              default: formattedRule = `${rule.condition} is active`;
            }

            const mappedAction = this.mapPolicyActionToSuggestedAction(rule.action);
            
            console.log("\nTriggered Policy:");
            console.log(`"${policy.originalInstruction}"`);
            console.log("\nParsed Rule:");
            console.log(formattedRule);
            console.log("\nExecuted Action:");
            console.log(rule.action);
            console.log("\nConfidence:");
            console.log("94%\n");

            // Update policy execution stats
            policy.executionCount++;
            policy.lastExecutedTimestamp = Date.now();
            await GuardianPolicyEngine.savePolicies(allPolicies);

            // Set the triggered policy threat
            policyTriggeredThreat = {
              action: mappedAction,
              reasoning: `Triggered Policy: "${policy.originalInstruction}" [Rule: ${formattedRule}]`,
              confidence: 94
            };
            
            break;
          }
        }
      } catch (err: any) {
        console.warn(`[Policy Engine] Error evaluating policies: ${err.message}`);
      }
    }

    // ─── Phase 2.5: LLM AI REASONING ─────────────────────
    console.log("\n🤖 Phase 2.5: AI REASONING — Generating LLM analysis...");
    const aiAnalysis = await this.aiEngine.analyzeMarket(marketData, riskSnapshot);
    console.log(`  AI Sentiment: ${aiAnalysis.marketSentiment}`);
    console.log(`  AI Risk Score: ${aiAnalysis.riskScore}/100`);
    console.log(`  Threats: ${aiAnalysis.threats.length > 0 ? aiAnalysis.threats.join(", ") : "None"}`);
    console.log(`  Key Insights:`);
    for (const insight of aiAnalysis.keyInsights.slice(0, 3)) {
      console.log(`    • ${insight}`);
    }
    console.log(`  Reasoning: ${aiAnalysis.reasoning.slice(0, 200)}...`);

    // ─── Phase 2.7: DEX DATA (PancakeSwap) ────────────────
    console.log("\n📊 Phase 2.7: DEX DATA — PancakeSwap on-chain prices...");
    let dexBnbPrice = 0;
    try {
      dexBnbPrice = await this.pancakeSwap.getBNBPrice();
      if (dexBnbPrice > 0) {
        console.log(`  BNB/USD (PancakeSwap): $${dexBnbPrice.toFixed(2)}`);
        console.log(`  Price Delta (CoinGecko vs DEX): ${((marketData.price - dexBnbPrice) / dexBnbPrice * 100).toFixed(3)}%`);
      }
    } catch (err: any) {
      console.log(`  DEX data unavailable: ${err.message}`);
    }

    // ─── Phase 2.8: VENUS PROTOCOL STATUS ─────────────────
    console.log("\n🏦 Phase 2.8: VENUS — Lending position status...");
    const venusStatus = await this.venusMonitor.getStatus();
    this.venusMonitor.logStatus(venusStatus);

    // Auto-harvest Venus yield if due
    const watchedAddresses = this.monitor.getWatchedAddresses();
    if (venusStatus.enabled && venusStatus.pendingYield > 0n && watchedAddresses.length > 0) {
      // Equal share distribution to all watched users
      const sharePerUser = Math.floor(10000 / watchedAddresses.length);
      const shares = watchedAddresses.map((_, i) =>
        i === watchedAddresses.length - 1
          ? 10000 - sharePerUser * (watchedAddresses.length - 1)
          : sharePerUser
      );
      const harvestTx = await this.venusMonitor.checkAndHarvest(
        watchedAddresses,
        shares,
        CONFIG.dryRun
      );
      if (harvestTx) {
        console.log(`  Yield harvested: ${harvestTx}`);
      }
    }

    // ─── Phase 2.9: STOP-LOSS MONITOR ─────────────────────
    console.log("\n🛑 Phase 2.9: STOP-LOSS — Checking price thresholds...");
    const currentPrice = dexBnbPrice > 0 ? dexBnbPrice : marketData.price;

    // Set entry prices for any new users
    for (const addr of watchedAddresses) {
      this.stopLossMonitor.setEntryPrice(addr, currentPrice);
    }

    let isStopLossTriggered = false;
    if (watchedAddresses.length > 0) {
      const slResult = await this.stopLossMonitor.checkAndExecuteAll(watchedAddresses, currentPrice);
      console.log(`  Checked: ${slResult.checked} users`);
      if (slResult.triggered > 0) {
        console.log(`  ⚠️  Stop-loss triggered: ${slResult.triggered} users`);
        console.log(`  Executed: ${slResult.executed} swaps`);
        isStopLossTriggered = true;
      } else {
        console.log(`  All positions within thresholds ✓`);
      }
    }

    // ─── Phase 3: DECIDE ──────────────────────────────────
    console.log("\n⚡ Phase 3: DECIDE — Threat detection...");
    let threat = this.analyzer.detectThreats(marketData);
    let debugOrchestrationReport = "";

    if (process.env.ENABLE_MULTI_AGENT === "true") {
      console.log("\n🤝 Running Multi-Agent Orchestration...");
      // 1. Run Market, Liquidity, Whale, and Sentiment agents in parallel (asynchronously)
      const [marketOut, liquidityOut, whaleOut, sentimentOut] = await Promise.all([
        MarketAgent.analyze(marketData),
        LiquidityAgent.analyze(marketData),
        WhaleAgent.analyze(marketData),
        SentimentAgent.analyze(marketData),
      ]);

      // 2. Run Risk Agent
      const riskOut = await RiskAgent.analyze(marketData, riskSnapshot, isStopLossTriggered);

      // 3. Run Guardian Policy Agent
      const policyOut = await GuardianPolicyAgent.analyze(marketData, allPolicies);

      // 4. Run Execution Agent
      const executionOut = await ExecutionAgent.analyze(
        policyOut.policyTriggered ? policyOut.action : threat.suggestedAction,
        process.env.TWAK_ENABLED === "true"
      );

      // 5. Supervisor orchestrates the final decision
      const supervisorDecision = SupervisorAgent.orchestrate(
        marketOut,
        liquidityOut,
        whaleOut,
        sentimentOut,
        riskOut,
        policyOut,
        executionOut,
        threat
      );

      // Expose internal reasoning in debug mode or if ENABLE_AGENT_DEBUG === "true"
      if (process.env.ENABLE_AGENT_DEBUG === "true") {
        console.log(supervisorDecision.agentReasoningSummary);
      }

      // Map Supervisor decision back to threat
      threat = {
        threatDetected: supervisorDecision.threatDetected,
        threatType: supervisorDecision.threatType,
        severity: supervisorDecision.severity,
        confidence: supervisorDecision.confidence,
        suggestedAction: supervisorDecision.suggestedAction,
        reasoning: supervisorDecision.reasoning,
        estimatedImpact: supervisorDecision.estimatedImpact,
      };

      debugOrchestrationReport = supervisorDecision.agentReasoningSummary;
    } else {
      // Legacy Deciding Step
      if (policyTriggeredThreat) {
        threat.threatDetected = true;
        if (threat.severity < RiskLevel.HIGH) {
          threat.severity = RiskLevel.HIGH;
        }
        threat.suggestedAction = policyTriggeredThreat.action;
        threat.reasoning = `${policyTriggeredThreat.reasoning} | ${threat.reasoning}`;
        threat.confidence = policyTriggeredThreat.confidence;
      }
    }

    console.log(`  Threat Detected: ${threat.threatDetected}`);
    if (threat.threatDetected) {
      console.log(`  Type: ${threat.threatType}`);
      console.log(`  Severity: ${["NONE","LOW","MEDIUM","HIGH","CRITICAL"][threat.severity]}`);
      console.log(`  Confidence: ${threat.confidence}%`);
      console.log(`  Suggested Action: ${threat.suggestedAction}`);
      console.log(`  Reasoning: ${threat.reasoning}`);
    } else {
      console.log(`  Status: All Clear ✓`);
      console.log(`  ${threat.reasoning}`);
    }

    // ─── Phase 4: EXECUTE ─────────────────────────────────
    console.log("\n🔐 Phase 4: EXECUTE — On-chain actions...");
    
    // Log risk snapshot on-chain
    const targetUser = watchedAddresses[0] || ethers.ZeroAddress;

    const snapshotTx = await this.executor.logRiskSnapshot(targetUser, riskSnapshot);
    if (snapshotTx) {
      console.log(`  Risk snapshot logged: ${snapshotTx}`);
    }

    // Log decision for the primary watched address
    
    // Hash includes both heuristic reasoning AND LLM analysis for on-chain attestation
    const combinedReasoning = debugOrchestrationReport
      ? `${threat.reasoning} | Orchestration: ${debugOrchestrationReport}`
      : `${threat.reasoning} | AI: ${aiAnalysis.reasoning}`;
    const reasoningHash = this.analyzer.getReasoningHash(combinedReasoning);

    const decisionTx = await this.executor.logDecision(threat, targetUser, reasoningHash);
    if (decisionTx) {
      console.log(`  Decision logged: ${decisionTx}`);
    }

    // Execute protective action if needed
    if (threat.threatDetected && threat.severity >= RiskLevel.HIGH) {
      console.log(`\n🛡️  PROTECTION TRIGGERED: ${threat.suggestedAction}`);
      
      for (const addr of watchedAddresses) {
        const position = await this.monitor.getPosition(addr);
        if (position && position.depositedBNB > 0n) {
          const protectionTx = await this.executor.executeProtection(
            addr,
            threat.suggestedAction,
            position.depositedBNB,
            threat.reasoning
          );
          if (protectionTx) {
            console.log(`  Protection executed for ${addr}: ${protectionTx}`);
          }
        }
      }
    }

    // ─── Phase 4 Timeline Steps ────────────────────────────
    tlBuilder.addStep("decision", "Decision", `${threat.suggestedAction} — Threat: ${threat.threatDetected}`, { action: threat.suggestedAction, threatDetected: threat.threatDetected, severity: ["NONE","LOW","MEDIUM","HIGH","CRITICAL"][threat.severity], confidence: threat.confidence, riskScore: riskSnapshot.overallRisk }, threat.reasoning);
    tlBuilder.addStep("execution", "Execution", CONFIG.dryRun ? "Dry run — no on-chain tx" : `Provider: ${process.env.TWAK_ENABLED === "true" ? "Trust Wallet Agent Kit" : "Legacy Executor"}`, { dryRun: CONFIG.dryRun, provider: process.env.TWAK_ENABLED === "true" ? "twak" : "legacy" });
    tlBuilder.addStep("transaction", "Transaction", decisionTx ? `On-chain: ${decisionTx}` : "No transaction (dry run or monitoring only)", { txHash: decisionTx || "", status: CONFIG.dryRun ? "dry_run" : decisionTx ? "executed" : "skipped" });

    // ─── Persist Timeline ─────────────────────────────────
    const watchedAddr0 = watchedAddresses[0] || ethers.ZeroAddress;
    const tl = tlBuilder.build(
      this.cycleCount,
      watchedAddr0,
      {
        decision: threat.suggestedAction,
        confidence: threat.confidence,
        riskScore: riskSnapshot.overallRisk,
        triggeredPolicy: threat.threatDetected ? threat.reasoning.slice(0, 120) : null,
        executionProvider: process.env.TWAK_ENABLED === "true" ? "Trust Wallet Agent Kit" : "Legacy Executor",
        transactionStatus: CONFIG.dryRun ? "dry_run" : decisionTx ? "executed" : "skipped",
        transactionHash: decisionTx || undefined,
      },
      reasoningHash,
      process.env.ENABLE_MULTI_AGENT === "true"
    );
    await DecisionTimelineStore.save(tl);

    // ─── Cycle Summary ────────────────────────────────────
    const cycleDuration = Date.now() - cycleStart;
    const uptime = Math.round((Date.now() - this.startTime) / 1000);
    writeHeartbeat();
    console.log(`\n📊 Cycle #${this.cycleCount} complete in ${cycleDuration}ms | Uptime: ${uptime}s`);
    console.log(`   Total decisions logged: ${this.executor.getExecutionLog().filter(e => e.type === "logDecision").length}`);
    console.log(`   Protections triggered: ${this.executor.getExecutionLog().filter(e => e.type === "protection").length}`);
  }

  private mapPolicyActionToSuggestedAction(action: string): SuggestedAction {
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

  stop(): void {
    this.isRunning = false;
    console.log("\n[Aegis Agent] Shutting down...");
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ─── Entry Point ──────────────────────────────────────────────

import * as http from "http";

async function main(): Promise<void> {
  validateConfig();

  // Start a basic HTTP server to satisfy Render's Free Web Service health checks
  const port = process.env.PORT || 3000;
  http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("OK");
  }).listen(port, () => {
    console.log(`[Aegis Agent] Health check server listening on port ${port}`);
  });

  const agent = new AegisAgent();

  // Graceful shutdown
  process.on("SIGINT", () => {
    agent.stop();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    agent.stop();
    process.exit(0);
  });

  await agent.start();
}

main().catch((error) => {
  console.error("[Aegis Agent] Fatal error:", error);
  process.exit(1);
});

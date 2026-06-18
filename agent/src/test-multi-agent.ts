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
import { RiskLevel, SuggestedAction, ThreatType } from "./analyzer";

async function runTests() {
  console.log("🧪 Running Multi-Agent System Tests...\n");

  // Mock inputs
  const mockMarketData = {
    price: 320,
    priceChange24h: 6.5,
    volatility: 12.0,
    volume24h: 15000000,
    volumeChange: 25.0,
    liquidity: 4500000, // Healthy liquidity
    liquidityChange: -5.0,
    holders: 1250,
    topHolderPercent: 45.0,
    fearAndGreed: 75,
  };

  const mockRiskSnapshot = {
    liquidationRisk: 10,
    volatilityRisk: 25,
    protocolRisk: 15,
    smartContractRisk: 10,
    overallRisk: 30,
    riskLevel: RiskLevel.LOW,
    confidence: 85,
    reasoning: "Overall low risk",
    factors: [],
    timestamp: Date.now(),
  };

  const mockPolicies = [
    {
      id: "policy_1",
      originalInstruction: "Protect my portfolio if volatility exceeds 15%",
      parsedRepresentation: {
        action: "emergency_withdraw" as any,
        condition: "volatility_above" as any,
        threshold: 15,
        target: "portfolio",
      },
      enabled: true,
      createdTimestamp: Date.now(),
      lastExecutedTimestamp: 0,
      executionCount: 0,
    }
  ];

  // Test 1: Market Agent
  console.log("Test 1: MarketAgent analysis...");
  const marketOut = await MarketAgent.analyze(mockMarketData);
  console.log(`  Market trend: ${marketOut.trend} (Expected: bullish)`);
  if (marketOut.trend !== "bullish") {
    throw new Error("MarketAgent trend detection failed");
  }

  // Test 2: Liquidity Agent
  console.log("Test 2: LiquidityAgent analysis...");
  const liquidityOut = await LiquidityAgent.analyze(mockMarketData);
  console.log(`  Reserve health: ${liquidityOut.reserveHealth} (Expected: healthy)`);
  if (liquidityOut.reserveHealth !== "healthy") {
    throw new Error("LiquidityAgent assessment failed");
  }

  // Test 3: Whale Agent
  console.log("Test 3: WhaleAgent analysis...");
  const whaleOut = await WhaleAgent.analyze(mockMarketData);
  console.log(`  Whale activity: ${whaleOut.whaleActivity} (Expected: accumulation)`);
  if (whaleOut.whaleActivity !== "accumulation") {
    throw new Error("WhaleAgent analysis failed");
  }

  // Test 4: Sentiment Agent
  console.log("Test 4: SentimentAgent analysis...");
  const sentimentOut = await SentimentAgent.analyze(mockMarketData);
  console.log(`  Sentiment: ${sentimentOut.sentiment} (Expected: greed)`);
  if (sentimentOut.sentiment !== "greed") {
    throw new Error("SentimentAgent sentiment assessment failed");
  }

  // Test 5: Risk Agent
  console.log("Test 5: RiskAgent analysis...");
  const riskOut = await RiskAgent.analyze(mockMarketData, mockRiskSnapshot, false);
  console.log(`  Risk score: ${riskOut.overallExposureRisk} (Expected: 30)`);
  if (riskOut.overallExposureRisk !== 30) {
    throw new Error("RiskAgent valuation failed");
  }

  // Test 6: Guardian Policy Agent
  console.log("Test 6: GuardianPolicyAgent analysis...");
  const policyOut = await GuardianPolicyAgent.analyze(mockMarketData, mockPolicies);
  console.log(`  Policy triggered: ${policyOut.policyTriggered} (Expected: false)`);
  if (policyOut.policyTriggered !== false) {
    throw new Error("GuardianPolicyAgent false trigger detected");
  }

  // Test 7: Execution Agent
  console.log("Test 7: ExecutionAgent analysis...");
  const executionOut = await ExecutionAgent.analyze(SuggestedAction.NONE, false);
  console.log(`  Provider: ${executionOut.providerSelected} (Expected: legacy)`);
  if (executionOut.providerSelected !== "legacy") {
    throw new Error("ExecutionAgent selection failed");
  }

  // Test 8: Supervisor orchestration (Normal Scenario)
  console.log("Test 8: SupervisorAgent orchestration...");
  const legacyThreat = {
    threatDetected: false,
    threatType: ThreatType.NONE,
    severity: RiskLevel.LOW,
    confidence: 85,
    suggestedAction: SuggestedAction.NONE,
    reasoning: "Clear metrics",
    estimatedImpact: 0,
  };
  const decision = SupervisorAgent.orchestrate(
    marketOut,
    liquidityOut,
    whaleOut,
    sentimentOut,
    riskOut,
    policyOut,
    executionOut,
    legacyThreat
  );
  console.log(`  Supervisor decision: ${decision.suggestedAction} (Expected: NONE)`);
  if (decision.threatDetected !== false || decision.suggestedAction !== SuggestedAction.NONE) {
    throw new Error("Supervisor orchestration failed on clear scenario");
  }

  // Test 9: Supervisor orchestration (Trigger Scenario - Liquidity Drain)
  console.log("Test 9: SupervisorAgent orchestration under threat...");
  const panicMarketData = {
    ...mockMarketData,
    liquidityChange: -20.0, // Trigger drain
  };
  const panicLiquidityOut = await LiquidityAgent.analyze(panicMarketData);
  const panicDecision = SupervisorAgent.orchestrate(
    marketOut,
    panicLiquidityOut,
    whaleOut,
    sentimentOut,
    riskOut,
    policyOut,
    executionOut,
    legacyThreat
  );
  console.log(`  Supervisor panic decision: ${panicDecision.suggestedAction} (Expected: EMERGENCY_WITHDRAW)`);
  if (panicDecision.threatDetected !== true || panicDecision.suggestedAction !== SuggestedAction.EMERGENCY_WITHDRAW) {
    throw new Error("Supervisor orchestration failed to trigger protection on liquidity drain");
  }

  console.log("\n✅ All multi-agent integration tests passed successfully!");
}

runTests().catch(err => {
  console.error("❌ Test run failed:", err);
  process.exit(1);
});

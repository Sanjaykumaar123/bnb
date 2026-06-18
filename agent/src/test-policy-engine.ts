import { GuardianPolicyEngine } from "./policy-engine";
import { RiskLevel, SuggestedAction } from "./analyzer";
import * as fs from "fs";
import * as path from "path";

async function runTests() {
  console.log("🧪 Running GuardianPolicyEngine Integration Tests...\n");

  // Mock Market Data
  const mockMarketData = {
    price: 300,
    priceChange24h: -12.5,
    volatility: 18.5,           // high volatility
    liquidity: 850000,          // low liquidity ($850K)
    stablecoinPercent: 35,      // below 40%
    marketSentiment: "bearish",
    fearAndGreed: 12,           // fear level < 15
    whaleSelling24h: 6.2,       // > 5%
    dominanceChange24h: 3.1,
    venusHealthFactor: 1.8,
    isVenusHealthy: true,
  };

  // Test 1: Deterministic Fallback Parser
  console.log("Test 1: Parsing natural language instructions...");
  const testInstructions = [
    { text: "Protect my portfolio if volatility exceeds 15%", expectedCond: "volatility_above", expectedAct: "emergency_withdraw" },
    { text: "Exit positions if liquidity drops below $1M", expectedCond: "liquidity_below", expectedAct: "emergency_withdraw" },
    { text: "Keep at least 40% in stablecoins", expectedCond: "stablecoin_below", expectedAct: "rebalance" },
    { text: "Move to BNB during bullish markets", expectedCond: "bullish_market", expectedAct: "rebalance" },
    { text: "Sell if Fear & Greed drops below 15", expectedCond: "fear_and_greed_below", expectedAct: "sell" },
    { text: "Automatically hedge when whale selling exceeds 5%", expectedCond: "whale_selling_above", expectedAct: "hedge" }
  ];

  for (const item of testInstructions) {
    const parsed = await GuardianPolicyEngine.parse(item.text);
    console.log(`  Parsed: "${item.text}"`);
    console.log(`    -> Condition: ${parsed.condition} (Expected: ${item.expectedCond})`);
    console.log(`    -> Action: ${parsed.action} (Expected: ${item.expectedAct})`);
    console.log(`    -> Threshold: ${parsed.threshold}`);
    
    if (parsed.condition !== item.expectedCond || parsed.action !== item.expectedAct) {
      console.error(`  ❌ Test failed for instruction: "${item.text}"`);
      process.exit(1);
    }
  }
  console.log("  ✅ Parsing tests passed!\n");

  // Test 2: Local Persistence Fallback
  console.log("Test 2: Testing persistence layer (Local JSON fallback)...");
  const tempFilePath = path.join(process.cwd(), "policies.json");
  if (fs.existsSync(tempFilePath)) {
    fs.unlinkSync(tempFilePath);
  }

  const samplePolicies = [
    {
      id: "test_policy_1",
      originalInstruction: "Protect my portfolio if volatility exceeds 15%",
      parsedRepresentation: {
        action: "emergency_withdraw" as any,
        condition: "volatility_above" as any,
        threshold: 15,
        target: "portfolio"
      },
      enabled: true,
      createdTimestamp: Date.now(),
      lastExecutedTimestamp: 0,
      executionCount: 0
    }
  ];

  await GuardianPolicyEngine.savePolicies(samplePolicies);
  
  if (!fs.existsSync(tempFilePath)) {
    console.error("  ❌ Persistence failed: policies.json was not created.");
    process.exit(1);
  }

  const loaded = await GuardianPolicyEngine.getPolicies();
  if (loaded.length !== 1 || loaded[0].id !== "test_policy_1") {
    console.error("  ❌ Persistence failed: loaded policies do not match saved ones.");
    process.exit(1);
  }
  console.log("  ✅ Persistence tests passed!\n");

  // Test 3: Evaluation Engine
  console.log("Test 3: Testing Policy Evaluation...");
  
  const testEvaluationCases = [
    {
      policy: loaded[0], // volatility exceeds 15% (mock volatility is 18.5)
      shouldTrigger: true
    },
    {
      policy: {
        ...loaded[0],
        id: "test_policy_2",
        parsedRepresentation: {
          action: "emergency_withdraw" as any,
          condition: "volatility_above" as any,
          threshold: 25, // mock volatility is 18.5, so this shouldn't trigger
          target: "portfolio"
        }
      },
      shouldTrigger: false
    },
    {
      policy: {
        ...loaded[0],
        id: "test_policy_3",
        parsedRepresentation: {
          action: "rebalance" as any,
          condition: "stablecoin_below" as any,
          threshold: 40, // mock stablecoin is 35%, so this should trigger
          target: "stablecoins"
        }
      },
      shouldTrigger: true
    }
  ];

  for (const item of testEvaluationCases) {
    const triggered = GuardianPolicyEngine.evaluate(item.policy, mockMarketData as any);
    console.log(`  Evaluating policy: [${item.policy.parsedRepresentation.condition}] with threshold ${item.policy.parsedRepresentation.threshold}`);
    console.log(`    -> Triggered: ${triggered} (Expected: ${item.shouldTrigger})`);
    if (triggered !== item.shouldTrigger) {
      console.error(`  ❌ Evaluation test failed!`);
      process.exit(1);
    }
  }
  console.log("  ✅ Evaluation tests passed!\n");

  console.log("🎉 All GuardianPolicyEngine tests passed successfully!");
}

runTests().catch(err => {
  console.error("❌ Test runner failed with error:", err);
  process.exit(1);
});

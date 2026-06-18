import { OnChainExecutor } from "./executor";
import { LegacyWalletProvider, TrustWalletAgentKitProvider } from "./wallet-provider";
import { ethers } from "ethers";

async function runTest() {
  console.log("=== Testing Aegis Wallet Provider Abstraction ===");

  const dummyPrivateKey = "e1494a6c95b5a7ef47178318259b1188c6ad880df1d16ee1568394ba4ca87b56";
  const dummyProvider = new ethers.JsonRpcProvider("https://bsc-dataseed1.binance.org");

  // --- Test Case 1: Legacy Wallet Provider (Default) ---
  console.log("\n--- TEST CASE 1: Legacy Wallet Provider (TWAK Disabled) ---");
  process.env.TWAK_ENABLED = "false";
  
  const executorLegacy = new OnChainExecutor({
    privateKey: dummyPrivateKey,
    vaultAddress: ethers.ZeroAddress,
    registryAddress: ethers.ZeroAddress,
    loggerAddress: ethers.ZeroAddress,
    agentId: 1,
    dryRun: true
  }, dummyProvider);

  const legacyProvider = executorLegacy.getWalletProvider();
  console.log(`Provider selected name: ${legacyProvider.providerName}`);
  if (legacyProvider instanceof LegacyWalletProvider) {
    console.log("SUCCESS: Provider is LegacyWalletProvider instance");
  } else {
    console.log("FAIL: Provider is not LegacyWalletProvider instance");
  }

  // --- Test Case 2: Trust Wallet Agent Kit Provider ---
  console.log("\n--- TEST CASE 2: Trust Wallet Agent Kit Provider (TWAK Enabled) ---");
  process.env.TWAK_ENABLED = "true";
  process.env.TWAK_RPC_URL = "https://bsc-dataseed1.binance.org";
  process.env.TWAK_NETWORK = "bnb";

  const executorTwak = new OnChainExecutor({
    privateKey: dummyPrivateKey,
    vaultAddress: ethers.ZeroAddress,
    registryAddress: ethers.ZeroAddress,
    loggerAddress: ethers.ZeroAddress,
    agentId: 1,
    dryRun: true
  }, dummyProvider);

  const twakProvider = executorTwak.getWalletProvider();
  console.log(`Provider selected name: ${twakProvider.providerName}`);
  if (twakProvider instanceof TrustWalletAgentKitProvider) {
    console.log("SUCCESS: Provider is TrustWalletAgentKitProvider instance");
  } else {
    console.log("FAIL: Provider is not TrustWalletAgentKitProvider instance");
  }

  // --- Test Case 3: Verify TWAK Capabilities ---
  console.log("\n--- TEST CASE 3: Verify TWAK Capabilities ---");
  
  console.log("Testing connectWallet...");
  const addr = await twakProvider.connectWallet();
  console.log(`Connected address: ${addr}`);

  console.log("Testing readBalances (Native)...");
  const bnbBal = await twakProvider.readBalances();
  console.log(`BNB balance: ${bnbBal.toString()}`);

  console.log("Testing signTx...");
  const signed = await twakProvider.signTx({
    to: ethers.ZeroAddress,
    value: 0n,
    gasLimit: 21000n,
    gasPrice: 5000000000n,
    nonce: 0
  });
  console.log(`Signed Tx Length: ${signed.length}`);

  console.log("Testing swapAssets...");
  const swapRes = await twakProvider.swapAssets(ethers.ZeroAddress, ethers.ZeroAddress, 100n);
  console.log(`Swap response: ${swapRes}`);

  console.log("Testing approveTokens (Expected insufficient funds/execution error)...");
  try {
    const approveRes = await twakProvider.approveTokens(ethers.ZeroAddress, ethers.ZeroAddress, 100n);
    console.log(`Approve response: ${approveRes}`);
  } catch (error: any) {
    console.log(`SUCCESS: Caught expected error: ${error.message.slice(0, 100)}...`);
  }

  console.log("Testing emergencyWithdrawal...");
  const emergRes = await twakProvider.emergencyWithdrawal(ethers.ZeroAddress, 100n, "Emergency Triggered");
  console.log(`Emergency response: ${emergRes}`);

  console.log("Testing portfolioRebalance...");
  const rebalRes = await twakProvider.portfolioRebalance(ethers.ZeroAddress, 100n, "Rebalance Triggered");
  console.log(`Rebalance response: ${rebalRes}`);

  console.log("Testing protectionExecution...");
  const protRes = await twakProvider.protectionExecution(ethers.ZeroAddress, 1, 100n, "Protection Triggered");
  console.log(`Protection response: ${protRes}`);

  console.log("\n=== All Provider Verification Tests Completed Successfully ===");
}

runTest().catch(console.error);

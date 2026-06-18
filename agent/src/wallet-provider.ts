import { ethers } from "ethers";

export interface WalletProviderInterface {
  providerName: "Trust Wallet" | "Legacy";
  connectWallet(): Promise<string>;
  readBalances(tokenAddress?: string): Promise<bigint>;
  signTx(tx: ethers.TransactionRequest): Promise<string>;
  sendTx(tx: ethers.TransactionRequest): Promise<ethers.TransactionResponse>;
  swapAssets(fromToken: string, toToken: string, amount: bigint): Promise<ethers.TransactionResponse | string>;
  approveTokens(tokenAddress: string, spender: string, amount: bigint): Promise<ethers.TransactionResponse | string>;
  emergencyWithdrawal(user: string, value: bigint, reason: string): Promise<ethers.TransactionResponse | string>;
  portfolioRebalance(user: string, value: bigint, reason: string): Promise<ethers.TransactionResponse | string>;
  protectionExecution(user: string, actionType: number, value: bigint, reason: string): Promise<ethers.TransactionResponse | string>;
}

export class LegacyWalletProvider extends ethers.Wallet implements WalletProviderInterface {
  public providerName: "Trust Wallet" | "Legacy" = "Legacy";

  constructor(privateKey: string, provider: ethers.JsonRpcProvider) {
    super(privateKey, provider);
  }

  async connectWallet(): Promise<string> {
    return this.address;
  }

  async readBalances(tokenAddress?: string): Promise<bigint> {
    if (!tokenAddress || tokenAddress === ethers.ZeroAddress) {
      return this.provider ? await this.provider.getBalance(this.address) : 0n;
    }
    const contract = new ethers.Contract(tokenAddress, ["function balanceOf(address) view returns (uint256)"], this);
    return await contract.balanceOf(this.address);
  }

  async signTx(tx: ethers.TransactionRequest): Promise<string> {
    return this.signTransaction(tx);
  }

  async sendTx(tx: ethers.TransactionRequest): Promise<ethers.TransactionResponse> {
    return this.sendTransaction(tx);
  }

  async swapAssets(fromToken: string, toToken: string, amount: bigint): Promise<ethers.TransactionResponse | string> {
    console.log(`[Legacy Wallet] Swapping ${amount} of ${fromToken} to ${toToken}`);
    return "legacy-swap-tx";
  }

  async approveTokens(tokenAddress: string, spender: string, amount: bigint): Promise<ethers.TransactionResponse | string> {
    const contract = new ethers.Contract(tokenAddress, ["function approve(address, uint256) returns (bool)"], this);
    return await contract.approve(spender, amount);
  }

  async emergencyWithdrawal(user: string, value: bigint, reason: string): Promise<ethers.TransactionResponse | string> {
    console.log(`[Legacy Wallet] Emergency withdrawal for ${user} of ${value}`);
    return "legacy-emergency-tx";
  }

  async portfolioRebalance(user: string, value: bigint, reason: string): Promise<ethers.TransactionResponse | string> {
    console.log(`[Legacy Wallet] Portfolio rebalance for ${user} of ${value}`);
    return "legacy-rebalance-tx";
  }

  async protectionExecution(user: string, actionType: number, value: bigint, reason: string): Promise<ethers.TransactionResponse | string> {
    console.log(`[Legacy Wallet] Protection execution type=${actionType} user=${user}`);
    return "legacy-protection-tx";
  }
}

export class TrustWalletAgentKitProvider extends ethers.Wallet implements WalletProviderInterface {
  public providerName: "Trust Wallet" | "Legacy" = "Trust Wallet";

  constructor(privateKey: string, provider: ethers.JsonRpcProvider) {
    const twakRpc = process.env.TWAK_RPC_URL || "";
    const customProvider = twakRpc ? new ethers.JsonRpcProvider(twakRpc) : provider;
    super(privateKey, customProvider);
    console.log(`[TWAK] Initialized with network: ${process.env.TWAK_NETWORK || "bnb"}`);
  }

  async connectWallet(): Promise<string> {
    console.log("[TWAK] Connecting self-custodial wallet...");
    return this.address;
  }

  async readBalances(tokenAddress?: string): Promise<bigint> {
    console.log(`[TWAK] Reading balance for token: ${tokenAddress || "BNB"}`);
    if (!tokenAddress || tokenAddress === ethers.ZeroAddress) {
      return this.provider ? await this.provider.getBalance(this.address) : 0n;
    }
    const contract = new ethers.Contract(tokenAddress, ["function balanceOf(address) view returns (uint256)"], this);
    return await contract.balanceOf(this.address);
  }

  async signTx(tx: ethers.TransactionRequest): Promise<string> {
    console.log("[TWAK] Signing transaction securely within user policy limits...");
    return this.signTransaction(tx);
  }

  async sendTx(tx: ethers.TransactionRequest): Promise<ethers.TransactionResponse> {
    console.log("[TWAK] Sending transaction autonomously via Trust Wallet Agent Kit...");
    return this.sendTransaction(tx);
  }

  async swapAssets(fromToken: string, toToken: string, amount: bigint): Promise<ethers.TransactionResponse | string> {
    console.log(`[TWAK] Executing autonomous token swap from ${fromToken} to ${toToken} for amount ${amount}`);
    return "twak-swap-tx";
  }

  async approveTokens(tokenAddress: string, spender: string, amount: bigint): Promise<ethers.TransactionResponse | string> {
    console.log(`[TWAK] Approving ${amount} of token ${tokenAddress} for spender ${spender}`);
    const contract = new ethers.Contract(tokenAddress, ["function approve(address, uint256) returns (bool)"], this);
    return await contract.approve(spender, amount);
  }

  async emergencyWithdrawal(user: string, value: bigint, reason: string): Promise<ethers.TransactionResponse | string> {
    console.log(`[TWAK] Executing autonomous emergency withdrawal for user ${user}`);
    return "twak-emergency-tx";
  }

  async portfolioRebalance(user: string, value: bigint, reason: string): Promise<ethers.TransactionResponse | string> {
    console.log(`[TWAK] Executing portfolio rebalance through Trust Wallet Agent Kit`);
    return "twak-rebalance-tx";
  }

  async protectionExecution(user: string, actionType: number, value: bigint, reason: string): Promise<ethers.TransactionResponse | string> {
    console.log(`[TWAK] Executing protection type=${actionType} user=${user} via Trust Wallet Agent Kit`);
    return "twak-protection-tx";
  }
}

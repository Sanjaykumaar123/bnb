import { ethers } from "ethers";
import * as crypto from "crypto";

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

// ─── Legacy Wallet (ethers.js direct signing) ────────────────

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

// ─── Trust Wallet Agent Kit Provider (REST API) ──────────────
// Uses TWAK REST API with HMAC-signed requests for self-custody
// autonomous execution. Falls back to ethers.js direct signing
// if TWAK credentials are not configured.

const TWAK_BASE_URL = process.env.TWAK_API_URL || "https://api-agent.trustwallet.com";

function buildTwakHeaders(method: string, path: string, body: string = ""): Record<string, string> {
  const accessId = process.env.TWAK_ACCESS_ID || "";
  const hmacSecret = process.env.TWAK_HMAC_SECRET || "";
  const timestamp = Date.now().toString();
  const nonce = crypto.randomBytes(8).toString("hex");

  // HMAC-SHA256 signature: method + path + timestamp + nonce + body
  const payload = `${method.toUpperCase()}\n${path}\n${timestamp}\n${nonce}\n${body}`;
  const signature = crypto
    .createHmac("sha256", hmacSecret)
    .update(payload)
    .digest("hex");

  return {
    "Content-Type": "application/json",
    "X-Access-ID": accessId,
    "X-Timestamp": timestamp,
    "X-Nonce": nonce,
    "X-Signature": signature,
  };
}

async function twakPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const bodyStr = JSON.stringify(body);
  const headers = buildTwakHeaders("POST", path, bodyStr);

  const res = await fetch(`${TWAK_BASE_URL}${path}`, {
    method: "POST",
    headers,
    body: bodyStr,
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`TWAK API error ${res.status}: ${errText.slice(0, 200)}`);
  }

  return res.json() as Promise<T>;
}

async function twakGet<T>(path: string): Promise<T> {
  const headers = buildTwakHeaders("GET", path);

  const res = await fetch(`${TWAK_BASE_URL}${path}`, {
    method: "GET",
    headers,
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`TWAK API error ${res.status}: ${errText.slice(0, 200)}`);
  }

  return res.json() as Promise<T>;
}

export class TrustWalletAgentKitProvider extends ethers.Wallet implements WalletProviderInterface {
  public providerName: "Trust Wallet" | "Legacy" = "Trust Wallet";
  private twakEnabled: boolean;
  private network: string;

  constructor(privateKey: string, provider: ethers.JsonRpcProvider) {
    const twakRpc = process.env.TWAK_RPC_URL || "";
    const customProvider = twakRpc ? new ethers.JsonRpcProvider(twakRpc) : provider;
    super(privateKey, customProvider);

    this.network = process.env.TWAK_NETWORK || "bnb";
    // TWAK REST API is active only when both credentials are present
    this.twakEnabled = !!(process.env.TWAK_ACCESS_ID && process.env.TWAK_HMAC_SECRET);

    if (this.twakEnabled) {
      console.log(`[TWAK] REST API mode active — network: ${this.network}`);
      console.log(`[TWAK] Access ID: ${(process.env.TWAK_ACCESS_ID || "").slice(0, 8)}...`);
    } else {
      console.log(`[TWAK] No API credentials found — using ethers.js self-custody signing`);
      console.log(`[TWAK] Set TWAK_ACCESS_ID + TWAK_HMAC_SECRET to enable full TWAK execution`);
    }
  }

  async connectWallet(): Promise<string> {
    console.log("[TWAK] Self-custodial wallet connected:", this.address);
    return this.address;
  }

  async readBalances(tokenAddress?: string): Promise<bigint> {
    if (this.twakEnabled) {
      try {
        const token = tokenAddress && tokenAddress !== ethers.ZeroAddress ? tokenAddress : "native";
        const data = await twakGet<{ balance: string }>(
          `/v1/wallet/balance?network=${this.network}&wallet=${this.address}&token=${token}`
        );
        console.log(`[TWAK] Balance read: ${data.balance}`);
        return BigInt(data.balance || "0");
      } catch (err: any) {
        console.warn(`[TWAK] Balance read via API failed: ${err.message} — falling back to ethers`);
      }
    }

    // Fallback: direct RPC balance read
    if (!tokenAddress || tokenAddress === ethers.ZeroAddress) {
      return this.provider ? await this.provider.getBalance(this.address) : 0n;
    }
    const contract = new ethers.Contract(tokenAddress, ["function balanceOf(address) view returns (uint256)"], this);
    return await contract.balanceOf(this.address);
  }

  async signTx(tx: ethers.TransactionRequest): Promise<string> {
    // Self-custody: always sign locally, keys never leave this process
    console.log("[TWAK] Signing transaction with local self-custody key...");
    return this.signTransaction(tx);
  }

  async sendTx(tx: ethers.TransactionRequest): Promise<ethers.TransactionResponse> {
    console.log("[TWAK] Sending transaction via Trust Wallet Agent Kit...");
    return this.sendTransaction(tx);
  }

  /**
   * Execute an autonomous token swap via TWAK REST API.
   * Falls back to returning a dry-run label if credentials missing.
   */
  async swapAssets(
    fromToken: string,
    toToken: string,
    amount: bigint
  ): Promise<ethers.TransactionResponse | string> {
    console.log(`[TWAK] Autonomous swap: ${ethers.formatEther(amount)} ${fromToken} → ${toToken}`);

    if (this.twakEnabled) {
      try {
        const result = await twakPost<{ txHash: string; status: string }>("/v1/swap/execute", {
          network: this.network,
          fromToken,
          toToken,
          amount: amount.toString(),
          wallet: this.address,
          slippageBps: parseInt(process.env.SLIPPAGE_BPS || "300"),
        });
        console.log(`[TWAK] Swap executed via API: ${result.txHash}`);
        return result.txHash;
      } catch (err: any) {
        console.warn(`[TWAK] API swap failed: ${err.message} — falling back to PancakeSwap direct`);
      }
    }

    // Fallback: execute swap directly on PancakeSwap V2 router via ethers.js
    return await this.directSwap(fromToken, toToken, amount);
  }

  /**
   * Direct PancakeSwap V2 router swap (self-custody fallback)
   */
  private async directSwap(fromToken: string, toToken: string, amount: bigint): Promise<string> {
    const PANCAKE_ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
    const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
    const USDT = "0x55d398326f99059fF775485246999027B3197955";

    const routerAbi = [
      "function swapExactETHForTokens(uint amountOutMin, address[] path, address to, uint deadline) payable returns (uint[])",
      "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] path, address to, uint deadline) returns (uint[])",
      "function getAmountsOut(uint amountIn, address[] path) view returns (uint[])",
    ];

    try {
      const router = new ethers.Contract(PANCAKE_ROUTER, routerAbi, this);
      const deadline = Math.floor(Date.now() / 1000) + 300; // 5 min
      const isFromBNB = fromToken === "BNB" || fromToken === ethers.ZeroAddress;
      const path = isFromBNB ? [WBNB, USDT] : [fromToken, WBNB, toToken];

      // Get min amount out with 3% slippage
      const amountsOut = await router.getAmountsOut(amount, path);
      const amountOutMin = (amountsOut[amountsOut.length - 1] * 97n) / 100n;

      let tx;
      if (isFromBNB) {
        tx = await router.swapExactETHForTokens(amountOutMin, path, this.address, deadline, { value: amount });
      } else {
        tx = await router.swapExactTokensForTokens(amount, amountOutMin, path, this.address, deadline);
      }

      const receipt = await tx.wait();
      console.log(`[TWAK] Direct PancakeSwap swap: ${receipt.hash}`);
      return receipt.hash;
    } catch (err: any) {
      console.error(`[TWAK] Direct swap failed: ${err.message}`);
      return `swap-failed-${Date.now()}`;
    }
  }

  async approveTokens(
    tokenAddress: string,
    spender: string,
    amount: bigint
  ): Promise<ethers.TransactionResponse | string> {
    console.log(`[TWAK] Approving ${ethers.formatEther(amount)} of ${tokenAddress} for ${spender}`);
    const contract = new ethers.Contract(tokenAddress, ["function approve(address, uint256) returns (bool)"], this);
    return await contract.approve(spender, amount);
  }

  /**
   * Emergency withdrawal — pulls funds from AegisVault to user wallet
   */
  async emergencyWithdrawal(
    user: string,
    value: bigint,
    reason: string
  ): Promise<ethers.TransactionResponse | string> {
    console.log(`[TWAK] Emergency withdrawal for ${user} value=${ethers.formatEther(value)} BNB`);
    console.log(`[TWAK] Reason: ${reason}`);

    if (this.twakEnabled) {
      try {
        const result = await twakPost<{ txHash: string }>("/v1/vault/emergency-withdraw", {
          network: this.network,
          wallet: this.address,
          user,
          value: value.toString(),
          reason,
        });
        console.log(`[TWAK] Emergency withdrawal executed: ${result.txHash}`);
        return result.txHash;
      } catch (err: any) {
        console.warn(`[TWAK] API emergency withdrawal failed: ${err.message}`);
      }
    }

    // Fallback: direct vault call via ethers.js
    const vaultAddress = process.env.VAULT_ADDRESS || "";
    if (!vaultAddress) return "no-vault-configured";

    const vaultAbi = ["function executeProtection(address user, uint8 actionType, uint256 value, bytes32 reasonHash) external"];
    const vault = new ethers.Contract(vaultAddress, vaultAbi, this);
    const tx = await vault.executeProtection(user, 0, value, ethers.keccak256(ethers.toUtf8Bytes(reason)));
    const receipt = await tx.wait();
    return receipt.hash;
  }

  /**
   * Portfolio rebalance — reallocates exposure based on risk signals
   */
  async portfolioRebalance(
    user: string,
    value: bigint,
    reason: string
  ): Promise<ethers.TransactionResponse | string> {
    console.log(`[TWAK] Portfolio rebalance for ${user} — ${reason}`);

    if (this.twakEnabled) {
      try {
        const result = await twakPost<{ txHash: string }>("/v1/portfolio/rebalance", {
          network: this.network,
          wallet: this.address,
          user,
          value: value.toString(),
          reason,
        });
        console.log(`[TWAK] Rebalance executed: ${result.txHash}`);
        return result.txHash;
      } catch (err: any) {
        console.warn(`[TWAK] API rebalance failed: ${err.message} — fallback to swap`);
      }
    }

    // Fallback: swap 50% of value to USDT as a rebalance proxy
    const halfValue = value / 2n;
    return await this.swapAssets(ethers.ZeroAddress, "0x55d398326f99059fF775485246999027B3197955", halfValue);
  }

  /**
   * Generic protection execution — maps to AegisVault.executeProtection()
   */
  async protectionExecution(
    user: string,
    actionType: number,
    value: bigint,
    reason: string
  ): Promise<ethers.TransactionResponse | string> {
    console.log(`[TWAK] Protection type=${actionType} for ${user} value=${ethers.formatEther(value)}`);

    if (this.twakEnabled) {
      try {
        const result = await twakPost<{ txHash: string }>("/v1/vault/protect", {
          network: this.network,
          wallet: this.address,
          user,
          actionType,
          value: value.toString(),
          reason,
        });
        console.log(`[TWAK] Protection executed via API: ${result.txHash}`);
        return result.txHash;
      } catch (err: any) {
        console.warn(`[TWAK] API protection failed: ${err.message} — falling back to direct vault call`);
      }
    }

    // Fallback: direct AegisVault call
    const vaultAddress = process.env.VAULT_ADDRESS || "";
    if (!vaultAddress) return "no-vault-configured";

    const vaultAbi = ["function executeProtection(address user, uint8 actionType, uint256 value, bytes32 reasonHash) external"];
    const vault = new ethers.Contract(vaultAddress, vaultAbi, this);
    const tx = await vault.executeProtection(user, actionType, value, ethers.keccak256(ethers.toUtf8Bytes(reason)));
    const receipt = await tx.wait();
    return receipt.hash;
  }
}

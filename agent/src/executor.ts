// ═══════════════════════════════════════════════════════════════
// Aegis Protocol — On-Chain Executor
// Executes protective actions and logs decisions to BSC
// ═══════════════════════════════════════════════════════════════

import { ethers } from "ethers";
import { RiskSnapshot, SuggestedAction, ThreatAssessment } from "./analyzer";
import { LegacyWalletProvider, TrustWalletAgentKitProvider, WalletProviderInterface } from "./wallet-provider";

export interface ExecutorConfig {
  privateKey: string;
  vaultAddress: string;
  registryAddress: string;
  loggerAddress: string;
  tokenGateAddress?: string;
  agentId: number;
  dryRun: boolean;
}

const VAULT_ABI = [
  "function executeProtection(address user, uint8 actionType, uint256 value, bytes32 reasonHash) external",
];

const REGISTRY_ABI = [
  "function recordAgentAction(uint256 agentId, bool wasSuccessful, uint256 valueProtected) external",
];

const LOGGER_ABI = [
  "function logDecision(uint256 agentId, address targetUser, uint8 decisionType, uint8 riskLevel, uint256 confidence, bytes32 analysisHash, bytes32 dataHash, bool actionTaken, uint256 actionId) external returns (uint256)",
  "function updateRiskSnapshot(address user, uint8 overallRisk, uint256 liquidationRisk, uint256 volatilityScore, uint256 protocolRisk, uint256 smartContractRisk, bytes32 detailsHash) external",
];

const TOKEN_GATE_ABI = [
  "function getHolderTier(address user) view returns (uint8)",
  "function isHolder(address user) view returns (bool)",
];

const ACTION_TYPE_MAP: Record<string, number> = {
  [SuggestedAction.EMERGENCY_WITHDRAW]: 0,
  [SuggestedAction.REBALANCE]: 1,
  [SuggestedAction.ALERT]: 2,
  [SuggestedAction.STOP_LOSS]: 3,
  [SuggestedAction.TAKE_PROFIT]: 4,
};

const DECISION_TYPE_MAP: Record<string, number> = {
  RiskAssessment: 0,
  ThreatDetected: 1,
  ProtectionTriggered: 2,
  AllClear: 3,
  MarketAnalysis: 4,
  PositionReview: 5,
};

export class OnChainExecutor {
  private wallet: ethers.Wallet;
  private vault: ethers.Contract;
  private registry: ethers.Contract;
  private logger: ethers.Contract;
  private tokenGate: ethers.Contract | null;
  private config: ExecutorConfig;
  private executionLog: ExecutionRecord[] = [];

  constructor(config: ExecutorConfig, provider: ethers.JsonRpcProvider) {
    this.config = config;

    const twakEnabled = process.env.TWAK_ENABLED === "true";
    if (twakEnabled) {
      console.log("Using Trust Wallet Agent Kit");
      this.wallet = new TrustWalletAgentKitProvider(config.privateKey, provider);
    } else {
      console.log("Using Legacy Executor");
      this.wallet = new LegacyWalletProvider(config.privateKey, provider);
    }

    this.vault = new ethers.Contract(config.vaultAddress, VAULT_ABI, this.wallet);
    this.registry = new ethers.Contract(config.registryAddress, REGISTRY_ABI, this.wallet);
    this.logger = new ethers.Contract(config.loggerAddress, LOGGER_ABI, this.wallet);
    this.tokenGate = config.tokenGateAddress
      ? new ethers.Contract(config.tokenGateAddress, TOKEN_GATE_ABI, this.wallet)
      : null;

    console.log("[Aegis Executor] Initialized");
    console.log(`  Agent ID: ${config.agentId}`);
    console.log(`  Operator: ${this.wallet.address}`);
    console.log(`  Dry Run: ${config.dryRun}`);
    if (this.tokenGate) console.log(`  TokenGate: ${config.tokenGateAddress}`);
  }

  async logDecision(
    threat: ThreatAssessment,
    targetUser: string,
    reasoningHash: string,
  ): Promise<string | null> {
    const actionTaken = threat.threatDetected
      && threat.suggestedAction !== SuggestedAction.NONE
      && threat.suggestedAction !== SuggestedAction.MONITOR
      && threat.suggestedAction !== SuggestedAction.ALERT;

    const decisionType = threat.threatDetected
      ? (actionTaken ? DECISION_TYPE_MAP.ProtectionTriggered : DECISION_TYPE_MAP.ThreatDetected)
      : DECISION_TYPE_MAP.AllClear;

    const confidence = Math.round(threat.confidence * 100);
    const analysisHash = this.ensureBytes32(reasoningHash);
    const dataHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify({
      threatType: threat.threatType,
      severity: threat.severity,
      suggestedAction: threat.suggestedAction,
      estimatedImpact: threat.estimatedImpact,
    })));

    console.log(`[Aegis Executor] Logging decision: type=${decisionType} risk=${threat.severity} confidence=${threat.confidence}%`);

    if (this.config.dryRun) {
      console.log("[Aegis Executor] DRY RUN — skipping on-chain log");
      this.recordExecution("logDecision", true, "dry-run", targetUser);
      return "dry-run-tx";
    }

    try {
      const tx = await this.logger.logDecision(
        this.config.agentId,
        targetUser,
        decisionType,
        threat.severity,
        confidence,
        analysisHash,
        dataHash,
        actionTaken,
        0,
      );
      const receipt = await tx.wait();
      console.log(`[Aegis Executor] Decision logged: ${receipt.hash}`);
      this.recordExecution("logDecision", true, receipt.hash, targetUser);
      return receipt.hash;
    } catch (error: any) {
      console.error("[Aegis Executor] Failed to log decision:", error.message);
      this.recordExecution("logDecision", false, error.message, targetUser);
      return null;
    }
  }

  async logRiskSnapshot(
    targetUser: string,
    snapshot: RiskSnapshot,
  ): Promise<string | null> {
    console.log(`[Aegis Executor] Logging risk snapshot: LIQ=${snapshot.liquidationRisk} VOL=${snapshot.volatilityRisk} PROTO=${snapshot.protocolRisk} SC=${snapshot.smartContractRisk}`);

    if (this.config.dryRun) {
      console.log("[Aegis Executor] DRY RUN — skipping risk snapshot");
      return "dry-run-tx";
    }

    try {
      const tx = await this.logger.updateRiskSnapshot(
        targetUser,
        snapshot.riskLevel,
        snapshot.liquidationRisk * 100,
        snapshot.volatilityRisk * 100,
        snapshot.protocolRisk * 100,
        snapshot.smartContractRisk * 100,
        ethers.keccak256(ethers.toUtf8Bytes(snapshot.reasoning)),
      );
      const receipt = await tx.wait();
      console.log(`[Aegis Executor] Risk snapshot logged: ${receipt.hash}`);
      this.recordExecution("logRiskSnapshot", true, receipt.hash, targetUser);
      return receipt.hash;
    } catch (error: any) {
      console.error("[Aegis Executor] Failed to log risk snapshot:", error.message);
      this.recordExecution("logRiskSnapshot", false, error.message, targetUser);
      return null;
    }
  }

  async executeProtection(
    userAddress: string,
    action: SuggestedAction,
    value: bigint,
    reason: string,
  ): Promise<string | null> {
    const actionType = ACTION_TYPE_MAP[action];
    if (actionType === undefined) {
      console.log(`[Aegis Executor] Action ${action} not executable on-chain`);
      return null;
    }

    console.log(`[Aegis Executor] Executing protection: ${action} for ${userAddress} value=${value}`);

    if (this.tokenGate) {
      try {
        const isHolder = await this.tokenGate.isHolder(userAddress);
        if (isHolder) {
          const tier = await this.tokenGate.getHolderTier(userAddress);
          const tierNames = ["None", "Bronze", "Silver", "Gold"];
          console.log(`[Aegis Executor] User is $UNIQ holder: ${tierNames[tier] || "Unknown"} tier — discounted fee applied`);
        }
      } catch {
        // Non-critical read.
      }
    }

    if (this.config.dryRun) {
      console.log("[Aegis Executor] DRY RUN — skipping protection execution");
      this.recordExecution("protection", true, "dry-run", userAddress);
      return "dry-run-tx";
    }

    try {
      const tx = await this.vault.executeProtection(
        userAddress,
        actionType,
        value,
        ethers.keccak256(ethers.toUtf8Bytes(reason)),
      );
      const receipt = await tx.wait();
      console.log(`[Aegis Executor] Protection executed: ${receipt.hash}`);

      await this.updateStats(true, value);
      this.recordExecution("protection", true, receipt.hash, userAddress);
      return receipt.hash;
    } catch (error: any) {
      console.error("[Aegis Executor] Protection failed:", error.message);
      this.recordExecution("protection", false, error.message, userAddress);
      return null;
    }
  }

  private async updateStats(success: boolean, valueProtected: bigint): Promise<void> {
    if (this.config.dryRun) return;

    try {
      const tx = await this.registry.recordAgentAction(
        this.config.agentId,
        success,
        valueProtected,
      );
      await tx.wait();
      console.log("[Aegis Executor] Agent stats updated");
    } catch (error: any) {
      console.error("[Aegis Executor] Stats update failed:", error.message);
    }
  }

  private ensureBytes32(value: string): string {
    if (/^0x[0-9a-fA-F]{64}$/.test(value)) return value;
    return ethers.keccak256(ethers.toUtf8Bytes(value));
  }

  private recordExecution(type: string, success: boolean, txHash: string, target: string): void {
    this.executionLog.push({ type, success, txHash, target, timestamp: Date.now() });
  }

  getExecutionLog(): ExecutionRecord[] {
    return [...this.executionLog];
  }

  getOperatorAddress(): string {
    return this.wallet.address;
  }

  getWalletProvider(): WalletProviderInterface {
    return this.wallet as unknown as WalletProviderInterface;
  }
}

interface ExecutionRecord {
  type: string;
  success: boolean;
  txHash: string;
  target: string;
  timestamp: number;
}

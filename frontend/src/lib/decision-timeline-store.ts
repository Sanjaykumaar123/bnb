// ═══════════════════════════════════════════════════════════════
// Aegis Protocol — Frontend Decision Timeline Store
// Read-only client for the timeline JSON persisted by the agent.
// ═══════════════════════════════════════════════════════════════

export type AgentStepName =
  | "observe"
  | "market_agent"
  | "liquidity_agent"
  | "whale_agent"
  | "sentiment_agent"
  | "risk_agent"
  | "guardian_policy_agent"
  | "execution_agent"
  | "supervisor"
  | "decision"
  | "execution"
  | "transaction"
  | "trade";

export interface AgentStep {
  step: AgentStepName;
  label: string;
  status: "pending" | "running" | "complete" | "skipped";
  timestamp: number;
  durationMs?: number;
  summary: string;
  details: Record<string, string | number | boolean>;
  debugOutput?: string;
}

export interface DecisionCard {
  decision: string;
  confidence: number;
  riskScore: number;
  triggeredPolicy: string | null;
  executionProvider: string;
  transactionStatus: "pending" | "executed" | "skipped" | "dry_run";
  transactionHash?: string;
}

export interface DecisionTimeline {
  id: string;
  cycleNumber: number;
  walletAddress: string;
  startTimestamp: number;
  endTimestamp: number;
  steps: AgentStep[];
  decisionCard: DecisionCard;
  reasoningHash: string;
  multiAgentEnabled: boolean;
}

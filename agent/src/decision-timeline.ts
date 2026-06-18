// ═══════════════════════════════════════════════════════════════
// Aegis Protocol — Explainable AI Decision Timeline
// Captures every agent step with timestamp + structured metadata
// Strictly additive — does not modify any existing file.
// ═══════════════════════════════════════════════════════════════

import * as fs from "fs";
import * as path from "path";

// ─── Timeline Types ────────────────────────────────────────────

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
  | "transaction";

export type AgentStepStatus = "pending" | "running" | "complete" | "skipped";

export interface AgentStep {
  step: AgentStepName;
  label: string;
  status: AgentStepStatus;
  timestamp: number;
  durationMs?: number;
  summary: string;
  details: Record<string, string | number | boolean>;
  debugOutput?: string; // only when ENABLE_AGENT_DEBUG=true
}

export interface DecisionCard {
  decision: string;        // SELL / REBALANCE / MONITOR / etc.
  confidence: number;      // 0-100
  riskScore: number;       // 0-100
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

// ─── Timeline Builder ─────────────────────────────────────────

export class DecisionTimelineBuilder {
  private steps: AgentStep[] = [];
  private startTime: number;
  private id: string;
  private debugMode: boolean;

  constructor(cycleId: string) {
    this.id = cycleId;
    this.startTime = Date.now();
    this.debugMode = process.env.ENABLE_AGENT_DEBUG === "true";
  }

  addStep(
    step: AgentStepName,
    label: string,
    summary: string,
    details: Record<string, string | number | boolean>,
    debugOutput?: string
  ): AgentStep {
    const entry: AgentStep = {
      step,
      label,
      status: "complete",
      timestamp: Date.now(),
      summary,
      details,
      debugOutput: this.debugMode ? debugOutput : undefined,
    };
    this.steps.push(entry);
    return entry;
  }

  build(
    cycleNumber: number,
    walletAddress: string,
    decisionCard: DecisionCard,
    reasoningHash: string,
    multiAgentEnabled: boolean
  ): DecisionTimeline {
    return {
      id: this.id,
      cycleNumber,
      walletAddress,
      startTimestamp: this.startTime,
      endTimestamp: Date.now(),
      steps: this.steps,
      decisionCard,
      reasoningHash,
      multiAgentEnabled,
    };
  }
}

// ─── Timeline Persistence ─────────────────────────────────────
// Stores the last N timelines in a JSON file for the frontend API to read.
// When ENABLE_POLICY_PERSISTENCE=true, also mirrors through Upstash Redis REST.

const TIMELINE_FILE = path.join(process.cwd(), "timelines.json");
const MAX_STORED_TIMELINES = 20;

export class DecisionTimelineStore {
  static async save(timeline: DecisionTimeline): Promise<void> {
    if (process.env.ENABLE_DECISION_TIMELINE !== "true") return;

    try {
      let existing: DecisionTimeline[] = [];
      if (fs.existsSync(TIMELINE_FILE)) {
        const raw = fs.readFileSync(TIMELINE_FILE, "utf-8");
        existing = JSON.parse(raw) as DecisionTimeline[];
      }

      // Prepend newest, cap to max
      existing.unshift(timeline);
      if (existing.length > MAX_STORED_TIMELINES) {
        existing = existing.slice(0, MAX_STORED_TIMELINES);
      }

      fs.writeFileSync(TIMELINE_FILE, JSON.stringify(existing, null, 2), "utf-8");

      // Optional Upstash Redis mirror
      if (
        process.env.ENABLE_POLICY_PERSISTENCE === "true" &&
        process.env.UPSTASH_REDIS_REST_URL &&
        process.env.UPSTASH_REDIS_REST_TOKEN
      ) {
        try {
          await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/set/aegis:timelines/${JSON.stringify(existing)}`, {
            method: "GET",
            headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` },
          });
        } catch {
          /* Redis mirror is best-effort */
        }
      }
    } catch (err: unknown) {
      console.warn("[DecisionTimeline] Failed to save timeline:", (err as Error).message);
    }
  }

  static async load(): Promise<DecisionTimeline[]> {
    if (process.env.ENABLE_DECISION_TIMELINE !== "true") return [];
    try {
      if (!fs.existsSync(TIMELINE_FILE)) return [];
      const raw = fs.readFileSync(TIMELINE_FILE, "utf-8");
      return JSON.parse(raw) as DecisionTimeline[];
    } catch {
      return [];
    }
  }
}

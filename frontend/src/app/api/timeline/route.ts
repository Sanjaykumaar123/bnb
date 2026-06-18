import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { DecisionTimeline } from "../../../lib/decision-timeline-store";

// Try to read timelines from the agent working directory's timelines.json
// Falls back to empty array when not found or feature is disabled.

function loadTimelines(): DecisionTimeline[] {
  if (process.env.ENABLE_DECISION_TIMELINE !== "true") return [];
  try {
    // Agent writes timelines.json to its cwd (agent/) — read from project root
    const candidates = [
      path.join(process.cwd(), "..", "agent", "timelines.json"),
      path.join(process.cwd(), "..", "timelines.json"),
      path.join(process.cwd(), "timelines.json"),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, "utf-8");
        return JSON.parse(raw) as DecisionTimeline[];
      }
    }
    return [];
  } catch {
    return [];
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "10", 10);
    const timelines = loadTimelines().slice(0, Math.min(limit, 20));
    return NextResponse.json({ success: true, timelines });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

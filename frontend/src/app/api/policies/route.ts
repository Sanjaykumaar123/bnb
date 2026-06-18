import { NextResponse } from "next/server";
import { getPolicies, savePolicies, parsePolicy, GuardianPolicy } from "@/lib/policy-store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const policies = await getPolicies();
    return NextResponse.json({ success: true, policies });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { instruction, previewOnly } = body;
    if (!instruction) {
      return NextResponse.json({ success: false, error: "Instruction is required" }, { status: 400 });
    }

    // Parse natural language to structured policy representation
    const rule = await parsePolicy(instruction);

    if (previewOnly) {
      return NextResponse.json({ success: true, rule });
    }

    const policies = await getPolicies();
    const newPolicy: GuardianPolicy = {
      id: "policy_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      originalInstruction: instruction,
      parsedRepresentation: rule,
      enabled: true,
      createdTimestamp: Date.now(),
      lastExecutedTimestamp: 0,
      executionCount: 0,
    };

    policies.push(newPolicy);
    await savePolicies(policies);

    return NextResponse.json({ success: true, policy: newPolicy });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 400 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, enabled, originalInstruction, parsedRepresentation } = body;
    if (!id) {
      return NextResponse.json({ success: false, error: "ID is required" }, { status: 400 });
    }

    const policies = await getPolicies();
    const idx = policies.findIndex(p => p.id === id);
    if (idx === -1) {
      return NextResponse.json({ success: false, error: "Policy not found" }, { status: 404 });
    }

    if (enabled !== undefined) {
      policies[idx].enabled = enabled;
    }
    if (originalInstruction !== undefined) {
      policies[idx].originalInstruction = originalInstruction;
    }
    if (parsedRepresentation !== undefined) {
      policies[idx].parsedRepresentation = parsedRepresentation;
    }

    await savePolicies(policies);
    return NextResponse.json({ success: true, policy: policies[idx] });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ success: false, error: "ID is required" }, { status: 400 });
    }

    const policies = await getPolicies();
    const filtered = policies.filter(p => p.id !== id);
    if (filtered.length === policies.length) {
      return NextResponse.json({ success: false, error: "Policy not found" }, { status: 404 });
    }

    await savePolicies(filtered);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import type { ClioSyncLogPayload } from "@/lib/jacob/clio-sync-types";
import { appendSheetRows } from "@/lib/jacob/sheets-sync";
import { SCORING_SHEET_ID } from "@/lib/google-sheets";

function authorize(req: NextRequest): boolean {
  const secret = process.env.JACOB_CLIO_INBOUND_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization") || "";
  return auth === `Bearer ${secret}`;
}

/**
 * Append one row to the "Clio Sync" intelligence tab.
 * n8n (Clio webhook) should POST here after updating GHL, or in parallel.
 */
export async function POST(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const spreadsheetId =
    process.env.JACOB_INTELLIGENCE_SHEET_ID?.trim() || SCORING_SHEET_ID;
  const tabName =
    process.env.JACOB_CLIO_SYNC_TAB_NAME?.trim() || "Clio Sync";

  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim()) {
    return NextResponse.json(
      { error: "GOOGLE_SERVICE_ACCOUNT_JSON not configured" },
      { status: 500 },
    );
  }

  let body: ClioSyncLogPayload;
  try {
    body = (await req.json()) as ClioSyncLogPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.event) {
    return NextResponse.json({ error: "event required" }, { status: 400 });
  }

  const ts = body.receivedAt || new Date().toISOString();
  const row: string[] = [
    ts,
    body.event,
    body.ghlContactId ?? "",
    body.clioMatterId ?? "",
    body.agreementStatus ?? "",
    body.paymentStatus ?? "",
    body.caseValue === null || body.caseValue === undefined
      ? ""
      : String(body.caseValue),
    (body.matterNotes ?? "").slice(0, 5000),
    body.raw ? JSON.stringify(body.raw).slice(0, 2000) : "",
  ];

  try {
    await appendSheetRows(spreadsheetId, tabName, [row]);
    return NextResponse.json({ ok: true, tabName, spreadsheetId });
  } catch (e) {
    console.error("[jacob/clio/log]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Append failed" },
      { status: 500 },
    );
  }
}

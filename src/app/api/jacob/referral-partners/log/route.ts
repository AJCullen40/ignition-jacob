export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import type { ReferralPartnerStageLogPayload } from "@/lib/jacob/referral-partner-log-types";
import { appendSheetRows } from "@/lib/jacob/sheets-sync";
import { SCORING_SHEET_ID } from "@/lib/google-sheets";

function authorize(req: NextRequest): boolean {
  const secret = process.env.JACOB_REFERRAL_PARTNER_WEBHOOK_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization") || "";
  return auth === `Bearer ${secret}`;
}

/**
 * Append one row when an opportunity hits the Referral Partner stage (or related event).
 * Called from n8n after GHL Workflow → Custom Webhook, or directly from a GHL-capable middle tier.
 */
export async function POST(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const spreadsheetId =
    process.env.JACOB_INTELLIGENCE_SHEET_ID?.trim() || SCORING_SHEET_ID;
  const tabName =
    process.env.JACOB_REFERRAL_PARTNER_TAB_NAME?.trim() ||
    "Referral Partner Log";

  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim()) {
    return NextResponse.json(
      { error: "GOOGLE_SERVICE_ACCOUNT_JSON not configured" },
      { status: 500 },
    );
  }

  let body: ReferralPartnerStageLogPayload;
  try {
    body = (await req.json()) as ReferralPartnerStageLogPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const ts = body.receivedAt || new Date().toISOString();
  const rawStr = body.raw != null ? JSON.stringify(body.raw) : "";
  const row: string[] = [
    ts,
    body.event ?? "",
    body.ghlContactId ?? "",
    body.ghlOpportunityId ?? "",
    (body.contactName ?? "").slice(0, 500),
    (body.pipelineStageName ?? "").slice(0, 500),
    (body.opportunitySource ?? "").slice(0, 500),
    (body.notes ?? "").slice(0, 2000),
    rawStr.slice(0, 4000),
  ];

  try {
    await appendSheetRows(spreadsheetId, tabName, [row]);
    return NextResponse.json({ ok: true, tabName, spreadsheetId });
  } catch (e) {
    console.error("[jacob/referral-partners/log]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Append failed" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getAllOpportunities } from "@/lib/ghl";
import { getScoringLeadsLite } from "@/lib/google-sheets";
import {
  fetchJacobCallLogRows,
  getJacobCallLogFetchInfo,
} from "@/lib/jacob/call-log";
import {
  buildReconciliationReport,
  reconciliationToSheetValues,
} from "@/lib/jacob/reconciliation";
import { overwriteSheetTab } from "@/lib/jacob/sheets-sync";
import { SCORING_SHEET_ID } from "@/lib/google-sheets";

function authorizeCron(req: NextRequest): boolean {
  const secret = process.env.JACOB_CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization") || "";
  return auth === `Bearer ${secret}`;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const cronOk = authorizeCron(req);
  if (!session?.user && !cronOk) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const spreadsheetId =
    process.env.JACOB_INTELLIGENCE_SHEET_ID?.trim() ||
    process.env.JACOB_RECONCILIATION_SPREADSHEET_ID?.trim() ||
    SCORING_SHEET_ID;
  const tabName =
    process.env.JACOB_RECONCILIATION_TAB_NAME?.trim() ||
    "Assigned vs Called";

  try {
    const [opps, calls, scoring] = await Promise.all([
      getAllOpportunities(),
      fetchJacobCallLogRows(),
      getScoringLeadsLite(),
    ]);
    const report = buildReconciliationReport(
      opps,
      calls,
      scoring,
      Date.now(),
      getJacobCallLogFetchInfo(),
    );
    const grid = reconciliationToSheetValues(report);

    let sheetSynced = false;
    if (spreadsheetId && process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim()) {
      await overwriteSheetTab(spreadsheetId, tabName, grid);
      sheetSynced = true;
    }

    return NextResponse.json({
      ok: true,
      generatedAt: report.generatedAt,
      sheetSynced,
      spreadsheetId: spreadsheetId || null,
      tabName,
      rowCount: grid.length,
      summary: report.summary,
      message: sheetSynced
        ? `Wrote ${grid.length} rows to "${tabName}".`
        : spreadsheetId
          ? "Report built; set GOOGLE_SERVICE_ACCOUNT_JSON to enable Sheets sync."
          : "Report built; set JACOB_INTELLIGENCE_SHEET_ID and GOOGLE_SERVICE_ACCOUNT_JSON to sync.",
    });
  } catch (e) {
    console.error("[jacob/reconciliation/sync]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sync failed" },
      { status: 500 },
    );
  }
}

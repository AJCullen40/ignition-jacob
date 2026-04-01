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
  buildAgentSummaryFromDetails,
  buildChannelBreakdownFromDetails,
  buildReconciliationReport,
  reconciliationDetailsToCsv,
} from "@/lib/jacob/reconciliation";

async function loadReport() {
  const [opps, calls, scoring] = await Promise.all([
    getAllOpportunities(),
    fetchJacobCallLogRows(),
    getScoringLeadsLite(),
  ]);
  return buildReconciliationReport(
    opps,
    calls,
    scoring,
    Date.now(),
    getJacobCallLogFetchInfo(),
  );
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const report = await loadReport();
    const agentQ = req.nextUrl.searchParams.get("agent")?.trim().toLowerCase();
    const channelQ = req.nextUrl.searchParams.get("channel")?.trim().toLowerCase();

    let details = report.details;
    if (agentQ) {
      details = details.filter((d) =>
        d.assignedAgent.toLowerCase().includes(agentQ),
      );
    }
    if (channelQ) {
      details = details.filter((d) =>
        d.leadSourceChannel.toLowerCase().includes(channelQ),
      );
    }

    const filtered =
      agentQ || channelQ
        ? {
            ...report,
            details,
            summary: buildAgentSummaryFromDetails(details),
            channelBreakdown: buildChannelBreakdownFromDetails(details),
          }
        : report;

    if (req.nextUrl.searchParams.get("format") === "csv") {
      const csv = reconciliationDetailsToCsv(filtered.details);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition":
            'attachment; filename="jacob-assigned-vs-called.csv"',
        },
      });
    }

    return NextResponse.json(filtered);
  } catch (e) {
    console.error("[jacob/reconciliation GET]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to build report" },
      { status: 500 },
    );
  }
}

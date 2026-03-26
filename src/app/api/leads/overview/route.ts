export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { querySalesforce } from "@/lib/salesforce";
import { getScoringLeads } from "@/lib/google-sheets";
import { normalizeSource } from "@/lib/normalize-source";
import { parseDateRange, soqlDateFilter, filterRowsByDate } from "@/lib/date-filter";

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const range = parseDateRange(params);
    const dateClause = soqlDateFilter(range);

    const [sfOpps, scoringRows] = await Promise.all([
      querySalesforce<{
        Id: string;
        StageName: string;
        Amount: number | null;
        CreatedDate: string;
      }>(
        `SELECT Id, StageName, Amount, CreatedDate FROM Opportunity WHERE ${dateClause}`
      ),
      getScoringLeads(),
    ]);

    const filtered = filterRowsByDate(scoringRows, range);

    const totalLeads = filtered.length;

    const stageCounts: Record<string, number> = {};
    for (const o of sfOpps) stageCounts[o.StageName] = (stageCounts[o.StageName] || 0) + 1;

    const retainedRaw =
      (stageCounts["Retained/Won"] || 0) +
      (stageCounts["Closed Won"] || 0) +
      (stageCounts["Retained"] || 0);
    const awaitingRetainerRaw = stageCounts["Awaiting Retainer"] || 0;
    const consultBookedRaw = stageCounts["Consultation Booked"] || 0;
    const leadQualified = stageCounts["Lead Qualified"] || 0;

    const consultationBooked = consultBookedRaw + awaitingRetainerRaw + retainedRaw;
    const awaitingRetainer = awaitingRetainerRaw + retainedRaw;
    const retained = retainedRaw;
    const totalRevenue = sfOpps
      .filter((o) => (o.StageName === "Retained/Won" || o.StageName === "Closed Won") && o.Amount)
      .reduce((sum, o) => sum + (o.Amount ?? 0), 0);

    const scoreCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const row of filtered) {
      const raw = (row["Score"] || "").trim();
      const s = parseInt(raw.match(/^(\d+)/)?.[1] || "0", 10);
      if (s >= 1 && s <= 5) scoreCounts[s]++;
    }
    const scoreDistribution = [1, 2, 3, 4, 5].map((score) => ({
      score,
      count: scoreCounts[score],
    }));

    const recentLeads = filtered.slice(-10).reverse().map((row) => ({
      id: row["ID"] || "",
      name: `${row["First Name"] || ""} ${row["Last Name"] || ""}`.trim(),
      score: parseInt((row["Score"] || "").match(/^(\d+)/)?.[1] || "0", 10),
      source: normalizeSource(row["Lead Source"] || ""),
      phoneOrigin: row["Phone Origin"] || "",
      createdAt: row["Date Created"] || "",
    }));

    return NextResponse.json({
      totalLeads,
      leadQualified,
      consultationBooked,
      awaitingRetainer,
      retained,
      totalRevenue,
      scoreDistribution,
      recentLeads,
    });
  } catch (err) {
    console.error("[leads/overview]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

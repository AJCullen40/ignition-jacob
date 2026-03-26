export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { getScoringLeads } from "@/lib/google-sheets";
import { parseDateRange, filterRowsByDate, soqlDateFilter } from "@/lib/date-filter";
import { querySalesforce } from "@/lib/salesforce";
import { normalizeSource } from "@/lib/normalize-source";

const HEATMAP_SOURCES = [
  "Facebook", "Instagram", "TikTok", "Other", "Website",
  "Google/Paid", "YouTube", "WhatsApp", "Referral", "DM",
];

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const range = parseDateRange(params);

    const rows = await getScoringLeads();
    const filtered = filterRowsByDate(rows, range);

    const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalScore = 0;
    let scored = 0;

    const sourceScoreCounts: Record<string, Record<number, number>> = {};
    for (const src of HEATMAP_SOURCES) {
      sourceScoreCounts[src] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    }

    const sfIdToScore: Record<string, number> = {};

    for (const row of filtered) {
      const s = parseInt((row["Score"] || "").match(/^(\d+)/)?.[1] || "0", 10);
      if (s < 1 || s > 5) continue;

      dist[s]++;
      totalScore += s;
      scored++;

      const src = normalizeSource(row["Lead Source"] || "");
      const bucket = HEATMAP_SOURCES.includes(src) ? src : "Other";
      sourceScoreCounts[bucket][s]++;

      const sfId = (row["SF ID"] || "").trim();
      if (sfId) sfIdToScore[sfId] = s;
    }

    const avgScore = scored > 0 ? Math.round((totalScore / scored) * 100) / 100 : 0;
    const closeCount = (dist[4] ?? 0) + (dist[5] ?? 0);

    const distribution = [1, 2, 3, 4, 5].map((score) => ({
      score,
      count: dist[score],
      percentage: scored > 0 ? Math.round((dist[score] / scored) * 1000) / 10 : 0,
    }));

    const sourceScoreMatrix = HEATMAP_SOURCES.map((source) => ({
      source,
      scores: sourceScoreCounts[source],
      total: Object.values(sourceScoreCounts[source]).reduce((a, b) => a + b, 0),
    }));

    // Booking data from Salesforce
    const bookingCountByScore: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    try {
      const dateClause = soqlDateFilter(range, "CreatedDate");
      const soql = `SELECT Id FROM Opportunity WHERE StageName IN ('Consultation Booked','Awaiting Retainer','Retained/Won','Closed Won') AND ${dateClause}`;
      const opps = await querySalesforce<{ Id: string }>(soql);
      for (const opp of opps) {
        const score = sfIdToScore[opp.Id];
        if (score && score >= 1 && score <= 5) {
          bookingCountByScore[score]++;
        }
      }
    } catch (e) {
      console.warn("[leads/scores] Salesforce booking query failed, returning zeros:", e);
    }

    const bookingsByScore = [1, 2, 3, 4, 5].map((score) => ({
      score,
      booked: bookingCountByScore[score],
      bookingRate: dist[score] > 0
        ? Math.round((bookingCountByScore[score] / dist[score]) * 10000) / 100
        : 0,
    }));

    return NextResponse.json({
      distribution,
      avgScore,
      closeToClosing: {
        count: closeCount,
        percentage: scored > 0 ? Math.round((closeCount / scored) * 1000) / 10 : 0,
      },
      totalLeads: scored,
      sourceScoreMatrix,
      bookingsByScore,
    });
  } catch (err) {
    console.error("[leads/scores]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

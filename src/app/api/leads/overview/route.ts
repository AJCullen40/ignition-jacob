export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import {
  getAllOpportunities,
  categorizeStage,
  isRetained,
} from "@/lib/ghl";
import { getScoringLeads } from "@/lib/google-sheets";
import { normalizeSource } from "@/lib/normalize-source";
import { parseDateRange, filterRowsByDate } from "@/lib/date-filter";

function isoDate(dt: string): string {
  return (dt || "").slice(0, 10);
}

/** Match SOQL THIS_MONTH when no explicit range: calendar month in UTC. */
function oppInOverviewRange(
  createdAt: string,
  range: { from: string; to: string } | null,
): boolean {
  const d = isoDate(createdAt);
  if (!range) {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth();
    const from = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
    const to = new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10);
    return d >= from && d <= to;
  }
  return d >= range.from && d <= range.to;
}

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const range = parseDateRange(params);

    const [allOpps, scoringRows] = await Promise.all([
      getAllOpportunities(),
      getScoringLeads(),
    ]);

    const sfOpps = allOpps.filter((o) => oppInOverviewRange(o.createdAt, range));

    const filtered = filterRowsByDate(scoringRows, range);

    const totalLeads = filtered.length;

    const stageCounts: Record<string, number> = {};
    for (const o of sfOpps) {
      const c = categorizeStage(o.stageName);
      stageCounts[c] = (stageCounts[c] || 0) + 1;
    }

    const retainedRaw = sfOpps.filter((o) =>
      isRetained(categorizeStage(o.stageName)),
    ).length;
    const awaitingRetainerRaw =
      (stageCounts["Agreement Sent"] || 0) +
      (stageCounts["Paid Consultation"] || 0);
    const consultBookedRaw = stageCounts["Paid Consultation"] || 0;
    const leadQualified =
      (stageCounts["Qualified"] || 0) + (stageCounts["Hot Lead"] || 0);

    const agreementSentRaw = stageCounts["Agreement Sent"] || 0;
    const consultationBooked =
      consultBookedRaw + agreementSentRaw + retainedRaw;
    const awaitingRetainer = agreementSentRaw + retainedRaw;
    const retained = retainedRaw;
    const totalRevenue = sfOpps
      .filter((o) => isRetained(categorizeStage(o.stageName)) && o.monetaryValue)
      .reduce((sum, o) => sum + (o.monetaryValue ?? 0), 0);

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

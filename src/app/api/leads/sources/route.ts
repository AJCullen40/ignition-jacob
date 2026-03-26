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

    const [sfOpps, sfAllTime, scoringRows] = await Promise.all([
      querySalesforce<{
        Id: string;
        StageName: string;
        LeadSource: string | null;
        Amount: number | null;
      }>(
        `SELECT Id, StageName, LeadSource, Amount FROM Opportunity WHERE ${dateClause}`
      ),
      querySalesforce<{
        LeadSource: string | null;
        StageName: string;
        cnt: number;
      }>(
        `SELECT LeadSource, StageName, COUNT(Id) cnt FROM Opportunity GROUP BY LeadSource, StageName`
      ),
      getScoringLeads(),
    ]);

    const filtered = filterRowsByDate(scoringRows, range);

    const sourceMap = new Map<
      string,
      {
        total: number;
        scoreSum: number;
        scored: number;
        highIntent: number;
        national: number;
        international: number;
      }
    >();

    for (const row of filtered) {
      const src = normalizeSource(row["Lead Source"] || "");
      const entry = sourceMap.get(src) ?? {
        total: 0, scoreSum: 0, scored: 0, highIntent: 0,
        national: 0, international: 0,
      };
      entry.total++;
      const s = parseInt((row["Score"] || "").match(/^(\d+)/)?.[1] || "0", 10);
      if (s >= 1 && s <= 5) {
        entry.scoreSum += s;
        entry.scored++;
        if (s >= 4) entry.highIntent++;
      }
      const origin = (row["Phone Origin"] || "").toLowerCase();
      if (origin === "national") entry.national++;
      else if (origin === "international") entry.international++;
      sourceMap.set(src, entry);
    }

    const bookedBySource = new Map<string, number>();
    const retainedBySource = new Map<string, number>();
    const revenueBySource = new Map<string, number>();
    for (const opp of sfOpps) {
      const src = normalizeSource(opp.LeadSource || "");
      if (
        opp.StageName === "Consultation Booked" ||
        opp.StageName === "Awaiting Retainer" ||
        opp.StageName === "Retained/Won" ||
        opp.StageName === "Closed Won" ||
        opp.StageName === "Retained"
      ) {
        bookedBySource.set(src, (bookedBySource.get(src) ?? 0) + 1);
      }
      if (opp.StageName === "Retained/Won" || opp.StageName === "Closed Won" || opp.StageName === "Retained") {
        retainedBySource.set(src, (retainedBySource.get(src) ?? 0) + 1);
        revenueBySource.set(src, (revenueBySource.get(src) ?? 0) + (opp.Amount ?? 0));
      }
    }

    const sources = Array.from(sourceMap.entries())
      .map(([source, data]) => {
        const booked = bookedBySource.get(source) ?? 0;
        const retained = retainedBySource.get(source) ?? 0;
        const revenue = revenueBySource.get(source) ?? 0;
        const nationalPct = data.total > 0
          ? Math.round((data.national / data.total) * 100)
          : 0;
        return {
          source,
          totalLeads: data.total,
          avgScore:
            data.scored > 0 ? Math.round((data.scoreSum / data.scored) * 100) / 100 : 0,
          highIntent: data.highIntent,
          booked,
          conversionRate: data.total > 0 ? (booked / data.total) * 100 : 0,
          retained,
          revenue,
          nationalPct,
          internationalCount: data.international,
        };
      })
      .sort((a, b) => b.totalLeads - a.totalLeads);

    // All-time SF source comparison
    const sfMap = new Map<string, { booked: number; retained: number; total: number }>();
    for (const row of sfAllTime) {
      const src = normalizeSource(row.LeadSource || "Unknown");
      const entry = sfMap.get(src) ?? { booked: 0, retained: 0, total: 0 };
      entry.total += row.cnt;
      if (
        row.StageName === "Consultation Booked" ||
        row.StageName === "Awaiting Retainer" ||
        row.StageName === "Retained/Won" ||
        row.StageName === "Closed Won" ||
        row.StageName === "Retained"
      ) {
        entry.booked += row.cnt;
      }
      if (row.StageName === "Retained/Won" || row.StageName === "Closed Won" || row.StageName === "Retained") {
        entry.retained += row.cnt;
      }
      sfMap.set(src, entry);
    }
    const sfSourceComparison = Array.from(sfMap.entries())
      .map(([source, d]) => ({ source, ...d }))
      .sort((a, b) => b.total - a.total);

    return NextResponse.json({ sources, sfSourceComparison });
  } catch (err) {
    console.error("[leads/sources]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

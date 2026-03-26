export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import {
  getAllOpportunities,
  categorizeStage,
  isRetained,
  isBookingPlus,
} from "@/lib/ghl";
import { getScoringLeads } from "@/lib/google-sheets";
import { normalizeSource } from "@/lib/normalize-source";
import { parseDateRange, filterRowsByDate, type DateRange } from "@/lib/date-filter";

function oppCreatedInReportRange(createdAt: string, range: DateRange | null): boolean {
  const day = createdAt.slice(0, 10);
  if (!range) {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const pad = (n: number) => String(n).padStart(2, "0");
    const start = `${y}-${pad(m + 1)}-01`;
    const lastDay = new Date(y, m + 1, 0).getDate();
    const end = `${y}-${pad(m + 1)}-${pad(lastDay)}`;
    return day >= start && day <= end;
  }
  return day >= range.from && day <= range.to;
}

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const range = parseDateRange(params);

    const [allOpps, scoringRows] = await Promise.all([
      getAllOpportunities(),
      getScoringLeads(),
    ]);

    const filtered = filterRowsByDate(scoringRows, range);

    const oppsInRange = allOpps.filter((o) =>
      oppCreatedInReportRange(o.createdAt, range),
    );

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
    for (const opp of oppsInRange) {
      const cat = categorizeStage(opp.stageName);
      const src = normalizeSource(opp.source || "");
      if (isBookingPlus(cat)) {
        bookedBySource.set(src, (bookedBySource.get(src) ?? 0) + 1);
      }
      if (isRetained(cat)) {
        retainedBySource.set(src, (retainedBySource.get(src) ?? 0) + 1);
        revenueBySource.set(
          src,
          (revenueBySource.get(src) ?? 0) + (opp.monetaryValue ?? 0),
        );
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

    const sfMap = new Map<string, { booked: number; retained: number; total: number }>();
    for (const opp of allOpps) {
      const src = normalizeSource(opp.source || "Unknown");
      const cat = categorizeStage(opp.stageName);
      const entry = sfMap.get(src) ?? { booked: 0, retained: 0, total: 0 };
      entry.total += 1;
      if (isBookingPlus(cat)) {
        entry.booked += 1;
      }
      if (isRetained(cat)) {
        entry.retained += 1;
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
      { status: 500 },
    );
  }
}

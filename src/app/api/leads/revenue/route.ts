export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { querySalesforce } from "@/lib/salesforce";
import { normalizeSource } from "@/lib/normalize-source";
import { parseDateRange, soqlDateFilter } from "@/lib/date-filter";

const RETAINED_STAGES = "'Retained/Won', 'Closed Won'";
const CONSULT_STAGES = "'Consultation Booked', 'Awaiting Retainer'";
const ALL_STAGES = `${RETAINED_STAGES}, ${CONSULT_STAGES}`;

interface SFOpp {
  Id: string;
  Name: string;
  Amount: number | null;
  LeadSource: string | null;
  CreatedDate: string;
  CloseDate: string | null;
  StageName: string;
}

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const range = parseDateRange(params);
    const dateClause = soqlDateFilter(range);

    const [opps, allTimeOpps] = await Promise.all([
      querySalesforce<SFOpp>(
        `SELECT Id, Name, Amount, LeadSource, CreatedDate, CloseDate, StageName FROM Opportunity WHERE StageName IN (${ALL_STAGES}) AND ${dateClause}`
      ),
      querySalesforce<SFOpp>(
        `SELECT Id, Amount, CloseDate, StageName FROM Opportunity WHERE StageName IN (${RETAINED_STAGES})`
      ),
    ]);

    const isRetained = (s: string) => s === "Retained/Won" || s === "Closed Won";

    const retainedOpps = opps.filter((o) => isRetained(o.StageName));
    const consultOpps = opps.filter((o) => !isRetained(o.StageName));

    const retainerRevenue = retainedOpps.reduce((s, o) => s + (o.Amount ?? 0), 0);
    const consultationRevenue = consultOpps.reduce((s, o) => s + (o.Amount ?? 0), 0);
    const totalRevenue = retainerRevenue + consultationRevenue;
    const totalRetained = retainedOpps.length;
    const avgRevenuePerRetained = totalRetained > 0 ? Math.round(totalRevenue / totalRetained) : 0;

    // Monthly retained for last 6 months
    const now = new Date();
    const monthlyMap = new Map<string, number>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthlyMap.set(`${String(d.getMonth() + 1).padStart(2, "0")}`, 0);
    }
    for (const opp of retainedOpps) {
      const dt = opp.CloseDate || opp.CreatedDate;
      if (!dt) continue;
      const mm = dt.slice(5, 7);
      if (monthlyMap.has(mm)) {
        monthlyMap.set(mm, (monthlyMap.get(mm) ?? 0) + 1);
      }
    }
    const monthlyRetained = Array.from(monthlyMap.entries()).map(([month, count]) => ({ month, count }));

    // Revenue by source (from retained opps only for source stats)
    const sourceAgg = new Map<string, { totalRevenue: number; retainers: number }>();
    for (const opp of retainedOpps) {
      const src = normalizeSource(opp.LeadSource || "");
      const entry = sourceAgg.get(src) ?? { totalRevenue: 0, retainers: 0 };
      entry.totalRevenue += opp.Amount ?? 0;
      entry.retainers++;
      sourceAgg.set(src, entry);
    }

    const sources = Array.from(sourceAgg.entries())
      .map(([source, d]) => ({
        source,
        retainers: d.retainers,
        totalRevenue: Math.round(d.totalRevenue * 100) / 100,
        avgRetainerValue: d.retainers > 0 ? Math.round((d.totalRevenue / d.retainers) * 100) / 100 : 0,
        costPerLead: 0,
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue);

    // All-time SF stats
    const sfTotalRevenue = allTimeOpps.reduce((s, o) => s + (o.Amount ?? 0), 0);
    const sfTotalRetained = allTimeOpps.length;
    const sfAvgPerRetained = sfTotalRetained > 0 ? Math.round(sfTotalRevenue / sfTotalRetained) : 0;

    // Monthly retained for all-time (last 6 months from all-time data)
    const sfMonthlyMap = new Map<string, number>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      sfMonthlyMap.set(`${String(d.getMonth() + 1).padStart(2, "0")}`, 0);
    }
    for (const opp of allTimeOpps) {
      const dt = opp.CloseDate;
      if (!dt) continue;
      const mm = dt.slice(5, 7);
      if (sfMonthlyMap.has(mm)) {
        sfMonthlyMap.set(mm, (sfMonthlyMap.get(mm) ?? 0) + 1);
      }
    }
    const sfMonthlyRetained = Array.from(sfMonthlyMap.entries()).map(([month, count]) => ({ month, count }));

    return NextResponse.json({
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      consultationRevenue: Math.round(consultationRevenue * 100) / 100,
      retainerRevenue: Math.round(retainerRevenue * 100) / 100,
      totalRetained,
      avgRevenuePerRetained,
      monthlyRetained,
      sources,
      sfTotalRevenue: Math.round(sfTotalRevenue * 100) / 100,
      sfTotalRetained,
      sfAvgPerRetained,
      sfMonthlyRetained,
    });
  } catch (err) {
    console.error("[leads/revenue]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

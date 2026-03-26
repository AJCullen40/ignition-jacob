export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import {
  getAllOpportunities,
  categorizeStage,
  isRetained,
  isBookingPlus,
} from "@/lib/ghl";
import { normalizeSource } from "@/lib/normalize-source";
import { parseDateRange, type DateRange } from "@/lib/date-filter";

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

function inRevenueFunnel(cat: string): boolean {
  return isBookingPlus(cat) || cat === "Consultation Booked";
}

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const range = parseDateRange(params);

    const allOpps = await getAllOpportunities();

    const opps = allOpps.filter((o) => {
      const cat = categorizeStage(o.stageName);
      return oppCreatedInReportRange(o.createdAt, range) && inRevenueFunnel(cat);
    });

    const allTimeOpps = allOpps.filter((o) =>
      isRetained(categorizeStage(o.stageName)),
    );

    const retainedOpps = opps.filter((o) =>
      isRetained(categorizeStage(o.stageName)),
    );
    const consultOpps = opps.filter(
      (o) => !isRetained(categorizeStage(o.stageName)),
    );

    const retainerRevenue = retainedOpps.reduce((s, o) => s + (o.monetaryValue ?? 0), 0);
    const consultationRevenue = consultOpps.reduce((s, o) => s + (o.monetaryValue ?? 0), 0);
    const totalRevenue = retainerRevenue + consultationRevenue;
    const totalRetained = retainedOpps.length;
    const avgRevenuePerRetained = totalRetained > 0 ? Math.round(totalRevenue / totalRetained) : 0;

    const now = new Date();
    const monthlyMap = new Map<string, number>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthlyMap.set(`${String(d.getMonth() + 1).padStart(2, "0")}`, 0);
    }
    for (const opp of retainedOpps) {
      const dt = opp.updatedAt || opp.createdAt;
      if (!dt) continue;
      const mm = dt.slice(5, 7);
      if (monthlyMap.has(mm)) {
        monthlyMap.set(mm, (monthlyMap.get(mm) ?? 0) + 1);
      }
    }
    const monthlyRetained = Array.from(monthlyMap.entries()).map(([month, count]) => ({ month, count }));

    const sourceAgg = new Map<string, { totalRevenue: number; retainers: number }>();
    for (const opp of retainedOpps) {
      const src = normalizeSource(opp.source || "");
      const entry = sourceAgg.get(src) ?? { totalRevenue: 0, retainers: 0 };
      entry.totalRevenue += opp.monetaryValue ?? 0;
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

    const sfTotalRevenue = allTimeOpps.reduce((s, o) => s + (o.monetaryValue ?? 0), 0);
    const sfTotalRetained = allTimeOpps.length;
    const sfAvgPerRetained = sfTotalRetained > 0 ? Math.round(sfTotalRevenue / sfTotalRetained) : 0;

    const sfMonthlyMap = new Map<string, number>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      sfMonthlyMap.set(`${String(d.getMonth() + 1).padStart(2, "0")}`, 0);
    }
    for (const opp of allTimeOpps) {
      const dt = opp.updatedAt;
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
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { querySalesforce } from "@/lib/salesforce";
import { getScoringLeads } from "@/lib/google-sheets";
import { parseDateRange, filterRowsByDate } from "@/lib/date-filter";
import { normalizeSource } from "@/lib/normalize-source";

const ACTIVE_PIPELINE = [
  "Lead Outreach",
  "Lead Qualified",
  "Consultation Booked",
  "Awaiting Retainer",
];

const RETAINED_STAGES = ["Retained/Won", "Closed Won", "Retained"];
const BOOKING_PLUS = [
  "Consultation Booked",
  "Awaiting Retainer",
  ...RETAINED_STAGES,
];

const STAGE_COLORS: Record<string, string> = {
  "Lead Outreach": "#3b82f6",
  "Lead Qualified": "#8b5cf6",
  "Consultation Booked": "#f59e0b",
  "Awaiting Retainer": "#22c55e",
};

interface SFOpp {
  Id: string;
  StageName: string;
  Amount: number | null;
  LeadSource: string | null;
  CreatedDate: string;
  CloseDate: string | null;
  IsClosed: boolean;
  AccountId: string | null;
  Name: string;
}

interface SFLead {
  Id: string;
  IsConverted: boolean;
  ConvertedAccountId: string | null;
}

function isSaneDate(d: string | null): boolean {
  if (!d) return false;
  const y = parseInt((d || "").slice(0, 4), 10);
  return y >= 2010 && y <= 2027;
}

function isoDate(dt: string): string {
  return (dt || "").slice(0, 10);
}

export async function GET(req: NextRequest) {
  try {
    const range = parseDateRange(req.nextUrl.searchParams);

    const [allOppsRaw, sfLeads, scoringRowsRaw] = await Promise.all([
      querySalesforce<SFOpp>(
        "SELECT Id, StageName, Amount, LeadSource, CreatedDate, CloseDate, IsClosed, AccountId, Name FROM Opportunity",
      ),
      querySalesforce<SFLead>(
        "SELECT Id, IsConverted, ConvertedAccountId FROM Lead",
      ),
      getScoringLeads(),
    ]);

    const allOpps = allOppsRaw.filter((o) => isSaneDate(o.CreatedDate));

    const scoringRows = filterRowsByDate(scoringRowsRaw, range);

    const oppsInRange = range
      ? allOpps.filter((o) => {
          const d = isoDate(o.CreatedDate);
          return d >= range.from && d <= range.to;
        })
      : allOpps;

    // ═══════════════════════════════════════════════════
    // 1. PIPELINE VALUE NOW (current open deals, no date filter)
    // ═══════════════════════════════════════════════════
    const activeOpps = allOpps.filter((o) => !o.IsClosed);
    const stages = ACTIVE_PIPELINE.map((stage) => {
      const opps = activeOpps.filter((o) => o.StageName === stage);
      return {
        stage,
        count: opps.length,
        value: opps.reduce((sum, o) => sum + (o.Amount ?? 0), 0),
        color: STAGE_COLORS[stage] ?? "#6b7280",
      };
    });

    const closableOpps = activeOpps.filter(
      (o) => o.StageName === "Awaiting Retainer",
    );

    const pipelineNow = {
      totalValue: stages.reduce((s, p) => s + p.value, 0),
      dealCount: stages.reduce((s, p) => s + p.count, 0),
      closableValue: closableOpps.reduce(
        (s, o) => s + (o.Amount ?? 0),
        0,
      ),
      closableCount: closableOpps.length,
      stages,
    };

    // ═══════════════════════════════════════════════════
    // 2. BOOKED → RETAINED CONVERSION RATE
    // ═══════════════════════════════════════════════════
    const bookedPlus = oppsInRange.filter((o) =>
      BOOKING_PLUS.includes(o.StageName),
    ).length;
    const retainedCount = oppsInRange.filter((o) =>
      RETAINED_STAGES.includes(o.StageName),
    ).length;
    const bookedToRetained = {
      totalBooked: bookedPlus,
      totalRetained: retainedCount,
      rate:
        bookedPlus > 0
          ? Math.round((retainedCount / bookedPlus) * 1000) / 10
          : 0,
    };

    // ═══════════════════════════════════════════════════
    // 3. MONEY LEFT ON THE TABLE
    // ═══════════════════════════════════════════════════
    const retainedAllTime = allOpps.filter((o) =>
      RETAINED_STAGES.includes(o.StageName),
    );
    const retainedWithRevenue = retainedAllTime.filter(
      (o) => o.Amount != null && o.Amount > 0,
    );
    const avgRetainerValue =
      retainedWithRevenue.length > 0
        ? retainedWithRevenue.reduce((s, o) => s + (o.Amount ?? 0), 0) /
          retainedWithRevenue.length
        : 5000;

    const hotLeads = scoringRows.filter((r) => {
      const score = parseInt(
        (r["Score"] || "").match(/^(\d+)/)?.[1] || "0",
        10,
      );
      return score >= 4;
    });

    const hotWithSfId = hotLeads.filter(
      (r) => (r["SF ID"] || "").trim() !== "",
    );
    const hotNoSfId = hotLeads.length - hotWithSfId.length;

    // Build Lead ID → Account ID map (converted leads only)
    const leadToAccount = new Map<string, string>();
    for (const l of sfLeads) {
      if (l.IsConverted && l.ConvertedAccountId) {
        leadToAccount.set(l.Id, l.ConvertedAccountId);
      }
    }

    // Build Account ID → has booking-stage opportunity
    const accountsWithBooking = new Set<string>();
    for (const o of allOpps) {
      if (o.AccountId && BOOKING_PLUS.includes(o.StageName)) {
        accountsWithBooking.add(o.AccountId);
      }
    }

    // Check which Lead IDs have a booking through the chain
    const leadIdsWithBooking = new Set<string>();
    for (const [leadId, accountId] of leadToAccount) {
      if (accountsWithBooking.has(accountId)) {
        leadIdsWithBooking.add(leadId);
      }
    }

    let convertedCount = 0;
    const hotWithSfIdNotBooked = hotWithSfId.filter((r) => {
      const sfId = (r["SF ID"] || "").trim();
      const isConverted = leadToAccount.has(sfId);
      if (isConverted) convertedCount++;
      return !leadIdsWithBooking.has(sfId);
    });
    const hotNotConverted = hotWithSfId.length - convertedCount;

    const topRecoveryLeads = hotWithSfIdNotBooked
      .map((r) => ({
        name: `${(r["First Name"] || "").trim()} ${(r["Last Name"] || "").trim()}`.trim(),
        score: parseInt(
          (r["Score"] || "").match(/^(\d+)/)?.[1] || "0",
          10,
        ),
        source: normalizeSource(r["Lead Source"] || ""),
        phone: (r["phone number"] || r["Phone"] || "").trim(),
        date: (r["Date Created"] || r["Date Created "] || "").trim(),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 25);

    const neverBookedCount = hotWithSfIdNotBooked.length;

    const RECOVERY_RATE = 0.15;
    const totalDropped = hotNoSfId + neverBookedCount;

    const moneyOnTable = {
      estimatedValue: Math.round(
        totalDropped * RECOVERY_RATE * avgRetainerValue,
      ),
      recoveryRate: RECOVERY_RATE,
      hotLeadsTotal: hotLeads.length,
      inSalesforceNotBooked: neverBookedCount,
      notInSalesforce: hotNoSfId,
      sfNotConverted: hotNotConverted,
      bookedCount: hotWithSfId.length - neverBookedCount,
      avgRetainerValue: Math.round(avgRetainerValue),
      topRecoveryLeads,
    };

    // ═══════════════════════════════════════════════════
    // 4. CHANNEL PERFORMANCE (SF Opportunities only for consistency)
    // ═══════════════════════════════════════════════════
    const channelMap = new Map<
      string,
      { total: number; booked: number; retained: number; revenue: number }
    >();

    for (const o of oppsInRange) {
      const src = normalizeSource(o.LeadSource || "");
      const entry = channelMap.get(src) ?? {
        total: 0,
        booked: 0,
        retained: 0,
        revenue: 0,
      };
      entry.total++;
      if (BOOKING_PLUS.includes(o.StageName)) entry.booked++;
      if (RETAINED_STAGES.includes(o.StageName)) {
        entry.retained++;
        entry.revenue += o.Amount ?? 0;
      }
      channelMap.set(src, entry);
    }

    const channelPerformance = Array.from(channelMap.entries())
      .map(([source, d]) => ({
        source,
        totalLeads: d.total,
        booked: d.booked,
        retained: d.retained,
        revenue: d.revenue,
        bookedRate:
          d.total > 0
            ? Math.round((d.booked / d.total) * 1000) / 10
            : 0,
        retainedRate:
          d.booked > 0
            ? Math.round((d.retained / d.booked) * 1000) / 10
            : 0,
      }))
      .filter((c) => c.totalLeads > 0)
      .sort((a, b) => b.retained - a.retained || b.totalLeads - a.totalLeads);

    // ═══════════════════════════════════════════════════
    // 5. RECENT RETAINED CLIENTS
    // ═══════════════════════════════════════════════════
    const recentRetained = retainedAllTime
      .filter((o) => isSaneDate(o.CloseDate || o.CreatedDate))
      .sort(
        (a, b) =>
          new Date(b.CloseDate || b.CreatedDate).getTime() -
          new Date(a.CloseDate || a.CreatedDate).getTime(),
      )
      .slice(0, 10)
      .map((o) => ({
        name: o.Name || "—",
        source: normalizeSource(o.LeadSource || ""),
        value: o.Amount ?? 0,
        date: (o.CloseDate || o.CreatedDate || "").slice(0, 10),
      }));

    // ═══════════════════════════════════════════════════
    // 6. MONTHLY RETAINED CLIENTS TREND
    // ═══════════════════════════════════════════════════
    const monthMap = new Map<string, { revenue: number; count: number }>();
    for (const o of retainedAllTime) {
      const d = o.CloseDate || o.CreatedDate || "";
      if (!isSaneDate(d)) continue;
      const month = d.slice(0, 7);
      if (!month) continue;
      const entry = monthMap.get(month) ?? { revenue: 0, count: 0 };
      entry.revenue += o.Amount ?? 0;
      entry.count++;
      monthMap.set(month, entry);
    }
    const monthlyRevenue = Array.from(monthMap.entries())
      .map(([month, d]) => ({ month, revenue: d.revenue, count: d.count }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // ═══════════════════════════════════════════════════
    // 7. SUMMARY STATS
    // ═══════════════════════════════════════════════════
    const totalRetainedAllTime = retainedAllTime.length;
    const totalRevenueAllTime = retainedAllTime.reduce(
      (s, o) => s + (o.Amount ?? 0),
      0,
    );

    return NextResponse.json({
      pipelineNow,
      bookedToRetained,
      moneyOnTable,
      channelPerformance,
      recentRetained,
      monthlyRevenue,
      summary: {
        totalRetainedAllTime,
        totalRevenueAllTime,
        avgRetainerValue: Math.round(avgRetainerValue),
        oppsWithAmounts: retainedWithRevenue.length,
        totalRetainedOpps: retainedAllTime.length,
      },
    });
  } catch (err) {
    console.error("[revenue/command-centre]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}

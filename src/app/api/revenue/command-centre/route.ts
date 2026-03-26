export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import {
  getAllOpportunities,
  categorizeStage,
  isRetained,
  isBookingPlus,
  ACTIVE_PIPELINE_CATEGORIES,
  PIPELINE_DISPLAY_STAGES,
  type GHLOpportunity,
} from "@/lib/ghl";
import { getScoringLeads } from "@/lib/google-sheets";
import { parseDateRange, filterRowsByDate } from "@/lib/date-filter";
import { normalizeSource } from "@/lib/normalize-source";

function isSaneDate(d: string | null): boolean {
  if (!d) return false;
  const y = parseInt((d || "").slice(0, 4), 10);
  return y >= 2010 && y <= 2027;
}

function isoDate(dt: string): string {
  return (dt || "").slice(0, 10);
}

function cat(opp: GHLOpportunity): string {
  return categorizeStage(opp.stageName);
}

function isOpenPipelineCategory(c: string): boolean {
  return (
    ACTIVE_PIPELINE_CATEGORIES.has(c) ||
    c === "Agreement Sent" ||
    c === "Paid Consultation" ||
    c === "Retained"
  );
}

export async function GET(req: NextRequest) {
  try {
    const range = parseDateRange(req.nextUrl.searchParams);

    const [allOppsRaw, scoringRowsRaw] = await Promise.all([
      getAllOpportunities(),
      getScoringLeads(),
    ]);

    const allOpps = allOppsRaw.filter((o) => isSaneDate(o.createdAt));

    const scoringRows = filterRowsByDate(scoringRowsRaw, range);

    const oppsInRange = range
      ? allOpps.filter((o) => {
          const d = isoDate(o.createdAt);
          return d >= range.from && d <= range.to;
        })
      : allOpps;

    // ═══════════════════════════════════════════════════
    // 1. PIPELINE VALUE NOW (current open deals, no date filter)
    // ═══════════════════════════════════════════════════
    const activeOpps = allOpps.filter(
      (o) => o.status === "open" && isOpenPipelineCategory(cat(o)),
    );
    const stages = PIPELINE_DISPLAY_STAGES.map(
      ({ label: stage, color, categories }) => {
        const opps = activeOpps.filter((o) => categories.includes(cat(o)));
        return {
          stage,
          count: opps.length,
          value: opps.reduce((sum, o) => sum + (o.monetaryValue ?? 0), 0),
          color,
        };
      },
    );

    const closableOpps = activeOpps.filter((o) => cat(o) === "Agreement Sent");

    const pipelineNow = {
      totalValue: stages.reduce((s, p) => s + p.value, 0),
      dealCount: stages.reduce((s, p) => s + p.count, 0),
      closableValue: closableOpps.reduce(
        (s, o) => s + (o.monetaryValue ?? 0),
        0,
      ),
      closableCount: closableOpps.length,
      stages,
    };

    // ═══════════════════════════════════════════════════
    // 2. BOOKED → RETAINED CONVERSION RATE
    // ═══════════════════════════════════════════════════
    const bookedPlus = oppsInRange.filter((o) => isBookingPlus(cat(o))).length;
    const retainedCount = oppsInRange.filter((o) => isRetained(cat(o))).length;
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
    const retainedAllTime = allOpps.filter((o) => isRetained(cat(o)));
    const retainedWithRevenue = retainedAllTime.filter(
      (o) => o.monetaryValue != null && o.monetaryValue > 0,
    );
    const avgRetainerValue =
      retainedWithRevenue.length > 0
        ? retainedWithRevenue.reduce(
            (s, o) => s + (o.monetaryValue ?? 0),
            0,
          ) / retainedWithRevenue.length
        : 5000;

    const hotLeads = scoringRows.filter((r) => {
      const score = parseInt(
        (r["Score"] || "").match(/^(\d+)/)?.[1] || "0",
        10,
      );
      return score >= 4;
    });

    const hotWithGhlId = hotLeads.filter(
      (r) => (r["ID"] || "").trim() !== "",
    );
    const hotNoGhlId = hotLeads.length - hotWithGhlId.length;

    const contactsWithBooking = new Set<string>();
    const allOppContactIds = new Set<string>();
    for (const o of allOpps) {
      const id = o.contact?.id;
      if (!id) continue;
      allOppContactIds.add(id);
      if (isBookingPlus(cat(o))) {
        contactsWithBooking.add(id);
      }
    }

    let convertedCount = 0;
    const hotWithGhlIdNotBooked = hotWithGhlId.filter((r) => {
      const contactId = (r["ID"] || "").trim();
      const hasAnyOpp = allOppContactIds.has(contactId);
      if (hasAnyOpp) convertedCount++;
      return !contactsWithBooking.has(contactId);
    });
    const hotNotConverted = hotWithGhlId.length - convertedCount;

    const topRecoveryLeads = hotWithGhlIdNotBooked
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

    const neverBookedCount = hotWithGhlIdNotBooked.length;

    const RECOVERY_RATE = 0.15;
    const totalDropped = hotNoGhlId + neverBookedCount;

    const moneyOnTable = {
      estimatedValue: Math.round(
        totalDropped * RECOVERY_RATE * avgRetainerValue,
      ),
      recoveryRate: RECOVERY_RATE,
      hotLeadsTotal: hotLeads.length,
      inSalesforceNotBooked: neverBookedCount,
      notInSalesforce: hotNoGhlId,
      sfNotConverted: hotNotConverted,
      bookedCount: hotWithGhlId.length - neverBookedCount,
      avgRetainerValue: Math.round(avgRetainerValue),
      topRecoveryLeads,
    };

    // ═══════════════════════════════════════════════════
    // 4. CHANNEL PERFORMANCE (GHL opportunities)
    // ═══════════════════════════════════════════════════
    const channelMap = new Map<
      string,
      { total: number; booked: number; retained: number; revenue: number }
    >();

    for (const o of oppsInRange) {
      const src = normalizeSource(o.source || "");
      const c = cat(o);
      const entry = channelMap.get(src) ?? {
        total: 0,
        booked: 0,
        retained: 0,
        revenue: 0,
      };
      entry.total++;
      if (isBookingPlus(c)) entry.booked++;
      if (isRetained(c)) {
        entry.retained++;
        entry.revenue += o.monetaryValue ?? 0;
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
      .filter((o) => isSaneDate(o.updatedAt || o.createdAt))
      .sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt).getTime() -
          new Date(a.updatedAt || a.createdAt).getTime(),
      )
      .slice(0, 10)
      .map((o) => ({
        name: o.name || "—",
        source: normalizeSource(o.source || ""),
        value: o.monetaryValue ?? 0,
        date: (o.updatedAt || o.createdAt || "").slice(0, 10),
      }));

    // ═══════════════════════════════════════════════════
    // 6. MONTHLY RETAINED CLIENTS TREND
    // ═══════════════════════════════════════════════════
    const monthMap = new Map<string, { revenue: number; count: number }>();
    for (const o of retainedAllTime) {
      const d = o.updatedAt || o.createdAt || "";
      if (!isSaneDate(d)) continue;
      const month = d.slice(0, 7);
      if (!month) continue;
      const entry = monthMap.get(month) ?? { revenue: 0, count: 0 };
      entry.revenue += o.monetaryValue ?? 0;
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
      (s, o) => s + (o.monetaryValue ?? 0),
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

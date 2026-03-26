export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { getFBLeadFormData } from "@/lib/google-sheets";
import { parseDateRange } from "@/lib/date-filter";

function normalizeCampaign(name: string): string {
  const n = name.trim();
  if (/RBB/i.test(n)) return "Legacy RBB (TOF)";
  if (/BOF/i.test(n)) return "Legacy BOF (Brad Show)";
  if (/Warm/i.test(n)) return "SB Warm (Retargeting)";
  if (/Cold/i.test(n)) return "SB Cold (Interest)";
  return n || "Unknown";
}

function parseUSDate(dateStr: string): string | null {
  const m = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}

function isDummy(email: string): boolean {
  return /dummyemail|test@|fake@|noreply/i.test(email);
}

const AD_COLUMNS = ["Ad ID", "Traffic Source", "Lead Price", "Converted?"];

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const range = parseDateRange(params);

    let rows = await getFBLeadFormData();

    if (range) {
      rows = rows.filter((row) => {
        const d = parseUSDate(row["Date"] || "");
        if (!d) return true;
        return d >= range.from && d <= range.to;
      });
    }

    const campaignMap = new Map<string, { total: number; dates: string[] }>();
    const dailyMap = new Map<string, Map<string, number>>();
    const adIdCounts = new Map<string, { count: number; campaign: string }>();
    const allDates: string[] = [];
    const phones = new Set<string>();
    let dummyEmails = 0;

    for (const row of rows) {
      const campaign = normalizeCampaign(row["Campaign Name"] || "");
      const isoDate = parseUSDate(row["Date"] || "");
      const email = (row["Email"] || "").toLowerCase();
      const phone = row["Phone"] || "";

      const entry = campaignMap.get(campaign) ?? { total: 0, dates: [] };
      entry.total++;
      if (isoDate) entry.dates.push(isoDate);
      campaignMap.set(campaign, entry);

      if (isoDate) {
        allDates.push(isoDate);
        if (!dailyMap.has(isoDate)) dailyMap.set(isoDate, new Map());
        const dayEntry = dailyMap.get(isoDate)!;
        dayEntry.set(campaign, (dayEntry.get(campaign) ?? 0) + 1);
      }

      for (const col of AD_COLUMNS) {
        const val = (row[col] || "").trim();
        if (/^\d{15,}$/.test(val)) {
          const existing = adIdCounts.get(val);
          if (existing) {
            existing.count++;
          } else {
            adIdCounts.set(val, { count: 1, campaign });
          }
        }
      }

      if (phone && !phone.includes("ERROR")) {
        phones.add(phone);
      }
      if (isDummy(email)) dummyEmails++;
    }

    const totalLeads = rows.length;
    const sortedDates = [...new Set(allDates)].sort();
    const daysActive = sortedDates.length;

    const campaignPerformance = Array.from(campaignMap.entries())
      .map(([campaign, data]) => {
        const sorted = data.dates.sort();
        return {
          campaign,
          totalLeads: data.total,
          pctOfTotal:
            totalLeads > 0
              ? Math.round((data.total / totalLeads) * 1000) / 10
              : 0,
          avgLeadsPerDay:
            daysActive > 0
              ? Math.round((data.total / daysActive) * 10) / 10
              : 0,
          firstLead: sorted[0] || null,
          lastLead: sorted[sorted.length - 1] || null,
        };
      })
      .sort((a, b) => b.totalLeads - a.totalLeads);

    const campaignNames = campaignPerformance.map((c) => c.campaign);

    const dailyVolume = Array.from(dailyMap.entries())
      .map(([date, campaigns]) => {
        const byCampaign: Record<string, number> = {};
        let total = 0;
        for (const name of campaignNames) {
          byCampaign[name] = campaigns.get(name) ?? 0;
          total += byCampaign[name];
        }
        return { date, total, byCampaign };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    const topAds = Array.from(adIdCounts.entries())
      .map(([adId, data]) => ({
        adId,
        leads: data.count,
        pctOfTotal:
          totalLeads > 0
            ? Math.round((data.count / totalLeads) * 1000) / 10
            : 0,
        campaign: data.campaign,
      }))
      .sort((a, b) => b.leads - a.leads)
      .slice(0, 10)
      .map((ad, i) => ({ rank: i + 1, ...ad }));

    let bestDay = "";
    let bestDayLeads = 0;
    for (const dv of dailyVolume) {
      if (dv.total > bestDayLeads) {
        bestDayLeads = dv.total;
        bestDay = dv.date;
      }
    }

    const quickStats = {
      totalLeads,
      dateRange:
        sortedDates.length > 0
          ? `${sortedDates[0]} — ${sortedDates[sortedDates.length - 1]}`
          : "—",
      daysActive,
      avgLeadsPerDay:
        daysActive > 0
          ? Math.round((totalLeads / daysActive) * 10) / 10
          : 0,
      bestDay,
      bestDayLeads,
      dummyEmails,
      uniquePhones: phones.size,
    };

    return NextResponse.json({
      campaignPerformance,
      dailyVolume,
      topAds,
      quickStats,
      campaignNames,
    });
  } catch (err) {
    console.error("[leads/paid-media]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}

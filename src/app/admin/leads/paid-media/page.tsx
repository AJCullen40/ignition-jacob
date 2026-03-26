"use client";

import { useState, useMemo } from "react";
import {
  Breadcrumb,
  DateRangePicker,
  DatePreset,
  computeDateRange,
  SkeletonTable,
  ErrorState,
  HeroCard,
  useFetchData,
} from "../_components";

interface CampaignRow {
  campaign: string;
  totalLeads: number;
  pctOfTotal: number;
  avgLeadsPerDay: number;
  firstLead: string | null;
  lastLead: string | null;
}

interface DailyRow {
  date: string;
  total: number;
  byCampaign: Record<string, number>;
}

interface TopAd {
  rank: number;
  adId: string;
  leads: number;
  pctOfTotal: number;
  campaign: string;
}

interface QuickStats {
  totalLeads: number;
  dateRange: string;
  daysActive: number;
  avgLeadsPerDay: number;
  bestDay: string;
  bestDayLeads: number;
  dummyEmails: number;
  uniquePhones: number;
}

interface PaidMediaData {
  campaignPerformance: CampaignRow[];
  dailyVolume: DailyRow[];
  topAds: TopAd[];
  quickStats: QuickStats;
  campaignNames: string[];
}

const CAMPAIGN_COLORS: Record<string, string> = {
  "Legacy RBB (TOF)": "#818cf8",
  "Legacy BOF (Brad Show)": "#a855f7",
  "SB Warm (Retargeting)": "#f59e0b",
  "SB Cold (Interest)": "#6b7280",
};

function fmtShortDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function PaidMediaPage() {
  const [preset, setPreset] = useState<DatePreset>("all");
  const range = useMemo(() => computeDateRange(preset), [preset]);
  const qs = range.start ? `?start=${range.start}&end=${range.end}` : "";

  const { data, loading, error, refetch } = useFetchData<PaidMediaData>(
    `/api/leads/paid-media${qs}`,
    [preset],
  );

  const maxDaily =
    data?.dailyVolume?.reduce((m, d) => Math.max(m, d.total), 0) ?? 1;

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-8">
        <div>
          <Breadcrumb items={["Admin", "Lead Intelligence", "Paid Media"]} />
          <h1 className="text-2xl font-bold text-gray-900 mt-1">Paid Media</h1>
          <p className="text-sm text-gray-400 mt-1">
            Facebook Lead Form campaign performance &amp; ad analytics
          </p>
        </div>
        <DateRangePicker active={preset} onChange={setPreset} />
      </div>

      {error && <ErrorState message={error} onRetry={refetch} />}
      {!error && loading && <SkeletonTable rows={6} />}

      {!error && !loading && data && (
        <>
          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <HeroCard
              label="Total Leads"
              value={data.quickStats.totalLeads.toLocaleString()}
              accent="#818cf8"
            />
            <HeroCard
              label="Avg Leads / Day"
              value={data.quickStats.avgLeadsPerDay.toString()}
            />
            <HeroCard
              label="Days Active"
              value={data.quickStats.daysActive.toString()}
            />
            <HeroCard
              label="Unique Phones"
              value={data.quickStats.uniquePhones.toLocaleString()}
            />
          </div>

          {/* Highlight Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">
                Best Day
              </p>
              <p className="text-xl font-bold text-green-400">
                {fmtShortDate(data.quickStats.bestDay)}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {data.quickStats.bestDayLeads} leads
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">
                Date Range
              </p>
              <p className="text-lg font-bold text-gray-900">
                {data.quickStats.dateRange}
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">
                Data Quality
              </p>
              <p className="text-sm text-gray-500 mt-2">
                {data.quickStats.dummyEmails} dummy email
                {data.quickStats.dummyEmails !== 1 ? "s" : ""} detected
              </p>
            </div>
          </div>

          {/* Campaign Performance */}
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Campaign Performance
          </h2>
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-x-auto mb-8">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  {[
                    "Campaign",
                    "Total Leads",
                    "% of Total",
                    "Avg / Day",
                    "First Lead",
                    "Last Lead",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-3 text-left text-xs uppercase text-gray-400 font-medium whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.campaignPerformance.map((row) => (
                  <tr
                    key={row.campaign}
                    className="border-b border-gray-200 last:border-0 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-5 py-3 font-medium">
                      <span className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{
                            background:
                              CAMPAIGN_COLORS[row.campaign] ?? "#6b7280",
                          }}
                        />
                        <span className="text-gray-900">{row.campaign}</span>
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-900 tabular-nums">
                      {row.totalLeads}
                    </td>
                    <td className="px-5 py-3 text-gray-500 tabular-nums">
                      {row.pctOfTotal}%
                    </td>
                    <td className="px-5 py-3 text-gray-500 tabular-nums">
                      {row.avgLeadsPerDay}
                    </td>
                    <td className="px-5 py-3 text-gray-500 tabular-nums">
                      {fmtShortDate(row.firstLead)}
                    </td>
                    <td className="px-5 py-3 text-gray-500 tabular-nums">
                      {fmtShortDate(row.lastLead)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-gray-50 border-t border-gray-300">
                  <td className="px-5 py-3 text-gray-900 font-semibold">TOTAL</td>
                  <td className="px-5 py-3 text-gray-900 font-semibold tabular-nums">
                    {data.quickStats.totalLeads}
                  </td>
                  <td className="px-5 py-3 text-gray-900 font-semibold tabular-nums">
                    100%
                  </td>
                  <td className="px-5 py-3 text-gray-900 font-semibold tabular-nums">
                    {data.quickStats.avgLeadsPerDay}
                  </td>
                  <td className="px-5 py-3" />
                  <td className="px-5 py-3" />
                </tr>
              </tbody>
            </table>
          </div>

          {/* Daily Lead Volume */}
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Daily Lead Volume
          </h2>
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 mb-8">
            <div className="space-y-2">
              {data.dailyVolume.map((day) => (
                <div key={day.date} className="flex items-center gap-4">
                  <span className="text-sm text-gray-500 w-20 shrink-0 tabular-nums">
                    {fmtShortDate(day.date)}
                  </span>
                  <div className="flex-1 flex h-7 rounded-lg overflow-hidden bg-gray-100">
                    {data.campaignNames.map((name) => {
                      const count = day.byCampaign[name] ?? 0;
                      if (count === 0) return null;
                      const widthPct = (count / maxDaily) * 100;
                      return (
                        <div
                          key={name}
                          className="h-full transition-all"
                          style={{
                            width: `${widthPct}%`,
                            background:
                              CAMPAIGN_COLORS[name] ?? "#6b7280",
                          }}
                          title={`${name}: ${count}`}
                        />
                      );
                    })}
                  </div>
                  <span className="text-sm text-gray-900 tabular-nums w-10 text-right font-medium">
                    {day.total}
                  </span>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-gray-200">
              {data.campaignNames.map((name) => (
                <div key={name} className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-sm"
                    style={{
                      background: CAMPAIGN_COLORS[name] ?? "#6b7280",
                    }}
                  />
                  <span className="text-xs text-gray-500">{name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top 10 Ads */}
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Top 10 Ads{" "}
            <span className="text-xs font-normal text-gray-400">
              (by Ad ID)
            </span>
          </h2>
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  {["Rank", "Ad ID", "Leads", "% of Total", "Campaign"].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-5 py-3 text-left text-xs uppercase text-gray-400 font-medium whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {data.topAds.map((ad) => (
                  <tr
                    key={ad.adId}
                    className="border-b border-gray-200 last:border-0 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-5 py-3 text-gray-400 tabular-nums">
                      {ad.rank}
                    </td>
                    <td className="px-5 py-3 text-gray-900 font-mono text-xs">
                      {ad.adId}
                    </td>
                    <td className="px-5 py-3 text-gray-900 tabular-nums font-medium">
                      {ad.leads}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#818cf8] rounded-full"
                            style={{
                              width: `${Math.min(ad.pctOfTotal * 3, 100)}%`,
                            }}
                          />
                        </div>
                        <span className="text-gray-500 tabular-nums text-xs">
                          {ad.pctOfTotal}%
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{
                            background:
                              CAMPAIGN_COLORS[ad.campaign] ?? "#6b7280",
                          }}
                        />
                        <span className="text-gray-500">{ad.campaign}</span>
                      </span>
                    </td>
                  </tr>
                ))}
                {data.topAds.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-12 text-center text-gray-400"
                    >
                      No ad data found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

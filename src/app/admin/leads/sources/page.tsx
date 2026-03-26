"use client";

import { useState, useMemo } from "react";
import {
  Breadcrumb,
  DateRangePicker,
  DatePreset,
  computeDateRange,
  SkeletonTable,
  ErrorState,
  useFetchData,
} from "../_components";

interface SourceRow {
  source: string;
  totalLeads: number;
  avgScore: number;
  highIntent: number;
  booked: number;
  conversionRate: number;
  retained: number;
  revenue: number;
  nationalPct: number;
  internationalCount: number;
}

interface SfSource {
  source: string;
  booked: number;
  retained: number;
  total: number;
}

interface SourcesData {
  sources: SourceRow[];
  sfSourceComparison: SfSource[];
}

function fmt$(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

export default function SourcesPage() {
  const [preset, setPreset] = useState<DatePreset>("30d");

  const range = useMemo(() => computeDateRange(preset), [preset]);
  const qs = range.start ? `?start=${range.start}&end=${range.end}` : "";

  const { data, loading, error, refetch } = useFetchData<SourcesData>(
    `/api/leads/sources${qs}`,
    [preset],
  );

  const topByLeads = data?.sources[0];
  const topByScore = data?.sources
    .filter((s) => s.totalLeads >= 5)
    .sort((a, b) => b.avgScore - a.avgScore)[0];
  const topByBooking = data?.sources
    .filter((s) => s.totalLeads >= 5)
    .sort((a, b) => b.conversionRate - a.conversionRate)[0];

  const sfMax = data?.sfSourceComparison?.[0]?.total ?? 1;

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-8">
        <div>
          <Breadcrumb
            items={["Admin", "Lead Intelligence", "Source Attribution"]}
          />
          <h1 className="text-2xl font-bold text-gray-900 mt-1">
            Source Attribution
          </h1>
        </div>
        <DateRangePicker active={preset} onChange={setPreset} />
      </div>

      {error && <ErrorState message={error} onRetry={refetch} />}

      {!error && loading && <SkeletonTable rows={8} />}

      {!error && !loading && data && (
        <>
          {/* Hero Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {topByLeads && (
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
                <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">
                  Largest Source
                </p>
                <p className="text-xl font-bold text-gray-900">{topByLeads.source}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {topByLeads.totalLeads} leads · {topByLeads.booked} booked
                </p>
              </div>
            )}
            {topByScore && (
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
                <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">
                  Best Avg Score
                </p>
                <p className="text-xl font-bold text-gray-900">{topByScore.source}</p>
                <p className="text-sm mt-1">
                  <span className="text-green-400">{topByScore.avgScore.toFixed(1)}</span>
                  <span className="text-gray-400"> avg · {topByScore.highIntent} high-intent</span>
                </p>
              </div>
            )}
            {topByBooking && (
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
                <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">
                  Best Booking Rate
                </p>
                <p className="text-xl font-bold text-gray-900">{topByBooking.source}</p>
                <p className="text-sm mt-1">
                  <span className="text-green-400">{topByBooking.conversionRate.toFixed(1)}%</span>
                  <span className="text-gray-400"> · {topByBooking.booked}/{topByBooking.totalLeads} leads</span>
                </p>
              </div>
            )}
          </div>

          {/* Channel Comparison Table */}
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Channel Comparison</h2>
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-x-auto mb-8">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  {[
                    "Source",
                    "Leads",
                    "Score 4-5%",
                    "Booked",
                    "Booking Rate",
                    "Retained",
                    "Revenue",
                    "% Nat'l",
                    "Int'l",
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
                {data.sources.map((row) => {
                  const score45Pct =
                    row.totalLeads > 0
                      ? ((row.highIntent / row.totalLeads) * 100).toFixed(1)
                      : "0.0";
                  return (
                    <tr
                      key={row.source}
                      className="border-b border-gray-200 last:border-0 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-5 py-3 text-gray-900 font-medium">
                        {row.source}
                      </td>
                      <td className="px-5 py-3 text-gray-900 tabular-nums">
                        {row.totalLeads}
                      </td>
                      <td className="px-5 py-3 tabular-nums">
                        <span
                          className={
                            parseFloat(score45Pct) >= 50
                              ? "text-green-400"
                              : parseFloat(score45Pct) >= 25
                                ? "text-yellow-400"
                                : "text-gray-500"
                          }
                        >
                          {score45Pct}%
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-500 tabular-nums">
                        {row.booked}
                      </td>
                      <td className="px-5 py-3 tabular-nums">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${
                            row.conversionRate >= 20
                              ? "bg-green-50 text-green-700"
                              : row.conversionRate >= 10
                                ? "bg-yellow-50 text-yellow-700"
                                : "bg-gray-50 text-gray-600"
                          }`}
                        >
                          {row.conversionRate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-500 tabular-nums">
                        {row.retained}
                      </td>
                      <td className="px-5 py-3 text-gray-900 tabular-nums">
                        {row.revenue > 0 ? fmt$(row.revenue) : "—"}
                      </td>
                      <td className="px-5 py-3 tabular-nums text-gray-500">
                        {row.nationalPct}%
                      </td>
                      <td className="px-5 py-3 tabular-nums text-gray-500">
                        {row.internationalCount}
                      </td>
                    </tr>
                  );
                })}
                {data.sources.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-6 py-12 text-center text-gray-400"
                    >
                      No source data found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Salesforce Source Comparison */}
          {data.sfSourceComparison && data.sfSourceComparison.length > 0 && (
            <>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                Salesforce Source Comparison
                <span className="text-xs font-normal text-gray-400 ml-2">All Time</span>
              </h2>
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 space-y-3">
                {data.sfSourceComparison.map((sf) => (
                  <div key={sf.source} className="flex items-center gap-4">
                    <span className="text-sm text-gray-900 w-40 shrink-0 truncate">
                      {sf.source}
                    </span>
                    <div className="flex-1 flex items-center gap-2">
                      <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#818cf8] rounded-full transition-all"
                          style={{
                            width: `${Math.max(2, (sf.total / sfMax) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 tabular-nums w-16 text-right">
                        {sf.total} opps
                      </span>
                    </div>
                    <span className="text-xs text-green-400 tabular-nums w-20 text-right">
                      {sf.booked} booked
                    </span>
                    <span className="text-xs text-purple-400 tabular-nums w-20 text-right">
                      {sf.retained} retained
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

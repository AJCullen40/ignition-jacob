"use client";

import { useState, useMemo } from "react";
import {
  Breadcrumb,
  DateRangePicker,
  DatePreset,
  computeDateRange,
  HeroCard,
  SkeletonCard,
  SkeletonChart,
  ErrorState,
  useFetchData,
} from "../_components";

interface ScoresData {
  distribution: { score: number; count: number; percentage: number }[];
  avgScore: number;
  closeToClosing: { count: number; percentage: number };
  totalLeads: number;
  sourceScoreMatrix: {
    source: string;
    scores: Record<number, number>;
    total: number;
  }[];
  bookingsByScore: {
    score: number;
    booked: number;
    bookingRate: number;
  }[];
}

const BAR_COLORS: Record<number, string> = {
  5: "#22c55e",
  4: "#3b82f6",
  3: "#eab308",
  2: "#6b7280",
  1: "#ef4444",
};

export default function ScoresPage() {
  const [preset, setPreset] = useState<DatePreset>("30d");

  const range = useMemo(() => computeDateRange(preset), [preset]);
  const qs = range.start ? `?start=${range.start}&end=${range.end}` : "";

  const { data, loading, error, refetch } = useFetchData<ScoresData>(
    `/api/leads/scores${qs}`,
    [preset],
  );

  const maxCount = data
    ? Math.max(...data.distribution.map((d) => d.count), 1)
    : 1;

  const bookingMap = useMemo(() => {
    if (!data?.bookingsByScore) return {} as Record<number, { booked: number; bookingRate: number }>;
    const m: Record<number, { booked: number; bookingRate: number }> = {};
    for (const b of data.bookingsByScore) m[b.score] = b;
    return m;
  }, [data]);

  const heatmapMax = useMemo(() => {
    if (!data?.sourceScoreMatrix) return 1;
    let mx = 1;
    for (const row of data.sourceScoreMatrix) {
      for (const v of Object.values(row.scores)) {
        if (v > mx) mx = v;
      }
    }
    return mx;
  }, [data]);

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-8">
        <div>
          <Breadcrumb
            items={["Admin", "Lead Intelligence", "Score Intelligence"]}
          />
          <h1 className="text-2xl font-bold text-gray-900 mt-1">
            Score Intelligence
          </h1>
        </div>
        <DateRangePicker active={preset} onChange={setPreset} />
      </div>

      {error && <ErrorState message={error} onRetry={refetch} />}

      {!error && loading && (
        <>
          <div className="grid sm:grid-cols-3 gap-4 mb-8">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
          <SkeletonChart />
        </>
      )}

      {!error && !loading && data && (
        <>
          {/* Hero cards */}
          <div className="grid sm:grid-cols-3 gap-4 mb-8">
            <HeroCard
              label="Total Leads"
              value={data.totalLeads}
              accent="#fff"
            />
            <HeroCard
              label="Avg Score"
              value={data.avgScore.toFixed(1)}
              accent="#3b82f6"
            />
            <HeroCard
              label="Close to Closing (4-5)"
              value={`${data.closeToClosing.count} (${data.closeToClosing.percentage.toFixed(1)}%)`}
              accent="#22c55e"
            />
          </div>

          {/* Score distribution */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-6">
              Score Distribution
            </h2>
            <div className="space-y-4">
              {data.distribution.map((d) => (
                <div key={d.score} className="flex items-center gap-4">
                  <div className="w-20 text-right shrink-0">
                    <span className="text-sm font-medium text-gray-500">
                      Score {d.score}
                    </span>
                  </div>
                  <div className="flex-1 h-9 bg-gray-100 rounded-lg overflow-hidden">
                    <div
                      className="h-full rounded-lg flex items-center px-3 transition-all duration-500"
                      style={{
                        width: `${Math.max((d.count / maxCount) * 100, 4)}%`,
                        background: BAR_COLORS[d.score] ?? "#6b7280",
                      }}
                    >
                      <span className="text-xs font-semibold text-white whitespace-nowrap">
                        {d.count}
                      </span>
                    </div>
                  </div>
                  <div className="w-14 text-right shrink-0">
                    <span className="text-xs text-gray-400 tabular-nums">
                      {d.percentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-28 text-right shrink-0">
                    {bookingMap[d.score] && (
                      <span className="text-xs text-indigo-600 tabular-nums">
                        {bookingMap[d.score].booked} booked{" "}
                        {bookingMap[d.score].bookingRate.toFixed(2)}%
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Source × Score Heatmap */}
          {data.sourceScoreMatrix && data.sourceScoreMatrix.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mt-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-6">
                Source &times; Score Heatmap
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 text-gray-400 font-medium">
                        Source
                      </th>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <th
                          key={s}
                          className="text-center py-2 px-3 font-medium"
                          style={{ color: BAR_COLORS[s] }}
                        >
                          Score {s}
                        </th>
                      ))}
                      <th className="text-center py-2 px-3 text-gray-500 font-medium">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sourceScoreMatrix
                      .filter((r) => r.total > 0)
                      .sort((a, b) => b.total - a.total)
                      .map((row) => (
                        <tr
                          key={row.source}
                          className="border-b border-gray-200/50 hover:bg-gray-50/50"
                        >
                          <td className="py-2 px-3 text-gray-900 font-medium">
                            {row.source}
                          </td>
                          {[1, 2, 3, 4, 5].map((s) => {
                            const count = row.scores[s] ?? 0;
                            const intensity = heatmapMax > 0 ? count / heatmapMax : 0;
                            const bg =
                              count === 0
                                ? "transparent"
                                : `rgba(129, 140, 248, ${0.1 + intensity * 0.7})`;
                            return (
                              <td
                                key={s}
                                className="text-center py-2 px-3 tabular-nums"
                                style={{ backgroundColor: bg }}
                              >
                                <span
                                  className={
                                    count === 0
                                      ? "text-[#333]"
                                      : "text-white font-medium"
                                  }
                                >
                                  {count}
                                </span>
                              </td>
                            );
                          })}
                          <td className="text-center py-2 px-3 text-gray-500 font-semibold tabular-nums">
                            {row.total}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

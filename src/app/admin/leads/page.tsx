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
  SkeletonTable,
  ErrorState,
  ScoreBadge,
  useFetchData,
} from "./_components";
import { formatNumber } from "@/lib/utils";

interface OverviewData {
  totalLeads: number;
  leadQualified: number;
  consultationBooked: number;
  awaitingRetainer: number;
  retained: number;
  scoreDistribution: { score: number; count: number }[];
  recentLeads: {
    id: string;
    name: string;
    score: number;
    source: string;
    phoneOrigin: string;
    createdAt: string;
  }[];
}

export default function LeadsOverviewPage() {
  const [preset, setPreset] = useState<DatePreset>("30d");

  const range = useMemo(() => computeDateRange(preset), [preset]);
  const qs = range.start ? `?start=${range.start}&end=${range.end}` : "";

  const { data, loading, error, refetch } = useFetchData<OverviewData>(
    `/api/leads/overview${qs}`,
    [preset],
  );

  const scoreDist = data?.scoreDistribution ?? [];
  const maxScore = scoreDist.length > 0
    ? Math.max(...scoreDist.map((s) => s.count), 1)
    : 1;

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-8">
        <div>
          <Breadcrumb items={["Admin", "Lead Intelligence"]} />
          <h1 className="text-2xl font-bold text-gray-900 mt-1">
            Lead Intelligence
          </h1>
        </div>
        <DateRangePicker active={preset} onChange={setPreset} />
      </div>

      {error && <ErrorState message={error} onRetry={refetch} />}

      {!error && loading && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
          <div className="grid lg:grid-cols-2 gap-6">
            <SkeletonChart />
            <SkeletonTable rows={10} />
          </div>
        </>
      )}

      {!error && !loading && data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
            <HeroCard
              label="Total Leads"
              value={formatNumber(data.totalLeads)}
            />
            <HeroCard
              label="Qualified"
              value={formatNumber(data.leadQualified)}
              accent="#3b82f6"
            />
            <HeroCard
              label="Consultations Booked"
              value={formatNumber(data.consultationBooked)}
              accent="#f59e0b"
            />
            <HeroCard
              label="Awaiting Retainer"
              value={formatNumber(data.awaitingRetainer)}
              accent="#22c55e"
            />
            <HeroCard
              label="Retained"
              value={formatNumber(data.retained)}
              accent="#a855f7"
            />
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Score Distribution */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-5">
                Score Distribution
              </h2>
              <div className="space-y-3">
                {scoreDist.map((s) => (
                  <div key={s.score} className="flex items-center gap-3">
                    <span className="w-16 text-xs text-gray-500 text-right shrink-0">
                      Score {s.score}
                    </span>
                    <div className="flex-1 h-7 bg-gray-100 rounded-md overflow-hidden">
                      <div
                        className="h-full rounded-md transition-all duration-500"
                        style={{
                          width: `${(s.count / maxScore) * 100}%`,
                          background:
                            s.score >= 4
                              ? "#22c55e"
                              : s.score === 3
                                ? "#eab308"
                                : "#6b7280",
                        }}
                      />
                    </div>
                    <span className="w-10 text-xs text-gray-500 tabular-nums">
                      {s.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Leads */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 pt-5 pb-3">
                <h2 className="text-sm font-semibold text-gray-900">
                  Recent Leads
                </h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-6 py-2 text-left text-xs uppercase text-gray-400 font-medium">
                      Name
                    </th>
                    <th className="px-4 py-2 text-left text-xs uppercase text-gray-400 font-medium">
                      Score
                    </th>
                    <th className="px-4 py-2 text-left text-xs uppercase text-gray-400 font-medium">
                      Source
                    </th>
                    <th className="px-4 py-2 text-left text-xs uppercase text-gray-400 font-medium">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentLeads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="border-b border-gray-200 last:border-0 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-3 text-gray-900">{lead.name}</td>
                      <td className="px-4 py-3">
                        <ScoreBadge score={lead.score} />
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {lead.source}
                      </td>
                      <td className="px-4 py-3 text-gray-400 tabular-nums">
                        {new Date(lead.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {data.recentLeads.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-6 py-8 text-center text-gray-400"
                      >
                        No leads found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

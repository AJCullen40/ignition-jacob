"use client";

import { useState, useMemo } from "react";
import {
  Breadcrumb,
  DateRangePicker,
  DatePreset,
  computeDateRange,
  SkeletonCard,
  ErrorState,
  useFetchData,
} from "../_components";
import { formatCurrency, formatNumber } from "@/lib/utils";

interface SourceRow {
  source: string;
  retainers: number;
  totalRevenue: number;
  avgRetainerValue: number;
  costPerLead: number;
}

interface RevenueData {
  totalRevenue: number;
  consultationRevenue: number;
  retainerRevenue: number;
  totalRetained: number;
  avgRevenuePerRetained: number;
  monthlyRetained: { month: string; count: number }[];
  sources: SourceRow[];
  sfTotalRevenue: number;
  sfTotalRetained: number;
  sfAvgPerRetained: number;
  sfMonthlyRetained: { month: string; count: number }[];
}

const MONTH_LABELS: Record<string, string> = {
  "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr",
  "05": "May", "06": "Jun", "07": "Jul", "08": "Aug",
  "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec",
};

const SOURCE_COLORS = [
  "#22c55e", "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9",
  "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
  "#ec4899", "#f43f5e", "#f97316", "#eab308",
];

function BarChart({ data }: { data: { month: string; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex items-end gap-3 h-40">
      {data.map((d) => (
        <div key={d.month} className="flex flex-col items-center gap-1 flex-1">
          <span className="text-xs text-gray-500 tabular-nums">{d.count}</span>
          <div
            className="w-full rounded-t-md transition-all duration-500"
            style={{
              height: `${Math.max((d.count / max) * 100, 4)}%`,
              background: "linear-gradient(to top, #22c55e, #3b82f6)",
            }}
          />
          <span className="text-[10px] text-gray-400">{MONTH_LABELS[d.month] ?? d.month}</span>
        </div>
      ))}
    </div>
  );
}

export default function RevenuePage() {
  const [preset, setPreset] = useState<DatePreset>("all");

  const range = useMemo(() => computeDateRange(preset), [preset]);
  const qs = range.start ? `?start=${range.start}&end=${range.end}` : "";

  const { data, loading, error, refetch } = useFetchData<RevenueData>(
    `/api/leads/revenue${qs}`,
    [preset],
  );

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-8">
        <div>
          <Breadcrumb items={["Admin", "Lead Intelligence", "Revenue Attribution"]} />
          <h1 className="text-2xl font-bold text-gray-900 mt-1">Revenue Attribution</h1>
        </div>
        <DateRangePicker active={preset} onChange={setPreset} />
      </div>

      {error && <ErrorState message={error} onRetry={refetch} />}

      {!error && loading && (
        <>
          <div className="grid sm:grid-cols-3 gap-4 mb-8">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <SkeletonCard className="h-60 mb-8" />
          <SkeletonCard className="h-80" />
        </>
      )}

      {!error && !loading && data && (
        <>
          {/* Hero Cards */}
          <div className="grid sm:grid-cols-3 gap-4 mb-8">
            <div className="rounded-xl p-6 bg-gradient-to-br from-[#166534] to-[#14532d] border border-[#22c55e]/20">
              <div className="text-xs uppercase tracking-wider text-green-300/70 mb-2">Total Revenue</div>
              <div className="text-3xl font-bold text-white">{formatCurrency(data.totalRevenue)}</div>
              <div className="text-xs text-green-300/60 mt-1">{formatNumber(data.totalRetained)} retained clients</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
              <div className="text-xs uppercase tracking-wider text-gray-400 mb-2">Consultation Revenue</div>
              <div className="text-3xl font-bold text-[#f59e0b]">{formatCurrency(data.consultationRevenue)}</div>
              <div className="text-xs text-gray-400 mt-1">Booked + Paid + Awaiting</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
              <div className="text-xs uppercase tracking-wider text-gray-400 mb-2">Retainer Revenue</div>
              <div className="text-3xl font-bold text-[#3b82f6]">{formatCurrency(data.retainerRevenue)}</div>
              <div className="text-xs text-gray-400 mt-1">Avg {formatCurrency(data.avgRevenuePerRetained)} / client</div>
            </div>
          </div>

          {/* Salesforce Revenue (Full Operation) */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mb-8">
            <h2 className="text-sm font-semibold text-gray-900 mb-5">Salesforce Revenue (Full Operation)</h2>
            <div className="grid sm:grid-cols-3 gap-6 mb-6">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Total SF Revenue</div>
                <div className="text-2xl font-bold text-[#d4af37]">{formatCurrency(data.sfTotalRevenue)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Clients Retained</div>
                <div className="text-2xl font-bold text-[#22c55e]">{formatNumber(data.sfTotalRetained)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Avg Revenue per Retained</div>
                <div className="text-2xl font-bold text-[#3b82f6]">{formatCurrency(data.sfAvgPerRetained)}</div>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-5">
              <h3 className="text-xs font-medium text-gray-500 mb-4">Monthly Retained Clients (SF)</h3>
              <BarChart data={data.sfMonthlyRetained} />
            </div>
          </div>

          {/* Revenue by Source */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-5">Revenue by Source</h2>
            <div className="space-y-3">
              {data.sources.map((row, i) => {
                const maxRev = data.sources[0]?.totalRevenue || 1;
                const pct = Math.max((row.totalRevenue / maxRev) * 100, 3);
                const color = SOURCE_COLORS[i % SOURCE_COLORS.length];
                return (
                  <div key={row.source}>
                    <div className="flex items-center gap-3">
                      <div className="w-28 shrink-0 text-sm text-gray-900 font-medium truncate">{row.source}</div>
                      <div className="flex-1 relative h-8">
                        <div
                          className="h-full rounded-md flex items-center px-3 transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: color + "33" }}
                        >
                          <span className="text-xs font-semibold whitespace-nowrap" style={{ color }}>
                            {formatCurrency(row.totalRevenue)}
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0 text-xs text-gray-400 tabular-nums whitespace-nowrap">
                        {row.retainers} retained
                        {row.costPerLead > 0 && <> &middot; {formatCurrency(row.costPerLead)}/lead</>}
                      </div>
                    </div>
                  </div>
                );
              })}
              {data.sources.length === 0 && (
                <div className="text-center text-gray-400 py-8">No revenue data found</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

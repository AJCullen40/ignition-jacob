"use client";

import { useState, useMemo } from "react";

import {
  DateRangePicker,
  DatePreset,
  computeDateRange,
  useFetchData,
} from "../leads/_components";

/* ── Types ── */
interface PipelineStage {
  stage: string;
  count: number;
  value: number;
  color: string;
}

interface RecoveryLead {
  name: string;
  score: number;
  source: string;
  phone: string;
  date: string;
}

interface RecentRetained {
  name: string;
  source: string;
  value: number;
  date: string;
}

interface ChannelRow {
  source: string;
  totalLeads: number;
  booked: number;
  retained: number;
  revenue: number;
  bookedRate: number;
  retainedRate: number;
}

interface MonthlyRevenue {
  month: string;
  revenue: number;
  count: number;
}

interface CommandCentreData {
  pipelineNow: {
    totalValue: number;
    dealCount: number;
    closableValue: number;
    closableCount: number;
    stages: PipelineStage[];
  };
  bookedToRetained: {
    totalBooked: number;
    totalRetained: number;
    rate: number;
  };
  moneyOnTable: {
    estimatedValue: number;
    hotLeadsTotal: number;
    inSalesforceNotBooked: number;
    notInSalesforce: number;
    sfNotConverted: number;
    bookedCount: number;
    avgRetainerValue: number;
    recoveryRate: number;
    topRecoveryLeads: RecoveryLead[];
  };
  channelPerformance: ChannelRow[];
  recentRetained: RecentRetained[];
  monthlyRevenue: MonthlyRevenue[];
  summary: {
    totalRetainedAllTime: number;
    totalRevenueAllTime: number;
    avgRetainerValue: number;
    oppsWithAmounts: number;
    totalRetainedOpps: number;
  };
}

/* ── Formatters ── */
function fmt$(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n.toLocaleString()}`;
}

function fmtN(n: number): string {
  return n.toLocaleString("en-US");
}

function fmtMonth(yyyymm: string): string {
  const [y, m] = yyyymm.split("-");
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[parseInt(m, 10) - 1]} '${y.slice(2)}`;
}

function fmtDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/* ── Loading skeleton ── */
function Skeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6 h-36"
          >
            <div className="h-3 w-24 bg-gray-100 rounded mb-4" />
            <div className="h-10 w-32 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
      <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6 h-64" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6 h-72" />
        <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6 h-72" />
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function RevenueCommandCentre() {
  const [preset, setPreset] = useState<DatePreset>("all");
  const [showRecoveryLeads, setShowRecoveryLeads] = useState(false);
  const range = useMemo(() => computeDateRange(preset), [preset]);
  const qs = range.start ? `?start=${range.start}&end=${range.end}` : "";

  const { data, loading, error, refetch } =
    useFetchData<CommandCentreData>(
      `/api/revenue/command-centre${qs}`,
      [preset],
    );

  const maxStageCount =
    data?.pipelineNow.stages.reduce((m, s) => Math.max(m, s.count), 1) ?? 1;
  const maxMonthlyCount =
    data?.monthlyRevenue.reduce((m, r) => Math.max(m, r.count), 1) ?? 1;
  const maxChannelLeads =
    data?.channelPerformance.reduce(
      (m, c) => Math.max(m, c.totalLeads),
      1,
    ) ?? 1;

  const totalDropped = (data?.moneyOnTable.inSalesforceNotBooked ?? 0) +
    (data?.moneyOnTable.notInSalesforce ?? 0);

  return (
    <div className="max-w-[1400px]">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-8">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-600 mb-1">
            Revenue
          </p>
          <h1 className="text-2xl font-bold text-gray-900">Revenue Radar</h1>
          <p className="text-sm text-gray-400 mt-1">
            Live from Salesforce &amp; AI Lead Score Sheet
          </p>
        </div>
        <DateRangePicker active={preset} onChange={setPreset} />
      </div>

      {error && (
        <div className="bg-white border border-red-200 shadow-sm rounded-2xl p-8 text-center">
          <p className="text-red-600 text-sm mb-4">{error}</p>
          <button
            onClick={refetch}
            className="bg-indigo-500 hover:bg-indigo-600 text-white text-sm px-5 py-2 rounded-lg transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {!error && loading && <Skeleton />}

      {!error && !loading && data && (
        <div className="space-y-6">
          {/* ═══ TOP 4 HERO METRICS ═══ */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Pipeline Value NOW */}
            <div className="relative bg-white border border-emerald-200 shadow-sm rounded-2xl p-6 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 to-transparent" />
              <div className="relative">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-600 mb-3">
                  Pipeline Value Now
                </p>
                <p className="text-3xl lg:text-4xl font-bold text-emerald-600 tracking-tight">
                  {data.pipelineNow.totalValue > 0
                    ? fmt$(data.pipelineNow.totalValue)
                    : fmtN(data.pipelineNow.dealCount)}
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  {data.pipelineNow.totalValue > 0
                    ? `${fmtN(data.pipelineNow.dealCount)} active deals`
                    : "active deals in pipeline"}
                </p>
                {data.pipelineNow.closableCount > 0 && (
                  <p className="text-xs text-emerald-500 mt-1">
                    {fmtN(data.pipelineNow.closableCount)} awaiting retainer
                  </p>
                )}
              </div>
            </div>

            {/* Booked → Retained */}
            <div className="relative bg-white border border-blue-200 shadow-sm rounded-2xl p-6 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-transparent" />
              <div className="relative">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-blue-600 mb-3">
                  Booked &rarr; Retained
                </p>
                <p className="text-3xl lg:text-4xl font-bold text-blue-600 tracking-tight">
                  {data.bookedToRetained.rate}%
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  {fmtN(data.bookedToRetained.totalRetained)} retained of{" "}
                  {fmtN(data.bookedToRetained.totalBooked)} booked
                </p>
              </div>
            </div>

            {/* Retained Clients */}
            <div className="relative bg-white border border-purple-200 shadow-sm rounded-2xl p-6 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-50 to-transparent" />
              <div className="relative">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-purple-600 mb-3">
                  Total Retained Clients
                </p>
                <p className="text-3xl lg:text-4xl font-bold text-purple-600 tracking-tight">
                  {fmtN(data.summary.totalRetainedAllTime)}
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  {data.summary.totalRevenueAllTime > 0
                    ? `${fmt$(data.summary.totalRevenueAllTime)} lifetime revenue`
                    : `${fmt$(data.summary.avgRetainerValue)} avg retainer`}
                </p>
              </div>
            </div>

            {/* Money Left on Table */}
            <div className="relative bg-white border border-red-200 shadow-sm rounded-2xl p-6 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-red-50 to-transparent" />
              <div className="relative">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-red-600 mb-3">
                  Money Left on Table
                </p>
                <p className="text-3xl lg:text-4xl font-bold text-red-600 tracking-tight">
                  {fmtN(totalDropped)}
                </p>
                <p className="text-sm text-gray-400 mt-2">
                  score 4-5 leads not booked
                </p>
                <p className="text-xs text-red-500 mt-1">
                  est. {fmt$(data.moneyOnTable.estimatedValue)} recoverable
                </p>
              </div>
            </div>
          </div>

          {/* ═══ PIPELINE STAGES ═══ */}
          <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900">
                Active Pipeline
              </h2>
              <span className="text-xs text-gray-400">
                Open deals only &middot; live from Salesforce
              </span>
            </div>
            <div className="space-y-3">
              {data.pipelineNow.stages.map((s) => (
                <div key={s.stage} className="flex items-center gap-4">
                  <span className="text-sm text-gray-500 w-44 shrink-0 truncate">
                    {s.stage}
                  </span>
                  <div className="flex-1 flex items-center gap-3">
                    <div className="flex-1 h-8 bg-gray-100 rounded-lg overflow-hidden">
                      <div
                        className="h-full rounded-lg transition-all flex items-center px-3"
                        style={{
                          width: `${Math.max(4, (s.count / maxStageCount) * 100)}%`,
                          background: s.color,
                          minWidth: s.count > 0 ? 60 : 0,
                        }}
                      >
                        {s.count > 0 && (
                          <span className="text-xs font-semibold text-white whitespace-nowrap">
                            {fmtN(s.count)}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-sm text-gray-900 font-semibold tabular-nums w-24 text-right">
                      {s.value > 0 ? fmt$(s.value) : fmtN(s.count)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ═══ TWO-COLUMN: CHANNEL PERFORMANCE + RECOVERY ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Channel Performance (3/5 width) */}
            <div className="lg:col-span-3 bg-white border border-gray-200 shadow-sm rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  Channel Performance
                </h2>
                <span className="text-[10px] uppercase tracking-wider text-gray-400">
                  Salesforce opportunities by source
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      {[
                        "Channel",
                        "Opportunities",
                        "Booked",
                        "Retained",
                        "Revenue",
                        "Book %",
                        "Retain %",
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-5 py-3 text-left text-[10px] uppercase tracking-wider text-gray-400 font-medium whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.channelPerformance.slice(0, 12).map((ch) => (
                      <tr
                        key={ch.source}
                        className="border-b border-gray-200 last:border-0 hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-5 py-3 text-gray-900 font-medium">
                          {ch.source}
                        </td>
                        <td className="px-5 py-3 tabular-nums">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-indigo-500 rounded-full"
                                style={{
                                  width: `${(ch.totalLeads / maxChannelLeads) * 100}%`,
                                }}
                              />
                            </div>
                            <span className="text-gray-500">
                              {fmtN(ch.totalLeads)}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-gray-500 tabular-nums">
                          {fmtN(ch.booked)}
                        </td>
                        <td className="px-5 py-3 text-gray-900 font-medium tabular-nums">
                          {fmtN(ch.retained)}
                        </td>
                        <td className="px-5 py-3 text-gray-900 tabular-nums">
                          {ch.revenue > 0 ? fmt$(ch.revenue) : "—"}
                        </td>
                        <td className="px-5 py-3 tabular-nums">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${
                              ch.bookedRate >= 50
                                ? "bg-emerald-50 text-emerald-700"
                                : ch.bookedRate >= 30
                                  ? "bg-yellow-50 text-yellow-700"
                                  : "bg-gray-50 text-gray-600"
                            }`}
                          >
                            {ch.bookedRate}%
                          </span>
                        </td>
                        <td className="px-5 py-3 tabular-nums">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${
                              ch.retainedRate >= 80
                                ? "bg-emerald-50 text-emerald-700"
                                : ch.retainedRate >= 60
                                  ? "bg-yellow-50 text-yellow-700"
                                  : "bg-gray-50 text-gray-600"
                            }`}
                          >
                            {ch.retainedRate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recovery Opportunities (2/5 width) */}
            <div className="lg:col-span-2 bg-white border border-red-200 shadow-sm rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">
                Recovery Opportunities
              </h2>
              <p className="text-xs text-gray-400 mb-5">
                Score 4-5 leads from AI scoring that never reached booking
              </p>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">
                    In SF, Not Booked
                  </p>
                  <p className="text-2xl font-bold text-amber-600">
                    {fmtN(data.moneyOnTable.inSalesforceNotBooked)}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">
                    Not in Salesforce
                  </p>
                  <p className="text-2xl font-bold text-red-600">
                    {fmtN(data.moneyOnTable.notInSalesforce)}
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase tracking-wider text-gray-400">
                    Total score 4-5 leads
                  </span>
                  <span className="text-sm font-semibold text-gray-900">
                    {fmtN(data.moneyOnTable.hotLeadsTotal)}
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full flex">
                    <div
                      className="bg-emerald-500 h-full"
                      style={{
                        width: `${
                          ((data.moneyOnTable.hotLeadsTotal - totalDropped) /
                            Math.max(data.moneyOnTable.hotLeadsTotal, 1)) *
                          100
                        }%`,
                      }}
                    />
                    <div
                      className="bg-amber-500 h-full"
                      style={{
                        width: `${
                          (data.moneyOnTable.inSalesforceNotBooked /
                            Math.max(data.moneyOnTable.hotLeadsTotal, 1)) *
                          100
                        }%`,
                      }}
                    />
                    <div
                      className="bg-red-500 h-full"
                      style={{
                        width: `${
                          (data.moneyOnTable.notInSalesforce /
                            Math.max(data.moneyOnTable.hotLeadsTotal, 1)) *
                          100
                        }%`,
                      }}
                    />
                  </div>
                </div>
                <div className="flex gap-4 mt-2 text-[10px]">
                  <span className="text-emerald-600">
                    ● Booked
                  </span>
                  <span className="text-amber-600">
                    ● In SF, no booking
                  </span>
                  <span className="text-red-600">
                    ● Not in SF
                  </span>
                </div>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                <p className="text-xs text-red-600 mb-1">
                  Estimated recoverable value
                </p>
                <p className="text-2xl font-bold text-red-600">
                  {fmt$(data.moneyOnTable.estimatedValue)}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {fmtN(totalDropped)} leads &times;{" "}
                  {Math.round(data.moneyOnTable.recoveryRate * 100)}%
                  recovery &times;{" "}
                  {fmt$(data.moneyOnTable.avgRetainerValue)} avg retainer
                </p>
              </div>

              {data.moneyOnTable.topRecoveryLeads.length > 0 && (
                <>
                  <button
                    onClick={() =>
                      setShowRecoveryLeads(!showRecoveryLeads)
                    }
                    className="text-xs text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                  >
                    {showRecoveryLeads ? "Hide" : "View"} top recovery leads
                    ({data.moneyOnTable.topRecoveryLeads.length})
                  </button>

                  {showRecoveryLeads && (
                    <div className="mt-3 max-h-64 overflow-y-auto space-y-1">
                      {data.moneyOnTable.topRecoveryLeads.map(
                        (lead, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold ${
                                  lead.score === 5
                                    ? "bg-green-50 text-green-700"
                                    : "bg-blue-50 text-blue-700"
                                }`}
                              >
                                {lead.score}
                              </span>
                              <span className="text-gray-900 font-medium">
                                {lead.name || "Unknown"}
                              </span>
                            </div>
                            <span className="text-gray-400">
                              {lead.source}
                            </span>
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ═══ BOTTOM ROW: MONTHLY TREND + RECENT RETAINED ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Monthly Retained Trend */}
            <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">
                Monthly Retained Clients
              </h2>
              <p className="text-xs text-gray-400 mb-5">
                Clients retained per month from Salesforce
              </p>

              {data.monthlyRevenue.length === 0 ? (
                <p className="text-sm text-gray-400 py-8 text-center">
                  No monthly data available
                </p>
              ) : (
                <div className="space-y-2">
                  {data.monthlyRevenue.slice(-18).map((m) => (
                    <div
                      key={m.month}
                      className="flex items-center gap-3"
                    >
                      <span className="text-xs text-gray-500 w-16 shrink-0 tabular-nums">
                        {fmtMonth(m.month)}
                      </span>
                      <div className="flex-1 h-6 bg-gray-100 rounded-md overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-md transition-all flex items-center px-2"
                          style={{
                            width: `${Math.max(6, (m.count / maxMonthlyCount) * 100)}%`,
                          }}
                        >
                          <span className="text-[10px] font-semibold text-white whitespace-nowrap">
                            {m.count}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs text-gray-900 font-semibold tabular-nums w-20 text-right">
                        {m.revenue > 0 ? fmt$(m.revenue) : `${fmtN(m.count)} clients`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Retained Clients */}
            <div className="bg-white border border-gray-200 shadow-sm rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  Recent Retained Clients
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  Latest retained opportunities from Salesforce
                </p>
              </div>
              {data.recentRetained.length === 0 ? (
                <p className="text-sm text-gray-400 py-8 text-center">
                  No retained clients found
                </p>
              ) : (
                <div className="divide-y divide-gray-200">
                  {data.recentRetained.map((client, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between px-6 py-3 hover:bg-gray-50 transition-colors"
                    >
                      <div>
                        <p className="text-sm text-gray-900 font-medium">
                          {client.name}
                        </p>
                        <p className="text-xs text-gray-400">
                          {client.source} &middot; {fmtDate(client.date)}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-emerald-600 tabular-nums">
                        {client.value > 0 ? fmt$(client.value) : "Retained"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ═══ DATA QUALITY FOOTER ═══ */}
          <div className="bg-gray-50 border border-gray-200 shadow-sm rounded-xl px-6 py-4">
            <div className="flex flex-wrap gap-x-8 gap-y-2 text-xs text-gray-400">
              <span>
                <span className="text-gray-500">Salesforce:</span>{" "}
                {fmtN(data.summary.totalRetainedOpps)} retained opps
                {data.summary.oppsWithAmounts > 0 &&
                  ` (${fmtN(data.summary.oppsWithAmounts)} with amounts)`}
              </span>
              <span>
                <span className="text-gray-500">Scoring Sheet:</span>{" "}
                {fmtN(data.moneyOnTable.hotLeadsTotal)} score 4-5 leads
              </span>
              <span>
                <span className="text-gray-500">Avg Retainer:</span>{" "}
                {fmt$(data.summary.avgRetainerValue)}
                {data.summary.oppsWithAmounts > 0
                  ? ` (from ${fmtN(data.summary.oppsWithAmounts)} deals)`
                  : " (default estimate)"}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

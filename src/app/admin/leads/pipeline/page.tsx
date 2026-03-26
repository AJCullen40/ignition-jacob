"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Breadcrumb,
  DateRangePicker,
  DatePreset,
  computeDateRange,
  HeroCard,
  SkeletonCard,
  SkeletonChart,
  ErrorState,
  FilterDropdown,
  useFetchData,
} from "../_components";
import { formatNumber } from "@/lib/utils";

interface PipelineData {
  stages: {
    label: string;
    count: number;
    color: string;
  }[];
  sources: string[];
}

interface DrilldownLead {
  sfId: string;
  name: string;
  stage: string;
  source: string;
  sfSource: string;
  date: string;
  amount: number;
  score: number | null;
  conversation: string;
  phone: string;
  phoneOrigin: string;
  matched: boolean;
}

interface DrilldownData {
  stage: string;
  total: number;
  matched: number;
  unmatched: number;
  leads: DrilldownLead[];
}

const STAGE_COLORS: Record<string, string> = {
  "New Leads": "#9ca3af",
  "Lead Outreach": "#3b82f6",
  "Lead Qualified": "#8b5cf6",
  "Consultation Booked": "#f59e0b",
  "Awaiting Retainer": "#22c55e",
  Retained: "#a855f7",
};

const SCORE_STYLES: Record<number, string> = {
  5: "bg-green-50 text-green-700 border-green-200",
  4: "bg-blue-50 text-blue-700 border-blue-200",
  3: "bg-yellow-50 text-yellow-700 border-yellow-200",
  2: "bg-orange-50 text-orange-700 border-orange-200",
  1: "bg-red-50 text-red-700 border-red-200",
};

function fmtDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ConversationCell({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return <span className="text-gray-400">—</span>;

  const preview = text.length > 120 ? text.slice(0, 120) + "…" : text;

  return (
    <div className="max-w-md">
      <p className="text-xs text-gray-500 leading-relaxed whitespace-pre-wrap">
        {expanded ? text : preview}
      </p>
      {text.length > 120 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[10px] text-indigo-600 hover:text-gray-900 mt-1 transition-colors cursor-pointer"
        >
          {expanded ? "Show less" : "Show full conversation"}
        </button>
      )}
    </div>
  );
}

export default function PipelinePage() {
  const [preset, setPreset] = useState<DatePreset>("30d");
  const [source, setSource] = useState("all");
  const [score, setScore] = useState("all");
  const [origin, setOrigin] = useState("all");
  const [activeStage, setActiveStage] = useState<string | null>(null);
  const [drilldown, setDrilldown] = useState<DrilldownData | null>(null);
  const [drilldownLoading, setDrilldownLoading] = useState(false);

  const range = useMemo(() => computeDateRange(preset), [preset]);
  const params = new URLSearchParams();
  if (range.start) {
    params.set("start", range.start);
    params.set("end", range.end!);
  }
  if (source !== "all") params.set("source", source);
  if (score !== "all") params.set("score", score);
  if (origin !== "all") params.set("origin", origin);
  const qs = params.toString() ? `?${params.toString()}` : "";

  const { data, loading, error, refetch } = useFetchData<PipelineData>(
    `/api/leads/pipeline${qs}`,
    [preset, source, score, origin],
  );

  const maxCount = data
    ? Math.max(...data.stages.map((s) => s.count), 1)
    : 1;

  const sourceOptions = [
    { value: "all", label: "All Sources" },
    ...(data?.sources ?? []).map((s) => ({ value: s, label: s })),
  ];

  const handleStageClick = useCallback(
    async (stage: string) => {
      if (activeStage === stage) {
        setActiveStage(null);
        setDrilldown(null);
        return;
      }
      setActiveStage(stage);
      setDrilldownLoading(true);
      setDrilldown(null);
      try {
        const ddParams = new URLSearchParams();
        ddParams.set("stage", stage);
        if (range.start) {
          ddParams.set("start", range.start);
          ddParams.set("end", range.end!);
        }
        const res = await fetch(
          `/api/leads/pipeline/drilldown?${ddParams.toString()}`,
        );
        if (!res.ok) throw new Error("Failed to fetch");
        const d: DrilldownData = await res.json();
        setDrilldown(d);
      } catch {
        setDrilldown(null);
      } finally {
        setDrilldownLoading(false);
      }
    },
    [activeStage, range],
  );

  useEffect(() => {
    setActiveStage(null);
    setDrilldown(null);
  }, [preset, source, score, origin]);

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6">
        <div>
          <Breadcrumb items={["Admin", "Lead Intelligence", "Pipeline"]} />
          <h1 className="text-2xl font-bold text-gray-900 mt-1">Pipeline</h1>
          <p className="text-xs text-gray-400 mt-1">
            Click any stage to drill down into individual leads
          </p>
        </div>
        <DateRangePicker active={preset} onChange={setPreset} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <FilterDropdown
          label="Source"
          value={source}
          options={sourceOptions}
          onChange={setSource}
        />
        <FilterDropdown
          label="Score"
          value={score}
          options={[
            { value: "all", label: "All Scores" },
            { value: "5", label: "Score 5" },
            { value: "4", label: "Score 4" },
            { value: "3", label: "Score 3" },
            { value: "2", label: "Score 2" },
            { value: "1", label: "Score 1" },
          ]}
          onChange={setScore}
        />
        <FilterDropdown
          label="Origin"
          value={origin}
          options={[
            { value: "all", label: "All Origins" },
            { value: "national", label: "National" },
            { value: "international", label: "International" },
          ]}
          onChange={setOrigin}
        />
      </div>

      {error && <ErrorState message={error} onRetry={refetch} />}

      {!error && loading && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
          <SkeletonChart />
        </>
      )}

      {!error && !loading && data && (
        <>
          {/* Hero cards — clickable */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            {data.stages.map((stage) => (
              <button
                key={stage.label}
                onClick={() => handleStageClick(stage.label)}
                className={`text-left transition-all cursor-pointer rounded-xl border p-4 shadow-sm ${
                  activeStage === stage.label
                    ? "border-gray-300 ring-1 ring-gray-200 bg-white scale-[1.02]"
                    : "border-gray-200 bg-white hover:border-gray-300 hover:scale-[1.01]"
                }`}
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-gray-400 mb-2">
                  {stage.label}
                </p>
                <p
                  className="text-2xl font-bold tracking-tight"
                  style={{ color: STAGE_COLORS[stage.label] ?? "#9ca3af" }}
                >
                  {formatNumber(stage.count)}
                </p>
                {activeStage === stage.label && (
                  <p className="text-[10px] text-indigo-600 mt-1">
                    ▼ Viewing leads
                  </p>
                )}
              </button>
            ))}
          </div>

          {/* Funnel */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mb-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-6">
              Pipeline Funnel
            </h2>
            <div className="space-y-4">
              {data.stages.map((stage, i) => (
                <button
                  key={stage.label}
                  onClick={() => handleStageClick(stage.label)}
                  className={`w-full flex items-center gap-4 group transition-all cursor-pointer rounded-lg px-2 py-1 ${
                    activeStage === stage.label
                      ? "bg-gray-50"
                      : "hover:bg-gray-50/50"
                  }`}
                >
                  <span className="w-40 text-sm text-gray-500 text-right shrink-0 group-hover:text-gray-900 transition-colors">
                    {stage.label}
                  </span>
                  <div className="flex-1 flex items-center gap-3">
                    <div className="flex-1 h-10 bg-gray-100 rounded-lg overflow-hidden relative">
                      <div
                        className="h-full rounded-lg transition-all duration-500 flex items-center px-3"
                        style={{
                          width: `${Math.max((stage.count / maxCount) * 100, 4)}%`,
                          background: STAGE_COLORS[stage.label] ?? "#6b7280",
                        }}
                      >
                        <span className="text-xs font-semibold text-white whitespace-nowrap">
                          {formatNumber(stage.count)}
                        </span>
                      </div>
                    </div>
                    {i < data.stages.length - 1 && (
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="shrink-0 text-gray-400"
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* ═══ DRILL-DOWN PANEL ═══ */}
          {activeStage && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              <div
                className="px-6 py-4 border-b border-gray-200 flex items-center justify-between"
                style={{
                  borderLeftWidth: 3,
                  borderLeftColor:
                    STAGE_COLORS[activeStage] ?? "#6b7280",
                }}
              >
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {activeStage}
                    {drilldown && (
                      <span className="text-sm font-normal text-gray-400 ml-2">
                        {drilldown.total} opportunities
                      </span>
                    )}
                  </h2>
                  {drilldown && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {drilldown.matched} matched to scoring sheet
                      {drilldown.unmatched > 0 &&
                        ` · ${drilldown.unmatched} unmatched`}
                      {" · "}showing top 100
                    </p>
                  )}
                </div>
                <button
                  onClick={() => {
                    setActiveStage(null);
                    setDrilldown(null);
                  }}
                  className="text-gray-400 hover:text-gray-900 transition-colors cursor-pointer p-1"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {drilldownLoading && (
                <div className="px-6 py-12 text-center">
                  <div className="inline-block w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm text-gray-400 mt-3">
                    Loading lead details…
                  </p>
                </div>
              )}

              {!drilldownLoading && drilldown && drilldown.leads.length === 0 && (
                <div className="px-6 py-12 text-center">
                  <p className="text-sm text-gray-400">
                    No leads found at this stage
                  </p>
                </div>
              )}

              {!drilldownLoading &&
                drilldown &&
                drilldown.leads.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          {[
                            "Name",
                            "Score",
                            "Source",
                            "Origin",
                            "Date",
                            "AI Conversation",
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
                        {drilldown.leads.map((lead) => (
                          <tr
                            key={lead.sfId}
                            className="border-b border-gray-200 last:border-0 hover:bg-gray-50 transition-colors"
                          >
                            {/* Name */}
                            <td className="px-5 py-3">
                              <div>
                                <p className="text-gray-900 font-medium">
                                  {lead.name}
                                </p>
                                {lead.phone && (
                                  <p className="text-[10px] text-gray-400 mt-0.5">
                                    {lead.phone}
                                  </p>
                                )}
                              </div>
                            </td>

                            {/* Score */}
                            <td className="px-5 py-3">
                              {lead.score != null && lead.score > 0 ? (
                                <span
                                  className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold border ${
                                    SCORE_STYLES[lead.score] ??
                                    "bg-gray-50 text-gray-600 border-gray-200"
                                  }`}
                                >
                                  {lead.score}
                                </span>
                              ) : (
                                <span className="text-gray-400 text-xs">
                                  {lead.matched ? "—" : "No match"}
                                </span>
                              )}
                            </td>

                            {/* Source */}
                            <td className="px-5 py-3">
                              <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-500">
                                {lead.source}
                              </span>
                            </td>

                            {/* Origin */}
                            <td className="px-5 py-3">
                              <span className="text-xs text-gray-500">
                                {lead.phoneOrigin || "—"}
                              </span>
                            </td>

                            {/* Date */}
                            <td className="px-5 py-3 whitespace-nowrap">
                              <span className="text-xs text-gray-500 tabular-nums">
                                {fmtDate(lead.date)}
                              </span>
                            </td>

                            {/* Conversation */}
                            <td className="px-5 py-3">
                              <ConversationCell text={lead.conversation} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

"use client";

import { useState, useMemo } from "react";
import {
  Breadcrumb,
  DateRangePicker,
  DatePreset,
  computeDateRange,
  SkeletonTable,
  ErrorState,
  ScoreBadge,
  FilterDropdown,
  useFetchData,
} from "../_components";

const stageColors: Record<string, string> = {
  New: "bg-gray-100 text-gray-600",
  "Lead Outreach": "bg-green-50 text-green-700",
  "Consultation Booked": "bg-blue-50 text-blue-700",
  "Awaiting Retainer": "bg-emerald-50 text-emerald-700",
  Retained: "bg-purple-50 text-purple-700",
};

function StagePill({ stage }: { stage: string }) {
  const color = stageColors[stage] || "bg-gray-100 text-gray-600";
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${color}`}>
      {stage}
    </span>
  );
}

interface Lead {
  id: string;
  name: string;
  score: number;
  source: string;
  phoneOrigin: string;
  stage: string;
  booked: boolean;
  retained: boolean;
  createdAt: string;
  sfId?: string;
}

interface ExplorerData {
  leads: Lead[];
  total: number;
  page: number;
  pageSize: number;
  sources: string[];
}

export default function ExplorerPage() {
  const [preset, setPreset] = useState<DatePreset>("30d");
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("all");
  const [score, setScore] = useState("all");
  const [origin, setOrigin] = useState("all");
  const [page, setPage] = useState(1);

  const range = useMemo(() => computeDateRange(preset), [preset]);
  const params = new URLSearchParams();
  if (range.start) {
    params.set("start", range.start);
    params.set("end", range.end!);
  }
  if (search) params.set("search", search);
  if (source !== "all") params.set("source", source);
  if (score !== "all") params.set("score", score);
  if (origin !== "all") params.set("origin", origin);
  params.set("page", String(page));
  const qs = `?${params.toString()}`;

  const { data, loading, error, refetch } = useFetchData<ExplorerData>(
    `/api/leads/explorer${qs}`,
    [preset, search, source, score, origin, page],
  );

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 1;

  const sourceOptions = [
    { value: "all", label: "All Sources" },
    ...(data?.sources ?? []).map((s) => ({ value: s, label: s })),
  ];

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6">
        <div>
          <Breadcrumb items={["Admin", "Lead Intelligence", "Lead Explorer"]} />
          <h1 className="text-2xl font-bold text-gray-900 mt-1">Lead Explorer</h1>
        </div>
        <DateRangePicker active={preset} onChange={setPreset} />
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap items-end gap-4 mb-6">
        <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
          <label className="text-[10px] uppercase tracking-wider text-gray-400">
            Search
          </label>
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name, email, phone…"
            className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#818cf8] placeholder:text-gray-400"
          />
        </div>
        <FilterDropdown
          label="Source"
          value={source}
          options={sourceOptions}
          onChange={(v) => {
            setSource(v);
            setPage(1);
          }}
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
          onChange={(v) => {
            setScore(v);
            setPage(1);
          }}
        />
        <FilterDropdown
          label="Origin"
          value={origin}
          options={[
            { value: "all", label: "All Origins" },
            { value: "national", label: "National" },
            { value: "international", label: "International" },
          ]}
          onChange={(v) => {
            setOrigin(v);
            setPage(1);
          }}
        />
      </div>

      {error && <ErrorState message={error} onRetry={refetch} />}

      {!error && loading && <SkeletonTable rows={10} />}

      {!error && !loading && data && (
        <>
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  {["Name", "Score", "Source", "Phone Origin", "Stage", "Booked", "Retained", "Date Created", "SF Link"].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-6 py-3 text-left text-xs uppercase text-gray-400 font-medium"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {data.leads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="border-b border-gray-200 last:border-0 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-3 text-gray-900 font-medium">
                      {lead.name}
                    </td>
                    <td className="px-6 py-3">
                      <ScoreBadge score={lead.score} />
                    </td>
                    <td className="px-6 py-3 text-gray-500">{lead.source}</td>
                    <td className="px-6 py-3 text-gray-500">
                      {lead.phoneOrigin}
                    </td>
                    <td className="px-6 py-3">
                      <StagePill stage={lead.stage} />
                    </td>
                    <td className="px-6 py-3 text-center">
                      {lead.booked ? (
                        <span className="text-green-400">✓</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-center">
                      {lead.retained ? (
                        <span className="text-green-400">✓</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-gray-400 tabular-nums">
                      {lead.createdAt ? new Date(lead.createdAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-6 py-3">
                      {lead.sfId ? (
                        <a
                          href={`https://login.salesforce.com/${lead.sfId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-[#a5b4fc] text-xs"
                        >
                          View →
                        </a>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {data.leads.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-6 py-12 text-center text-gray-400"
                    >
                      No leads found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-xs text-gray-400">
                Showing {(data.page - 1) * data.pageSize + 1}–
                {Math.min(data.page * data.pageSize, data.total)} of{" "}
                {data.total}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-500 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-500 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

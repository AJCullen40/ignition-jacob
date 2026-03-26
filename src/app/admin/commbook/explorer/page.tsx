"use client";

import { useEffect, useState, useMemo } from "react";

interface RevenueItem {
  name: string;
  amount: number;
  visaType: string;
  platform: string;
  postUrl: string;
  postDate: string;
  commentScore: number;
  consultationDate: string;
  retainerDate: string;
}

const GOLD = "#d4af37";
const GOLD_DIM = "#b8962e";
const NAVY = "#0a1628";
const CARD_BG = "#ffffff";

const SCORE_COLORS: Record<number, string> = {
  1: "#ef4444",
  2: "#f59e0b",
  3: "#3b82f6",
  4: "#22c55e",
};

const SOURCES = ["All Sources", "Facebook", "Instagram", "YouTube", "TikTok", "Other"];
const SCORES = ["All Scores", "1", "2", "3", "4"];

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-200 ${className}`} style={{ minHeight: 20 }} />;
}

export default function CommBookExplorer() {
  const [leads, setLeads] = useState<RevenueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("All Sources");
  const [scoreFilter, setScoreFilter] = useState("All Scores");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/commbook/overview?start=" + thirtyDaysAgo());
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        setLeads(json.revenueAttribution || []);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      if (search && !l.name.toLowerCase().includes(search.toLowerCase()) && !l.visaType.toLowerCase().includes(search.toLowerCase())) return false;
      if (sourceFilter !== "All Sources" && l.platform !== sourceFilter) return false;
      if (scoreFilter !== "All Scores" && l.commentScore !== Number(scoreFilter)) return false;
      return true;
    });
  }, [leads, search, sourceFilter, scoreFilter]);

  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="flex items-center gap-3 mb-8">
        <span
          className="flex items-center justify-center rounded-lg text-xs font-bold"
          style={{ width: 36, height: 36, background: `linear-gradient(135deg, ${GOLD}, ${GOLD_DIM})`, color: NAVY }}
        >
          CB
        </span>
        <div>
          <h1 className="text-xl font-bold text-gray-900">CommBook Lead Explorer</h1>
          <p className="text-xs text-gray-400">Search and filter attributed leads</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      <div
        className="rounded-xl shadow-sm border p-6"
        style={{ background: CARD_BG, borderColor: "#e5e7eb" }}
      >
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] rounded-lg border px-3 py-2 text-sm text-gray-900 placeholder-[#6b7280] outline-none focus:border-[#d4af37]"
            style={{ background: "#f3f4f6", borderColor: "#e5e7eb" }}
          />
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="cursor-pointer rounded-lg border px-3 py-2 text-sm text-gray-900 outline-none"
            style={{ background: "#f3f4f6", borderColor: "#e5e7eb" }}
          >
            {SOURCES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={scoreFilter}
            onChange={(e) => setScoreFilter(e.target.value)}
            className="cursor-pointer rounded-lg border px-3 py-2 text-sm text-gray-900 outline-none"
            style={{ background: "#f3f4f6", borderColor: "#e5e7eb" }}
          >
            {SCORES.map((s) => (
              <option key={s} value={s}>
                {s === "All Scores" ? s : `Score ${s}`}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: "#e5e7eb" }}>
                  <Th>Name</Th>
                  <Th align="right">Amount</Th>
                  <Th>Visa Type</Th>
                  <Th>Platform</Th>
                  <Th align="center">Score</Th>
                  <Th>Source Date</Th>
                  <Th>Retainer Date</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l, i) => (
                  <tr
                    key={i}
                    className="border-b transition-colors hover:bg-gray-50"
                    style={{ borderColor: "#e5e7eb" }}
                  >
                    <td className="py-2.5 pr-4 font-medium text-gray-900">{l.name}</td>
                    <td className="py-2.5 pr-4 text-right font-semibold" style={{ color: GOLD }}>
                      ${l.amount.toLocaleString()}
                    </td>
                    <td className="py-2.5 pr-4 text-gray-500">{l.visaType}</td>
                    <td className="py-2.5 pr-4 text-gray-500">{l.platform}</td>
                    <td className="py-2.5 pr-4 text-center">
                      <span
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                        style={{ background: SCORE_COLORS[Math.min(l.commentScore, 4)] || "#6b7280" }}
                      >
                        {Math.min(l.commentScore, 4)}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-gray-500">
                      {l.postDate ? new Date(l.postDate).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-2.5 text-gray-500">
                      {l.retainerDate ? new Date(l.retainerDate).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-400">
                      {leads.length === 0 ? "No lead data available" : "No leads match your filters"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="mt-3 text-xs text-gray-400">
              Showing {filtered.length} of {leads.length} leads
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: string }) {
  return (
    <th
      className={`pb-2 pr-4 text-xs font-medium uppercase tracking-wider text-gray-400 ${
        align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function thirtyDaysAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().split("T")[0];
}

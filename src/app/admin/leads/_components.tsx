"use client";

import { useState, useCallback, useEffect } from "react";

/* ── Date Range Picker ─────────────────────────────── */

export type DatePreset =
  | "today"
  | "7d"
  | "30d"
  | "90d"
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "all"
  | "custom";

const PRESETS: { key: DatePreset; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 Days" },
  { key: "30d", label: "Last 30 Days" },
  { key: "90d", label: "Last 90 Days" },
  { key: "this_month", label: "This Month" },
  { key: "last_month", label: "Last Month" },
  { key: "this_quarter", label: "This Quarter" },
  { key: "all", label: "All Time" },
  { key: "custom", label: "Custom" },
];

export function computeDateRange(preset: DatePreset): {
  start: string | null;
  end: string | null;
} {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  switch (preset) {
    case "today":
      return { start: fmt(now), end: fmt(now) };
    case "7d": {
      const s = new Date(now);
      s.setDate(s.getDate() - 7);
      return { start: fmt(s), end: fmt(now) };
    }
    case "30d": {
      const s = new Date(now);
      s.setDate(s.getDate() - 30);
      return { start: fmt(s), end: fmt(now) };
    }
    case "90d": {
      const s = new Date(now);
      s.setDate(s.getDate() - 90);
      return { start: fmt(s), end: fmt(now) };
    }
    case "this_month":
      return {
        start: fmt(new Date(now.getFullYear(), now.getMonth(), 1)),
        end: fmt(now),
      };
    case "last_month": {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: fmt(s), end: fmt(e) };
    }
    case "this_quarter": {
      const qStart = Math.floor(now.getMonth() / 3) * 3;
      return {
        start: fmt(new Date(now.getFullYear(), qStart, 1)),
        end: fmt(now),
      };
    }
    case "all":
      return { start: null, end: null };
    case "custom":
      return { start: null, end: null };
  }
}

export function DateRangePicker({
  active,
  onChange,
}: {
  active: DatePreset;
  onChange: (preset: DatePreset) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PRESETS.map((p) => (
        <button
          key={p.key}
          onClick={() => onChange(p.key)}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
            active === p.key
              ? "bg-[#818cf8] text-white"
              : "bg-white border border-gray-200 text-gray-500 hover:text-gray-900 hover:border-gray-300"
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

/* ── Breadcrumb ────────────────────────────────────── */

export function Breadcrumb({ items }: { items: string[] }) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-2">
          {i > 0 && <span>/</span>}
          <span className={i === items.length - 1 ? "text-gray-900" : ""}>
            {item}
          </span>
        </span>
      ))}
    </div>
  );
}

/* ── Hero Card ─────────────────────────────────────── */

export function HeroCard({
  label,
  value,
  accent = "#111827",
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 flex-1 min-w-[140px] shadow-sm">
      <div className="text-xs uppercase tracking-wider text-gray-400 mb-2">
        {label}
      </div>
      <div className="text-2xl font-bold" style={{ color: accent }}>
        {value}
      </div>
    </div>
  );
}

/* ── Skeleton ──────────────────────────────────────── */

export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div
      className={`bg-white border border-gray-200 rounded-xl p-6 animate-pulse shadow-sm ${className}`}
    >
      <div className="h-3 w-20 bg-gray-100 rounded mb-3" />
      <div className="h-7 w-28 bg-gray-100 rounded" />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <tr>
      {Array.from({ length: 5 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-gray-100 rounded animate-pulse w-full" />
        </td>
      ))}
    </tr>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-100">
            {Array.from({ length: 5 }).map((_, i) => (
              <th key={i} className="px-4 py-3 text-left">
                <div className="h-3 w-16 bg-gray-100 rounded animate-pulse" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 animate-pulse shadow-sm">
      <div className="h-4 w-32 bg-gray-100 rounded mb-6" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 mb-3">
          <div className="h-4 w-16 bg-gray-100 rounded" />
          <div
            className="h-6 bg-gray-100 rounded"
            style={{ width: `${60 - i * 10}%` }}
          />
        </div>
      ))}
    </div>
  );
}

/* ── Error State ───────────────────────────────────── */

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-8 flex flex-col items-center gap-4 shadow-sm">
      <div className="text-red-500 text-sm">{message}</div>
      <button
        onClick={onRetry}
        className="bg-[#818cf8] hover:bg-[#6366f1] text-white text-sm px-4 py-2 rounded-lg transition-colors cursor-pointer"
      >
        Retry
      </button>
    </div>
  );
}

/* ── Score Badge ───────────────────────────────────── */

const SCORE_COLORS: Record<number, string> = {
  5: "bg-green-50 text-green-700 border-green-200",
  4: "bg-blue-50 text-blue-700 border-blue-200",
  3: "bg-yellow-50 text-yellow-700 border-yellow-200",
  2: "bg-gray-50 text-gray-600 border-gray-200",
  1: "bg-red-50 text-red-700 border-red-200",
};

export function ScoreBadge({ score }: { score: number }) {
  const cls = SCORE_COLORS[score] ?? SCORE_COLORS[1];
  return (
    <span
      className={`inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-semibold ${cls}`}
    >
      {score}
    </span>
  );
}

/* ── useFetchData hook ─────────────────────────────── */

export function useFetchData<T>(
  url: string,
  deps: unknown[] = [],
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((d) => setData(d as T))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  useEffect(() => {
    fetchData();
  }, [fetchData, ...deps]);

  return { data, loading, error, refetch: fetchData };
}

/* ── Filter Dropdown ───────────────────────────────── */

export function FilterDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] uppercase tracking-wider text-gray-400">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-[#818cf8] cursor-pointer appearance-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

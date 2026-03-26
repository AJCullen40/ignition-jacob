"use client";

import { useEffect, useState, useCallback } from "react";

interface RecoveryData {
  totalOpportunities: number;
  hotLeads: number;
  score5Agreed: number;
  neverBooked: number;
  estimatedRecoverableRevenue: number;
  neverCalled: number;
  calledNotBooked: number;
  convertedProfile: {
    avgScore: number;
    avgDmMessages: number;
    feeAgreementRate: number;
    totalConverted: number;
  };
  recoveryMatchResults: {
    highMatch: number;
    mediumMatch: number;
    lowMatch: number;
  };
  avgRetainerValue: number;
}

type RangeKey = "today" | "7d" | "30d" | "90d" | "thisMonth" | "lastMonth" | "all";

const GOLD = "#d4af37";
const GOLD_DIM = "#b8962e";
const NAVY = "#0a1628";
const CARD_BG = "#ffffff";

const RANGE_LABELS: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
  { key: "90d", label: "90d" },
  { key: "thisMonth", label: "This Month" },
  { key: "lastMonth", label: "Last Month" },
  { key: "all", label: "All Time" },
];

function rangeToParams(key: RangeKey): string {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  switch (key) {
    case "today":
      return `start=${fmt(now)}`;
    case "7d": {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return `start=${fmt(d)}`;
    }
    case "30d": {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      return `start=${fmt(d)}`;
    }
    case "90d": {
      const d = new Date(now);
      d.setDate(d.getDate() - 90);
      return `start=${fmt(d)}`;
    }
    case "thisMonth":
      return `start=${fmt(new Date(now.getFullYear(), now.getMonth(), 1))}`;
    case "lastMonth": {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0);
      return `start=${fmt(s)}&end=${fmt(e)}`;
    }
    case "all":
      return "";
  }
}

function fmt$(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-200 ${className}`} style={{ minHeight: 20 }} />;
}

export default function RecoveryRadar() {
  const [range, setRange] = useState<RangeKey>("all");
  const [data, setData] = useState<RecoveryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (r: RangeKey) => {
    setLoading(true);
    setError(null);
    try {
      const params = rangeToParams(r);
      const url = `/api/commbook/recovery${params ? `?${params}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(range);
  }, [range, fetchData]);

  return (
    <div className="mx-auto max-w-[1400px]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <span
            className="flex items-center justify-center rounded-lg text-xs font-bold"
            style={{
              width: 36,
              height: 36,
              background: `linear-gradient(135deg, ${GOLD}, ${GOLD_DIM})`,
              color: NAVY,
            }}
          >
            CB
          </span>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Revenue Recovery Radar</h1>
            <p className="text-xs text-gray-400">
              AI-analyzed leads that should have converted — recoverable revenue from sales gaps
            </p>
          </div>
        </div>

        <div className="flex gap-1 rounded-lg p-1" style={{ background: "#f3f4f6" }}>
          {RANGE_LABELS.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className="cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
              style={{
                background: range === r.key ? GOLD : "transparent",
                color: range === r.key ? NAVY : "#9ca3af",
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Alert Banner */}
      {!loading && data && data.neverBooked > 0 && (
        <div
          className="mb-6 rounded-xl shadow-sm border px-5 py-4"
          style={{ background: "rgba(212, 175, 55, 0.08)", borderColor: "rgba(212, 175, 55, 0.3)" }}
        >
          <div className="flex items-start gap-3">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke={GOLD}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mt-0.5 shrink-0"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div>
              <p className="text-sm font-medium" style={{ color: GOLD }}>
                <span className="font-bold">{data.neverBooked} leads</span> agreed to consultation
                fees but were never booked.{" "}
                <span className="font-bold">{data.neverCalled}</span> were never called by a human.
              </p>
              <p className="mt-1 text-sm" style={{ color: GOLD_DIM }}>
                Estimated recoverable revenue:{" "}
                <span className="font-bold text-gray-900">{fmt$(data.estimatedRecoverableRevenue)}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Metric Cards — 2×3 grid */}
      {loading ? (
        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : data ? (
        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-3">
          <MetricCard
            label="Total Opportunities"
            value={data.totalOpportunities.toLocaleString()}
            sub="Scoring leads with score 4-5"
          />
          <MetricCard
            label="Hot — Score 4 & 5"
            value={data.hotLeads.toLocaleString()}
            accent={GOLD}
          />
          <MetricCard
            label="Score 5 — Agreed to Fees"
            value={data.score5Agreed.toLocaleString()}
          />
          <MetricCard
            label="Est. Recoverable Revenue"
            value={fmt$(data.estimatedRecoverableRevenue)}
            accent="#ef4444"
          />
          <MetricCard
            label="Never Called"
            value={data.neverCalled.toLocaleString()}
            sub="No human phone call in Salesforce"
          />
          <MetricCard
            label="Called, Not Booked"
            value={data.calledNotBooked.toLocaleString()}
            sub="Human called but never booked"
          />
        </div>
      ) : null}

      {/* Conversion Benchmark Analysis */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
      ) : data ? (
        <>
          <h2
            className="mb-4 text-sm font-semibold uppercase tracking-wider"
            style={{ color: GOLD }}
          >
            Conversion Benchmark Analysis
          </h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Converted Lead Profile */}
            <div
              className="rounded-xl shadow-sm border p-6"
              style={{ background: CARD_BG, borderColor: "#e5e7eb" }}
            >
              <div className="mb-4 flex items-center gap-2">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg"
                  style={{ background: "rgba(34, 197, 94, 0.15)" }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#22c55e"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-900">
                    Converted Lead Profile
                  </h3>
                  <p className="text-[10px] text-gray-400">
                    Based on {data.convertedProfile.totalConverted} converted leads
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <ProfileRow
                  label="Avg DM Messages"
                  value={data.convertedProfile.avgDmMessages.toFixed(1)}
                />
                <ProfileRow
                  label="Fee Agreement Rate"
                  value={`${data.convertedProfile.feeAgreementRate.toFixed(1)}%`}
                />
                <ProfileRow
                  label="Avg Lead Score"
                  value={data.convertedProfile.avgScore.toFixed(1)}
                />
              </div>
            </div>

            {/* Recovery Lead Match Results */}
            <div
              className="rounded-xl shadow-sm border p-6"
              style={{ background: CARD_BG, borderColor: "#e5e7eb" }}
            >
              <div className="mb-4 flex items-center gap-2">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg"
                  style={{ background: "rgba(212, 175, 55, 0.15)" }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={GOLD}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-900">
                    Recovery Lead Match Results
                  </h3>
                  <p className="text-[10px] text-gray-400">
                    How never-booked leads compare to converted profile
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                <MatchBar
                  label="High Match"
                  detail="≥65% profile match"
                  count={data.recoveryMatchResults.highMatch}
                  total={data.neverBooked}
                  color="#22c55e"
                />
                <MatchBar
                  label="Medium Match"
                  detail="35–64% profile match"
                  count={data.recoveryMatchResults.mediumMatch}
                  total={data.neverBooked}
                  color="#f59e0b"
                />
                <MatchBar
                  label="Low Match"
                  detail="<35% profile match"
                  count={data.recoveryMatchResults.lowMatch}
                  total={data.neverBooked}
                  color="#ef4444"
                />
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div
      className="rounded-xl shadow-sm border px-5 py-4"
      style={{ background: CARD_BG, borderColor: accent ? `${accent}44` : "#e5e7eb" }}
    >
      <div
        className="text-xs font-medium uppercase tracking-wider"
        style={{ color: GOLD_DIM }}
      >
        {label}
      </div>
      <div
        className="mt-1 text-2xl font-bold"
        style={{ color: accent || "#111827" }}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-gray-400">{sub}</div>}
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg px-3 py-2.5" style={{ background: "#f3f4f6" }}>
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-semibold text-gray-900">{value}</span>
    </div>
  );
}

function MatchBar({
  label,
  detail,
  count,
  total,
  color,
}: {
  label: string;
  detail: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
          <span className="text-sm font-medium text-gray-900">{label}</span>
          <span className="text-[10px] text-gray-400">{detail}</span>
        </div>
        <span className="text-sm font-semibold text-gray-900">
          {count} <span className="text-xs text-gray-400">({pct.toFixed(0)}%)</span>
        </span>
      </div>
      <div className="h-2 rounded-full" style={{ background: "#f3f4f6" }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.max(pct, 1)}%`, background: color }}
        />
      </div>
    </div>
  );
}

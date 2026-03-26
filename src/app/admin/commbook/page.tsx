"use client";

import { useEffect, useState, useCallback } from "react";

interface HeroData {
  commBookRate: number;
  totalComments: number;
  totalBookings: number;
  totalRetainers: number;
  totalRevenue: number;
}
interface FunnelStage {
  stage: string;
  count: number;
  rate: number;
}
interface TopPost {
  postUrl: string;
  platform: string;
  date: string;
  totalComments: number;
  bookings: number;
  commBookRate: number;
}
interface PlatformData {
  platform: string;
  color: string;
  totalComments: number;
  dmsStarted: number;
  leadsScored: number;
  consultationsBooked: number;
  retainersSigned: number;
  commBookRate: number;
  revenue: number;
}
interface VisaType {
  visaType: string;
  comments: number;
  leadsScored: number;
  bookings: number;
  retainers: number;
  commBookRate: number;
  avgRetainerValue: number;
  totalRevenue: number;
}
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
interface CommBookData {
  lastUpdated: string;
  hero: HeroData;
  funnel: FunnelStage[];
  topPosts: TopPost[];
  platforms: PlatformData[];
  visaTypes: VisaType[];
  revenueAttribution: RevenueItem[];
}

type RangeKey = "today" | "7d" | "30d" | "90d" | "thisMonth" | "lastMonth";

const GOLD = "#d4af37";
const GOLD_DIM = "#b8962e";
const NAVY = "#0a1628";
const CARD_BG = "#ffffff";

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
  }
}

const RANGE_LABELS: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
  { key: "90d", label: "90d" },
  { key: "thisMonth", label: "This Month" },
  { key: "lastMonth", label: "Last Month" },
];

function fmt$(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-gray-200 ${className}`}
      style={{ minHeight: 20 }}
    />
  );
}

function HeroCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div
      className="rounded-xl shadow-sm border px-5 py-4"
      style={{ background: CARD_BG, borderColor: "#e5e7eb" }}
    >
      <div className="text-xs font-medium uppercase tracking-wider" style={{ color: GOLD_DIM }}>
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold text-gray-900">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-gray-400">{sub}</div>}
    </div>
  );
}

export default function CommBookOverview() {
  const [range, setRange] = useState<RangeKey>("30d");
  const [data, setData] = useState<CommBookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revSearch, setRevSearch] = useState("");
  const [revSort, setRevSort] = useState<"amount" | "name" | "score">("amount");

  const fetchData = useCallback(async (r: RangeKey) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/commbook/overview?${rangeToParams(r)}`);
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

  const maxFunnel = data ? Math.max(...data.funnel.map((f) => f.count), 1) : 1;

  const filteredRevenue = data
    ? data.revenueAttribution
        .filter(
          (r) =>
            !revSearch ||
            r.name.toLowerCase().includes(revSearch.toLowerCase()) ||
            r.visaType.toLowerCase().includes(revSearch.toLowerCase())
        )
        .sort((a, b) => {
          if (revSort === "amount") return b.amount - a.amount;
          if (revSort === "name") return a.name.localeCompare(b.name);
          return b.commentScore - a.commentScore;
        })
    : [];

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
            <h1 className="text-xl font-bold text-gray-900">CommBook Intelligence</h1>
            <p className="text-xs text-gray-400">
              {data
                ? `Updated ${new Date(data.lastUpdated).toLocaleString()}`
                : "Loading..."}
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

      {/* Hero Cards */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4 mb-8 md:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : data ? (
        <div className="grid grid-cols-2 gap-4 mb-8 md:grid-cols-3 lg:grid-cols-6">
          <HeroCard label="CommBook Rate" value={`${data.hero.commBookRate.toFixed(2)}%`} />
          <HeroCard label="Total Comments" value={data.hero.totalComments.toLocaleString()} />
          <HeroCard label="Legit Leads" value={data.funnel.find((f) => f.stage === "Legit Lead")?.count.toLocaleString() || "0"} />
          <HeroCard label="Consults Booked" value={data.hero.totalBookings.toLocaleString()} />
          <HeroCard label="Retainers Signed" value={data.hero.totalRetainers.toLocaleString()} />
          <HeroCard label="Revenue" value={fmt$(data.hero.totalRevenue)} />
        </div>
      ) : null}

      {/* Conversion Funnel */}
      <Section title="Conversion Funnel">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8" />
            ))}
          </div>
        ) : data ? (
          <div className="space-y-3">
            {data.funnel.map((f) => (
              <div key={f.stage} className="flex items-center gap-3">
                <div className="w-40 shrink-0 text-right text-xs text-gray-500">{f.stage}</div>
                <div className="relative flex-1 h-7 rounded" style={{ background: "#f3f4f6" }}>
                  <div
                    className="h-full rounded"
                    style={{
                      width: `${Math.max((f.count / maxFunnel) * 100, 1)}%`,
                      background: `linear-gradient(90deg, ${GOLD}, ${GOLD_DIM})`,
                      transition: "width 600ms ease",
                    }}
                  />
                  <span className="absolute inset-y-0 left-2 flex items-center text-xs font-semibold text-white">
                    {f.count.toLocaleString()}
                  </span>
                </div>
                <div className="w-14 text-right text-xs font-medium" style={{ color: GOLD }}>
                  {f.rate.toFixed(1)}%
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </Section>

      {/* Top Posts */}
      <Section title="Top Posts by CommBook">
        {loading ? (
          <Skeleton className="h-48" />
        ) : data ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: "#e5e7eb" }}>
                  <Th>Post URL</Th>
                  <Th>Platform</Th>
                  <Th>Date</Th>
                  <Th align="right">Comments</Th>
                  <Th align="right">Bookings</Th>
                  <Th align="right">CB Rate</Th>
                </tr>
              </thead>
              <tbody>
                {data.topPosts.slice(0, 15).map((p, i) => (
                  <tr
                    key={i}
                    className="border-b transition-colors hover:bg-gray-50"
                    style={{ borderColor: "#e5e7eb" }}
                  >
                    <td className="py-2 pr-4 max-w-[300px] truncate">
                      <a
                        href={p.postUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:underline"
                        style={{ color: GOLD }}
                      >
                        {p.postUrl.replace(/https?:\/\/(www\.)?/, "").slice(0, 60)}
                      </a>
                    </td>
                    <td className="py-2 pr-4 text-gray-500">{p.platform}</td>
                    <td className="py-2 pr-4 text-gray-500">{p.date ? new Date(p.date).toLocaleDateString() : "—"}</td>
                    <td className="py-2 pr-4 text-right text-gray-900">{p.totalComments.toLocaleString()}</td>
                    <td className="py-2 pr-4 text-right text-gray-900">{p.bookings}</td>
                    <td className="py-2 text-right font-medium" style={{ color: GOLD }}>
                      {p.commBookRate.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Section>

      {/* Platform Comparison */}
      <Section title="Platform Comparison">
        {loading ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-36 rounded-xl" />
            ))}
          </div>
        ) : data ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {data.platforms.map((p) => (
              <div
                key={p.platform}
                className="rounded-xl shadow-sm border p-4"
                style={{ background: CARD_BG, borderColor: "#e5e7eb" }}
              >
                <div className="mb-3 flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: p.color }}
                  />
                  <span className="text-sm font-semibold text-gray-900">{p.platform}</span>
                </div>
                <div className="space-y-1 text-xs">
                  <Row label="Comments" value={p.totalComments.toLocaleString()} />
                  <Row label="DMs Started" value={p.dmsStarted.toLocaleString()} />
                  <Row label="AI Scored" value={p.leadsScored.toLocaleString()} />
                  <Row label="Booked" value={p.consultationsBooked.toLocaleString()} />
                  <Row label="Retained" value={p.retainersSigned.toLocaleString()} />
                  <Row label="Revenue" value={fmt$(p.revenue)} gold />
                  <Row label="CB Rate" value={`${p.commBookRate.toFixed(1)}%`} gold />
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </Section>

      {/* Visa Type Performance */}
      <Section title="Visa Type / Topic Performance">
        {loading ? (
          <Skeleton className="h-48" />
        ) : data ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: "#e5e7eb" }}>
                  <Th>Visa Type</Th>
                  <Th align="right">Comments</Th>
                  <Th align="right">AI Scored</Th>
                  <Th align="right">Bookings</Th>
                  <Th align="right">Retainers</Th>
                  <Th align="right">CB Rate</Th>
                  <Th align="right">Avg Retainer</Th>
                  <Th align="right">Revenue</Th>
                </tr>
              </thead>
              <tbody>
                {data.visaTypes.map((v) => (
                  <tr
                    key={v.visaType}
                    className="border-b transition-colors hover:bg-gray-50"
                    style={{ borderColor: "#e5e7eb" }}
                  >
                    <td className="py-2 pr-4 font-medium text-gray-900">{v.visaType}</td>
                    <td className="py-2 pr-4 text-right text-gray-500">{v.comments.toLocaleString()}</td>
                    <td className="py-2 pr-4 text-right text-gray-500">{v.leadsScored.toLocaleString()}</td>
                    <td className="py-2 pr-4 text-right text-gray-500">{v.bookings.toLocaleString()}</td>
                    <td className="py-2 pr-4 text-right text-gray-500">{v.retainers.toLocaleString()}</td>
                    <td className="py-2 pr-4 text-right font-medium" style={{ color: GOLD }}>
                      {v.commBookRate.toFixed(1)}%
                    </td>
                    <td className="py-2 pr-4 text-right text-gray-500">{fmt$(v.avgRetainerValue)}</td>
                    <td className="py-2 text-right font-semibold" style={{ color: GOLD }}>
                      {fmt$(v.totalRevenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Section>

      {/* Revenue Attribution */}
      <Section title="Revenue Attribution — Comment to Cash">
        {loading ? (
          <Skeleton className="h-48" />
        ) : data ? (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <input
                type="text"
                placeholder="Search by name or visa type..."
                value={revSearch}
                onChange={(e) => setRevSearch(e.target.value)}
                className="rounded-lg border px-3 py-1.5 text-sm text-gray-900 placeholder-[#6b7280] outline-none focus:border-[#d4af37]"
                style={{ background: "#f3f4f6", borderColor: "#e5e7eb" }}
              />
              <select
                value={revSort}
                onChange={(e) => setRevSort(e.target.value as typeof revSort)}
                className="cursor-pointer rounded-lg border px-3 py-1.5 text-sm text-gray-900 outline-none"
                style={{ background: "#f3f4f6", borderColor: "#e5e7eb" }}
              >
                <option value="amount">Sort: Amount</option>
                <option value="name">Sort: Name</option>
                <option value="score">Sort: Score</option>
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b" style={{ borderColor: "#e5e7eb" }}>
                    <Th>Name</Th>
                    <Th align="right">Amount</Th>
                    <Th>Visa Type</Th>
                    <Th>Platform</Th>
                    <Th align="center">Score</Th>
                    <Th>Retainer Date</Th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRevenue.map((r, i) => (
                    <tr
                      key={i}
                      className="border-b transition-colors hover:bg-gray-50"
                      style={{ borderColor: "#e5e7eb" }}
                    >
                      <td className="py-2 pr-4 font-medium text-gray-900">{r.name}</td>
                      <td className="py-2 pr-4 text-right font-semibold" style={{ color: GOLD }}>
                        {fmt$(r.amount)}
                      </td>
                      <td className="py-2 pr-4 text-gray-500">{r.visaType}</td>
                      <td className="py-2 pr-4 text-gray-500">{r.platform}</td>
                      <td className="py-2 pr-4 text-center">
                        <ScoreBadge score={r.commentScore} />
                      </td>
                      <td className="py-2 text-gray-500">
                        {r.retainerDate ? new Date(r.retainerDate).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  ))}
                  {filteredRevenue.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-gray-400">
                        No revenue records found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </Section>
    </div>
  );
}

/* ---- Shared small components ---- */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="mb-6 rounded-xl shadow-sm border p-6"
      style={{ background: CARD_BG, borderColor: "#e5e7eb" }}
    >
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider" style={{ color: GOLD }}>
        {title}
      </h2>
      {children}
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

function Row({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-400">{label}</span>
      <span className={gold ? "font-medium" : "text-gray-900"} style={gold ? { color: GOLD } : undefined}>
        {value}
      </span>
    </div>
  );
}

const SCORE_COLORS: Record<number, string> = {
  1: "#ef4444",
  2: "#f59e0b",
  3: "#3b82f6",
  4: "#22c55e",
};

function ScoreBadge({ score }: { score: number }) {
  const s = Math.min(Math.max(score, 1), 4);
  return (
    <span
      className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
      style={{ background: SCORE_COLORS[s] || "#6b7280" }}
    >
      {s}
    </span>
  );
}

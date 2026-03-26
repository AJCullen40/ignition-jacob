"use client";

import { useEffect, useState } from "react";

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

const GOLD = "#d4af37";
const GOLD_DIM = "#b8962e";
const NAVY = "#0a1628";
const CARD_BG = "#ffffff";

function fmt$(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-200 ${className}`} style={{ minHeight: 20 }} />;
}

export default function CommBookAttribution() {
  const [platforms, setPlatforms] = useState<PlatformData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/commbook/overview?start=" + thirtyDaysAgo());
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        setPlatforms(json.platforms || []);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalRevenue = platforms.reduce((s, p) => s + p.revenue, 0);

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
          <h1 className="text-xl font-bold text-gray-900">CommBook Attribution</h1>
          <p className="text-xs text-gray-400">Revenue breakdown by platform</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      {/* Revenue Summary */}
      {!loading && platforms.length > 0 && (
        <div className="mb-6 rounded-xl shadow-sm border p-6" style={{ background: CARD_BG, borderColor: "#e5e7eb" }}>
          <div className="text-xs font-medium uppercase tracking-wider" style={{ color: GOLD_DIM }}>
            Total Attributed Revenue
          </div>
          <div className="mt-1 text-3xl font-bold text-gray-900">{fmt$(totalRevenue)}</div>
          <div className="mt-1 text-xs text-gray-400">{platforms.length} platforms tracked</div>
        </div>
      )}

      {/* Revenue Bars */}
      <div className="rounded-xl shadow-sm border p-6 mb-6" style={{ background: CARD_BG, borderColor: "#e5e7eb" }}>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider" style={{ color: GOLD }}>
          Revenue by Platform
        </h2>
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {platforms.map((p) => {
              const pct = totalRevenue > 0 ? (p.revenue / totalRevenue) * 100 : 0;
              return (
                <div key={p.platform}>
                  <div className="mb-1 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
                      <span className="text-sm font-medium text-gray-900">{p.platform}</span>
                    </div>
                    <span className="text-sm font-semibold" style={{ color: GOLD }}>
                      {fmt$(p.revenue)} <span className="text-xs text-gray-400">({pct.toFixed(1)}%)</span>
                    </span>
                  </div>
                  <div className="h-3 w-full rounded-full" style={{ background: "#f3f4f6" }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(pct, 0.5)}%`, background: p.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail Table */}
      <div className="rounded-xl shadow-sm border p-6" style={{ background: CARD_BG, borderColor: "#e5e7eb" }}>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider" style={{ color: GOLD }}>
          Platform Detail
        </h2>
        {loading ? (
          <Skeleton className="h-48" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: "#e5e7eb" }}>
                  <Th>Platform</Th>
                  <Th align="right">Comments</Th>
                  <Th align="right">DMs</Th>
                  <Th align="right">AI Scored</Th>
                  <Th align="right">Booked</Th>
                  <Th align="right">Retained</Th>
                  <Th align="right">CB Rate</Th>
                  <Th align="right">Revenue</Th>
                </tr>
              </thead>
              <tbody>
                {platforms.map((p) => (
                  <tr key={p.platform} className="border-b transition-colors hover:bg-gray-50" style={{ borderColor: "#e5e7eb" }}>
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
                        <span className="font-medium text-gray-900">{p.platform}</span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 text-right text-gray-500">{p.totalComments.toLocaleString()}</td>
                    <td className="py-2.5 pr-4 text-right text-gray-500">{p.dmsStarted.toLocaleString()}</td>
                    <td className="py-2.5 pr-4 text-right text-gray-500">{p.leadsScored.toLocaleString()}</td>
                    <td className="py-2.5 pr-4 text-right text-gray-500">{p.consultationsBooked.toLocaleString()}</td>
                    <td className="py-2.5 pr-4 text-right text-gray-500">{p.retainersSigned.toLocaleString()}</td>
                    <td className="py-2.5 pr-4 text-right font-medium" style={{ color: GOLD }}>{p.commBookRate.toFixed(1)}%</td>
                    <td className="py-2.5 text-right font-semibold" style={{ color: GOLD }}>{fmt$(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: string }) {
  return (
    <th className={`pb-2 pr-4 text-xs font-medium uppercase tracking-wider text-gray-400 ${align === "right" ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}

function thirtyDaysAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().split("T")[0];
}

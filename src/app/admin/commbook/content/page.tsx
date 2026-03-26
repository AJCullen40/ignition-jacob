"use client";

import { useEffect, useState } from "react";

interface TopPost {
  postUrl: string;
  platform: string;
  date: string;
  totalComments: number;
  bookings: number;
  commBookRate: number;
}

const GOLD = "#d4af37";
const GOLD_DIM = "#b8962e";
const NAVY = "#0a1628";
const CARD_BG = "#ffffff";

const PLAT_COLORS: Record<string, string> = {
  Facebook: "#1877F2",
  Instagram: "#E4405F",
  YouTube: "#FF0000",
  TikTok: "#000000",
  Other: "#767676",
};

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-gray-200 ${className}`} style={{ minHeight: 20 }} />;
}

export default function ContentIntelligence() {
  const [posts, setPosts] = useState<TopPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [platFilter, setPlatFilter] = useState("All");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/commbook/overview?start=" + thirtyDaysAgo());
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        setPosts(json.topPosts || []);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = platFilter === "All" ? posts : posts.filter((p) => p.platform === platFilter);
  const uniquePlats = ["All", ...Array.from(new Set(posts.map((p) => p.platform)))];
  const maxComments = Math.max(...filtered.map((p) => p.totalComments), 1);

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
          <h1 className="text-xl font-bold text-gray-900">Content Intelligence</h1>
          <p className="text-xs text-gray-400">Top performing content posts</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      {/* Stats Bar */}
      {!loading && posts.length > 0 && (
        <div className="mb-6 grid grid-cols-3 gap-4">
          <StatCard label="Total Posts Tracked" value={posts.length.toString()} />
          <StatCard label="Total Comments" value={posts.reduce((s, p) => s + p.totalComments, 0).toLocaleString()} />
          <StatCard label="Avg Comments / Post" value={Math.round(posts.reduce((s, p) => s + p.totalComments, 0) / posts.length).toLocaleString()} />
        </div>
      )}

      {/* Content Table */}
      <div className="rounded-xl shadow-sm border p-6" style={{ background: CARD_BG, borderColor: "#e5e7eb" }}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: GOLD }}>
            Top Posts by Engagement
          </h2>
          <select
            value={platFilter}
            onChange={(e) => setPlatFilter(e.target.value)}
            className="cursor-pointer rounded-lg border px-3 py-1.5 text-sm text-gray-900 outline-none"
            style={{ background: "#f3f4f6", borderColor: "#e5e7eb" }}
          >
            {uniquePlats.map((p) => (
              <option key={p} value={p}>{p === "All" ? "All Platforms" : p}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((p, i) => (
              <div
                key={i}
                className="flex items-center gap-4 rounded-lg border p-3 transition-colors hover:bg-gray-50"
                style={{ borderColor: "#e5e7eb" }}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-gray-900" style={{ background: "#f3f4f6" }}>
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <a
                    href={p.postUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-sm font-medium hover:underline"
                    style={{ color: GOLD }}
                  >
                    {p.postUrl.replace(/https?:\/\/(www\.)?/, "").slice(0, 80)}
                  </a>
                  <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full" style={{ background: PLAT_COLORS[p.platform] || "#767676" }} />
                      {p.platform}
                    </span>
                    {p.date && <span>{new Date(p.date).toLocaleDateString()}</span>}
                  </div>
                </div>
                <div className="w-48 shrink-0">
                  <div className="h-2 rounded-full" style={{ background: "#f3f4f6" }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(p.totalComments / maxComments) * 100}%`,
                        background: `linear-gradient(90deg, ${GOLD}, ${GOLD_DIM})`,
                      }}
                    />
                  </div>
                </div>
                <div className="w-20 shrink-0 text-right">
                  <div className="text-sm font-semibold text-gray-900">{p.totalComments.toLocaleString()}</div>
                  <div className="text-[10px] text-gray-400">comments</div>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="py-12 text-center text-gray-400">No posts found</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl shadow-sm border px-5 py-4" style={{ background: CARD_BG, borderColor: "#e5e7eb" }}>
      <div className="text-xs font-medium uppercase tracking-wider" style={{ color: GOLD_DIM }}>{label}</div>
      <div className="mt-1 text-2xl font-bold text-gray-900">{value}</div>
    </div>
  );
}

function thirtyDaysAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().split("T")[0];
}

export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { getScoringLeads } from "@/lib/google-sheets";
import { normalizeSource } from "@/lib/normalize-source";
import { parseDateRange, filterRowsByDate } from "@/lib/date-filter";

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const range = parseDateRange(params);

    const search = (params.get("search") || "").toLowerCase();
    const sourceFilter = params.get("source");
    const scoreFilter = params.get("score");
    const originFilter = params.get("origin");
    const page = Math.max(1, parseInt(params.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(params.get("pageSize") || "25", 10)));

    const rows = await getScoringLeads();
    let filtered = filterRowsByDate(rows, range);

    filtered = filtered.filter((row) => {
      const name = `${row["First Name"] || ""} ${row["Last Name"] || ""}`.toLowerCase();
      if (search && !name.includes(search)) return false;
      if (sourceFilter && normalizeSource(row["Lead Source"] || "") !== sourceFilter) return false;
      if (scoreFilter && (row["Score"] || "") !== scoreFilter) return false;
      if (originFilter && (row["Phone Origin"] || "") !== originFilter) return false;
      return true;
    });

    const total = filtered.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const pageRows = filtered.slice(start, start + pageSize);

    const sources = Array.from(
      new Set(filtered.map((row) => normalizeSource(row["Lead Source"] || "")))
    )
      .filter(Boolean)
      .sort();

    const leads = pageRows.map((row, idx) => ({
      id: row["ID"] || String(start + idx),
      name: `${row["First Name"] || ""} ${row["Last Name"] || ""}`.trim(),
      score: parseInt((row["Score"] || "").match(/^(\d+)/)?.[1] || "0", 10),
      source: normalizeSource(row["Lead Source"] || ""),
      phone: row["phone number"] || "",
      phoneOrigin: row["Phone Origin"] || "",
      stage: "New",
      booked: false,
      retained: false,
      createdAt: row["Date Created"] || "",
      sfId: row["ID"] || "",
    }));

    return NextResponse.json({ leads, sources, total, page, pageSize, totalPages });
  } catch (err) {
    console.error("[leads/explorer]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

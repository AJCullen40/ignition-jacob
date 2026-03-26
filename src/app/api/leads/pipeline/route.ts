export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import {
  getAllOpportunities,
  categorizeStage,
  PIPELINE_DISPLAY_STAGES,
} from "@/lib/ghl";
import { getScoringLeads } from "@/lib/google-sheets";
import { normalizeSource } from "@/lib/normalize-source";
import { parseDateRange, filterRowsByDate } from "@/lib/date-filter";

function isoDate(dt: string): string {
  return (dt || "").slice(0, 10);
}

function displayLabelForCategory(cat: string): string | null {
  for (const { label, categories } of PIPELINE_DISPLAY_STAGES) {
    if (categories.includes(cat)) return label;
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const range = parseDateRange(params);

    const sourceFilter = params.get("source");
    const scoreFilter = params.get("score");
    const originFilter = params.get("origin");

    const [allOpps, scoringRows] = await Promise.all([
      getAllOpportunities(),
      getScoringLeads(),
    ]);

    const ghOpps = range
      ? allOpps.filter((o) => {
          const d = isoDate(o.createdAt);
          return d >= range.from && d <= range.to;
        })
      : allOpps;

    const filtered = filterRowsByDate(scoringRows, range);

    const applicableRows =
      sourceFilter || scoreFilter || originFilter
        ? filtered.filter((row) => {
            if (
              sourceFilter &&
              normalizeSource(row["Lead Source"] || "") !== sourceFilter
            )
              return false;
            if (
              scoreFilter &&
              String(
                parseInt(
                  (row["Score"] || "").match(/^(\d+)/)?.[1] || "0",
                  10,
                ),
              ) !== scoreFilter
            )
              return false;
            if (originFilter && (row["Phone Origin"] || "") !== originFilter)
              return false;
            return true;
          })
        : filtered;

    let contactIdSet: Set<string> | null = null;
    if (sourceFilter || scoreFilter || originFilter) {
      contactIdSet = new Set(
        applicableRows.map((r) => (r["ID"] || "").trim()).filter(Boolean),
      );
    }

    const stageCounts = new Map<string, number>();
    for (const { label } of PIPELINE_DISPLAY_STAGES) stageCounts.set(label, 0);

    for (const opp of ghOpps) {
      if (contactIdSet && !contactIdSet.has(opp.contact.id)) continue;
      const cat = categorizeStage(opp.stageName);
      const label = displayLabelForCategory(cat);
      if (label === null) continue;
      stageCounts.set(label, (stageCounts.get(label) ?? 0) + 1);
    }

    const stages = PIPELINE_DISPLAY_STAGES.map(({ label, color }) => ({
      label,
      count: stageCounts.get(label) ?? 0,
      color,
    }));

    const sourceSet = new Set<string>();
    for (const row of filtered) {
      const src = normalizeSource(row["Lead Source"] || "");
      if (src !== "Other") sourceSet.add(src);
    }
    sourceSet.add("Other");
    const sources = Array.from(sourceSet).sort();

    return NextResponse.json({ stages, sources });
  } catch (err) {
    console.error("[leads/pipeline]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}

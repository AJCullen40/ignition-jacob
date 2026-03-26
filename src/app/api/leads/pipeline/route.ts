export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { querySalesforce } from "@/lib/salesforce";
import { getScoringLeads } from "@/lib/google-sheets";
import { normalizeSource } from "@/lib/normalize-source";
import { parseDateRange, filterRowsByDate } from "@/lib/date-filter";

const PIPELINE_STAGES = [
  "New Leads",
  "Lead Outreach",
  "Lead Qualified",
  "Consultation Booked",
  "Awaiting Retainer",
  "Retained",
];

const STAGE_COLORS: Record<string, string> = {
  "New Leads": "#9ca3af",
  "Lead Outreach": "#3b82f6",
  "Lead Qualified": "#8b5cf6",
  "Consultation Booked": "#f59e0b",
  "Awaiting Retainer": "#22c55e",
  Retained: "#a855f7",
};

const STAGE_ALIASES: Record<string, string> = {
  "Retained/Won": "Retained",
  "Closed Won": "Retained",
};

interface SFOpp {
  StageName: string;
  Id: string;
  CreatedDate: string;
}

function isoDate(dt: string): string {
  return (dt || "").slice(0, 10);
}

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const range = parseDateRange(params);

    const sourceFilter = params.get("source");
    const scoreFilter = params.get("score");
    const originFilter = params.get("origin");

    const [allSfOpps, scoringRows] = await Promise.all([
      querySalesforce<SFOpp>(
        "SELECT StageName, Id, CreatedDate FROM Opportunity",
      ),
      getScoringLeads(),
    ]);

    // Filter SF Opportunities by date in JavaScript (not SOQL)
    const sfOpps = range
      ? allSfOpps.filter((o) => {
          const d = isoDate(o.CreatedDate);
          return d >= range.from && d <= range.to;
        })
      : allSfOpps;

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

    let sfIdSet: Set<string> | null = null;
    if (sourceFilter || scoreFilter || originFilter) {
      sfIdSet = new Set(
        applicableRows.map((r) => r["SF ID"]).filter(Boolean),
      );
    }

    const stageCounts = new Map<string, number>();
    for (const stage of PIPELINE_STAGES) stageCounts.set(stage, 0);

    const sfIdsInPipeline = new Set<string>();
    for (const opp of sfOpps) {
      if (sfIdSet && !sfIdSet.has(opp.Id)) continue;
      const mapped = STAGE_ALIASES[opp.StageName] ?? opp.StageName;
      const current = stageCounts.get(mapped);
      if (current !== undefined) {
        stageCounts.set(mapped, current + 1);
        sfIdsInPipeline.add(opp.Id);
      }
    }

    const stages = PIPELINE_STAGES.map((stage) => ({
      label: stage,
      count: stageCounts.get(stage) ?? 0,
      color: STAGE_COLORS[stage] ?? "#9ca3af",
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

export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import {
  getAllOpportunities,
  categorizeStage,
  PIPELINE_DISPLAY_STAGES,
} from "@/lib/ghl";
import { getScoringLeads } from "@/lib/google-sheets";
import { parseDateRange } from "@/lib/date-filter";
import { normalizeSource } from "@/lib/normalize-source";

function isoDate(dt: string): string {
  return (dt || "").slice(0, 10);
}

/** Strip case-type suffix after dash for name matching (e.g. "Kumar Phagoo - H1B LP"). */
function nameBaseForMatch(name: string): string {
  const base = (name || "").split(/\s*[-–]\s*/)[0]?.trim().toLowerCase() ?? "";
  return base;
}

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const stage = params.get("stage");
    if (!stage) {
      return NextResponse.json(
        { error: "stage parameter required" },
        { status: 400 },
      );
    }

    const stageConfig = PIPELINE_DISPLAY_STAGES.find((s) => s.label === stage);
    if (!stageConfig) {
      return NextResponse.json(
        { error: `Unknown stage: ${stage}` },
        { status: 400 },
      );
    }

    const allowedCategories = new Set(stageConfig.categories);

    const range = parseDateRange(params);

    const [allOpps, scoringRows] = await Promise.all([
      getAllOpportunities(),
      getScoringLeads(),
    ]);

    const opps = range
      ? allOpps.filter((o) => {
          const d = isoDate(o.createdAt);
          return d >= range.from && d <= range.to;
        })
      : allOpps;

    const stageOpps = opps.filter((o) =>
      allowedCategories.has(categorizeStage(o.stageName)),
    );

    const idToRow = new Map<string, Record<string, string>>();
    for (const row of scoringRows) {
      const id = (row["ID"] || "").trim();
      if (id) idToRow.set(id, row);
    }

    const nameToRow = new Map<string, Record<string, string>>();
    for (const row of scoringRows) {
      const name =
        `${(row["First Name"] || "").trim()} ${(row["Last Name"] || "").trim()}`
          .trim()
          .toLowerCase();
      if (name && name.length > 2) nameToRow.set(name, row);
    }

    const phoneToRow = new Map<string, Record<string, string>>();
    for (const row of scoringRows) {
      const phone = (row["phone number"] || row["Phone"] || "")
        .replace(/\D/g, "")
        .slice(-10);
      if (phone.length >= 7) phoneToRow.set(phone, row);
    }

    const leads = stageOpps.map((opp) => {
      let row = idToRow.get(opp.contact.id);

      if (!row) {
        const base = nameBaseForMatch(opp.name || "");
        if (base.length > 2) row = nameToRow.get(base);
      }

      if (!row) {
        const phone = (opp.contact.phone || "")
          .replace(/\D/g, "")
          .slice(-10);
        if (phone.length >= 7) row = phoneToRow.get(phone);
      }

      const score = row
        ? parseInt((row["Score"] || "").match(/^(\d+)/)?.[1] || "0", 10)
        : null;

      const conversation = row
        ? (
            row["Conversation History"] ||
            row["Conversation History "] ||
            ""
          ).trim()
        : "";

      return {
        sfId: opp.id,
        name: opp.name || "—",
        stage: categorizeStage(opp.stageName),
        source: normalizeSource(opp.source || ""),
        sfSource: opp.source || "—",
        date: isoDate(opp.createdAt),
        amount: opp.monetaryValue ?? 0,
        score,
        conversation,
        phone: row ? (row["phone number"] || row["Phone"] || "").trim() : "",
        phoneOrigin: row ? (row["Phone Origin"] || "").trim() : "",
        matched: !!row,
      };
    });

    leads.sort((a, b) => {
      if (b.score !== a.score) return (b.score ?? 0) - (a.score ?? 0);
      return b.date.localeCompare(a.date);
    });

    const matchedCount = leads.filter((l) => l.matched).length;

    return NextResponse.json({
      stage,
      total: leads.length,
      matched: matchedCount,
      unmatched: leads.length - matchedCount,
      leads: leads.slice(0, 100),
    });
  } catch (err) {
    console.error("[pipeline/drilldown]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    );
  }
}

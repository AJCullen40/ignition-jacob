export const dynamic = "force-dynamic";
export const maxDuration = 30;

import { NextRequest, NextResponse } from "next/server";
import { querySalesforce } from "@/lib/salesforce";
import { getScoringLeads } from "@/lib/google-sheets";
import { parseDateRange } from "@/lib/date-filter";
import { normalizeSource } from "@/lib/normalize-source";

const STAGE_ALIASES: Record<string, string> = {
  "Retained/Won": "Retained",
  "Closed Won": "Retained",
};

interface SFOpp {
  Id: string;
  StageName: string;
  Name: string;
  LeadSource: string | null;
  CreatedDate: string;
  Amount: number | null;
}

function isoDate(dt: string): string {
  return (dt || "").slice(0, 10);
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

    const range = parseDateRange(params);

    const [allOpps, scoringRows] = await Promise.all([
      querySalesforce<SFOpp>(
        "SELECT Id, StageName, Name, LeadSource, CreatedDate, Amount FROM Opportunity",
      ),
      getScoringLeads(),
    ]);

    const opps = range
      ? allOpps.filter((o) => {
          const d = isoDate(o.CreatedDate);
          return d >= range.from && d <= range.to;
        })
      : allOpps;

    // Resolve stage aliases for matching
    const targetStages: string[] = [];
    if (stage === "Retained") {
      targetStages.push("Retained", "Retained/Won", "Closed Won");
    } else {
      targetStages.push(stage);
      for (const [alias, mapped] of Object.entries(STAGE_ALIASES)) {
        if (mapped === stage) targetStages.push(alias);
      }
    }

    const stageOpps = opps.filter((o) => targetStages.includes(o.StageName));

    // Build SF ID → scoring sheet row lookup
    const sfIdToRow = new Map<string, Record<string, string>>();
    for (const row of scoringRows) {
      const sfId = (row["SF ID"] || "").trim();
      if (sfId) sfIdToRow.set(sfId, row);
    }

    // Build name-based matching (first+last → row)
    const nameToRow = new Map<string, Record<string, string>>();
    for (const row of scoringRows) {
      const name =
        `${(row["First Name"] || "").trim()} ${(row["Last Name"] || "").trim()}`
          .trim()
          .toLowerCase();
      if (name && name.length > 2) nameToRow.set(name, row);
    }

    // Build phone-based matching
    const phoneToRow = new Map<string, Record<string, string>>();
    for (const row of scoringRows) {
      const phone = (row["phone number"] || row["Phone"] || "")
        .replace(/\D/g, "")
        .slice(-10);
      if (phone.length >= 7) phoneToRow.set(phone, row);
    }

    function cleanOppName(name: string): string {
      return name
        .replace(/\s*[-–]\s*(IMM|PI|Retainer|Immigration|imm|pi|ESTATE|Estate|WC|DISSOLUTION|Disso|Corp|CORP|Criminal|CRIM|Div|DIV).*$/i, "")
        .replace(/\s*[-–]\s*$/, "")
        .trim()
        .toLowerCase();
    }

    const leads = stageOpps.map((opp) => {
      let row = sfIdToRow.get(opp.Id);

      if (!row) {
        const cleaned = cleanOppName(opp.Name || "");
        if (cleaned.length > 2) row = nameToRow.get(cleaned);
      }

      if (!row) {
        const parts = (opp.Name || "").split(/\s*[-–]\s*/);
        if (parts.length > 0) {
          const justName = parts[0].trim().toLowerCase();
          if (justName.length > 2) row = nameToRow.get(justName);
        }
      }

      const score = row
        ? parseInt((row["Score"] || "").match(/^(\d+)/)?.[1] || "0", 10)
        : null;

      const conversation = row
        ? (row["Conversation History"] || row["Conversation History "] || "").trim()
        : "";

      return {
        sfId: opp.Id,
        name: opp.Name || "—",
        stage: STAGE_ALIASES[opp.StageName] ?? opp.StageName,
        source: normalizeSource(opp.LeadSource || ""),
        sfSource: opp.LeadSource || "—",
        date: isoDate(opp.CreatedDate),
        amount: opp.Amount ?? 0,
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

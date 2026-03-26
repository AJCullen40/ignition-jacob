import { NextRequest, NextResponse } from "next/server";
import { getScoringLeads } from "@/lib/google-sheets";
import { querySalesforce } from "@/lib/salesforce";
import { parseDateRange, filterRowsByDate } from "@/lib/date-filter";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const BOOKING_STAGES = [
  "Consultation Booked",
  "Awaiting Retainer",
  "Retained/Won",
  "Closed Won",
];
const RETAINED_STAGES = ["Retained/Won", "Closed Won"];

interface SFLead {
  Id: string;
  IsConverted: boolean;
  ConvertedAccountId: string | null;
}

interface SFOpp {
  Id: string;
  StageName: string;
  Amount: number | null;
  AccountId: string;
}

export async function GET(req: NextRequest) {
  try {
    const range = parseDateRange(req.nextUrl.searchParams);

    const [allScoringRaw, sfLeads, sfOpps] = await Promise.all([
      getScoringLeads(),
      querySalesforce<SFLead>(
        "SELECT Id, IsConverted, ConvertedAccountId FROM Lead"
      ),
      querySalesforce<SFOpp>(
        "SELECT Id, StageName, Amount, AccountId FROM Opportunity"
      ),
    ]);

    const allScoring = filterRowsByDate(allScoringRaw, range);

    const lead2acct = new Map<string, string>();
    for (const l of sfLeads) {
      if (l.IsConverted && l.ConvertedAccountId) {
        lead2acct.set(l.Id, l.ConvertedAccountId);
      }
    }

    const oppsByAcct = new Map<string, SFOpp[]>();
    for (const o of sfOpps) {
      if (!oppsByAcct.has(o.AccountId)) oppsByAcct.set(o.AccountId, []);
      oppsByAcct.get(o.AccountId)!.push(o);
    }

    function getOppsForLead(sfId: string): SFOpp[] {
      if (!sfId) return [];
      const acctId = lead2acct.get(sfId);
      if (!acctId) return [];
      return oppsByAcct.get(acctId) || [];
    }

    function hasBookingOpp(opps: SFOpp[]): boolean {
      return opps.some((o) => BOOKING_STAGES.includes(o.StageName));
    }

    const hotLeadsRows = allScoring.filter((r) => {
      const score = parseInt(
        (r["Score"] || "").split("|")[0].trim(),
        10
      );
      return score >= 4;
    });

    const score5Rows = allScoring.filter((r) => {
      const score = parseInt(
        (r["Score"] || "").split("|")[0].trim(),
        10
      );
      return score === 5;
    });

    const totalOpportunities = hotLeadsRows.length;
    const hotLeads = hotLeadsRows.length;
    const score5Agreed = score5Rows.length;

    const neverBookedRows = hotLeadsRows.filter((r) => {
      const sfId = (r["SF ID"] || "").trim();
      const opps = getOppsForLead(sfId);
      return !hasBookingOpp(opps);
    });

    const neverBooked = neverBookedRows.length;

    const neverCalledRows = neverBookedRows.filter((r) => {
      const sfId = (r["SF ID"] || "").trim();
      const opps = getOppsForLead(sfId);
      return opps.length === 0;
    });

    const neverCalled = neverCalledRows.length;
    const calledNotBooked = neverBooked - neverCalled;

    const retainedOpps = sfOpps.filter(
      (o) => RETAINED_STAGES.includes(o.StageName) && o.Amount && o.Amount > 0
    );
    const avgRetainerValue =
      retainedOpps.length > 0
        ? retainedOpps.reduce((s, o) => s + (o.Amount || 0), 0) /
          retainedOpps.length
        : 5000;
    const estimatedRecoverableRevenue = Math.round(
      neverBooked * avgRetainerValue
    );

    const convertedRows = allScoring.filter((r) => {
      const score = parseInt(
        (r["Score"] || "").split("|")[0].trim(),
        10
      );
      if (score < 4) return false;
      const sfId = (r["SF ID"] || "").trim();
      const opps = getOppsForLead(sfId);
      return opps.some((o) => RETAINED_STAGES.includes(o.StageName));
    });

    const convertedScores = convertedRows.map((r) =>
      parseInt((r["Score"] || "").split("|")[0].trim(), 10)
    );
    const avgConvertedScore =
      convertedScores.length > 0
        ? convertedScores.reduce((a, b) => a + b, 0) / convertedScores.length
        : 0;

    const convertedDmCounts = convertedRows.map((r) => {
      const dm = (r["DM Count"] || r["DM Messages"] || "0").trim();
      return parseInt(dm, 10) || 0;
    });
    const avgDmMessages =
      convertedDmCounts.length > 0
        ? convertedDmCounts.reduce((a, b) => a + b, 0) /
          convertedDmCounts.length
        : 0;

    const feeAgreedCount = convertedRows.filter((r) => {
      const score = parseInt(
        (r["Score"] || "").split("|")[0].trim(),
        10
      );
      return score === 5;
    }).length;
    const feeAgreementRate =
      convertedRows.length > 0
        ? (feeAgreedCount / convertedRows.length) * 100
        : 0;

    const convertedProfile = {
      avgScore: Math.round(avgConvertedScore * 10) / 10,
      avgDmMessages: Math.round(avgDmMessages * 10) / 10,
      feeAgreementRate: Math.round(feeAgreementRate * 10) / 10,
      totalConverted: convertedRows.length,
    };

    let highMatch = 0;
    let mediumMatch = 0;
    let lowMatch = 0;

    for (const r of neverBookedRows) {
      let matchScore = 0;
      const score = parseInt(
        (r["Score"] || "").split("|")[0].trim(),
        10
      );
      if (score >= convertedProfile.avgScore) matchScore += 40;
      else if (score >= convertedProfile.avgScore - 0.5) matchScore += 20;

      const dmCount =
        parseInt(
          (r["DM Count"] || r["DM Messages"] || "0").trim(),
          10
        ) || 0;
      if (dmCount >= convertedProfile.avgDmMessages) matchScore += 35;
      else if (dmCount >= convertedProfile.avgDmMessages * 0.5) matchScore += 15;

      if (score === 5) matchScore += 25;

      if (matchScore >= 65) highMatch++;
      else if (matchScore >= 35) mediumMatch++;
      else lowMatch++;
    }

    const recoveryMatchResults = {
      highMatch,
      mediumMatch,
      lowMatch,
    };

    return NextResponse.json({
      totalOpportunities,
      hotLeads,
      score5Agreed,
      neverBooked,
      estimatedRecoverableRevenue,
      neverCalled,
      calledNotBooked,
      convertedProfile,
      recoveryMatchResults,
      avgRetainerValue: Math.round(avgRetainerValue),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[Recovery Radar API]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

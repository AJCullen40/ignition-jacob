import { NextRequest, NextResponse } from "next/server";
import { getScoringLeads } from "@/lib/google-sheets";
import {
  getAllOpportunities,
  categorizeStage,
  isRetained,
  isBookingPlus,
  type GHLOpportunity,
} from "@/lib/ghl";
import { parseDateRange, filterRowsByDate } from "@/lib/date-filter";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function scoringContactId(row: Record<string, string>): string {
  return (row["ID"] || row["SF ID"] || "").trim();
}

export async function GET(req: NextRequest) {
  try {
    const range = parseDateRange(req.nextUrl.searchParams);

    const [allScoringRaw, allOpps] = await Promise.all([
      getScoringLeads(),
      getAllOpportunities(),
    ]);

    const allScoring = filterRowsByDate(allScoringRaw, range);

    const oppsByContact = new Map<string, GHLOpportunity[]>();
    for (const o of allOpps) {
      const cid = o.contact?.id;
      if (!cid) continue;
      if (!oppsByContact.has(cid)) oppsByContact.set(cid, []);
      oppsByContact.get(cid)!.push(o);
    }

    function getOppsForLead(contactId: string): GHLOpportunity[] {
      if (!contactId) return [];
      return oppsByContact.get(contactId) ?? [];
    }

    function hasBookingOpp(opps: GHLOpportunity[]): boolean {
      return opps.some((o) => isBookingPlus(categorizeStage(o.stageName)));
    }

    const hotLeadsRows = allScoring.filter((r) => {
      const score = parseInt(
        (r["Score"] || "").split("|")[0].trim(),
        10,
      );
      return score >= 4;
    });

    const score5Rows = allScoring.filter((r) => {
      const score = parseInt(
        (r["Score"] || "").split("|")[0].trim(),
        10,
      );
      return score === 5;
    });

    const totalOpportunities = hotLeadsRows.length;
    const hotLeads = hotLeadsRows.length;
    const score5Agreed = score5Rows.length;

    const neverBookedRows = hotLeadsRows.filter((r) => {
      const contactId = scoringContactId(r);
      const opps = getOppsForLead(contactId);
      return !hasBookingOpp(opps);
    });

    const neverBooked = neverBookedRows.length;

    const neverCalledRows = neverBookedRows.filter((r) => {
      const contactId = scoringContactId(r);
      const opps = getOppsForLead(contactId);
      return opps.length === 0;
    });

    const neverCalled = neverCalledRows.length;
    const calledNotBooked = neverBooked - neverCalled;

    const retainedOpps = allOpps.filter((o) => {
      const cat = categorizeStage(o.stageName);
      return isRetained(cat) && o.monetaryValue && o.monetaryValue > 0;
    });
    const avgRetainerValue =
      retainedOpps.length > 0
        ? retainedOpps.reduce((s, o) => s + (o.monetaryValue || 0), 0) /
          retainedOpps.length
        : 5000;
    const estimatedRecoverableRevenue = Math.round(
      neverBooked * avgRetainerValue,
    );

    const convertedRows = allScoring.filter((r) => {
      const score = parseInt(
        (r["Score"] || "").split("|")[0].trim(),
        10,
      );
      if (score < 4) return false;
      const contactId = scoringContactId(r);
      const opps = getOppsForLead(contactId);
      return opps.some((o) => isRetained(categorizeStage(o.stageName)));
    });

    const convertedScores = convertedRows.map((r) =>
      parseInt((r["Score"] || "").split("|")[0].trim(), 10),
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
        10,
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
        10,
      );
      if (score >= convertedProfile.avgScore) matchScore += 40;
      else if (score >= convertedProfile.avgScore - 0.5) matchScore += 20;

      const dmCount =
        parseInt(
          (r["DM Count"] || r["DM Messages"] || "0").trim(),
          10,
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

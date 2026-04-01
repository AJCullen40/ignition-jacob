/**
 * Closers call scoring — mirrors setter sheet shape; Melina’s closing script replaces PLACEHOLDER_CLOSER_SCRIPT.
 */

export const CLOSER_NAMES = ["Eric", "Selena", "Julio", "Karima"] as const;

/** Tab headers for new "Closers Scoring" worksheet (create tab manually or via Sheets API). */
export const CLOSERS_SCORING_HEADERS = [
  "Call ID",
  "Date",
  "Closer",
  "Contact ID",
  "Contact Name",
  "Phone",
  "Source: GHL / RingCentral",
  "Needs detection (1-5)",
  "Urgency qualification (1-5)",
  "Affordability confirmation (1-5)",
  "Agreement sent Y/N",
  "Objection handling (1-5)",
  "AI composite score",
  "AI summary",
  "Transcript ref",
] as const;

export const PLACEHOLDER_CLOSER_SCRIPT = `CLOSING SCRIPT (PLACEHOLDER — replace when Melina provides the final version)

You are scoring immigration closing calls for h1b.biz. Evaluate the closer on:
(a) Needs detection — did they surface visa goals, timeline, and blockers?
(b) Urgency qualification — deadlines, work authorization risk, family impact.
(c) Affordability confirmation — budget, payment plan, willingness to invest.
(d) Agreement sent — explicit yes/no whether retainer/agreement was sent on the call.
(e) Objection handling — price, timing, spouse, other firms.

Output strict JSON: { "needs":1-5, "urgency":1-5, "affordability":1-5, "agreement_sent":"Y"|"N", "objections":1-5, "composite":1-5, "summary":"one paragraph" }`;

export function closersTemplateCsv(): string {
  const rows = [
    [...CLOSERS_SCORING_HEADERS].join(","),
    // Example row
    [
      "CALL-001",
      new Date().toISOString().slice(0, 10),
      "Eric",
      "ghl-contact-id",
      "Jane Doe",
      "+15551234567",
      "GHL",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ]
      .map((c) => (typeof c === "string" && c.includes(",") ? `"${c.replace(/"/g, '""')}"` : c))
      .join(","),
  ];
  return rows.join("\n");
}

export type CloserLeaderboardRow = {
  closer: string;
  callsMade: number;
  agreementsSent: number;
  agreementsSigned: number;
  casesClosed: number;
  aiScoreAvg: number | null;
};

/** Shell leaderboard until closers sheet + GHL stages are wired. */
export function closersLeaderboardPlaceholder(): CloserLeaderboardRow[] {
  return CLOSER_NAMES.map((name) => ({
    closer: name,
    callsMade: 0,
    agreementsSent: 0,
    agreementsSigned: 0,
    casesClosed: 0,
    aiScoreAvg: null,
  }));
}

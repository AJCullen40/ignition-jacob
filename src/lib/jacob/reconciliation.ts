import type { GHLOpportunity } from "@/lib/ghl";
import type { CallLogFetchInfo } from "@/lib/jacob/call-log";
import {
  getOpportunitySourceAgentMap,
  resolveAssignedAgentFromOpportunitySource,
} from "@/lib/jacob/opportunity-source-agents";
import {
  categorizeStage,
  getAssignedAgentName,
  isBookingPlus,
  isWarmOrHotPipelineStage,
} from "@/lib/ghl";

const MS_7D = 7 * 24 * 60 * 60 * 1000;

export interface ReconciliationDetailRow {
  contactId: string;
  contactName: string;
  assignedAgent: string;
  leadSourceChannel: string;
  stageName: string;
  scoreBucket: "Warm" | "Hot";
  callsLast7Days: number;
  lastCallAt: string | null;
  calledRecently: boolean;
  /** Transition flag: calls ingested from GHL vs RingCentral export */
  sourceSystem: "GHL" | "RingCentral";
  consultationBooked: boolean;
}

export interface AgentSummaryRow {
  agent: string;
  assignedLeads: number;
  called: number;
  notCalled: number;
  coveragePct: number;
}

export interface ChannelPerformanceRow {
  source: string;
  leadsAssigned: number;
  callsMade: number;
  consultationsBooked: number;
  conversionPct: number;
}

function normHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function findCell(row: Record<string, string>, patterns: string[]): string {
  const entries = Object.entries(row);
  const normMap = new Map(entries.map(([k, v]) => [normHeader(k), v.trim()]));
  for (const p of patterns) {
    const n = normHeader(p);
    const hit = entries.find(([k]) => normHeader(k) === n);
    if (hit?.[1]?.trim()) return hit[1].trim();
  }
  for (const p of patterns) {
    const sub = normHeader(p);
    const hit = entries.find(([k]) => normHeader(k).includes(sub));
    if (hit?.[1]?.trim()) return hit[1].trim();
  }
  return "";
}

function parseRowDate(raw: string): number | null {
  if (!raw) return null;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : null;
}

function isOutboundDirection(
  row: Record<string, string>,
  assumeIfBlank: boolean,
): boolean {
  const dir = findCell(row, [
    "Direction",
    "Call Direction",
    "Type",
    "Call Type",
    "Inbound/Outbound",
  ]);
  if (!dir) return assumeIfBlank;
  const d = dir.toLowerCase();
  if (d.includes("inbound") || d.includes("in bound")) return false;
  return (
    d.includes("outbound") ||
    d.includes("out bound") ||
    /^out\b/.test(d)
  );
}

function normPhone10(raw: string | null | undefined): string {
  if (!raw) return "";
  const d = raw.replace(/\D/g, "");
  if (d.length >= 11 && d[0] === "1") return d.slice(-10);
  if (d.length >= 10) return d.slice(-10);
  return "";
}

function callLogSourceSystem(row: Record<string, string>): "GHL" | "RingCentral" {
  const src = findCell(row, ["Source", "Source System", "Platform", "Dialer"]);
  const s = src.toLowerCase();
  if (s.includes("ringcentral") || s.includes("ring central") || s.includes("rc ")) {
    return "RingCentral";
  }
  return "GHL";
}

export interface CallStats {
  outbound7d: number;
  lastAt: number | null;
  lastSource: "GHL" | "RingCentral";
}

function mergeStats(a: CallStats, b: CallStats): CallStats {
  const lastA = a.lastAt ?? 0;
  const lastB = b.lastAt ?? 0;
  const m = Math.max(lastA, lastB);
  return {
    outbound7d: a.outbound7d + b.outbound7d,
    lastAt: m > 0 ? m : null,
    lastSource: lastA >= lastB ? a.lastSource : b.lastSource,
  };
}

export interface CallLogIndexMeta {
  totalRows: number;
  rowsCountedIn7dWindow: number;
  assumeOutboundWhenDirectionBlank: boolean;
}

export interface CallLogIndexResult {
  byContactId: Map<string, CallStats>;
  byPhone: Map<string, CallStats>;
  meta: CallLogIndexMeta;
}

/**
 * Indexes outbound calls in the last 7 days by GHL contact id and by phone (last 10 digits).
 * Set JACOB_CALL_LOG_ASSUME_OUTBOUND=false to require an explicit outbound direction column.
 */
export function indexCallLog(
  callRows: Record<string, string>[],
  nowMs: number = Date.now(),
): CallLogIndexResult {
  const assumeBlank =
    process.env.JACOB_CALL_LOG_ASSUME_OUTBOUND?.trim().toLowerCase() !==
    "false";

  const byContactId = new Map<string, CallStats>();
  const byPhone = new Map<string, CallStats>();
  const cutoff = nowMs - MS_7D;
  let rowsCountedIn7dWindow = 0;

  const bump = (map: Map<string, CallStats>, key: string, ts: number, src: "GHL" | "RingCentral") => {
    rowsCountedIn7dWindow += 1;
    const cur = map.get(key) ?? {
      outbound7d: 0,
      lastAt: null as number | null,
      lastSource: "GHL" as const,
    };
    cur.outbound7d += 1;
    if (cur.lastAt == null || ts > cur.lastAt) {
      cur.lastAt = ts;
      cur.lastSource = src;
    }
    map.set(key, cur);
  };

  for (const row of callRows) {
    if (!isOutboundDirection(row, assumeBlank)) continue;

    const dateRaw = findCell(row, [
      "Call Date",
      "Date",
      "Started At",
      "Timestamp",
      "Call Time",
      "Date/Time",
    ]);
    const ts = parseRowDate(dateRaw);
    if (ts == null || ts < cutoff || ts > nowMs + 60_000) continue;

    const src = callLogSourceSystem(row);
    const contactId = findCell(row, [
      "GHL Contact ID",
      "Contact ID",
      "Contact Id",
      "GHL ID",
      "Lead ID",
    ]);
    const phoneRaw = findCell(row, [
      "Phone",
      "Phone Number",
      "To",
      "To Number",
      "Dialed",
      "Caller ID",
    ]);
    const phone = normPhone10(phoneRaw);

    if (contactId.length >= 5) {
      bump(byContactId, contactId, ts, src);
    } else if (phone.length === 10) {
      bump(byPhone, phone, ts, src);
    }
  }

  return {
    byContactId,
    byPhone,
    meta: {
      totalRows: callRows.length,
      rowsCountedIn7dWindow,
      assumeOutboundWhenDirectionBlank: assumeBlank,
    },
  };
}

function statsForOpportunity(
  contactId: string,
  contactPhone: string | null | undefined,
  idx: CallLogIndexResult,
): CallStats | undefined {
  const a =
    contactId.length >= 5 ? idx.byContactId.get(contactId) : undefined;
  const p = normPhone10(contactPhone ?? "");
  const b = p.length === 10 ? idx.byPhone.get(p) : undefined;
  if (a && b) return mergeStats(a, b);
  return a ?? b;
}

function scoreBucketFromStage(stageName: string): "Warm" | "Hot" {
  const s = stageName.toLowerCase();
  if (s.includes("hot") || s.includes("🔥")) return "Hot";
  return "Warm";
}

/** Map GHL contact id → lead source label from AI scoring sheet */
export function scoringRowsToLeadSourceByContactId(
  rows: Record<string, string>[],
): Map<string, string> {
  const m = new Map<string, string>();
  for (const r of rows) {
    const id = (r["ID"] || r["id"] || "").trim();
    if (!id) continue;
    const src = (r["Lead Source"] || r["Lead source"] || "").trim() || "Unknown";
    m.set(id, src);
  }
  return m;
}

export function buildChannelBreakdownFromDetails(
  details: ReconciliationDetailRow[],
): ChannelPerformanceRow[] {
  const byChannel = new Map<
    string,
    { assigned: number; calls: number; booked: number }
  >();
  for (const d of details) {
    const c = byChannel.get(d.leadSourceChannel) ?? {
      assigned: 0,
      calls: 0,
      booked: 0,
    };
    c.assigned += 1;
    c.calls += d.callsLast7Days;
    if (d.consultationBooked) c.booked += 1;
    byChannel.set(d.leadSourceChannel, c);
  }
  return Array.from(byChannel.entries())
    .map(([source, v]) => ({
      source,
      leadsAssigned: v.assigned,
      callsMade: v.calls,
      consultationsBooked: v.booked,
      conversionPct:
        v.assigned > 0
          ? Math.round((v.booked / v.assigned) * 1000) / 10
          : 0,
    }))
    .sort((a, b) => b.leadsAssigned - a.leadsAssigned);
}

export function buildAgentSummaryFromDetails(
  details: ReconciliationDetailRow[],
): AgentSummaryRow[] {
  const byAgent = new Map<
    string,
    { assigned: number; called: number; notCalled: number }
  >();
  for (const d of details) {
    const e = byAgent.get(d.assignedAgent) ?? {
      assigned: 0,
      called: 0,
      notCalled: 0,
    };
    e.assigned += 1;
    if (d.calledRecently) e.called += 1;
    else e.notCalled += 1;
    byAgent.set(d.assignedAgent, e);
  }
  return Array.from(byAgent.entries())
    .map(([agent, v]) => ({
      agent,
      assignedLeads: v.assigned,
      called: v.called,
      notCalled: v.notCalled,
      coveragePct:
        v.assigned > 0 ? Math.round((v.called / v.assigned) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.notCalled - a.notCalled || b.assignedLeads - a.assignedLeads);
}

export function buildReconciliationReport(
  opps: GHLOpportunity[],
  callRows: Record<string, string>[],
  scoringRows: Record<string, string>[],
  nowMs: number = Date.now(),
  callLogInfo: CallLogFetchInfo,
): {
  generatedAt: string;
  summary: AgentSummaryRow[];
  details: ReconciliationDetailRow[];
  channelBreakdown: ChannelPerformanceRow[];
  callLog: {
    source: "google_sheet";
    sheetId: string | null;
    gid: string;
    configured: boolean;
    rowsInTab: number;
    rowsMatchedLast7d: number;
    assumeOutboundWhenDirectionBlank: boolean;
    note: string;
  };
  assignment: {
    mode: "opportunity_source_map" | "ghl_opportunity_fields";
    sourceMapEntries: number;
  };
} {
  const callIdx = indexCallLog(callRows, nowMs);
  const leadSourceById = scoringRowsToLeadSourceByContactId(scoringRows);
  const sourceAgentMap = getOpportunitySourceAgentMap();

  const warmHot = opps.filter((o) => isWarmOrHotPipelineStage(o.stageName));

  let note =
    "Call counts come from the Google Sheet call log (not GHL’s reporting API).";
  if (!callLogInfo.configured) {
    note =
      "Set JACOB_CALL_LOG_SHEET_ID (and JACOB_CALL_LOG_GID if not tab 0) to your published dialer/call export tab.";
  } else if (callRows.length === 0) {
    note =
      "Call log tab returned 0 rows — check gid, publish settings, and that the tab is not empty.";
  } else if (callIdx.meta.rowsCountedIn7dWindow === 0) {
    note =
      "No calls matched the last-7-day window. Check date column parsing, Direction (or set JACOB_CALL_LOG_ASSUME_OUTBOUND=false only if the sheet marks outbound explicitly), and that Contact ID or Phone matches GHL.";
  }

  const details: ReconciliationDetailRow[] = warmHot.map((opp) => {
    const contactId = opp.contact?.id || "";
    const name = (opp.contact?.name || opp.name || "").trim() || "—";
    const channel =
      leadSourceById.get(contactId) ||
      (opp.source || "").trim() ||
      "Unknown";
    const agent = resolveAssignedAgentFromOpportunitySource(
      opp.source || "",
      channel,
      sourceAgentMap,
      getAssignedAgentName(opp),
    );
    const stats = statsForOpportunity(
      contactId,
      opp.contact?.phone,
      callIdx,
    );
    const calls = stats?.outbound7d ?? 0;
    const lastTs = stats?.lastAt ?? null;
    const cat = categorizeStage(opp.stageName);

    return {
      contactId,
      contactName: name,
      assignedAgent: agent,
      leadSourceChannel: channel,
      stageName: opp.stageName,
      scoreBucket: scoreBucketFromStage(opp.stageName),
      callsLast7Days: calls,
      lastCallAt: lastTs ? new Date(lastTs).toISOString() : null,
      calledRecently: calls > 0,
      sourceSystem: stats?.lastSource ?? "GHL",
      consultationBooked: isBookingPlus(cat),
    };
  });

  const byAgent = new Map<
    string,
    { assigned: number; called: number; notCalled: number }
  >();
  for (const d of details) {
    const e = byAgent.get(d.assignedAgent) ?? {
      assigned: 0,
      called: 0,
      notCalled: 0,
    };
    e.assigned += 1;
    if (d.calledRecently) e.called += 1;
    else e.notCalled += 1;
    byAgent.set(d.assignedAgent, e);
  }

  const summary: AgentSummaryRow[] = Array.from(byAgent.entries())
    .map(([agent, v]) => ({
      agent,
      assignedLeads: v.assigned,
      called: v.called,
      notCalled: v.notCalled,
      coveragePct:
        v.assigned > 0 ? Math.round((v.called / v.assigned) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.notCalled - a.notCalled || b.assignedLeads - a.assignedLeads);

  const byChannel = new Map<
    string,
    { assigned: number; calls: number; booked: number }
  >();
  for (const d of details) {
    const c = byChannel.get(d.leadSourceChannel) ?? {
      assigned: 0,
      calls: 0,
      booked: 0,
    };
    c.assigned += 1;
    c.calls += d.callsLast7Days;
    if (d.consultationBooked) c.booked += 1;
    byChannel.set(d.leadSourceChannel, c);
  }

  const channelBreakdown: ChannelPerformanceRow[] = Array.from(
    byChannel.entries(),
  )
    .map(([source, v]) => ({
      source,
      leadsAssigned: v.assigned,
      callsMade: v.calls,
      consultationsBooked: v.booked,
      conversionPct:
        v.assigned > 0
          ? Math.round((v.booked / v.assigned) * 1000) / 10
          : 0,
    }))
    .sort((a, b) => b.leadsAssigned - a.leadsAssigned);

  return {
    generatedAt: new Date(nowMs).toISOString(),
    summary,
    details,
    channelBreakdown,
    callLog: {
      source: "google_sheet",
      sheetId: callLogInfo.sheetId,
      gid: callLogInfo.gid,
      configured: callLogInfo.configured,
      rowsInTab: callRows.length,
      rowsMatchedLast7d: callIdx.meta.rowsCountedIn7dWindow,
      assumeOutboundWhenDirectionBlank:
        callIdx.meta.assumeOutboundWhenDirectionBlank,
      note,
    },
    assignment: {
      mode:
        sourceAgentMap.size > 0
          ? "opportunity_source_map"
          : "ghl_opportunity_fields",
      sourceMapEntries: sourceAgentMap.size,
    },
  };
}

/** Build A1 grid for Google Sheets tab (summary + blank + detail + channel section). */
function csvEscape(cell: string): string {
  if (/[",\n\r]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`;
  return cell;
}

export function reconciliationDetailsToCsv(
  details: ReconciliationDetailRow[],
): string {
  const headers = [
    "Contact ID",
    "Name",
    "Assigned Agent",
    "Lead Source Channel",
    "GHL Stage",
    "Bucket",
    "Calls 7d outbound",
    "Last call UTC",
    "Called",
    "Source GHL/RC",
    "Consult booked",
  ];
  const lines = [
    headers.join(","),
    ...details.map((d) =>
      [
        d.contactId,
        d.contactName,
        d.assignedAgent,
        d.leadSourceChannel,
        d.stageName,
        d.scoreBucket,
        String(d.callsLast7Days),
        d.lastCallAt ?? "",
        d.calledRecently ? "Yes" : "No",
        d.sourceSystem,
        d.consultationBooked ? "Yes" : "No",
      ]
        .map(csvEscape)
        .join(","),
    ),
  ];
  return lines.join("\n");
}

export function reconciliationToSheetValues(
  report: ReturnType<typeof buildReconciliationReport>,
): (string | number)[][] {
  const lines: (string | number)[][] = [
    ["Assigned vs Called — Daily reconciliation (Warm/Hot)"],
    [`Generated (UTC): ${report.generatedAt}`],
    [],
    ["Agent", "Assigned Leads", "Called", "Not Called", "% Coverage"],
    ...report.summary.map((s) => [
      s.agent,
      s.assignedLeads,
      s.called,
      s.notCalled,
      s.coveragePct,
    ]),
    [],
    [
      "Contact ID",
      "Name",
      "Assigned Agent",
      "Lead Source Channel",
      "GHL Stage",
      "Bucket",
      "Calls (7d outbound)",
      "Last call (UTC)",
      "Called?",
      "Source GHL/RC",
      "Consult booked",
    ],
    ...report.details.map((d) => [
      d.contactId,
      d.contactName,
      d.assignedAgent,
      d.leadSourceChannel,
      d.stageName,
      d.scoreBucket,
      d.callsLast7Days,
      d.lastCallAt ?? "",
      d.calledRecently ? "Yes" : "No",
      d.sourceSystem,
      d.consultationBooked ? "Yes" : "No",
    ]),
    [],
    ["Channel snapshot (this cohort)"],
    [
      "Source",
      "Leads Assigned",
      "Calls Made (7d)",
      "Consultations Booked",
      "Conversion %",
    ],
    ...report.channelBreakdown.map((c) => [
      c.source,
      c.leadsAssigned,
      c.callsMade,
      c.consultationsBooked,
      c.conversionPct,
    ]),
  ];
  return lines;
}

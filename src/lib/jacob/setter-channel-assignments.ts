/**
 * Jacob Sapochnick — Setter Channel Assignments
 * Matches GHL Opportunity Source (exact filter strings) → Setter.
 * Built-in list from ops sheet (Active rows). Override/extend via Google Sheet + JACOB_SOURCE_AGENT_JSON.
 */

import { fetchPublicSheetTabCsv } from "@/lib/google-sheets";

function normKey(k: string): string {
  return k.trim().toLowerCase();
}

/** Active assignments — Column G "Filter Value to Enter" → Column C Setter (Apr 2026 sheet). */
const BUILTIN_FILTER_TO_SETTER: [string, string][] = [
  ["Website Form", "Giselle"],
  ["chat widget", "Giselle"],
  ["FB Lead Form", "Leo"],
  ["Consult Landing Page", "Adriana"],
  ["Instagram", "Juan"],
  ["Facebook", "Juan"],
  ["TikTok", "Juan"],
  ["WhatsApp", "Juan"],
  ["Livestream", "Juan"],
];

function normHeaderKey(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function findColumnKey(
  row: Record<string, string>,
  patterns: string[],
): string | null {
  const keys = Object.keys(row);
  for (const p of patterns) {
    const np = normHeaderKey(p);
    const hit = keys.find((k) => normHeaderKey(k) === np);
    if (hit) return hit;
  }
  for (const p of patterns) {
    const np = normHeaderKey(p);
    const hit = keys.find(
      (k) => normHeaderKey(k).includes(np) || np.includes(normHeaderKey(k)),
    );
    if (hit) return hit;
  }
  return null;
}

function parseJsonEnvMap(): Map<string, string> {
  const raw = process.env.JACOB_SOURCE_AGENT_JSON?.trim();
  if (!raw) return new Map();
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const map = new Map<string, string>();
    for (const [k, v] of Object.entries(obj)) {
      if (typeof v !== "string" || !v.trim()) continue;
      map.set(normKey(k), v.trim());
    }
    return map;
  } catch {
    console.warn("[jacob/setter-assignments] JACOB_SOURCE_AGENT_JSON invalid");
    return new Map();
  }
}

/**
 * Parse published CSV rows from "Setter Channel Assignments" style layout.
 * Skips rows whose Status contains "Pending". Uses "Filter Value to Enter" → Setter.
 * Export the tab with the header row as the first line of the CSV (no title rows above it), or use a range that starts on the header row.
 */
export function parseSetterAssignmentsSheetRows(
  rows: Record<string, string>[],
): Map<string, string> {
  const map = new Map<string, string>();
  if (rows.length === 0) return map;

  const sample = rows[0];
  const fk = findColumnKey(sample, [
    "Filter Value to Enter",
    "Filter Value",
    "GHL Source",
    "CRM Filter",
  ]);
  const sk = findColumnKey(sample, ["Setter", "Agent", "Assigned To"]);
  const stk = findColumnKey(sample, ["Status"]);
  const ok = findColumnKey(sample, ["Opportunity Source", "Source Label"]);

  if (!fk || !sk) {
    console.warn(
      "[jacob/setter-assignments] Sheet missing Filter / Setter columns",
    );
    return map;
  }

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const status = stk ? (row[stk] || "").toLowerCase() : "";
    if (status.includes("pending")) continue;

    const setter = (row[sk] || "").trim();
    const filterVal = (row[fk] || "").trim();
    if (!setter || !filterVal) continue;
    if (normKey(setter) === "setter") continue;

    map.set(normKey(filterVal), setter);
    if (ok) {
      const oppSrc = (row[ok] || "").trim();
      if (oppSrc && normKey(oppSrc) !== normKey(filterVal)) {
        map.set(normKey(oppSrc), setter);
      }
    }
  }

  return map;
}

export async function fetchSetterAssignmentsSheetRows(): Promise<
  Record<string, string>[]
> {
  const sheetId = process.env.JACOB_SETTER_ASSIGNMENTS_SHEET_ID?.trim();
  const gid = process.env.JACOB_SETTER_ASSIGNMENTS_GID?.trim() || "0";
  if (!sheetId) return [];
  return fetchPublicSheetTabCsv(sheetId, gid);
}

/**
 * Merge order (later wins): built-in Active map → published assignments sheet → JACOB_SOURCE_AGENT_JSON.
 */
export async function loadMergedOpportunitySourceAgentMap(): Promise<
  Map<string, string>
> {
  const merged = new Map<string, string>();

  for (const [filter, setter] of BUILTIN_FILTER_TO_SETTER) {
    merged.set(normKey(filter), setter);
  }

  try {
    const sheetRows = await fetchSetterAssignmentsSheetRows();
    if (sheetRows.length > 0) {
      const fromSheet = parseSetterAssignmentsSheetRows(sheetRows);
      for (const [k, v] of fromSheet) merged.set(k, v);
    }
  } catch (e) {
    console.error("[jacob/setter-assignments] Sheet load failed:", e);
  }

  for (const [k, v] of parseJsonEnvMap()) {
    merged.set(k, v);
  }

  return merged;
}

export function getBuiltinSetterAssignmentCount(): number {
  return BUILTIN_FILTER_TO_SETTER.length;
}

import { fetchPublicSheetTabCsv } from "@/lib/google-sheets";

/**
 * Setter call scoring / dialer log tab (configure gid to the correct worksheet).
 * Expected columns (flexible header match in reconciliation): Contact ID, Call date, Direction, Agent, etc.
 */
export async function fetchJacobCallLogRows(): Promise<Record<string, string>[]> {
  const sheetId = process.env.JACOB_CALL_LOG_SHEET_ID?.trim();
  const gid = process.env.JACOB_CALL_LOG_GID?.trim() || "0";
  if (!sheetId) {
    console.warn("[jacob/call-log] JACOB_CALL_LOG_SHEET_ID not set — reconciliation will show zero calls.");
    return [];
  }
  return fetchPublicSheetTabCsv(sheetId, gid);
}

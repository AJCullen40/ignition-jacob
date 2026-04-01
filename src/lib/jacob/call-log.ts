import { fetchPublicSheetTabCsv } from "@/lib/google-sheets";

export interface CallLogFetchInfo {
  sheetId: string | null;
  gid: string;
  /** False when no sheet could be resolved — all call counts stay zero */
  configured: boolean;
}

/**
 * Call activity is matched from a published Google Sheet tab (dialer / setter log),
 * not from GHL’s native call APIs. Set JACOB_CALL_LOG_SHEET_ID + JACOB_CALL_LOG_GID
 * to the workbook tab that contains one row per call with Contact ID (or phone) + date.
 */
export function getJacobCallLogFetchInfo(): CallLogFetchInfo {
  const explicit = process.env.JACOB_CALL_LOG_SHEET_ID?.trim();
  const gid = process.env.JACOB_CALL_LOG_GID?.trim() || "0";
  const sheetId = explicit || null;
  const configured = Boolean(sheetId);
  return { sheetId, gid, configured };
}

export async function fetchJacobCallLogRows(): Promise<Record<string, string>[]> {
  const { sheetId, gid, configured } = getJacobCallLogFetchInfo();
  if (!configured) {
    console.warn(
      "[jacob/call-log] Set JACOB_CALL_LOG_SHEET_ID to the Google Sheet that holds call rows (same or different workbook as scoring).",
    );
    return [];
  }
  try {
    return await fetchPublicSheetTabCsv(sheetId!, gid);
  } catch (e) {
    console.error("[jacob/call-log] Fetch failed:", e);
    return [];
  }
}

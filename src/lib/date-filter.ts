/**
 * Shared date-range utilities for SOQL and Sheets filtering.
 * API routes accept ?from=YYYY-MM-DD&to=YYYY-MM-DD
 */

export type DateRange = { from: string; to: string };

/**
 * Build a SOQL date filter clause for a CreatedDate field.
 * Returns e.g. "CreatedDate >= 2026-02-01T00:00:00Z AND CreatedDate <= 2026-02-16T23:59:59Z"
 */
export function soqlDateFilter(range: DateRange | null, field: string = "CreatedDate"): string {
  if (!range) return `${field} = THIS_MONTH`;
  return `${field} >= ${range.from}T00:00:00Z AND ${field} <= ${range.to}T23:59:59Z`;
}

/**
 * Build a "previous period" SOQL filter of the same duration, shifted back.
 * E.g. if range is Feb 1–15 (15 days), prev is Jan 17–31.
 */
export function soqlPrevDateFilter(range: DateRange | null, field: string = "CreatedDate"): string {
  if (!range) return `${field} = LAST_MONTH`;
  const fromDate = new Date(range.from + "T00:00:00Z");
  const toDate = new Date(range.to + "T23:59:59Z");
  const durationMs = toDate.getTime() - fromDate.getTime();
  const prevTo = new Date(fromDate.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - durationMs);
  return `${field} >= ${prevFrom.toISOString().slice(0, 10)}T00:00:00Z AND ${field} <= ${prevTo.toISOString().slice(0, 10)}T23:59:59Z`;
}

/**
 * Parse from/to from URLSearchParams. Returns null if not provided (fall back to THIS_MONTH).
 */
export function parseDateRange(params: URLSearchParams): DateRange | null {
  const from = params.get("from") || params.get("start");
  const to = params.get("to") || params.get("end");
  if (from && to && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return { from, to };
  }
  return null;
}

/**
 * Filter sheet rows by a date column. Checks multiple common column names.
 */
export function filterRowsByDate(rows: Record<string, string>[], range: DateRange | null): Record<string, string>[] {
  if (!range) return rows;
  const from = range.from;
  const to = range.to;
  return rows.filter(row => {
    const dateVal = (
      row["Last Comment Date"] || row["Date Created"] || row["Last Update"] ||
      row.date || row.Date || row.created_at || row.Timestamp || row.Created || ""
    ).slice(0, 10);
    if (!dateVal || dateVal.length < 10) return true; // keep rows without dates
    return dateVal >= from && dateVal <= to;
  });
}

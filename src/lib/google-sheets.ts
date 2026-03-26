/**
 * Google Sheets client with in-memory caching.
 * Uses public CSV export.
 */

const COMMENTS_SHEET_ID = '19yfOuHlm6yOlZBAFbKo2ZT4BCt5E2QO-D7UqK9XATzI';
const SCORING_SHEET_ID = '1NJxV_RKkr4lAKm9e47QvpLxh6DBLWvEcdf4mPg82M5U';

// ---------- In-memory cache ----------
type CacheEntry<T> = { data: T; ts: number };
const SHEET_CACHE_TTL = 15 * 60 * 1000; // 15 minutes

const scoringCache: { entry: CacheEntry<Record<string, string>[]> | null } = { entry: null };
const commentsCache: { entry: CacheEntry<{ fbIg: Record<string, string>[]; youtube: Record<string, string>[] }> | null } = { entry: null };
const fbLeadFormCache: { entry: CacheEntry<Record<string, string>[]> | null } = { entry: null };

function isFresh<T>(c: CacheEntry<T> | null): c is CacheEntry<T> {
  return c !== null && (Date.now() - c.ts) < SHEET_CACHE_TTL;
}

// ---------- Types ----------
export type CommentRow = {
  date: string;
  platform: string;
  username: string;
  comment: string;
  buyingIntent: boolean;
  intentScore: number;
  responded: boolean;
  responseTime: string;
  theme: string;
};

export type ScoringRow = {
  date: string;
  name: string;
  phone: string;
  source: string;
  score: number;
  sfStatus: string;
  booked: boolean;
  retained: boolean;
};

// ---------- Fetch ----------
async function fetchSheetCSV(sheetId: string, gid: string = '0'): Promise<string> {
  // Use gviz/tq endpoint with CSV output — faster than full export for large sheets
  // Falls back to full export if gviz fails
  const gvizUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}`;
  const res = await fetch(gvizUrl, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
  if (!res.ok) {
    throw new Error(`Google Sheets fetch failed: ${res.status}`);
  }
  const text = await res.text();
  // Guard against HTML error pages (e.g. login redirects, permission errors)
  if (text.trimStart().startsWith('<!DOCTYPE') || text.trimStart().startsWith('<html')) {
    throw new Error(`Google Sheets returned HTML instead of CSV (sheet ${sheetId}, gid ${gid})`);
  }
  return text;
}

// ---------- Robust CSV parser ----------
function parseCSV(rawCsv: string): Record<string, string>[] {
  // Strip NUL bytes from the entire input before parsing
  const csv = rawCsv.replace(/\0/g, '');

  // RFC 4180 compliant parser — handles multiline quoted fields
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;
  let i = 0;

  while (i < csv.length) {
    const ch = csv[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < csv.length && csv[i + 1] === '"') {
          // Escaped quote ""
          currentField += '"';
          i += 2;
          continue;
        } else {
          // End of quoted field
          inQuotes = false;
          i++;
          continue;
        }
      } else {
        // Inside quotes: newlines, commas, anything is literal field content
        currentField += ch;
        i++;
        continue;
      }
    }

    // Not in quotes
    if (ch === '"') {
      inQuotes = true;
      i++;
    } else if (ch === ',') {
      currentRow.push(currentField);
      currentField = '';
      i++;
    } else if (ch === '\r') {
      if (i + 1 < csv.length && csv[i + 1] === '\n') {
        // \r\n — row boundary
        currentRow.push(currentField);
        currentField = '';
        rows.push(currentRow);
        currentRow = [];
        i += 2;
      } else {
        // Bare \r — treat as row boundary
        currentRow.push(currentField);
        currentField = '';
        rows.push(currentRow);
        currentRow = [];
        i++;
      }
    } else if (ch === '\n') {
      currentRow.push(currentField);
      currentField = '';
      rows.push(currentRow);
      currentRow = [];
      i++;
    } else {
      currentField += ch;
      i++;
    }
  }

  // Last field/row
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  if (rows.length < 2) return [];

  const headers = rows[0].map(h => h.trim());
  const result: Record<string, string>[] = [];

  for (let r = 1; r < rows.length; r++) {
    const values = rows[r];
    // Skip rows that don't have enough columns (malformed)
    if (values.length < 3) continue;
    const row: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      row[headers[c]] = (values[c] ?? '').trim();
    }
    result.push(row);
  }

  return result;
}

// ---------- Public API ----------
export async function getComments(): Promise<{ fbIg: Record<string, string>[]; youtube: Record<string, string>[] }> {
  if (isFresh(commentsCache.entry)) {
    return commentsCache.entry.data;
  }

  try {
    const fbIgUrl = `https://docs.google.com/spreadsheets/d/${COMMENTS_SHEET_ID}/export?format=csv&gid=0&range=K:P`;
    const ytUrl = `https://docs.google.com/spreadsheets/d/${COMMENTS_SHEET_ID}/export?format=csv&gid=427395799&range=K:P`;
    const [fbIgCsv, ytCsv] = await Promise.all([
      fetch(fbIgUrl, { cache: 'no-store', signal: AbortSignal.timeout(25000), redirect: 'follow' })
        .then(async r => {
          if (!r.ok) throw new Error(`FB/IG sheet fetch failed: ${r.status}`);
          const text = await r.text();
          if (text.trimStart().startsWith('<!DOCTYPE') || text.trimStart().startsWith('<html')) {
            throw new Error('FB/IG sheet returned HTML');
          }
          return text;
        }),
      fetch(ytUrl, { cache: 'no-store', signal: AbortSignal.timeout(25000), redirect: 'follow' })
        .then(async r => {
          if (!r.ok) throw new Error(`YT sheet fetch failed: ${r.status}`);
          const text = await r.text();
          if (text.trimStart().startsWith('<!DOCTYPE') || text.trimStart().startsWith('<html')) {
            throw new Error('YT sheet returned HTML');
          }
          return text;
        }),
    ]);
    const data = {
      fbIg: parseCSV(fbIgCsv),
      youtube: parseCSV(ytCsv),
    };
    commentsCache.entry = { data, ts: Date.now() };
    return data;
  } catch (e) {
    console.error('[google-sheets] Comments fetch failed:', e);
    // Return stale cache if available
    if (commentsCache.entry) return commentsCache.entry.data;
    return { fbIg: [], youtube: [] };
  }
}

/**
 * Lightweight scoring fetch — excludes Conversation History column (which is ~3KB per row).
 * Used by commbook engine which only needs ID, Score, Phone, SF ID, etc.
 * Columns: A=ID, B=First Name, C=Last Name, D=Score, F=Date Created, G=Lead Source, H=Phone Origin, J=phone number, L=SF ID
 */
export async function getScoringLeadsLite(): Promise<Record<string, string>[]> {
  try {
    // Fetch columns A-D,F-N (skip E = Conversation History) via multiple ranges
    // Google export doesn't support non-contiguous ranges, so fetch A-D and F-N separately
    const [csvAD, csvFN] = await Promise.all([
      fetch(`https://docs.google.com/spreadsheets/d/${SCORING_SHEET_ID}/export?format=csv&gid=0&range=A:D`, { cache: 'no-store', signal: AbortSignal.timeout(25000), redirect: 'follow' }).then(r => r.ok ? r.text() : ''),
      fetch(`https://docs.google.com/spreadsheets/d/${SCORING_SHEET_ID}/export?format=csv&gid=0&range=F:N`, { cache: 'no-store', signal: AbortSignal.timeout(25000), redirect: 'follow' }).then(r => r.ok ? r.text() : ''),
    ]);
    if (!csvAD || !csvFN) return [];
    const rowsAD = parseCSV(csvAD);
    const rowsFN = parseCSV(csvFN);
    // Merge by row index
    const merged: Record<string, string>[] = [];
    for (let i = 0; i < Math.min(rowsAD.length, rowsFN.length); i++) {
      merged.push({ ...rowsAD[i], ...rowsFN[i] });
    }
    console.log(`[google-sheets] Scoring lite: ${merged.length} rows`);
    return merged;
  } catch (e) {
    console.error('[google-sheets] Scoring lite fetch failed:', e);
    return [];
  }
}

export async function getFBLeadFormData(): Promise<Record<string, string>[]> {
  if (isFresh(fbLeadFormCache.entry)) {
    return fbLeadFormCache.entry.data;
  }
  try {
    const url = `https://docs.google.com/spreadsheets/d/${COMMENTS_SHEET_ID}/export?format=csv&gid=534677439`;
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(25000), redirect: 'follow' });
    if (!res.ok) throw new Error(`FB Lead Form fetch failed: ${res.status}`);
    const text = await res.text();
    if (text.trimStart().startsWith('<!DOCTYPE') || text.trimStart().startsWith('<html')) {
      throw new Error('FB Lead Form returned HTML');
    }
    const data = parseCSV(text);
    fbLeadFormCache.entry = { data, ts: Date.now() };
    console.log(`[google-sheets] FB Lead Form: ${data.length} rows`);
    return data;
  } catch (e) {
    console.error('[google-sheets] FB Lead Form fetch failed:', e);
    if (fbLeadFormCache.entry) return fbLeadFormCache.entry.data;
    return [];
  }
}

export async function getScoringLeads(): Promise<Record<string, string>[]> {
  if (isFresh(scoringCache.entry)) {
    return scoringCache.entry.data;
  }

  try {
    const urlAD = `https://docs.google.com/spreadsheets/d/${SCORING_SHEET_ID}/export?format=csv&gid=0&range=A:D`;
    const urlFN = `https://docs.google.com/spreadsheets/d/${SCORING_SHEET_ID}/export?format=csv&gid=0&range=F:N`;
    const [resAD, resFN] = await Promise.all([
      fetch(urlAD, { cache: 'no-store', signal: AbortSignal.timeout(25000), redirect: 'follow' }),
      fetch(urlFN, { cache: 'no-store', signal: AbortSignal.timeout(25000), redirect: 'follow' }),
    ]);
    if (!resAD.ok || !resFN.ok) {
      throw new Error(`Google Sheets scoring export failed: AD=${resAD.status} FN=${resFN.status}`);
    }
    const [csvAD, csvFN] = await Promise.all([resAD.text(), resFN.text()]);
    for (const t of [csvAD, csvFN]) {
      if (t.trimStart().startsWith('<!DOCTYPE') || t.trimStart().startsWith('<html')) {
        throw new Error('Google Sheets returned HTML instead of CSV for scoring sheet');
      }
    }
    const rowsAD = parseCSV(csvAD);
    const rowsFN = parseCSV(csvFN);
    const data: Record<string, string>[] = [];
    for (let i = 0; i < Math.max(rowsAD.length, rowsFN.length); i++) {
      data.push({ ...(rowsAD[i] || {}), ...(rowsFN[i] || {}) });
    }
    scoringCache.entry = { data, ts: Date.now() };
    console.log(`[google-sheets] Scoring cache refreshed: ${data.length} rows`);
    return data;
  } catch (e) {
    console.error('[google-sheets] Scoring fetch failed:', e);
    if (scoringCache.entry) return scoringCache.entry.data;
    return [];
  }
}

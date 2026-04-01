import { JWT } from "google-auth-library";

function getJwt(): JWT {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");
  const creds = JSON.parse(raw) as {
    client_email: string;
    private_key: string;
  };
  return new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

async function authHeader(): Promise<string> {
  const jwt = getJwt();
  const t = await jwt.getAccessToken();
  if (!t.token) throw new Error("Google access token unavailable");
  return `Bearer ${t.token}`;
}

/**
 * Replace entire tab contents (clears A1:Z10000 then writes values).
 * Create the tab once in the spreadsheet UI with the same name as JACOB_RECONCILIATION_TAB_NAME.
 */
export async function overwriteSheetTab(
  spreadsheetId: string,
  tabName: string,
  values: (string | number)[][],
): Promise<void> {
  const auth = await authHeader();
  const clearRange = encodeURIComponent(`${tabName}!A1:Z10000`);
  const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${clearRange}:clear`;
  const clearRes = await fetch(clearUrl, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: "{}",
  });
  if (!clearRes.ok) {
    throw new Error(`Sheets clear failed: ${clearRes.status} ${await clearRes.text()}`);
  }

  const putRange = encodeURIComponent(`${tabName}!A1`);
  const putUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${putRange}?valueInputOption=USER_ENTERED`;
  const putRes = await fetch(putUrl, {
    method: "PUT",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify({ values }),
  });
  if (!putRes.ok) {
    throw new Error(`Sheets update failed: ${putRes.status} ${await putRes.text()}`);
  }
}

export async function appendSheetRows(
  spreadsheetId: string,
  tabName: string,
  values: (string | number)[][],
): Promise<void> {
  const auth = await authHeader();
  const range = encodeURIComponent(`${tabName}!A1`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify({ values }),
  });
  if (!res.ok) {
    throw new Error(`Sheets append failed: ${res.status} ${await res.text()}`);
  }
}

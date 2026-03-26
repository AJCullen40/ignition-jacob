/**
 * Salesforce REST API client using refresh_token grant.
 * Env: SF_INSTANCE_URL, SF_CLIENT_ID, SF_CLIENT_SECRET, SF_REFRESH_TOKEN
 */

let cached: { accessToken: string; instanceUrl: string; until: number } | null = null;
const TOKEN_TTL_MS = 55 * 60 * 1000; // 55 min

export function getSalesforceConfig() {
  const instanceUrl = process.env.SF_INSTANCE_URL?.trim();
  const clientId = process.env.SF_CLIENT_ID?.trim();
  const clientSecret = process.env.SF_CLIENT_SECRET?.trim();
  const refreshToken = process.env.SF_REFRESH_TOKEN?.trim();
  if (!instanceUrl || !clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "SF_INSTANCE_URL, SF_CLIENT_ID, SF_CLIENT_SECRET, SF_REFRESH_TOKEN required"
    );
  }
  return { instanceUrl, clientId, clientSecret, refreshToken };
}

export async function getSalesforceAccessToken(): Promise<{ accessToken: string; instanceUrl: string }> {
  if (cached && Date.now() < cached.until) {
    return { accessToken: cached.accessToken, instanceUrl: cached.instanceUrl };
  }

  const { instanceUrl, clientId, clientSecret, refreshToken } = getSalesforceConfig();

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });

  const res = await fetch("https://login.salesforce.com/services/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Salesforce auth failed: ${res.status} ${err}`);
  }

  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const text = await res.text();
    throw new Error(`Salesforce auth returned non-JSON: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as { access_token?: string; instance_url?: string };
  const accessToken = data.access_token;
  const resolvedInstance = data.instance_url ?? instanceUrl;
  if (!accessToken) throw new Error("No access_token in Salesforce response");

  cached = {
    accessToken,
    instanceUrl: resolvedInstance,
    until: Date.now() + TOKEN_TTL_MS,
  };
  return { accessToken, instanceUrl: resolvedInstance };
}

// ---------- Query cache (5 min TTL) ----------
const SF_CACHE_TTL = 5 * 60 * 1000;
const queryCache: Map<string, { data: unknown[]; ts: number }> = new Map();

export async function querySalesforce<T = Record<string, unknown>>(soql: string): Promise<T[]> {
  const cacheKey = soql.trim();
  const hit = queryCache.get(cacheKey);
  if (hit && (Date.now() - hit.ts) < SF_CACHE_TTL) {
    return hit.data as T[];
  }

  const { accessToken, instanceUrl } = await getSalesforceAccessToken();
  const base = instanceUrl.replace(/\/$/, "");
  const allRecords: T[] = [];
  let url: string | null = `${base}/services/data/v59.0/query?q=${encodeURIComponent(soql)}`;

  while (url) {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Salesforce query failed: ${res.status} ${err}`);
    }

    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      const text = await res.text();
      throw new Error(`Salesforce returned non-JSON: ${text.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      records?: T[];
      nextRecordsUrl?: string;
      done?: boolean;
    };
    const records = data.records ?? [];
    allRecords.push(...records);

    if (data.done === false && data.nextRecordsUrl) {
      url = data.nextRecordsUrl.startsWith("http")
        ? data.nextRecordsUrl
        : `${base}${data.nextRecordsUrl}`;
    } else {
      url = null;
    }
  }

  queryCache.set(cacheKey, { data: allRecords, ts: Date.now() });

  if (queryCache.size > 50) {
    const now = Date.now();
    queryCache.forEach((v, k) => {
      if (now - v.ts > SF_CACHE_TTL) queryCache.delete(k);
    });
  }

  return allRecords;
}

/**
 * GoHighLevel v1 REST API client.
 * Replaces Salesforce for Jacob's pipeline/opportunity data.
 *
 * Key differences from Salesforce:
 *  - Contact → Opportunity (no Lead→Account→Opportunity chain)
 *  - Pipeline stages are per-pipeline, identified by UUID
 *  - Scoring sheet "ID" column = GHL contact.id (direct match)
 *
 * Uses node:https directly to bypass Next.js fetch patching (4-5x faster).
 */

import https from "node:https";

const GHL_API_KEY = process.env.GHL_API_KEY || "";
const BASE = "https://rest.gohighlevel.com/v1";
const agent = new https.Agent({ keepAlive: true, maxSockets: 10 });

// ─── Types ───────────────────────────────────────────────────────────

export interface GHLStage {
  id: string;
  name: string;
}

export interface GHLPipeline {
  id: string;
  name: string;
  stages: GHLStage[];
  locationId: string;
}

export interface GHLContact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  tags: string[];
}

export interface GHLOpportunity {
  id: string;
  name: string;
  monetaryValue: number;
  pipelineId: string;
  pipelineStageId: string;
  status: string;
  source: string;
  createdAt: string;
  updatedAt: string;
  contact: GHLContact;
  /** Resolved stage name (enriched by client) */
  stageName: string;
  /** Pipeline name (enriched by client) */
  pipelineName: string;
}

// ─── Caches (survive HMR via globalThis) ────────────────────────────

const PIPELINE_TTL = 60 * 60 * 1000; // 1 hour
const OPP_TTL = 15 * 60 * 1000; // 15 min

interface GHLCache {
  pipelineCache: {
    data: GHLPipeline[];
    stageMap: Map<string, string>;
    ts: number;
  } | null;
  oppCache: { data: GHLOpportunity[]; ts: number } | null;
  fetchInProgress: Promise<GHLOpportunity[]> | null;
}

const g = globalThis as unknown as { __ghlCache?: GHLCache };
if (!g.__ghlCache) {
  g.__ghlCache = { pipelineCache: null, oppCache: null, fetchInProgress: null };
}
const cache = g.__ghlCache;

// ─── HTTP (with rate-limit retry) ────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function rawGet(url: string): Promise<{ status: number; headers: Record<string, string | undefined>; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { agent, headers: { Authorization: `Bearer ${GHL_API_KEY}` } }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () =>
        resolve({
          status: res.statusCode ?? 0,
          headers: res.headers as Record<string, string | undefined>,
          body: Buffer.concat(chunks).toString(),
        }),
      );
    });
    req.on("error", reject);
    req.setTimeout(30000, () => { req.destroy(new Error("GHL request timeout")); });
  });
}

async function ghlGet<T>(url: string, attempt = 0): Promise<T> {
  const fullUrl = (url.startsWith("http") ? url : `${BASE}${url}`).replace(
    /^http:\/\//,
    "https://",
  );
  const res = await rawGet(fullUrl);
  if (res.status === 429 || res.status >= 500) {
    const retryAfter = parseInt(res.headers["retry-after"] || "0", 10);
    const backoff = Math.max(retryAfter * 1000, 2000 * 2 ** attempt);
    if (attempt < 4) {
      console.warn(`[GHL] ${res.status}, retry in ${backoff}ms (attempt ${attempt + 1})`);
      await sleep(backoff);
      return ghlGet<T>(url, attempt + 1);
    }
    throw new Error(`GHL failed after ${attempt + 1} retries (last status: ${res.status})`);
  }
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`GHL ${url.slice(0, 80)}: ${res.status} ${res.body.slice(0, 200)}`);
  }
  return JSON.parse(res.body) as T;
}

// ─── Pipelines & Stage Map ───────────────────────────────────────────

export async function getPipelines(): Promise<GHLPipeline[]> {
  if (cache.pipelineCache && Date.now() - cache.pipelineCache.ts < PIPELINE_TTL) {
    return cache.pipelineCache.data;
  }
  const { pipelines } = await ghlGet<{ pipelines: GHLPipeline[] }>("/pipelines/");
  const stageMap = new Map<string, string>();
  for (const p of pipelines) {
    for (const s of p.stages) stageMap.set(s.id, s.name);
  }
  cache.pipelineCache = { data: pipelines, stageMap, ts: Date.now() };
  return pipelines;
}

export async function getStageMap(): Promise<Map<string, string>> {
  if (cache.pipelineCache && Date.now() - cache.pipelineCache.ts < PIPELINE_TTL) {
    return cache.pipelineCache.stageMap;
  }
  await getPipelines();
  return cache.pipelineCache!.stageMap;
}

// ─── Opportunities (paginated, all pipelines) ───────────────────────

async function fetchAllOpps(): Promise<GHLOpportunity[]> {
  const t0 = Date.now();
  const pipelines = await getPipelines();
  console.log(`[GHL] getPipelines: ${Date.now() - t0}ms, ${pipelines.length} pipelines`);
  const stageMap = cache.pipelineCache!.stageMap;
  const all: GHLOpportunity[] = [];

  for (const pipeline of pipelines) {
    let url: string | null =
      `${BASE}/pipelines/${pipeline.id}/opportunities?limit=100`;
    let pages = 0;
    const pt0 = Date.now();

    interface PageResponse {
      opportunities: GHLOpportunity[];
      meta?: { nextPageUrl?: string; total?: number };
    }

    let maxPages = 200;

    while (url && pages < maxPages) {
      const data: PageResponse = await ghlGet<PageResponse>(url);
      const batch = data.opportunities || [];

      if (pages === 0 && data.meta?.total) {
        maxPages = Math.ceil(data.meta.total / 100) + 3;
      }

      for (const opp of batch) {
        opp.stageName = stageMap.get(opp.pipelineStageId) || "Unknown";
        opp.pipelineName = pipeline.name;
      }
      all.push(...batch);
      pages++;

      if (batch.length < 50) break;

      url = data.meta?.nextPageUrl ? data.meta.nextPageUrl : null;
    }
    console.log(
      `[GHL] Pipeline "${pipeline.name}": ${pages} pages, ${Date.now() - pt0}ms`,
    );
  }

  console.log(`[GHL] Total: ${all.length} opps in ${Date.now() - t0}ms`);
  return all;
}

export async function getAllOpportunities(): Promise<GHLOpportunity[]> {
  if (cache.oppCache && Date.now() - cache.oppCache.ts < OPP_TTL) {
    return cache.oppCache.data;
  }

  if (cache.fetchInProgress) return cache.fetchInProgress;

  cache.fetchInProgress = fetchAllOpps()
    .then((data) => {
      cache.oppCache = { data, ts: Date.now() };
      cache.fetchInProgress = null;
      console.log(`[GHL] Cached ${data.length} opportunities`);
      return data;
    })
    .catch((err) => {
      cache.fetchInProgress = null;
      if (cache.oppCache) {
        console.warn("[GHL] Fetch failed, returning stale cache:", err);
        return cache.oppCache.data;
      }
      throw err;
    });

  return cache.fetchInProgress;
}

// ─── Stage Categorization ────────────────────────────────────────────
// Maps raw GHL stage names (with emojis) to clean display categories.

export function categorizeStage(rawName: string): string {
  const s = rawName.toLowerCase();
  if (s.includes("retainer closed")) return "Retained";
  if (s.includes("signed") && s.includes("submitted")) return "Retained";
  if (s.includes("agreement sent")) return "Agreement Sent";
  if (s.includes("paid") && s.includes("consult")) return "Paid Consultation";
  if (s.includes("referral partner")) return "Referral";
  if (s.includes("nurture")) return "Nurture";
  if (s.includes("turn ai off") || s.includes("juan") || s.includes("giselle"))
    return "Human Handoff";
  if (s.includes("trying to reach")) return "Follow Up";
  if (s.includes("agreed to pay") || s.includes("awaiting booking"))
    return "Awaiting Booking";
  if (s.includes("hot") || (s.includes("wants") && s.includes("payment")))
    return "Hot Lead";
  if (s.includes("free consultation")) return "Free Consultation";
  if (s.includes("warm") || s.includes("close to closing")) return "Qualified";
  if (s.includes("lead responded") || s.includes("responded"))
    return "Lead Responded";
  if (s.includes("new lead") || s.includes("no response")) return "New Leads";
  if (s.includes("non client") || s.includes("wrong contact"))
    return "Disqualified";
  // PI pipeline stages
  if (s.includes("consultation booked") || s.includes("booked a call"))
    return "Consultation Booked";
  if (s.includes("contacted")) return "Lead Responded";
  if (s.includes("follow up")) return "Follow Up";
  if (s.includes("inbound call") || s.includes("call now")) return "Hot Lead";
  return cleanStageName(rawName);
}

export function cleanStageName(name: string): string {
  return name
    .replace(
      /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27FF}\u{FE00}-\u{FEFF}\u{200D}\u{20E3}]/gu,
      "",
    )
    .replace(/[❌💡💬✅☎️🔥💲⌚🪴💰🤝📞📅🤳⏳]/g, "")
    .replace(/\s*>>\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Revenue Radar groupings ─────────────────────────────────────────

export const RETAINED_CATEGORIES = new Set(["Retained"]);

export const BOOKING_PLUS_CATEGORIES = new Set([
  "Paid Consultation",
  "Agreement Sent",
  "Retained",
]);

export const ACTIVE_PIPELINE_CATEGORIES = new Set([
  "New Leads",
  "Lead Responded",
  "Qualified",
  "Hot Lead",
  "Free Consultation",
  "Awaiting Booking",
  "Follow Up",
  "Human Handoff",
  "Consultation Booked",
  "Contacted",
]);

// Pipeline funnel stages for display (ordered progression)
export const PIPELINE_DISPLAY_STAGES = [
  { label: "New Leads", color: "#9ca3af", categories: ["New Leads", "Disqualified"] },
  { label: "Lead Responded", color: "#3b82f6", categories: ["Lead Responded"] },
  { label: "Qualified", color: "#8b5cf6", categories: ["Qualified", "Hot Lead"] },
  { label: "Consultation", color: "#f59e0b", categories: ["Free Consultation", "Awaiting Booking"] },
  { label: "Paid Consultation", color: "#22c55e", categories: ["Paid Consultation"] },
  { label: "Agreement Sent", color: "#14b8a6", categories: ["Agreement Sent"] },
  { label: "Retained", color: "#a855f7", categories: ["Retained"] },
];

export function isRetained(cat: string): boolean {
  return RETAINED_CATEGORIES.has(cat);
}

export function isBookingPlus(cat: string): boolean {
  return BOOKING_PLUS_CATEGORIES.has(cat);
}

/** Warm (score 4) / Hot (score 5) pipeline buckets used for setter reconciliation. */
export function isWarmOrHotPipelineStage(stageName: string): boolean {
  const cat = categorizeStage(stageName);
  return cat === "Qualified" || cat === "Hot Lead";
}

type LooseOpp = GHLOpportunity & Record<string, unknown>;

/** Best-effort assignee name from GHL opportunity payload (v1 shape varies). */
export function getAssignedAgentName(opp: GHLOpportunity): string {
  const o = opp as LooseOpp;
  const pick = (v: unknown): string | null => {
    if (v == null) return null;
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "object") {
      const r = v as Record<string, unknown>;
      const name = r.name;
      if (typeof name === "string" && name.trim()) return name.trim();
      const fn = r.firstName;
      const ln = r.lastName;
      if (typeof fn === "string" || typeof ln === "string") {
        return `${typeof fn === "string" ? fn : ""} ${typeof ln === "string" ? ln : ""}`.trim() || null;
      }
    }
    return null;
  };
  return (
    pick(o.assignedTo) ||
    pick(o.assignedUser) ||
    (Array.isArray(o.users) && o.users.length ? pick(o.users[0]) : null) ||
    pick(o.user) ||
    "Unassigned"
  );
}

/**
 * GoHighLevel v1 REST API client.
 * Replaces Salesforce for Jacob's pipeline/opportunity data.
 *
 * Key differences from Salesforce:
 *  - Contact → Opportunity (no Lead→Account→Opportunity chain)
 *  - Pipeline stages are per-pipeline, identified by UUID
 *  - Scoring sheet "ID" column = GHL contact.id (direct match)
 */

const GHL_API_KEY = process.env.GHL_API_KEY || "";
const BASE = "https://rest.gohighlevel.com/v1";

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

// ─── Caches ──────────────────────────────────────────────────────────

const PIPELINE_TTL = 60 * 60 * 1000; // 1 hour
const OPP_TTL = 15 * 60 * 1000; // 15 min (matches Google Sheets cache)

let pipelineCache: {
  data: GHLPipeline[];
  stageMap: Map<string, string>;
  ts: number;
} | null = null;

let oppCache: { data: GHLOpportunity[]; ts: number } | null = null;
let fetchInProgress: Promise<GHLOpportunity[]> | null = null;

// ─── HTTP ────────────────────────────────────────────────────────────

async function ghlGet<T>(url: string): Promise<T> {
  const fullUrl = url.startsWith("http") ? url : `${BASE}${url}`;
  const res = await fetch(fullUrl, {
    headers: { Authorization: `Bearer ${GHL_API_KEY}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GHL ${url.slice(0, 80)}: ${res.status} ${err.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

// ─── Pipelines & Stage Map ───────────────────────────────────────────

export async function getPipelines(): Promise<GHLPipeline[]> {
  if (pipelineCache && Date.now() - pipelineCache.ts < PIPELINE_TTL) {
    return pipelineCache.data;
  }
  const { pipelines } = await ghlGet<{ pipelines: GHLPipeline[] }>("/pipelines/");
  const stageMap = new Map<string, string>();
  for (const p of pipelines) {
    for (const s of p.stages) stageMap.set(s.id, s.name);
  }
  pipelineCache = { data: pipelines, stageMap, ts: Date.now() };
  return pipelines;
}

export async function getStageMap(): Promise<Map<string, string>> {
  if (pipelineCache && Date.now() - pipelineCache.ts < PIPELINE_TTL) {
    return pipelineCache.stageMap;
  }
  await getPipelines();
  return pipelineCache!.stageMap;
}

// ─── Opportunities (paginated, all pipelines) ───────────────────────

async function fetchAllOpps(): Promise<GHLOpportunity[]> {
  const pipelines = await getPipelines();
  const stageMap = pipelineCache!.stageMap;
  const all: GHLOpportunity[] = [];

  for (const pipeline of pipelines) {
    let url: string | null =
      `${BASE}/pipelines/${pipeline.id}/opportunities?limit=100`;
    let pages = 0;

    interface PageResponse {
      opportunities: GHLOpportunity[];
      meta?: { nextPageUrl?: string; total?: number };
    }

    while (url) {
      const data: PageResponse = await ghlGet<PageResponse>(url);

      for (const opp of data.opportunities || []) {
        opp.stageName = stageMap.get(opp.pipelineStageId) || "Unknown";
        opp.pipelineName = pipeline.name;
      }
      all.push(...(data.opportunities || []));
      pages++;

      url =
        data.meta?.nextPageUrl && data.opportunities?.length > 0
          ? data.meta.nextPageUrl
          : null;
    }
    if (pages > 1) {
      console.log(
        `[GHL] Pipeline "${pipeline.name}": ${pages} pages fetched`,
      );
    }
  }

  return all;
}

export async function getAllOpportunities(): Promise<GHLOpportunity[]> {
  if (oppCache && Date.now() - oppCache.ts < OPP_TTL) {
    return oppCache.data;
  }

  // Dedup concurrent fetches (multiple routes may trigger simultaneously)
  if (fetchInProgress) return fetchInProgress;

  fetchInProgress = fetchAllOpps()
    .then((data) => {
      oppCache = { data, ts: Date.now() };
      fetchInProgress = null;
      console.log(`[GHL] Cached ${data.length} opportunities`);
      return data;
    })
    .catch((err) => {
      fetchInProgress = null;
      if (oppCache) {
        console.warn("[GHL] Fetch failed, returning stale cache:", err);
        return oppCache.data;
      }
      throw err;
    });

  return fetchInProgress;
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

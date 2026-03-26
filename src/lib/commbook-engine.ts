// CommBook Intelligence Engine v6 — Pre-computed cache + live fallback
// Primary: Read from n8n pre-computed cache (stored via /api/commbook/ingest)
// Fallback: Live query (limited to 20K rows due to Vercel timeout)

import {
  getAllOpportunities,
  categorizeStage,
  isRetained,
  isBookingPlus,
  type GHLOpportunity,
} from "./ghl";
import { readFile } from "fs/promises";
import { join } from "path";

const COMMENTS_SHEET_ID = "1PgJcRYNNYRp8fLRsdivN3NxgqFoK1-vlid22PIXmZAs";
const SCORING_SHEET_ID = "1FY1yRBAYzhJvKivwIrV-4BzSawKyJF4XO59FeLMM5Bo";

// ====== Types ======
export interface CommBookData {
  lastUpdated: string;
  hero: { commBookRate: number; totalComments: number; totalBookings: number; totalRetainers: number; totalRevenue: number };
  funnel: { stage: string; count: number; rate: number }[];
  topPosts: { postUrl: string; platform: string; date: string; totalComments: number; bookings: number; commBookRate: number }[];
  platforms: { platform: string; color: string; totalComments: number; dmsStarted: number; leadsScored: number; consultationsBooked: number; retainersSigned: number; commBookRate: number; revenue: number }[];
  visaTypes: { visaType: string; comments: number; leadsScored: number; bookings: number; retainers: number; commBookRate: number; avgRetainerValue: number; totalRevenue: number }[];
  geographic: { region: string; comments: number; bookings: number; retainers: number; commBookRate: number; revenue: number }[];
  revenueAttribution: { name: string; amount: number; visaType: string; platform: string; postUrl: string; postDate: string; commentScore: number; consultationDate: string; retainerDate: string }[];
  debug?: Record<string, number | string>;
}

// ====== Pre-computed Cache Access ======
declare global {
  // eslint-disable-next-line no-var
  var __commBookCache: { data: { generatedAt: string; version: number; ranges: Record<string, CommBookData> }; ts: number } | undefined;
}

const CACHE_FILE = join("/tmp", "commbook-cache.json");
const CACHE_MAX_AGE = 12 * 60 * 60 * 1000; // 12 hours

function dateRangeToKey(startDate?: string, endDate?: string): string {
  if (!startDate && !endDate) return "all";

  const now = new Date();
  const startMs = startDate ? new Date(startDate).getTime() : 0;

  // Try to match known ranges
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).getTime();

  if (startDate && !endDate) {
    const diffDays = Math.round((now.getTime() - startMs) / (1000 * 60 * 60 * 24));
    if (diffDays <= 8 && diffDays >= 6) return "7d";
    if (diffDays <= 31 && diffDays >= 29) return "30d";
    if (diffDays <= 91 && diffDays >= 89) return "90d";
    if (Math.abs(startMs - thisMonthStart) < 86400000) return "thisMonth";
    if (Math.abs(startMs - lastMonthStart) < 86400000 && endDate) return "lastMonth";
  }

  return ""; // No matching range
}

async function getCachedData(startDate?: string, endDate?: string): Promise<CommBookData | null> {
  try {
    // Check memory cache first
    let cacheData = globalThis.__commBookCache?.data;

    if (!cacheData) {
      // Try /tmp file first
      try {
        const raw = await readFile(CACHE_FILE, "utf-8");
        cacheData = JSON.parse(raw);
        if (cacheData) {
          globalThis.__commBookCache = { data: cacheData, ts: Date.now() };
        }
      } catch {
        /* file doesn't exist */
      }
    }

    if (!cacheData?.ranges || !cacheData.generatedAt) return null;

    // Check staleness
    const age = Date.now() - new Date(cacheData.generatedAt).getTime();
    if (age > CACHE_MAX_AGE) {
      console.log(`[CB] Cache is stale: ${Math.round(age / 3600000)}h old`);
      return null;
    }

    const rangeKey = dateRangeToKey(startDate, endDate);
    if (!rangeKey || !cacheData.ranges[rangeKey]) {
      console.log(`[CB] No cached range for key="${rangeKey}"`);
      return null;
    }

    const rangeData = cacheData.ranges[rangeKey];
    console.log(`[CB] Cache hit: range=${rangeKey}, ${rangeData.hero?.totalComments} comments, age=${Math.round(age / 60000)}min`);

    return {
      ...rangeData,
      lastUpdated: cacheData.generatedAt,
      debug: { ...rangeData.debug, source: "pre-computed", cacheAge: Math.round(age / 1000) } as Record<string, number | string>,
    };
  } catch (e) {
    console.warn("[CB] Cache read error:", e);
    return null;
  }
}

// ====== Visa Keywords ======
const VISA_TYPES: Record<string, string[]> = {
  "Green Card": ["green card", "permanent resident", "i-485", "i-140", "adjustment of status"],
  "H-1B": ["h-1b", "h1b", "h1-b", "specialty occupation"],
  Asylum: ["asylum", "persecution", "refugee"],
  "K-1 Fiancé": ["k-1", "k1", "fiancé", "fiance"],
  Citizenship: ["citizenship", "naturalization", "n-400"],
  DACA: ["daca", "dreamer", "deferred action"],
  TPS: ["tps", "temporary protected status"],
  "Family Petition": ["family petition", "i-130", "family-based"],
  "Work Permit": ["work permit", "ead", "employment authorization", "i-765"],
  "Deportation Defense": ["deportation", "removal", "immigration court"],
  "Student Visa": ["f-1", "f1", "student visa", "i-20"],
  "Business Immigration": ["eb-5", "eb5", "investor", "l-1", "l1", "e-2", "e2"],
  "O-1 Visa": ["o-1", "o1", "extraordinary ability"],
  VAWA: ["vawa", "violence against women"],
  "Personal Injury": ["personal injury", "accident", "car accident"],
};

const AREA_CODE_MAP: Record<string, string> = {
  "201": "NJ",
  "202": "DC",
  "203": "CT",
  "205": "AL",
  "206": "WA",
  "207": "ME",
  "208": "ID",
  "209": "CA",
  "210": "TX",
  "212": "NY",
  "213": "CA",
  "214": "TX",
  "215": "PA",
  "216": "OH",
  "217": "IL",
  "218": "MN",
  "219": "IN",
  "224": "IL",
  "225": "LA",
  "228": "MS",
  "229": "GA",
  "231": "MI",
  "234": "OH",
  "239": "FL",
  "240": "MD",
  "248": "MI",
  "251": "AL",
  "252": "NC",
  "253": "WA",
  "254": "TX",
  "256": "AL",
  "260": "IN",
  "262": "WI",
  "267": "PA",
  "269": "MI",
  "270": "KY",
  "272": "PA",
  "276": "VA",
  "281": "TX",
  "301": "MD",
  "302": "DE",
  "303": "CO",
  "304": "WV",
  "305": "FL",
  "307": "WY",
  "308": "NE",
  "309": "IL",
  "310": "CA",
  "312": "IL",
  "313": "MI",
  "314": "MO",
  "315": "NY",
  "316": "KS",
  "317": "IN",
  "318": "LA",
  "319": "IA",
  "320": "MN",
  "321": "FL",
  "323": "CA",
  "325": "TX",
  "330": "OH",
  "331": "IL",
  "334": "AL",
  "336": "NC",
  "337": "LA",
  "339": "MA",
  "340": "VI",
  "346": "TX",
  "347": "NY",
  "351": "MA",
  "352": "FL",
  "360": "WA",
  "361": "TX",
  "385": "UT",
  "386": "FL",
  "401": "RI",
  "402": "NE",
  "404": "GA",
  "405": "OK",
  "406": "MT",
  "407": "FL",
  "408": "CA",
  "409": "TX",
  "410": "MD",
  "412": "PA",
  "413": "MA",
  "414": "WI",
  "415": "CA",
  "417": "MO",
  "419": "OH",
  "423": "TN",
  "424": "CA",
  "425": "WA",
  "430": "TX",
  "432": "TX",
  "434": "VA",
  "435": "UT",
  "440": "OH",
  "442": "CA",
  "443": "MD",
  "458": "OR",
  "469": "TX",
  "470": "GA",
  "475": "CT",
  "478": "GA",
  "479": "AR",
  "480": "AZ",
  "484": "PA",
  "501": "AR",
  "502": "KY",
  "503": "OR",
  "504": "LA",
  "505": "NM",
  "507": "MN",
  "508": "MA",
  "509": "WA",
  "510": "CA",
  "512": "TX",
  "513": "OH",
  "515": "IA",
  "516": "NY",
  "517": "MI",
  "518": "NY",
  "520": "AZ",
  "530": "CA",
  "531": "NE",
  "534": "WI",
  "539": "OK",
  "540": "VA",
  "541": "OR",
  "551": "NJ",
  "559": "CA",
  "561": "FL",
  "562": "CA",
  "563": "IA",
  "567": "OH",
  "570": "PA",
  "571": "VA",
  "573": "MO",
  "574": "IN",
  "575": "NM",
  "580": "OK",
  "585": "NY",
  "586": "MI",
  "601": "MS",
  "602": "AZ",
  "603": "NH",
  "605": "SD",
  "606": "KY",
  "607": "NY",
  "608": "WI",
  "609": "NJ",
  "610": "PA",
  "612": "MN",
  "614": "OH",
  "615": "TN",
  "616": "MI",
  "617": "MA",
  "618": "IL",
  "619": "CA",
  "620": "KS",
  "623": "AZ",
  "626": "CA",
  "628": "CA",
  "629": "TN",
  "630": "IL",
  "631": "NY",
  "636": "MO",
  "641": "IA",
  "646": "NY",
  "650": "CA",
  "651": "MN",
  "657": "CA",
  "660": "MO",
  "661": "CA",
  "662": "MS",
  "667": "MD",
  "669": "CA",
  "678": "GA",
  "681": "WV",
  "682": "TX",
  "689": "FL",
  "701": "ND",
  "702": "NV",
  "703": "VA",
  "704": "NC",
  "706": "GA",
  "707": "CA",
  "708": "IL",
  "712": "IA",
  "713": "TX",
  "714": "CA",
  "715": "WI",
  "716": "NY",
  "717": "PA",
  "718": "NY",
  "719": "CO",
  "720": "CO",
  "724": "PA",
  "725": "NV",
  "727": "FL",
  "731": "TN",
  "732": "NJ",
  "734": "MI",
  "737": "TX",
  "740": "OH",
  "743": "NC",
  "747": "CA",
  "754": "FL",
  "757": "VA",
  "760": "CA",
  "762": "GA",
  "763": "MN",
  "764": "CA",
  "765": "IN",
  "769": "MS",
  "770": "GA",
  "772": "FL",
  "773": "IL",
  "774": "MA",
  "775": "NV",
  "779": "IL",
  "781": "MA",
  "785": "KS",
  "786": "FL",
  "801": "UT",
  "802": "VT",
  "803": "SC",
  "804": "VA",
  "805": "CA",
  "806": "TX",
  "808": "HI",
  "810": "MI",
  "812": "IN",
  "813": "FL",
  "814": "PA",
  "815": "IL",
  "816": "MO",
  "817": "TX",
  "818": "CA",
  "828": "NC",
  "830": "TX",
  "831": "CA",
  "832": "TX",
  "838": "NY",
  "843": "SC",
  "845": "NY",
  "847": "IL",
  "848": "NJ",
  "850": "FL",
  "854": "SC",
  "856": "NJ",
  "857": "MA",
  "858": "CA",
  "859": "KY",
  "860": "CT",
  "862": "NJ",
  "863": "FL",
  "864": "SC",
  "865": "TN",
  "870": "AR",
  "872": "IL",
  "878": "PA",
  "901": "TN",
  "903": "TX",
  "904": "FL",
  "906": "MI",
  "907": "AK",
  "908": "NJ",
  "909": "CA",
  "910": "NC",
  "912": "GA",
  "913": "KS",
  "914": "NY",
  "915": "TX",
  "916": "CA",
  "917": "NY",
  "918": "OK",
  "919": "NC",
  "920": "WI",
  "925": "CA",
  "928": "AZ",
  "929": "NY",
  "931": "TN",
  "936": "TX",
  "937": "OH",
  "938": "AL",
  "940": "TX",
  "941": "FL",
  "947": "MI",
  "949": "CA",
  "951": "CA",
  "952": "MN",
  "954": "FL",
  "956": "TX",
  "959": "CT",
  "970": "CO",
  "971": "OR",
  "972": "TX",
  "973": "NJ",
  "978": "MA",
  "979": "TX",
  "980": "NC",
  "984": "NC",
  "985": "LA",
};
const STATE_NAMES: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  DC: "Washington DC",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  VI: "US Virgin Islands",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
};
const PLAT_COLORS: Record<string, string> = {
  Facebook: "#1877F2",
  Instagram: "#E4405F",
  YouTube: "#FF0000",
  TikTok: "#000000",
  Other: "#767676",
  Unknown: "#767676",
};

// ====== Helpers ======
function extractVisa(text: string): string {
  if (!text) return "Unknown";
  const l = text.toLowerCase();
  for (const [t, kw] of Object.entries(VISA_TYPES)) {
    if (kw.some((k) => l.includes(k))) return t;
  }
  return "Other";
}
function extractState(phone: string): string | null {
  if (!phone) return null;
  const d = phone.replace(/\D/g, "");
  const ac = d.length === 11 && d[0] === "1" ? d.slice(1, 4) : d.length === 10 ? d.slice(0, 3) : "";
  return AREA_CODE_MAP[ac] || null;
}
function normPlat(s: string): string {
  if (!s) return "Unknown";
  const l = s.toLowerCase();
  if (l.includes("facebook") || l.includes("fb")) return "Facebook";
  if (l.includes("instagram") || l.includes("ig")) return "Instagram";
  if (l.includes("youtube") || l.includes("yt")) return "YouTube";
  if (l.includes("tiktok")) return "TikTok";
  return "Other";
}

/** GHL opportunity names: "Contact Name - Case Type" → case type after last " - " */
function extractCaseTypeFromOppName(name: string): string {
  if (!name) return "";
  const idx = name.lastIndexOf(" - ");
  if (idx === -1) return name.trim();
  return name.slice(idx + 3).trim();
}

function ghlOppToOppInfo(opp: GHLOpportunity): OppInfo {
  const rawStage = opp.stageName || "";
  const stage = categorizeStage(rawStage);
  return {
    stage,
    rawStage,
    amount: opp.monetaryValue || 0,
    closeDate: opp.updatedAt || "",
    caseType: extractCaseTypeFromOppName(opp.name || ""),
    name: opp.name || "",
  };
}

/** Post–paid-consult funnel: Agreement Sent or Retained (mirrors SF Awaiting Retainer + Closed Won, excluding Consultation Booked alone). */
function isPaidPlus(category: string): boolean {
  return category === "Agreement Sent" || isRetained(category);
}

/** Lower rank = more advanced (preferred as bestOpp). */
function bestOppRank(category: string): number {
  if (isRetained(category)) return 0;
  if (category === "Agreement Sent") return 1;
  if (category === "Paid Consultation") return 2;
  if (category === "Consultation Booked") return 3;
  return 99;
}

function pickBestOpp(opps: OppInfo[]): OppInfo | undefined {
  if (opps.length === 0) return undefined;
  let best = opps[0];
  let r = bestOppRank(best.stage);
  for (let i = 1; i < opps.length; i++) {
    const ri = bestOppRank(opps[i].stage);
    if (ri < r) {
      r = ri;
      best = opps[i];
    }
  }
  return best;
}

// ====== CSV Parser ======
function parseCSV(raw: string): Record<string, string>[] {
  const csv = raw.replace(/\0/g, "");
  const rows: string[][] = [];
  let cr: string[] = [];
  let cf = "";
  let inQ = false;
  let i = 0;
  while (i < csv.length) {
    const ch = csv[i];
    if (inQ) {
      if (ch === '"') {
        if (csv[i + 1] === '"') {
          cf += '"';
          i += 2;
        } else {
          inQ = false;
          i++;
        }
      } else {
        cf += ch;
        i++;
      }
    } else if (ch === '"') {
      inQ = true;
      i++;
    } else if (ch === ",") {
      cr.push(cf);
      cf = "";
      i++;
    } else if (ch === "\r" || ch === "\n") {
      cr.push(cf);
      cf = "";
      rows.push(cr);
      cr = [];
      if (ch === "\r" && csv[i + 1] === "\n") i += 2;
      else i++;
    } else {
      cf += ch;
      i++;
    }
  }
  if (cf || cr.length) {
    cr.push(cf);
    rows.push(cr);
  }
  if (rows.length < 2) return [];
  const hd = rows[0].map((h) => h.trim());
  const out: Record<string, string>[] = [];
  for (let r = 1; r < rows.length; r++) {
    if (rows[r].length < 2) continue;
    const o: Record<string, string> = {};
    for (let c = 0; c < hd.length; c++) o[hd[c]] = (rows[r][c] ?? "").trim();
    out.push(o);
  }
  return out;
}

async function fetchSheet(sheetId: string, gid: string, range: string): Promise<Record<string, string>[]> {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}&range=${encodeURIComponent(range)}`;
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(25000), redirect: "follow" });
  if (!res.ok) return [];
  const text = await res.text();
  if (text.trimStart().startsWith("<!")) return [];
  return parseCSV(text);
}

// ====== Caches ======
interface OppInfo {
  stage: string;
  rawStage: string;
  amount: number;
  closeDate: string;
  caseType: string;
  name: string;
}

interface ScoringWithGHL {
  ghlId: string;
  name: string;
  phone: string;
  phoneOrigin: string;
  score: number;
  leadSource: string;
  dateCreated: string;
  opps: OppInfo[];
}

let scoringGHLCache: { data: ScoringWithGHL[]; ts: number } | null = null;
const SCORING_GHL_TTL = 30 * 60 * 1000;
const resCache = new Map<string, { data: CommBookData; ts: number }>();
const RES_TTL = 5 * 60 * 1000;
let warmInProgress = false;

async function getScoringGHLData(): Promise<ScoringWithGHL[]> {
  if (scoringGHLCache && Date.now() - scoringGHLCache.ts < SCORING_GHL_TTL) return scoringGHLCache.data;
  if (warmInProgress) return scoringGHLCache?.data || [];
  warmInProgress = true;

  try {
    const [scorAD, scorFH, scorJL, allOpps] = await Promise.all([
      fetchSheet(SCORING_SHEET_ID, "0", "A:D"),
      fetchSheet(SCORING_SHEET_ID, "0", "F:H"),
      fetchSheet(SCORING_SHEET_ID, "0", "J:L"),
      getAllOpportunities(),
    ]);

    const byContactId = new Map<string, GHLOpportunity[]>();
    for (const opp of allOpps) {
      const cid = opp.contact?.id?.trim();
      if (!cid) continue;
      if (!byContactId.has(cid)) byContactId.set(cid, []);
      byContactId.get(cid)!.push(opp);
    }

    console.log(`[CB] GHL: ${allOpps.length} opportunities, ${byContactId.size} contacts with opps`);

    const scoringRows: {
      ghlId: string;
      name: string;
      score: number;
      phone: string;
      phoneOrigin: string;
      leadSource: string;
      dateCreated: string;
    }[] = [];
    const len = Math.min(scorAD.length, scorFH.length, scorJL.length);

    for (let i = 0; i < len; i++) {
      const ghlId = (scorAD[i]["ID"] || "").trim();
      if (!ghlId) continue;
      scoringRows.push({
        ghlId,
        name: `${scorAD[i]["First Name"] || ""} ${scorAD[i]["Last Name"] || ""}`.trim(),
        score: parseInt((scorAD[i]["Score"] || "").split("|")[0].trim(), 10) || 0,
        phone: (scorJL[i]["phone number"] || "").trim(),
        phoneOrigin: (scorFH[i]["Phone Origin"] || "").trim(),
        leadSource: (scorFH[i]["Lead Source"] || "").trim(),
        dateCreated: (scorFH[i]["Date Created"] || "").trim(),
      });
    }

    const result: ScoringWithGHL[] = scoringRows.map((sr) => {
      const rawOpps = byContactId.get(sr.ghlId) || [];
      const opps = rawOpps.map(ghlOppToOppInfo);
      return { ...sr, opps };
    });

    const withOpps = result.filter((r) => r.opps.length > 0).length;
    console.log(`[CB] Scoring+GHL: ${result.length} total, ${withOpps} with opps`);

    scoringGHLCache = { data: result, ts: Date.now() };
    return result;
  } catch (e) {
    console.error("[CB] Scoring+GHL error:", e);
    return scoringGHLCache?.data || [];
  } finally {
    warmInProgress = false;
  }
}

// ====== Main Engine ======

export async function computeCommBookData(startDate?: string, endDate?: string): Promise<CommBookData> {
  // 1. Try pre-computed cache first
  const cached = await getCachedData(startDate, endDate);
  if (cached) return cached;

  console.log(`[CB] Cache miss, falling back to live query (start=${startDate}, end=${endDate})`);

  // 2. Check in-memory result cache
  const cacheKey = `cb:${startDate || "all"}:${endDate || "all"}`;
  const memCached = resCache.get(cacheKey);
  if (memCached && Date.now() - memCached.ts < RES_TTL) return memCached.data;

  const t0 = Date.now();

  const [fbIg, yt] = await Promise.all([
    fetchSheet(COMMENTS_SHEET_ID, "0", "K:P"),
    fetchSheet(COMMENTS_SHEET_ID, "757216095", "K:P"),
  ]);

  const scoringGHL = await getScoringGHLData();
  const t1 = Date.now();

  const allComments: Record<string, string>[] = [...fbIg, ...yt];
  const startMs = startDate ? new Date(startDate).getTime() : 0;
  const endMs = endDate ? new Date(endDate + "T23:59:59").getTime() : Infinity;
  const doDateFilter = !!(startDate || endDate);

  let totalComments = 0;
  let dmsSent = 0;
  const postMap = new Map<string, { url: string; plat: string; date: string; c: number }>();
  const commentPlatCounts = new Map<string, { c: number; d: number }>();
  const commentVisaCounts = new Map<string, number>();

  for (const c of allComments) {
    const d = c["Last Comment Date"] || c["Date Created"] || "";
    if (doDateFilter) {
      if (!d) continue;
      const t = new Date(d).getTime();
      if (isNaN(t) || t < startMs || t > endMs) continue;
    }
    totalComments++;
    const dm = (c["DM Action"] || "").toUpperCase() === "TRUE";
    if (dm) dmsSent++;

    const plat = normPlat(c["Lead Source"] || "");
    const pc = commentPlatCounts.get(plat) || { c: 0, d: 0 };
    pc.c++;
    if (dm) pc.d++;
    commentPlatCounts.set(plat, pc);

    const url = (c["Post URL"] || "").trim();
    if (url) {
      const e = postMap.get(url) || { url, plat, date: d, c: 0 };
      e.c++;
      postMap.set(url, e);
    }

    // Visa extraction deferred to GHL join (Comment History not fetched for speed)
  }

  let filteredScoring = scoringGHL;
  if (doDateFilter) {
    filteredScoring = scoringGHL.filter((s) => {
      if (s.dateCreated) {
        const t = new Date(s.dateCreated).getTime();
        if (!isNaN(t) && t >= startMs && t <= endMs) return true;
      }
      for (const opp of s.opps) {
        if (opp.closeDate) {
          const t = new Date(opp.closeDate).getTime();
          if (!isNaN(t) && t >= startMs && t <= endMs) return true;
        }
      }
      if (!s.dateCreated && s.opps.length === 0) return true;
      return false;
    });
  }

  const leadsScored = filteredScoring.filter((s) => s.score > 0).length;

  interface ScoringOppResult {
    scoring: ScoringWithGHL;
    bestOpp?: OppInfo;
  }

  const scoringResults: ScoringOppResult[] = filteredScoring.map((s) => {
    if (s.opps.length === 0) return { scoring: s };
    return { scoring: s, bestOpp: pickBestOpp(s.opps) };
  });

  const booked = scoringResults.filter((r) => r.bestOpp && isBookingPlus(r.bestOpp.stage)).length;
  const paid = scoringResults.filter((r) => r.bestOpp && isPaidPlus(r.bestOpp.stage)).length;
  const retained = scoringResults.filter((r) => r.bestOpp && isRetained(r.bestOpp.stage)).length;
  const revenue = scoringResults
    .filter((r) => r.bestOpp && isRetained(r.bestOpp.stage) && r.bestOpp.amount > 0)
    .reduce((s, r) => s + (r.bestOpp?.amount || 0), 0);

  const hero = {
    commBookRate: totalComments > 0 ? (booked / totalComments) * 100 : 0,
    totalComments,
    totalBookings: booked,
    totalRetainers: retained,
    totalRevenue: revenue,
  };

  const funnel = [
    { stage: "Comments", count: totalComments, rate: 100 },
    { stage: "Legit Lead", count: dmsSent, rate: totalComments > 0 ? (dmsSent / totalComments) * 100 : 0 },
    { stage: "AI Scored", count: leadsScored, rate: totalComments > 0 ? (leadsScored / totalComments) * 100 : 0 },
    { stage: "Consultation Booked", count: booked, rate: leadsScored > 0 ? (booked / leadsScored) * 100 : 0 },
    { stage: "Awaiting Retainer", count: paid, rate: booked > 0 ? (paid / booked) * 100 : 0 },
    { stage: "Retainer Signed", count: retained, rate: paid > 0 ? (retained / paid) * 100 : 0 },
  ];

  const topPosts = Array.from(postMap.values())
    .sort((a, b) => b.c - a.c)
    .slice(0, 20)
    .map((p) => ({ postUrl: p.url, platform: p.plat, date: p.date, totalComments: p.c, bookings: 0, commBookRate: 0 }));

  const platBookings = new Map<string, { s: number; b: number; r: number; rev: number }>();
  for (const sr of scoringResults) {
    const plat = normPlat(sr.scoring.leadSource);
    const p = platBookings.get(plat) || { s: 0, b: 0, r: 0, rev: 0 };
    if (sr.scoring.score > 0) p.s++;
    if (sr.bestOpp && isBookingPlus(sr.bestOpp.stage)) p.b++;
    if (sr.bestOpp && isRetained(sr.bestOpp.stage)) {
      p.r++;
      if (sr.bestOpp.amount > 0) p.rev += sr.bestOpp.amount;
    }
    platBookings.set(plat, p);
  }

  const allPlats = new Set<string>();
  commentPlatCounts.forEach((_, k) => allPlats.add(k));
  platBookings.forEach((_, k) => allPlats.add(k));

  const platforms = Array.from(allPlats)
    .map((name) => {
      const cc = commentPlatCounts.get(name) || { c: 0, d: 0 };
      const pb = platBookings.get(name) || { s: 0, b: 0, r: 0, rev: 0 };
      return {
        platform: name,
        color: PLAT_COLORS[name] || "#767676",
        totalComments: cc.c,
        dmsStarted: cc.d,
        leadsScored: pb.s,
        consultationsBooked: pb.b,
        retainersSigned: pb.r,
        commBookRate: cc.c > 0 ? (pb.r / cc.c) * 100 : 0,
        revenue: pb.rev,
      };
    })
    .sort((a, b) => b.totalComments - a.totalComments);

  const visaAgg = new Map<string, { comments: number; scored: number; booked: number; retained: number; revenue: number }>();
  commentVisaCounts.forEach((count, visa) => {
    const v = visaAgg.get(visa) || { comments: 0, scored: 0, booked: 0, retained: 0, revenue: 0 };
    v.comments += count;
    visaAgg.set(visa, v);
  });
  for (const sr of scoringResults) {
    let visa = "Unknown";
    if (sr.bestOpp?.caseType)
      visa = sr.bestOpp.caseType.toLowerCase().includes("immigration") ? extractVisa(sr.scoring.name) : sr.bestOpp.caseType;
    if (visa === "Unknown" || visa === "Other") continue;
    const v = visaAgg.get(visa) || { comments: 0, scored: 0, booked: 0, retained: 0, revenue: 0 };
    if (sr.scoring.score > 0) v.scored++;
    if (sr.bestOpp && isBookingPlus(sr.bestOpp.stage)) v.booked++;
    if (sr.bestOpp && isRetained(sr.bestOpp.stage)) {
      v.retained++;
      if (sr.bestOpp.amount > 0) v.revenue += sr.bestOpp.amount;
    }
    visaAgg.set(visa, v);
  }

  const visaTypes = Array.from(visaAgg.entries())
    .filter(([, d]) => d.comments >= 3 || d.booked > 0)
    .map(([n, d]) => ({
      visaType: n,
      comments: d.comments,
      leadsScored: d.scored,
      bookings: d.booked,
      retainers: d.retained,
      commBookRate: d.comments > 0 ? (d.retained / d.comments) * 100 : 0,
      avgRetainerValue: d.retained > 0 ? d.revenue / d.retained : 0,
      totalRevenue: d.revenue,
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue || b.bookings - a.bookings || b.comments - a.comments);

  const geoMap = new Map<string, { c: number; b: number; r: number; rev: number }>();
  for (const sr of scoringResults) {
    const st = extractState(sr.scoring.phone);
    const region = st ? STATE_NAMES[st] || st : sr.scoring.phoneOrigin === "international" ? "International" : null;
    if (!region) continue;
    const g = geoMap.get(region) || { c: 0, b: 0, r: 0, rev: 0 };
    g.c++;
    if (sr.bestOpp && isBookingPlus(sr.bestOpp.stage)) g.b++;
    if (sr.bestOpp && isRetained(sr.bestOpp.stage)) {
      g.r++;
      if (sr.bestOpp.amount > 0) g.rev += sr.bestOpp.amount;
    }
    geoMap.set(region, g);
  }
  const geographic = Array.from(geoMap.entries())
    .filter(([, d]) => d.c >= 2)
    .map(([n, d]) => ({
      region: n,
      comments: d.c,
      bookings: d.b,
      retainers: d.r,
      commBookRate: d.c > 0 ? (d.r / d.c) * 100 : 0,
      revenue: d.rev,
    }))
    .sort((a, b) => b.revenue - a.revenue || b.retainers - a.retainers || b.comments - a.comments);

  const revenueAttribution = scoringResults
    .filter((r) => r.bestOpp && isRetained(r.bestOpp.stage) && r.bestOpp.amount > 0)
    .sort((a, b) => (b.bestOpp?.amount || 0) - (a.bestOpp?.amount || 0))
    .slice(0, 50)
    .map((r) => ({
      name: r.scoring.name || r.bestOpp?.name || "Unknown",
      amount: r.bestOpp?.amount || 0,
      visaType: r.bestOpp?.caseType || "Immigration",
      platform: normPlat(r.scoring.leadSource),
      postUrl: "",
      postDate: r.scoring.dateCreated,
      commentScore: Math.min(r.scoring.score, 4),
      consultationDate: "",
      retainerDate: r.bestOpp?.closeDate || "",
    }));

  const result: CommBookData = {
    lastUpdated: new Date().toISOString(),
    hero,
    funnel,
    topPosts,
    platforms,
    visaTypes,
    geographic,
    revenueAttribution,
    debug: {
      source: "live-query",
      totalComments,
      fetchMs: t1 - t0,
      totalMs: Date.now() - t0,
      scoringRows: filteredScoring.length,
      scoringWithOpps: scoringResults.filter((r) => r.bestOpp).length,
      ghlCacheAge: scoringGHLCache ? Math.round((Date.now() - scoringGHLCache.ts) / 1000) : -1,
      dms: dmsSent,
      scored: leadsScored,
      booked,
      paid,
      retained,
      revenue,
    },
  };

  resCache.set(cacheKey, { data: result, ts: Date.now() });
  return result;
}

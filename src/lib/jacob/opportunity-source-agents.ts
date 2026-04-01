import { normalizeSource } from "@/lib/normalize-source";

/**
 * Map GHL opportunity `source` (raw string from API) to the setter/closer who owns that channel.
 *
 * Set env JACOB_SOURCE_AGENT_JSON to a JSON object, e.g.:
 * {"Facebook":"Juan","fb lead form":"Juan","Brad Show Live":"Adriana","Website":"Leo"}
 *
 * Lookup order (first hit wins):
 * 1) Exact source string from GHL (case-insensitive key)
 * 2) normalizeSource(opp.source) as key (case-insensitive)
 * 3) Lead channel label already computed for the row (case-insensitive)
 */
function normKey(k: string): string {
  return k.trim().toLowerCase();
}

export function getOpportunitySourceAgentMap(): Map<string, string> {
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
    console.warn("[jacob/source-agents] JACOB_SOURCE_AGENT_JSON is not valid JSON");
    return new Map();
  }
}

export function resolveAssignedAgentFromOpportunitySource(
  opportunitySourceRaw: string,
  leadChannelLabel: string,
  sourceAgentMap: Map<string, string>,
  ghlAssigneeFallback: string,
): string {
  if (sourceAgentMap.size === 0) return ghlAssigneeFallback;

  const raw = (opportunitySourceRaw || "").trim();
  if (raw) {
    const byRaw = sourceAgentMap.get(normKey(raw));
    if (byRaw) return byRaw;
    const normalized = normalizeSource(raw);
    const byNorm = sourceAgentMap.get(normKey(normalized));
    if (byNorm) return byNorm;
  }

  const byChannel = sourceAgentMap.get(normKey(leadChannelLabel));
  if (byChannel) return byChannel;

  return ghlAssigneeFallback;
}

export function isSourceAgentMapConfigured(): boolean {
  return getOpportunitySourceAgentMap().size > 0;
}

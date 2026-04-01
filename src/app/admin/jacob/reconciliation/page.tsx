"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Breadcrumb } from "../../leads/_components";

type AgentSummary = {
  agent: string;
  assignedLeads: number;
  called: number;
  notCalled: number;
  coveragePct: number;
};

type Detail = {
  contactId: string;
  contactName: string;
  assignedAgent: string;
  leadSourceChannel: string;
  stageName: string;
  scoreBucket: string;
  callsLast7Days: number;
  lastCallAt: string | null;
  calledRecently: boolean;
  sourceSystem: string;
  consultationBooked: boolean;
};

type ChannelRow = {
  source: string;
  leadsAssigned: number;
  callsMade: number;
  consultationsBooked: number;
  conversionPct: number;
};

export default function JacobReconciliationPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [summary, setSummary] = useState<AgentSummary[]>([]);
  const [details, setDetails] = useState<Detail[]>([]);
  const [channels, setChannels] = useState<ChannelRow[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string>("");
  const [agentFilter, setAgentFilter] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (agentFilter.trim()) p.set("agent", agentFilter.trim());
    if (channelFilter.trim()) p.set("channel", channelFilter.trim());
    const s = p.toString();
    return s ? `?${s}` : "";
  }, [agentFilter, channelFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/jacob/reconciliation${qs}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setSummary(data.summary || []);
      setDetails(data.details || []);
      setChannels(data.channelBreakdown || []);
      setGeneratedAt(data.generatedAt || "");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [qs]);

  useEffect(() => {
    load();
  }, [load]);

  const runSync = async () => {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/jacob/reconciliation/sync", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setSyncMsg(data.message || "Synced.");
      await load();
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-8 max-w-[1400px]">
      <div>
        <Breadcrumb items={["Jacob (H1B)", "Assigned vs Called"]} />
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
          Assigned vs Called — Warm / Hot reconciliation
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          GHL pipeline (Qualified + Hot Lead) vs outbound calls in the call log
          (last 7 days). Filter by agent or channel for Karima’s SOP.
        </p>
        {generatedAt && (
          <p className="text-xs text-gray-400 mt-2">
            Last built: {new Date(generatedAt).toLocaleString()}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-[10px] uppercase text-gray-400 mb-1">
            Agent contains
          </label>
          <input
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
            placeholder="e.g. Juan"
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-48"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase text-gray-400 mb-1">
            Channel contains
          </label>
          <input
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            placeholder="e.g. Facebook"
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-48"
          />
        </div>
        <button
          type="button"
          onClick={() => load()}
          disabled={loading}
          className="rounded-lg bg-gray-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-50 cursor-pointer"
        >
          {loading ? "Loading…" : "Apply filters"}
        </button>
        <button
          type="button"
          onClick={runSync}
          disabled={syncing}
          className="rounded-lg border border-indigo-300 text-indigo-700 px-4 py-2 text-sm font-medium disabled:opacity-50 cursor-pointer bg-white"
        >
          {syncing ? "Syncing…" : "Push to Sheets tab"}
        </button>
      </div>
      {err && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">
          {err}
        </div>
      )}
      {syncMsg && (
        <div className="text-sm text-indigo-800 bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-3">
          {syncMsg}
        </div>
      )}

      <section className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 font-semibold text-gray-900">
          Agent coverage
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-500">
                <th className="px-4 py-2 font-medium">Agent</th>
                <th className="px-4 py-2 font-medium">Assigned</th>
                <th className="px-4 py-2 font-medium">Called</th>
                <th className="px-4 py-2 font-medium">Not called</th>
                <th className="px-4 py-2 font-medium">% Coverage</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((s) => (
                <tr key={s.agent} className="border-t border-gray-100">
                  <td className="px-4 py-2 font-medium">{s.agent}</td>
                  <td className="px-4 py-2">{s.assignedLeads}</td>
                  <td className="px-4 py-2 text-green-700">{s.called}</td>
                  <td className="px-4 py-2 text-red-600">{s.notCalled}</td>
                  <td className="px-4 py-2">{s.coveragePct}%</td>
                </tr>
              ))}
              {!loading && summary.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-gray-400" colSpan={5}>
                    No warm/hot opportunities returned from GHL.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 font-semibold text-gray-900">
          Channel snapshot (filtered cohort)
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-500">
                <th className="px-4 py-2 font-medium">Source</th>
                <th className="px-4 py-2 font-medium">Leads assigned</th>
                <th className="px-4 py-2 font-medium">Calls (7d)</th>
                <th className="px-4 py-2 font-medium">Consult booked</th>
                <th className="px-4 py-2 font-medium">Conversion %</th>
              </tr>
            </thead>
            <tbody>
              {channels.map((c) => (
                <tr key={c.source} className="border-t border-gray-100">
                  <td className="px-4 py-2">{c.source}</td>
                  <td className="px-4 py-2">{c.leadsAssigned}</td>
                  <td className="px-4 py-2">{c.callsMade}</td>
                  <td className="px-4 py-2">{c.consultationsBooked}</td>
                  <td className="px-4 py-2">{c.conversionPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 font-semibold text-gray-900">
          Lead detail
        </div>
        <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50">
              <tr className="text-left text-gray-500">
                <th className="px-3 py-2 font-medium">Agent</th>
                <th className="px-3 py-2 font-medium">Channel</th>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Stage</th>
                <th className="px-3 py-2 font-medium">7d calls</th>
                <th className="px-3 py-2 font-medium">Src</th>
              </tr>
            </thead>
            <tbody>
              {details.map((d) => (
                <tr key={d.contactId} className="border-t border-gray-100">
                  <td className="px-3 py-2 whitespace-nowrap">{d.assignedAgent}</td>
                  <td className="px-3 py-2">{d.leadSourceChannel}</td>
                  <td className="px-3 py-2">{d.contactName}</td>
                  <td className="px-3 py-2 text-xs max-w-[200px] truncate" title={d.stageName}>
                    {d.stageName}
                  </td>
                  <td className="px-3 py-2">
                    <span className={d.calledRecently ? "text-green-700" : "text-red-600"}>
                      {d.callsLast7Days}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs">{d.sourceSystem}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

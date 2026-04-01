"use client";

import { useEffect, useState } from "react";
import { Breadcrumb } from "../../leads/_components";

type LB = {
  closer: string;
  callsMade: number;
  agreementsSent: number;
  agreementsSigned: number;
  casesClosed: number;
  aiScoreAvg: number | null;
};

export default function JacobClosersScoringPage() {
  const [rows, setRows] = useState<LB[]>([]);
  const [prompt, setPrompt] = useState<string>("");
  const [note, setNote] = useState<string>("");

  useEffect(() => {
    fetch("/api/jacob/closers-scoring/leaderboard")
      .then((r) => r.json())
      .then((d) => {
        setRows(d.leaderboard || []);
        setPrompt(d.promptPlaceholder || "");
        setNote(d.note || "");
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-8 max-w-[1100px]">
      <div>
        <Breadcrumb items={["Jacob (H1B)", "Closers scoring"]} />
        <h1 className="text-2xl font-bold text-gray-900">Closers call scoring</h1>
        <p className="text-sm text-gray-500 mt-1">
          Duplicate of setter scoring structure: weighted on needs, urgency,
          affordability, agreement sent, objections. Source column tracks GHL
          vs RingCentral during migration.
        </p>
        {note && <p className="text-xs text-amber-700 mt-2">{note}</p>}
      </div>

      <div className="flex flex-wrap gap-3">
        <a
          href="/api/jacob/closers-scoring/template"
          className="inline-flex items-center rounded-lg bg-gray-900 text-white px-4 py-2 text-sm font-medium"
        >
          Download CSV template
        </a>
        <p className="text-xs text-gray-500 self-center">
          Create a <strong>Closers Scoring</strong> tab in the intelligence
          workbook and paste headers + rows, or import this CSV.
        </p>
      </div>

      <section className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 font-semibold text-gray-900">
          Closer leaderboard (shell — metrics wire to sheet + GHL)
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-gray-500">
                <th className="px-4 py-2 font-medium">Closer</th>
                <th className="px-4 py-2 font-medium">Calls</th>
                <th className="px-4 py-2 font-medium">Agreements sent</th>
                <th className="px-4 py-2 font-medium">Signed</th>
                <th className="px-4 py-2 font-medium">Cases closed</th>
                <th className="px-4 py-2 font-medium">AI avg</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.closer} className="border-t border-gray-100">
                  <td className="px-4 py-2 font-medium">{r.closer}</td>
                  <td className="px-4 py-2">{r.callsMade}</td>
                  <td className="px-4 py-2">{r.agreementsSent}</td>
                  <td className="px-4 py-2">{r.agreementsSigned}</td>
                  <td className="px-4 py-2">{r.casesClosed}</td>
                  <td className="px-4 py-2">
                    {r.aiScoreAvg == null ? "—" : r.aiScoreAvg}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
        <h2 className="text-sm font-semibold text-gray-800 mb-2">
          Placeholder AI prompt (Claude sonnet — swap when Melina sends script)
        </h2>
        <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono max-h-64 overflow-y-auto">
          {prompt || "Loading…"}
        </pre>
      </section>
    </div>
  );
}

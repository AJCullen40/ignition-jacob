"use client";

import { useMemo } from "react";
import { Breadcrumb } from "../../leads/_components";

const STAGE_TRIGGER = "Referral Partner";

export default function JacobReferralPartnersAdminPage() {
  const base = useMemo(() => {
    if (typeof window === "undefined") return "";
    return window.location.origin;
  }, []);

  const logUrl = `${base}/api/jacob/referral-partners/log`;
  const publicPageUrl = `${base}/referral-partners`;

  return (
    <div className="max-w-3xl">
      <Breadcrumb items={["Jacob (H1B)", "Referral partners"]} />

      <h1 className="mt-4 text-2xl font-semibold text-gray-900">
        Referral partners — GHL stage + n8n
      </h1>
      <p className="mt-2 text-sm text-gray-600">
        Link a GHL workflow to the <strong>{STAGE_TRIGGER}</strong> opportunity
        stage, forward the payload to n8n, then log each event to Sheets via
        the API below. Call scoring workflows stay out of scope for now.
      </p>

      <section className="mt-8 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Public page</h2>
        <p className="mt-1 text-sm text-gray-600">
          Partners and staff can open the marketing-facing page (no login):
        </p>
        <a
          href="/referral-partners"
          className="mt-2 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-800"
        >
          {publicPageUrl || "/referral-partners"}
        </a>
      </section>

      <section className="mt-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">
          1. Google Sheet tab
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          In the same intelligence workbook as reconciliation, create a tab
          named <code className="rounded bg-gray-100 px-1">Referral Partner Log</code>{" "}
          (or set <code className="rounded bg-gray-100 px-1">JACOB_REFERRAL_PARTNER_TAB_NAME</code>).
          Header row:
        </p>
        <pre className="mt-3 overflow-x-auto rounded bg-gray-50 p-3 text-xs text-gray-800">
          Received (UTC) | Event | GHL Contact ID | GHL Opportunity ID |
          Contact Name | Stage Name | Opportunity Source | Notes | Raw JSON
        </pre>
      </section>

      <section className="mt-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">
          2. GHL workflow (trigger)
        </h2>
        <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-gray-600">
          <li>
            <strong>Trigger:</strong> Opportunity — stage changed (or your
            closest equivalent).
          </li>
          <li>
            <strong>Condition:</strong> New stage name contains or equals{" "}
            <code className="rounded bg-gray-100 px-1">{STAGE_TRIGGER}</code>.
          </li>
          <li>
            <strong>Action:</strong> Custom webhook → POST to your n8n webhook
            URL (import{" "}
            <code className="rounded bg-gray-100 px-1">
              n8n/jacob-referral-partner-stage.json
            </code>{" "}
            on pilot.ignitionsystems.io and use the generated webhook path).
          </li>
        </ol>
      </section>

      <section className="mt-6 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">
          3. Log endpoint (n8n → Ignition)
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Set <code className="rounded bg-gray-100 px-1">JACOB_REFERRAL_PARTNER_WEBHOOK_SECRET</code>{" "}
          in Vercel and in n8n env. n8n HTTP node:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-600">
          <li>
            <strong>POST</strong>{" "}
            <code className="break-all rounded bg-gray-100 px-1 text-xs">
              {logUrl || "…/api/jacob/referral-partners/log"}
            </code>
          </li>
          <li>
            Header{" "}
            <code className="rounded bg-gray-100 px-1">
              Authorization: Bearer &lt;JACOB_REFERRAL_PARTNER_WEBHOOK_SECRET&gt;
            </code>
          </li>
          <li>JSON body: see type in repo under referral-partner-log-types</li>
        </ul>
      </section>

      <section className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-5">
        <h2 className="text-sm font-semibold text-amber-900">GHL payload shape</h2>
        <p className="mt-1 text-sm text-amber-900/90">
          Workflow payloads vary by GHL version and trigger. The bundled n8n
          workflow uses a Code node with common field guesses — adjust the
          mapping once you inspect one real execution in n8n.
        </p>
      </section>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Referral partners | Revenue Radar",
  description:
    "Information for referral partners working with Jacob Sapochnick’s immigration practice.",
};

export default function ReferralPartnersPage() {
  return (
    <div
      className="min-h-screen text-white"
      style={{
        background: "linear-gradient(180deg, #0f0f17 0%, #1a1a24 100%)",
      }}
    >
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <span className="text-sm font-semibold tracking-tight">
            Referral partners
          </span>
          <Link
            href="/login"
            className="text-xs text-white/60 hover:text-white transition-colors"
          >
            Team sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Partner referrals
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-white/75">
          This page is the public home for your referral program. When a lead is
          qualified in our CRM and moved to the{" "}
          <strong className="text-white/90">Referral Partner</strong> pipeline
          stage, our automation records the event and your team can follow your
          internal playbook (setter assignment, outreach, and tracking).
        </p>
        <p className="mt-4 text-sm leading-relaxed text-white/75">
          For questions about submissions, agreements, or co-marketing, contact
          your Ignition or firm coordinator — this site does not collect partner
          applications on its own unless a form is added here later.
        </p>

        <section
          className="mt-10 rounded-xl border border-white/10 bg-white/[0.03] p-6"
          aria-labelledby="ops-heading"
        >
          <h2
            id="ops-heading"
            className="text-sm font-semibold uppercase tracking-wider text-white/50"
          >
            Operations note
          </h2>
          <p className="mt-2 text-sm text-white/70">
            GHL should run a workflow when an opportunity enters the stage that
            matches <strong className="text-white/90">Referral Partner</strong>{" "}
            (exact spelling as in your pipeline). That workflow calls n8n,
            which posts to the secured log endpoint so rows appear in the
            intelligence Google Sheet tab{" "}
            <code className="rounded bg-black/30 px-1.5 py-0.5 text-xs">
              Referral Partner Log
            </code>
            .
          </p>
        </section>
      </main>
    </div>
  );
}

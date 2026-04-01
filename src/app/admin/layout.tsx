"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";

interface NavSection {
  label: string;
  icon: React.ReactNode;
  defaultOpen: boolean;
  links: { label: string; href: string }[];
}

const sections: NavSection[] = [
  {
    label: "Revenue",
    icon: (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
    defaultOpen: true,
    links: [
      { label: "Revenue Radar", href: "/admin/revenue" },
    ],
  },
  {
    label: "Lead Intelligence",
    icon: (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
    defaultOpen: false,
    links: [
      { label: "Overview", href: "/admin/leads" },
      { label: "Source Attribution", href: "/admin/leads/sources" },
      { label: "Pipeline", href: "/admin/leads/pipeline" },
      { label: "Lead Explorer", href: "/admin/leads/explorer" },
      { label: "Score Intelligence", href: "/admin/leads/scores" },
      { label: "Revenue Attribution", href: "/admin/leads/revenue" },
      { label: "Paid Media", href: "/admin/leads/paid-media" },
    ],
  },
  {
    label: "Jacob (H1B)",
    icon: (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    defaultOpen: true,
    links: [
      { label: "Assigned vs Called", href: "/admin/jacob/reconciliation" },
      { label: "Closers scoring", href: "/admin/jacob/closers-scoring" },
    ],
  },
  {
    label: "CommBook",
    icon: (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
      </svg>
    ),
    defaultOpen: false,
    links: [
      { label: "Overview", href: "/admin/commbook" },
      { label: "Content Performance", href: "/admin/commbook/content" },
      { label: "Attribution", href: "/admin/commbook/attribution" },
      { label: "Lead Explorer", href: "/admin/commbook/explorer" },
    ],
  },
];

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        transition: "transform 200ms ease",
        transform: open ? "rotate(90deg)" : "rotate(0deg)",
      }}
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function SidebarSection({
  section,
  pathname,
}: {
  section: NavSection;
  pathname: string;
}) {
  const [open, setOpen] = useState(section.defaultOpen);
  const isActive = section.links.some((l) => pathname === l.href);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-2 cursor-pointer"
      >
        <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#6b7280]">
          <span className={isActive ? "text-[#818cf8]" : ""}>{section.icon}</span>
          {section.label}
        </span>
        <span className="text-[#6b7280]">
          <Chevron open={open} />
        </span>
      </button>

      <div
        style={{
          maxHeight: open ? `${section.links.length * 36}px` : "0px",
          transition: "max-height 250ms ease, opacity 200ms ease",
          opacity: open ? 1 : 0,
          overflow: "hidden",
        }}
      >
        {section.links.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`block px-4 py-[7px] text-sm transition-colors ${
                active
                  ? "text-white border-l-2 border-[#818cf8] bg-white/[0.04] pl-[14px]"
                  : "text-[#9ca3af] hover:text-[#d1d5db] border-l-2 border-transparent pl-[14px]"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside
        className="flex flex-col justify-between shrink-0"
        style={{
          width: 250,
          background: "#0f0f17",
          borderRight: "1px solid #1e1e2e",
        }}
      >
        <div>
          {/* Brand */}
          <div className="flex items-center gap-3 px-4 py-5">
            <div
              className="flex items-center justify-center rounded-lg text-xs font-bold text-white"
              style={{
                width: 32,
                height: 32,
                background: "linear-gradient(135deg, #6366f1, #a855f7)",
              }}
            >
              IP
            </div>
            <div>
              <div className="text-sm font-semibold text-white">Ignition</div>
              <div className="text-[11px] text-[#6b7280]">
                Intelligence Platform
              </div>
            </div>
          </div>

          <div
            className="mx-4 mb-3"
            style={{ borderTop: "1px solid #1e1e2e" }}
          />

          {/* Nav sections */}
          <nav className="flex flex-col gap-1">
            {sections.map((section) => (
              <SidebarSection
                key={section.label}
                section={section}
                pathname={pathname}
              />
            ))}
          </nav>
        </div>

        {/* User info */}
        <div className="px-4 py-4" style={{ borderTop: "1px solid #1e1e2e" }}>
          {session?.user?.email && (
            <div className="mb-2 truncate text-xs text-[#6b7280]">
              {session.user.email}
            </div>
          )}
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="text-xs text-[#9ca3af] hover:text-white transition-colors cursor-pointer"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-8 bg-gray-50">{children}</main>
    </div>
  );
}

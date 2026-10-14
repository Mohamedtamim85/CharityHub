"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Overview" },
  { href: "/cases", label: "Cases" },
  { href: "/donors", label: "Donors" },
  { href: "/sponsorships", label: "Periodic" },
  { href: "/occasions", label: "Occasions" },
  { href: "/zakat", label: "Zakat Calculator" },
  { href: "/hubs", label: "Hubs" },
];

export default function DonationsSubNav() {
  const pathname = usePathname();
  return (
    <div className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200">
      {TABS.map((tab) => {
        const active = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${
              active ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

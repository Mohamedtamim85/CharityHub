import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import DonationsSubNav from "@/components/DonationsSubNav";
import { caseSummaryInclude, crossHubFlags, hubsVisibleTo, manageableHubs, summarizeCase } from "@/lib/donations";
import { CATEGORY_LABELS, GRADE_STYLES, STATUS_LABELS } from "@/lib/donation-calc";
import { formatEgp } from "@/lib/format";

const selectClass = "rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none";
const STATUSES = ["PENDING", "ACTIVE", "FUNDED", "CLOSED"] as const;

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; hub?: string; status?: string; category?: string; zakat?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { q = "", hub = "", status = "open", category = "", zakat = "" } = await searchParams;
  const where: Prisma.DonationCaseWhereInput = {
    hub: hubsVisibleTo(session.userId),
    ...(hub && { hubId: hub }),
    ...(status === "open"
      ? { status: { in: ["PENDING", "ACTIVE"] } }
      : (STATUSES as readonly string[]).includes(status)
        ? { status: status as (typeof STATUSES)[number] }
        : {}),
    ...(category && { category: category as Prisma.EnumDonationCaseCategoryFilter["equals"] }),
    ...(zakat === "yes" && { zakatCategory: { not: null } }),
    ...(q && {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { mobile: { contains: q } },
        { nationalId: { contains: q } },
        { governorate: { contains: q, mode: "insensitive" } },
        { city: { contains: q, mode: "insensitive" } },
      ],
    }),
  };
  const [cases, hubs, managed] = await Promise.all([
    prisma.donationCase.findMany({ where, include: caseSummaryInclude, orderBy: [{ status: "asc" }, { createdAt: "desc" }] }),
    prisma.donationHub.findMany({ where: hubsVisibleTo(session.userId), select: { id: true, name: true }, orderBy: { name: "asc" } }),
    manageableHubs(session.userId),
  ]);
  const flagged = await crossHubFlags(cases);

  return (
    <AppShell userName={session.name}>
      <h1 className="mb-4 text-2xl font-semibold text-slate-900">Donation Hub</h1>
      <DonationsSubNav />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-900">Cases</h2>
        {managed.length > 0 && (
          <Link href="/cases/new" className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover">
            + New Case
          </Link>
        )}
      </div>
      <form method="get" className="mb-4 flex flex-wrap items-center gap-2">
        <input name="q" defaultValue={q} placeholder="Search name, mobile, ID, area" className={`${selectClass} w-full sm:w-64`} />
        <select name="hub" defaultValue={hub} className={selectClass}>
          <option value="">All hubs</option>
          {hubs.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={status} className={selectClass}>
          <option value="open">Open (pending + active)</option>
          <option value="all">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select name="category" defaultValue={category} className={selectClass}>
          <option value="">Any category</option>
          {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <select name="zakat" defaultValue={zakat} className={selectClass}>
          <option value="">Zakat & sadaqah</option>
          <option value="yes">Zakat-eligible only</option>
        </select>
        <button type="submit" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Filter
        </button>
        <span className="ml-auto text-sm text-slate-500">{cases.length} case(s)</span>
      </form>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2">Case</th>
              <th className="px-3 py-2">Validity</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Funding</th>
              <th className="px-3 py-2">Visible to</th>
            </tr>
          </thead>
          <tbody>
            {cases.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                  No cases match.
                </td>
              </tr>
            )}
            {cases.map((c) => {
              const s = summarizeCase(c);
              return (
                <tr key={c.id} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2">
                    <Link href={`/cases/${c.id}`} className="font-medium text-slate-900 hover:underline">
                      {c.name}
                    </Link>
                    <p className="text-xs text-slate-400">
                      {[c.city, c.governorate].filter(Boolean).join(", ") || "-"} · {c.hub.name}
                    </p>
                    {flagged.has(c.id) && <p className="text-xs font-medium text-amber-700">Also registered by another source</p>}
                  </td>
                  <td className="px-3 py-2">
                    {s.grade ? (
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${GRADE_STYLES[s.grade.grade]}`} title={s.grade.label}>
                        {s.grade.grade} · {s.grade.score}%
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">not validated</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {CATEGORY_LABELS[c.category]}
                    {c.zakatCategory && <span className="block text-xs text-green-700">zakat-eligible</span>}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{STATUS_LABELS[c.status]}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {c.fundingType === "ONE_TIME" ? (
                      <>
                        {formatEgp(s.progress.covered)}
                        {s.progress.target !== null && <span className="text-slate-400"> / {formatEgp(s.progress.target)}</span>}
                      </>
                    ) : (
                      <>
                        {formatEgp(s.progress.covered)}
                        <span className="text-slate-400">
                          {s.progress.target !== null && ` / ${formatEgp(s.progress.target)}`} per {c.fundingType === "MONTHLY" ? "month" : "quarter"}
                        </span>
                      </>
                    )}
                    {s.progress.percent !== null && (
                      <div className="mt-1 h-1.5 w-32 rounded bg-slate-100">
                        <div className="h-1.5 rounded bg-brand" style={{ width: `${s.progress.percent}%` }} />
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{c.audience === "CHAIN" ? "Whole chain" : "Private"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}

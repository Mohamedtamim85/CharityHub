import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import DonationsSubNav from "@/components/DonationsSubNav";
import DonorImportForm from "@/components/DonorImportForm";
import { hubsVisibleTo, manageableHubs } from "@/lib/donations";
import { RELATION_LABELS } from "@/lib/donation-calc";
import { formatEgp, toNumber } from "@/lib/format";

const selectClass = "rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none";

export default async function DonorsPage({ searchParams }: { searchParams: Promise<{ q?: string; hub?: string; layer?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { q = "", hub = "", layer = "" } = await searchParams;
  const where: Prisma.DonorWhereInput = {
    hub: hubsVisibleTo(session.userId),
    ...(hub && { hubId: hub }),
    ...(layer && { layer: Number(layer) }),
    ...(q && {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { mobile: { contains: q } },
        { location: { contains: q, mode: "insensitive" } },
      ],
    }),
  };
  const [donors, hubs, managed] = await Promise.all([
    prisma.donor.findMany({
      where,
      include: {
        hub: { select: { name: true } },
        invitedBy: { select: { id: true, name: true } },
        _count: { select: { invitees: true } },
        donations: { select: { amount: true } },
      },
      orderBy: [{ layer: "asc" }, { name: "asc" }],
    }),
    prisma.donationHub.findMany({ where: hubsVisibleTo(session.userId), select: { id: true, name: true }, orderBy: { name: "asc" } }),
    manageableHubs(session.userId),
  ]);
  const importDonors = await prisma.donor.findMany({
    where: { hubId: { in: managed.map((h) => h.id) } },
    select: { id: true, name: true, layer: true, hubId: true },
    orderBy: { name: "asc" },
  });

  return (
    <AppShell userName={session.name}>
      <h1 className="mb-4 text-2xl font-semibold text-slate-900">Donation Hub</h1>
      <DonationsSubNav />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-900">Donors</h2>
        {managed.length > 0 && (
          <Link href="/donors/new" className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover">
            + New Donor
          </Link>
        )}
      </div>
      {managed.length > 0 && <DonorImportForm hubs={managed} donors={importDonors} />}
      <form method="get" className="mb-4 flex flex-wrap items-center gap-2">
        <input name="q" defaultValue={q} placeholder="Search name, mobile, location" className={`${selectClass} w-full sm:w-64`} />
        <select name="hub" defaultValue={hub} className={selectClass}>
          <option value="">All hubs</option>
          {hubs.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </select>
        <select name="layer" defaultValue={layer} className={selectClass}>
          <option value="">Any layer</option>
          {[1, 2, 3, 4, 5, 6].map((l) => (
            <option key={l} value={l}>
              Layer {l}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Filter
        </button>
        <span className="ml-auto text-sm text-slate-500">{donors.length} donor(s)</span>
      </form>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2">Donor</th>
              <th className="px-3 py-2">Layer</th>
              <th className="px-3 py-2">Brought in by</th>
              <th className="px-3 py-2">Mobile</th>
              <th className="px-3 py-2">Location</th>
              <th className="px-3 py-2 text-right">Monthly pledge</th>
              <th className="px-3 py-2 text-right">Given</th>
            </tr>
          </thead>
          <tbody>
            {donors.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                  No donors.
                </td>
              </tr>
            )}
            {donors.map((d) => (
              <tr key={d.id} className="border-t border-slate-100">
                <td className="px-3 py-2">
                  <Link href={`/donors/${d.id}`} className="font-medium text-slate-900 hover:underline">
                    {d.name}
                  </Link>
                  <p className="text-xs text-slate-400">{d.hub.name}</p>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                  L{d.layer} · {RELATION_LABELS[d.relation]}
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {d.invitedBy ? (
                    <Link href={`/donors/${d.invitedBy.id}`} className="hover:underline">
                      {d.invitedBy.name}
                    </Link>
                  ) : (
                    "Hub team"
                  )}
                  {d._count.invitees > 0 && <span className="block text-xs text-slate-400">brought in {d._count.invitees}</span>}
                </td>
                <td className="px-3 py-2 text-slate-600">{d.mobile ?? "-"}</td>
                <td className="px-3 py-2 text-slate-600">{d.location ?? "-"}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right">{d.monthlyAmount ? formatEgp(toNumber(d.monthlyAmount)) : "-"}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right">{formatEgp(d.donations.reduce((s, x) => s + toNumber(x.amount), 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}

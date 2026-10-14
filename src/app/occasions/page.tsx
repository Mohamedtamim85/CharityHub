import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import DonationsSubNav from "@/components/DonationsSubNav";
import OccasionForm from "@/components/OccasionForm";
import { hubsVisibleTo, manageableHubs } from "@/lib/donations";
import { OCCASION_INFO, type OccasionType } from "@/lib/donation-calc";
import { formatDate, formatEgp, toNumber } from "@/lib/format";

export default async function OccasionsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const [occasions, managed] = await Promise.all([
    prisma.donationOccasion.findMany({
      where: { hub: hubsVisibleTo(session.userId) },
      include: { hub: { select: { name: true } }, allocations: { select: { quantity: true, amount: true, delivered: true } } },
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    }),
    manageableHubs(session.userId),
  ]);
  return (
    <AppShell userName={session.name}>
      <h1 className="mb-4 text-2xl font-semibold text-slate-900">Donation Hub</h1>
      <DonationsSubNav />
      <h2 className="mb-1 text-xl font-semibold text-slate-900">Occasions</h2>
      <p className="mb-4 text-sm text-slate-500">
        Seasonal drives: Zakat al-Fitr before the Eid prayer, Eid al-Adha udhiyah meat, Ramadan boxes, aqiqah, kaffarah, fidyah, winter
        and back-to-school. Each one lists what every case receives and whether it was delivered.
      </p>
      <div className="mb-6 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2">Occasion</th>
              <th className="px-3 py-2">Dates</th>
              <th className="px-3 py-2 text-right">Cases</th>
              <th className="px-3 py-2 text-right">Quantity</th>
              <th className="px-3 py-2 text-right">Value</th>
              <th className="px-3 py-2 text-right">Delivered</th>
            </tr>
          </thead>
          <tbody>
            {occasions.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                  No occasions yet.
                </td>
              </tr>
            )}
            {occasions.map((o) => {
              const qty = o.allocations.reduce((s, a) => s + toNumber(a.quantity), 0);
              const value = o.allocations.reduce((s, a) => s + toNumber(a.amount), 0);
              const delivered = o.allocations.filter((a) => a.delivered).length;
              return (
                <tr key={o.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">
                    <Link href={`/occasions/${o.id}`} className="font-medium text-slate-900 hover:underline">
                      {o.title}
                    </Link>
                    <p className="text-xs text-slate-400">
                      {o.hub.name}
                      {o.hijriYear && ` · ${o.hijriYear} AH`}
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                    {formatDate(o.startDate)} – {formatDate(o.endDate)}
                  </td>
                  <td className="px-3 py-2 text-right">{o.allocations.length}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    {qty} {OCCASION_INFO[o.type as OccasionType].unit}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">{formatEgp(value)}</td>
                  <td className="px-3 py-2 text-right">
                    {delivered}/{o.allocations.length}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {managed.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">New occasion</h3>
          <OccasionForm hubs={managed} />
        </div>
      )}
    </AppShell>
  );
}

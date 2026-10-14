import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import DonationsSubNav from "@/components/DonationsSubNav";
import { hubsVisibleTo, sponsorshipsWithSchedule } from "@/lib/donations";
import { cairoToday } from "@/lib/dates";
import { formatEgp, formatDate, toNumber } from "@/lib/format";
import { OCCASION_INFO, type OccasionType } from "@/lib/donation-calc";

function Card({ label, value, href, tone = "text-slate-900" }: { label: string; value: string; href: string; tone?: string }) {
  return (
    <Link href={href} className="rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-300">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${tone}`}>{value}</p>
    </Link>
  );
}

export default async function DonationsOverview() {
  const session = await getSession();
  if (!session) redirect("/login");
  const hubWhere = hubsVisibleTo(session.userId);
  const today = cairoToday();
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));

  const [hubs, active, pending, review, monthDonations, sponsorships, occasions] = await Promise.all([
    prisma.donationHub.count({ where: hubWhere }),
    prisma.donationCase.count({ where: { hub: hubWhere, status: "ACTIVE" } }),
    prisma.donationCase.count({ where: { hub: hubWhere, status: "PENDING" } }),
    prisma.donationCase.findMany({
      where: { hub: hubWhere, status: { in: ["ACTIVE", "FUNDED"] }, nextReviewDate: { lte: today } },
      select: { id: true, name: true, nextReviewDate: true },
      orderBy: { nextReviewDate: "asc" },
      take: 10,
    }),
    prisma.donation.aggregate({ where: { case: { hub: hubWhere }, date: { gte: monthStart } }, _sum: { amount: true } }),
    sponsorshipsWithSchedule({ active: true, case: { hub: hubWhere } }),
    prisma.donationOccasion.findMany({
      where: { hub: hubWhere, OR: [{ endDate: null }, { endDate: { gte: today } }] },
      include: { _count: { select: { allocations: true } } },
      orderBy: { startDate: "asc" },
      take: 5,
    }),
  ]);
  const dueNow = sponsorships.filter((s) => s.schedule.currentKey && !s.schedule.currentPaid);
  const overdue = sponsorships.filter((s) => s.schedule.overdue.length > 0);

  return (
    <AppShell userName={session.name}>
      <h1 className="mb-4 text-2xl font-semibold text-slate-900">Donation Hub</h1>
      <DonationsSubNav />
      {hubs === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
          <p className="mb-2 font-medium text-slate-800">Start by creating your hub.</p>
          <p className="mb-3">
            A hub is your own donation circle: your team validates cases first-hand (layer 1), your family and close friends join as
            donors (layer 2), their family and friends after them (layer 3) and so on. Every case gets a validity grade from the layer of
            whoever vouched for it, and cases are checked against every other hub so one person isn&apos;t funded twice without anyone knowing.
          </p>
          <Link href="/hubs" className="font-medium text-brand hover:underline">
            Create a hub →
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
            <Card label="Active cases" value={String(active)} href="/cases?status=ACTIVE" />
            <Card label="Waiting for validation" value={String(pending)} href="/cases?status=PENDING" tone={pending ? "text-amber-700" : undefined} />
            <Card label="Donated this month" value={formatEgp(toNumber(monthDonations._sum.amount))} href="/cases" />
            <Card label="Periodic due this period" value={String(dueNow.length)} href="/sponsorships" />
            <Card label="Overdue sponsorships" value={String(overdue.length)} href="/sponsorships" tone={overdue.length ? "text-red-600" : undefined} />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold text-slate-800">Due for re-validation</h2>
              {review.length === 0 ? (
                <p className="text-sm text-slate-500">Nothing to re-check.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {review.map((c) => (
                    <li key={c.id} className="flex justify-between">
                      <Link href={`/cases/${c.id}`} className="text-slate-800 hover:underline">
                        {c.name}
                      </Link>
                      <span className="text-red-600">{formatDate(c.nextReviewDate)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold text-slate-800">Current occasions</h2>
              {occasions.length === 0 ? (
                <p className="text-sm text-slate-500">
                  None.{" "}
                  <Link href="/occasions" className="text-brand hover:underline">
                    Plan Eid / Ramadan →
                  </Link>
                </p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {occasions.map((o) => (
                    <li key={o.id} className="flex justify-between">
                      <Link href={`/occasions/${o.id}`} className="text-slate-800 hover:underline">
                        {o.title}
                      </Link>
                      <span className="text-slate-500">
                        {o._count.allocations} {OCCASION_INFO[o.type as OccasionType].unit === "kg" ? "families" : "allocations"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}

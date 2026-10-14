import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import AppShell from "@/components/AppShell";
import DonationsSubNav from "@/components/DonationsSubNav";
import InstallmentButton from "@/components/InstallmentButton";
import { hubsManagedBy, hubsVisibleTo, sponsorshipsWithSchedule } from "@/lib/donations";
import { prisma } from "@/lib/prisma";
import { formatEgp } from "@/lib/format";
import { whatsappUrl } from "@/lib/phone";

export default async function SponsorshipsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const [rows, managed] = await Promise.all([
    sponsorshipsWithSchedule({ active: true, case: { hub: hubsVisibleTo(session.userId) } }),
    prisma.donationHub.findMany({ where: hubsManagedBy(session.userId), select: { id: true } }),
  ]);
  const managedIds = new Set(managed.map((h) => h.id));
  const monthly = rows.filter((r) => r.frequency === "MONTHLY").reduce((s, r) => s + r.amountNumber, 0);
  const quarterly = rows.filter((r) => r.frequency === "QUARTERLY").reduce((s, r) => s + r.amountNumber, 0);
  const sorted = [...rows].sort((a, b) => b.schedule.overdue.length - a.schedule.overdue.length || Number(a.schedule.currentPaid) - Number(b.schedule.currentPaid));

  return (
    <AppShell userName={session.name}>
      <h1 className="mb-4 text-2xl font-semibold text-slate-900">Donation Hub</h1>
      <DonationsSubNav />
      <h2 className="mb-1 text-xl font-semibold text-slate-900">Periodic donations</h2>
      <p className="mb-4 text-sm text-slate-500">
        Monthly and quarterly sponsorships for cases that need steady support. Add one from a case page; mark each period as received here.
        Commitments: {formatEgp(monthly)} / month and {formatEgp(quarterly)} / quarter.
      </p>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2">Case</th>
              <th className="px-3 py-2">Donor</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2">This period</th>
              <th className="px-3 py-2">Overdue</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                  No active sponsorships.
                </td>
              </tr>
            )}
            {sorted.map((s) => {
              const manage = managedIds.has(s.case.hubId);
              const reminder = `Assalamu alaikum ${s.donor.name.split(" ")[0]}, a gentle reminder of your ${s.frequency === "MONTHLY" ? "monthly" : "quarterly"} support (${formatEgp(s.amountNumber)}) for the case you sponsor. Jazakum Allahu khayran.`;
              return (
                <tr key={s.id} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2">
                    <Link href={`/cases/${s.case.id}`} className="font-medium text-slate-900 hover:underline">
                      {s.case.name}
                    </Link>
                    <p className="text-xs text-slate-400">{s.case.hub.name}</p>
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/donors/${s.donor.id}`} className="hover:underline">
                      {s.donor.name}
                    </Link>
                    {s.donor.mobile && (
                      <a href={whatsappUrl(reminder, s.donor.mobile)} target="_blank" rel="noreferrer" className="block text-xs text-green-700 hover:underline">
                        WhatsApp reminder
                      </a>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    {formatEgp(s.amountNumber)} <span className="text-xs text-slate-400">/ {s.frequency === "MONTHLY" ? "mo" : "qtr"}</span>
                  </td>
                  <td className="px-3 py-2">
                    {!s.schedule.currentKey ? (
                      <span className="text-xs text-slate-400">not started / ended</span>
                    ) : s.schedule.currentPaid ? (
                      <span className="text-xs font-medium text-green-700">✓ {s.schedule.currentKey}</span>
                    ) : manage ? (
                      <InstallmentButton periodKey={s.schedule.currentKey} sponsorship={{ id: s.id, caseId: s.case.id, donorId: s.donor.id, amount: s.amountNumber }} />
                    ) : (
                      <span className="text-xs text-amber-700">due {s.schedule.currentKey}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {s.schedule.overdue.length === 0 ? (
                      <span className="text-xs text-slate-400">-</span>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {s.schedule.overdue.map((k) =>
                          manage ? (
                            <InstallmentButton key={k} periodKey={k} sponsorship={{ id: s.id, caseId: s.case.id, donorId: s.donor.id, amount: s.amountNumber }} />
                          ) : (
                            <span key={k} className="text-xs text-red-600">
                              {k}
                            </span>
                          ),
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import BackLink from "@/components/BackLink";
import DonationsSubNav from "@/components/DonationsSubNav";
import DonorForm from "@/components/DonorForm";
import DonorLinkButton from "@/components/DonorLinkButton";
import ActionButton from "@/components/ActionButton";
import { hubAccess, sponsorshipsWithSchedule } from "@/lib/donations";
import { KIND_LABELS, RELATION_LABELS, validityGrade } from "@/lib/donation-calc";
import { formatDate, formatEgp, toNumber } from "@/lib/format";

export default async function DonorPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const donor = await prisma.donor.findUnique({
    where: { id },
    include: {
      hub: { select: { id: true, name: true } },
      invitedBy: { select: { id: true, name: true, layer: true } },
      invitees: { select: { id: true, name: true, layer: true, relation: true }, orderBy: { name: "asc" } },
      validatedCases: { select: { id: true, name: true, status: true, validationLayer: true } },
      donations: { include: { case: { select: { id: true, name: true } } }, orderBy: { date: "desc" } },
    },
  });
  if (!donor) notFound();
  const access = await hubAccess(session.userId, donor.hubId);
  if (!access) notFound();
  const sponsorships = await sponsorshipsWithSchedule({ donorId: id });
  const total = donor.donations.reduce((s, d) => s + toNumber(d.amount), 0);
  const thisYear = new Date().getUTCFullYear();
  const zakatThisYear = donor.donations
    .filter((d) => d.kind === "ZAKAT" && d.date.getUTCFullYear() === thisYear)
    .reduce((s, d) => s + toNumber(d.amount), 0);

  return (
    <AppShell userName={session.name}>
      <BackLink href="/donors" label="Donors" />
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{donor.name}</h1>
          <p className="text-sm text-slate-500">
            <Link href={`/hubs/${donor.hub.id}`} className="hover:underline">
              {donor.hub.name}
            </Link>{" "}
            · Layer {donor.layer} · {RELATION_LABELS[donor.relation]}
            {donor.invitedBy && (
              <>
                {" "}
                of{" "}
                <Link href={`/donors/${donor.invitedBy.id}`} className="hover:underline">
                  {donor.invitedBy.name}
                </Link>
              </>
            )}
          </p>
        </div>
        {access.canManage && <DonorLinkButton donorId={donor.id} donorName={donor.name} mobile={donor.mobile} />}
      </div>
      <DonationsSubNav />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Total given</p>
          <p className="text-xl font-semibold">{formatEgp(total)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Zakat given in {thisYear}</p>
          <p className="text-xl font-semibold">{formatEgp(zakatThisYear)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Monthly pledge</p>
          <p className="text-xl font-semibold">{donor.monthlyAmount ? formatEgp(toNumber(donor.monthlyAmount)) : "-"}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Active sponsorships</p>
          <p className="text-xl font-semibold">{sponsorships.filter((s) => s.active).length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold text-slate-800">Details</h2>
            {access.canManage ? (
              <DonorForm
                donorId={donor.id}
                hubs={[]}
                donors={[]}
                initial={{
                  hubId: donor.hubId,
                  name: donor.name,
                  mobile: donor.mobile ?? "",
                  email: donor.email ?? "",
                  location: donor.location ?? "",
                  monthlyAmount: donor.monthlyAmount ? String(donor.monthlyAmount) : "",
                  preferredMethod: donor.preferredMethod ?? "",
                  notes: donor.notes ?? "",
                  relation: donor.relation,
                  invitedById: donor.invitedById ?? "",
                }}
              />
            ) : (
              <p className="text-sm text-slate-600">
                {donor.mobile ?? "-"} · {donor.location ?? "-"}
              </p>
            )}
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-semibold text-slate-800">Donations</h2>
            {donor.donations.length === 0 ? (
              <p className="text-sm text-slate-500">None yet.</p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {donor.donations.map((d) => (
                    <tr key={d.id} className="border-t border-slate-100">
                      <td className="py-1.5 text-slate-600">{formatDate(d.date)}</td>
                      <td className="py-1.5">
                        <Link href={`/cases/${d.case.id}`} className="hover:underline">
                          {d.case.name}
                        </Link>
                      </td>
                      <td className="py-1.5 text-slate-600">
                        {KIND_LABELS[d.kind]}
                        {d.periodKey && ` · ${d.periodKey}`}
                      </td>
                      <td className="py-1.5 text-right">{formatEgp(toNumber(d.amount))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
        <div className="space-y-6">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">Brought into the hub</h2>
              {access.canManage && (
                <Link href={`/donors/new?hub=${donor.hubId}&invitedBy=${donor.id}`} className="text-xs font-medium text-brand hover:underline">
                  + Add family / friend
                </Link>
              )}
            </div>
            {donor.invitees.length === 0 ? (
              <p className="text-sm text-slate-500">Nobody yet.</p>
            ) : (
              <ul className="text-sm">
                {donor.invitees.map((i) => (
                  <li key={i.id}>
                    <Link href={`/donors/${i.id}`} className="hover:underline">
                      {i.name}
                    </Link>{" "}
                    <span className="text-xs text-slate-400">
                      L{i.layer} · {RELATION_LABELS[i.relation]}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-semibold text-slate-800">Cases they vouched for</h2>
            {donor.validatedCases.length === 0 ? (
              <p className="text-sm text-slate-500">None.</p>
            ) : (
              <ul className="text-sm">
                {donor.validatedCases.map((c) => (
                  <li key={c.id}>
                    <Link href={`/cases/${c.id}`} className="hover:underline">
                      {c.name}
                    </Link>{" "}
                    <span className="text-xs text-slate-400">grade {validityGrade(c.validationLayer)?.grade ?? "-"}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-semibold text-slate-800">Sponsorships</h2>
            {sponsorships.length === 0 ? (
              <p className="text-sm text-slate-500">None.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {sponsorships.map((s) => (
                  <li key={s.id}>
                    <Link href={`/cases/${s.case.id}`} className="hover:underline">
                      {s.case.name}
                    </Link>{" "}
                    — {formatEgp(s.amountNumber)} / {s.frequency === "MONTHLY" ? "month" : "quarter"}
                    {!s.active && <span className="text-xs text-slate-400"> (stopped)</span>}
                    {s.schedule.overdue.length > 0 && <span className="block text-xs text-red-600">overdue: {s.schedule.overdue.join(", ")}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {access.canManage && (
            <ActionButton
              endpoint={`/api/donors/${donor.id}`}
              method="DELETE"
              label="Remove donor"
              redirectTo="/donors"
              confirmText={`Remove ${donor.name} from the hub?`}
            />
          )}
        </div>
      </div>
    </AppShell>
  );
}

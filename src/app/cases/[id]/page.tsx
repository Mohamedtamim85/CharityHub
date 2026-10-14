import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import BackLink from "@/components/BackLink";
import DonationsSubNav from "@/components/DonationsSubNav";
import CaseForm from "@/components/CaseForm";
import DonationForm from "@/components/DonationForm";
import InstallmentButton from "@/components/InstallmentButton";
import ActionButton from "@/components/ActionButton";
import { caseSummaryInclude, findCaseDuplicates, hubAccess, sponsorshipsWithSchedule, summarizeCase } from "@/lib/donations";
import { CATEGORY_LABELS, GRADE_STYLES, KIND_LABELS, STATUS_LABELS, ZAKAT_CATEGORY_LABELS } from "@/lib/donation-calc";
import { formatDate, formatEgp, toNumber } from "@/lib/format";

const isoDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const c = await prisma.donationCase.findUnique({
    where: { id },
    include: {
      ...caseSummaryInclude,
      visibleTo: { select: { donorId: true } },
      createdBy: { select: { name: true } },
    },
  });
  if (!c) notFound();
  const access = await hubAccess(session.userId, c.hubId);
  if (!access) notFound();
  const [donations, sponsorships, donors, duplicates, allocations] = await Promise.all([
    prisma.donation.findMany({ where: { caseId: id }, include: { donor: { select: { id: true, name: true } } }, orderBy: { date: "desc" } }),
    sponsorshipsWithSchedule({ caseId: id }),
    prisma.donor.findMany({ where: { hubId: c.hubId }, select: { id: true, name: true, layer: true, hubId: true }, orderBy: [{ layer: "asc" }, { name: "asc" }] }),
    findCaseDuplicates(session.userId, c.hubId, c.nationalId, c.mobile, c.id),
    prisma.occasionAllocation.findMany({ where: { caseId: id }, include: { occasion: { select: { id: true, title: true } } }, orderBy: { createdAt: "desc" } }),
  ]);
  const s = summarizeCase(c);
  const periodic = c.fundingType === "ONE_TIME" ? null : c.fundingType;

  return (
    <AppShell userName={session.name}>
      <BackLink href="/cases" label="Cases" />
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{c.name}</h1>
          <p className="text-sm text-slate-500">
            {c.hub.name} · {CATEGORY_LABELS[c.category]} · {STATUS_LABELS[c.status]} · added by {c.createdBy?.name ?? "-"} on {formatDate(c.createdAt)}
          </p>
        </div>
        {s.grade ? (
          <div className={`rounded-lg px-3 py-2 text-sm ${GRADE_STYLES[s.grade.grade]}`}>
            <p className="font-semibold">
              Validity {s.grade.grade} · {s.grade.score}%
            </p>
            <p className="text-xs">
              {s.grade.label}
              {s.validator && ` — ${s.validator}`}
            </p>
            <p className="text-xs">
              {c.homeVisit ? "✓ home visit" : "✗ no home visit"} · {c.documentsChecked ? "✓ documents" : "✗ documents"}
            </p>
          </div>
        ) : (
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Not validated — can&apos;t receive donations yet.</div>
        )}
      </div>
      <DonationsSubNav />

      {duplicates.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-medium">Also registered elsewhere — coordinate before sending more support:</p>
          <ul className="mt-1 list-disc pl-5">
            {duplicates.map((d, i) => (
              <li key={i}>
                {d.id ? (
                  <Link href={`/cases/${d.id}`} className="underline">
                    {d.sameHub ? "Another record in this hub" : d.hubName}
                  </Link>
                ) : (
                  d.hubName
                )}{" "}
                (matched on {d.matchedOn.join(" and ")}) — {STATUS_LABELS[d.status]}
                {d.activeSponsorships > 0 && `, ${d.activeSponsorships} active sponsor(s)`}
                {d.donatedLast90Days > 0 && `, ${formatEgp(d.donatedLast90Days)} in the last 90 days`}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">{periodic ? `Covered per ${periodic === "MONTHLY" ? "month" : "quarter"}` : "Raised"}</p>
          <p className="text-xl font-semibold">{formatEgp(s.progress.covered)}</p>
          {s.progress.target !== null && <p className="text-xs text-slate-500">of {formatEgp(s.progress.target)}</p>}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Still needed</p>
          <p className={`text-xl font-semibold ${s.progress.gap ? "text-red-600" : "text-green-700"}`}>
            {s.progress.gap !== null ? formatEgp(s.progress.gap) : "-"}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Total received</p>
          <p className="text-xl font-semibold">{formatEgp(s.raised)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Zakat</p>
          <p className="text-sm font-medium">{c.zakatCategory ? ZAKAT_CATEGORY_LABELS[c.zakatCategory] : "Sadaqah only"}</p>
        </div>
      </div>

      {access.canManage && c.status !== "PENDING" && c.status !== "CLOSED" && (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-slate-800">Give</h2>
          <DonationForm caseId={c.id} donors={donors} defaultFrequency={periodic} />
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-800">Sponsorships</h2>
          {sponsorships.length === 0 ? (
            <p className="text-sm text-slate-500">None.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {sponsorships.map((sp) => (
                <li key={sp.id} className="border-t border-slate-100 pt-2">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span>
                      <Link href={`/donors/${sp.donor.id}`} className="font-medium hover:underline">
                        {sp.donor.name}
                      </Link>{" "}
                      — {formatEgp(sp.amountNumber)} / {sp.frequency === "MONTHLY" ? "month" : "quarter"} ({KIND_LABELS[sp.kind]})
                    </span>
                    <span className="text-xs text-slate-500">
                      {formatDate(sp.startDate)} → {sp.endDate ? formatDate(sp.endDate) : "open"}
                      {!sp.active && " · stopped"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Paid {sp.schedule.paid.length} of {sp.schedule.due.length} period(s)
                    {sp.schedule.overdue.length > 0 && <span className="text-red-600"> · overdue {sp.schedule.overdue.join(", ")}</span>}
                  </p>
                  {access.canManage && (
                    <div className="mt-1 flex flex-wrap gap-3">
                      {[...sp.schedule.overdue, ...(sp.schedule.currentKey && !sp.schedule.currentPaid ? [sp.schedule.currentKey] : [])].map((k) => (
                        <InstallmentButton key={k} periodKey={k} sponsorship={{ id: sp.id, caseId: c.id, donorId: sp.donor.id, amount: sp.amountNumber }} />
                      ))}
                      {sp.active && (
                        <ActionButton
                          endpoint={`/api/sponsorships/${sp.id}`}
                          method="PATCH"
                          body={{ active: false }}
                          label="Stop"
                          confirmText="Stop this sponsorship?"
                          className="text-xs text-slate-500 hover:underline"
                        />
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-800">Donations received</h2>
          {donations.length === 0 ? (
            <p className="text-sm text-slate-500">None yet.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {donations.map((d) => (
                  <tr key={d.id} className="border-t border-slate-100">
                    <td className="py-1.5 text-slate-600">{formatDate(d.date)}</td>
                    <td className="py-1.5">
                      <Link href={`/donors/${d.donor.id}`} className="hover:underline">
                        {d.donor.name}
                      </Link>
                    </td>
                    <td className="py-1.5 text-xs text-slate-500">
                      {KIND_LABELS[d.kind]}
                      {d.periodKey && ` · ${d.periodKey}`}
                      {d.method && ` · ${d.method}`}
                    </td>
                    <td className="py-1.5 text-right">{formatEgp(toNumber(d.amount))}</td>
                    {access.canManage && (
                      <td className="py-1.5 pl-2 text-right">
                        <ActionButton
                          endpoint={`/api/donations/${d.id}`}
                          method="DELETE"
                          label="×"
                          confirmText="Remove this donation record?"
                          className="text-xs text-slate-400 hover:text-red-600"
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {allocations.length > 0 && (
            <>
              <h3 className="mb-1 mt-4 text-xs font-semibold text-slate-700">Occasions</h3>
              <ul className="text-sm">
                {allocations.map((a) => (
                  <li key={a.id}>
                    <Link href={`/occasions/${a.occasion.id}`} className="hover:underline">
                      {a.occasion.title}
                    </Link>{" "}
                    — {toNumber(a.quantity)} {a.amount && `(${formatEgp(toNumber(a.amount))})`} {a.delivered ? "✓ delivered" : "pending"}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {access.canManage ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">Case details</h2>
          <CaseForm
            caseId={c.id}
            hubs={[]}
            donors={donors}
            initial={{
              hubId: c.hubId,
              name: c.name,
              nationalId: str(c.nationalId),
              mobile: str(c.mobile),
              gender: str(c.gender),
              birthYear: str(c.birthYear),
              maritalStatus: str(c.maritalStatus),
              governorate: str(c.governorate),
              city: str(c.city),
              address: str(c.address),
              familySize: str(c.familySize),
              dependents: str(c.dependents),
              monthlyIncome: str(c.monthlyIncome),
              monthlyNeed: str(c.monthlyNeed),
              category: c.category,
              zakatCategory: str(c.zakatCategory),
              story: str(c.story),
              paymentDetails: str(c.paymentDetails),
              fundingType: c.fundingType,
              goalAmount: str(c.goalAmount),
              periodAmount: str(c.periodAmount),
              periodStart: isoDate(c.periodStart),
              periodEnd: isoDate(c.periodEnd),
              validatedBy: c.validatedByUserId ? "team" : str(c.validatedByDonorId),
              homeVisit: c.homeVisit,
              documentsChecked: c.documentsChecked,
              nextReviewDate: isoDate(c.nextReviewDate),
              status: "",
              audience: c.audience,
              visibleDonorIds: c.visibleTo.map((v) => v.donorId),
            }}
          />
          <div className="mt-4 border-t border-slate-100 pt-3">
            <ActionButton
              endpoint={`/api/donation-cases/${c.id}`}
              method="DELETE"
              label="Delete case"
              redirectTo="/cases"
              confirmText="Delete this case? (Cases with donations can only be closed.)"
            />
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
          <p>{c.story ?? "No story recorded."}</p>
        </div>
      )}
    </AppShell>
  );
}

import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { verifyDonorToken } from "@/lib/donor-link";
import { caseSummaryInclude, casesVisibleToDonor, summarizeCase } from "@/lib/donations";
import { CATEGORY_LABELS, displayName, GRADE_STYLES } from "@/lib/donation-calc";
import { formatEgp, toNumber } from "@/lib/format";

export const metadata: Metadata = { title: "Cases you can support", robots: { index: false, follow: false } };

/** A donor's read-only page (signed link, no login): the validated cases they may see. No contact details are shown. */
export default async function GivePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const donorId = verifyDonorToken(token);
  const donor = donorId
    ? await prisma.donor.findUnique({ where: { id: donorId }, select: { id: true, name: true, hubId: true, hub: { select: { name: true } } } })
    : null;
  if (!donor) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 text-center text-slate-600">
        <p>This link has expired or isn&apos;t valid. Ask the person who sent it for a new one.</p>
      </main>
    );
  }
  const [cases, given] = await Promise.all([
    prisma.donationCase.findMany({ where: casesVisibleToDonor(donor), include: caseSummaryInclude, orderBy: { validationLayer: "asc" } }),
    prisma.donation.aggregate({ where: { donorId: donor.id }, _sum: { amount: true } }),
  ]);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-semibold text-slate-900">Assalamu alaikum {donor.name.split(" ")[0]}</h1>
        <p className="mb-1 text-sm text-slate-600">
          Validated cases in <strong>{donor.hub.name}</strong> you can support. Each case shows how closely it is known to the team.
        </p>
        {toNumber(given._sum.amount) > 0 && (
          <p className="mb-4 text-sm text-slate-600">
            Your support so far: <strong>{formatEgp(toNumber(given._sum.amount))}</strong> — jazakum Allahu khayran.
          </p>
        )}
        <div className="mt-4 space-y-3">
          {cases.length === 0 && <p className="text-sm text-slate-500">No open cases right now.</p>}
          {cases.map((c) => {
            const s = summarizeCase(c);
            return (
              <div key={c.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{displayName(c.name)}</p>
                    <p className="text-xs text-slate-500">
                      {CATEGORY_LABELS[c.category]}
                      {c.governorate && ` · ${c.governorate}`}
                      {c.familySize && ` · family of ${c.familySize}`}
                      {c.zakatCategory && " · zakat-eligible"}
                    </p>
                  </div>
                  {s.grade && (
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${GRADE_STYLES[s.grade.grade]}`}>
                      {s.grade.grade} · {s.grade.label}
                    </span>
                  )}
                </div>
                {c.story && <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{c.story}</p>}
                <div className="mt-3 text-sm text-slate-700">
                  {c.status === "FUNDED" ? (
                    <span className="font-medium text-green-700">Fully funded, alhamdulillah</span>
                  ) : c.fundingType === "ONE_TIME" ? (
                    <>
                      {formatEgp(s.progress.covered)} raised{s.progress.target !== null && ` of ${formatEgp(s.progress.target)}`}
                    </>
                  ) : (
                    <>
                      {formatEgp(s.progress.covered)}
                      {s.progress.target !== null && ` of ${formatEgp(s.progress.target)}`} committed per{" "}
                      {c.fundingType === "MONTHLY" ? "month" : "quarter"}
                    </>
                  )}
                  {s.progress.percent !== null && (
                    <div className="mt-1 h-2 rounded bg-slate-100">
                      <div className="h-2 rounded bg-brand" style={{ width: `${s.progress.percent}%` }} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-6 text-xs text-slate-400">To give, reply to whoever shared this link with you. Names are shortened to protect the families.</p>
      </div>
    </main>
  );
}

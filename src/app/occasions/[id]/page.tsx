import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import BackLink from "@/components/BackLink";
import DonationsSubNav from "@/components/DonationsSubNav";
import AllocationForm from "@/components/AllocationForm";
import ActionButton from "@/components/ActionButton";
import { hubAccess } from "@/lib/donations";
import { meatThirds, OCCASION_INFO, type OccasionType } from "@/lib/donation-calc";
import { formatDate, formatEgp, toNumber } from "@/lib/format";

export default async function OccasionPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const occasion = await prisma.donationOccasion.findUnique({
    where: { id },
    include: {
      hub: { select: { id: true, name: true } },
      allocations: {
        include: { case: { select: { id: true, name: true, familySize: true, city: true } }, donor: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!occasion) notFound();
  const access = await hubAccess(session.userId, occasion.hubId);
  if (!access) notFound();
  const info = OCCASION_INFO[occasion.type as OccasionType];
  const allocated = new Set(occasion.allocations.map((a) => a.caseId));
  const [cases, donors] = access.canManage
    ? await Promise.all([
        prisma.donationCase.findMany({
          where: { hubId: occasion.hubId, status: { in: ["ACTIVE", "FUNDED"] }, id: { notIn: [...allocated] } },
          select: { id: true, name: true, familySize: true },
          orderBy: { name: "asc" },
        }),
        prisma.donor.findMany({ where: { hubId: occasion.hubId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
      ])
    : [[], []];
  const qty = occasion.allocations.reduce((s, a) => s + toNumber(a.quantity), 0);
  const value = occasion.allocations.reduce((s, a) => s + toNumber(a.amount), 0);
  const delivered = occasion.allocations.filter((a) => a.delivered).length;

  return (
    <AppShell userName={session.name}>
      <BackLink href="/occasions" label="Occasions" />
      <h1 className="text-2xl font-semibold text-slate-900">{occasion.title}</h1>
      <p className="mb-4 text-sm text-slate-500">
        {occasion.hub.name} · {formatDate(occasion.startDate)} – {formatDate(occasion.endDate)}
        {occasion.hijriYear && ` · ${occasion.hijriYear} AH`}
        {occasion.unitValue && ` · ${formatEgp(toNumber(occasion.unitValue))} per ${info.unit}`}
      </p>
      <DonationsSubNav />
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 md:col-span-2">
          <h2 className="mb-1 text-sm font-semibold text-slate-800">Rules</h2>
          {info.timing && <p className="mb-1 text-sm text-slate-700">{info.timing}</p>}
          <ul className="list-disc pl-5 text-sm text-slate-600">
            {info.rules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
          <p className="text-xs text-slate-500">Allocated</p>
          <p className="text-xl font-semibold">
            {qty} {info.unit}
          </p>
          <p className="text-slate-600">{formatEgp(value)}</p>
          <p className="mt-1 text-slate-600">
            Delivered to {delivered} of {occasion.allocations.length} case(s)
          </p>
          {occasion.type === "EID_AL_ADHA" && qty > 0 && (
            <p className="mt-2 text-xs text-slate-500">
              {qty} kg to the poor here is the &quot;poor third&quot; of about {Math.round(qty * 3)} kg of udhiyah meat (household and gifts
              thirds would be {meatThirds(qty * 3).household} kg each).
            </p>
          )}
        </div>
      </div>

      {access.canManage && <AllocationForm occasionId={occasion.id} unit={info.unit} cases={cases} donors={donors} />}

      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2">Case</th>
              <th className="px-3 py-2 text-right">Quantity</th>
              <th className="px-3 py-2 text-right">Value</th>
              <th className="px-3 py-2">Given by</th>
              <th className="px-3 py-2">Delivered</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {occasion.allocations.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                  Nothing allocated yet.
                </td>
              </tr>
            )}
            {occasion.allocations.map((a) => (
              <tr key={a.id} className="border-t border-slate-100">
                <td className="px-3 py-2">
                  <Link href={`/cases/${a.case.id}`} className="hover:underline">
                    {a.case.name}
                  </Link>
                  <span className="text-xs text-slate-400"> {a.case.city ?? ""}</span>
                </td>
                <td className="px-3 py-2 text-right">
                  {toNumber(a.quantity)} {info.unit}
                </td>
                <td className="px-3 py-2 text-right">{a.amount ? formatEgp(toNumber(a.amount)) : "-"}</td>
                <td className="px-3 py-2 text-slate-600">{a.donor?.name ?? "Hub pool"}</td>
                <td className="px-3 py-2">
                  {access.canManage ? (
                    <ActionButton
                      endpoint={`/api/occasion-allocations/${a.id}`}
                      method="PATCH"
                      body={{ delivered: !a.delivered }}
                      label={a.delivered ? `✓ ${formatDate(a.deliveredAt)}` : "Mark delivered"}
                      className={a.delivered ? "text-xs font-medium text-green-700 hover:underline" : "text-xs font-medium text-brand hover:underline"}
                    />
                  ) : a.delivered ? (
                    "✓"
                  ) : (
                    "-"
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {access.canManage && (
                    <ActionButton
                      endpoint={`/api/occasion-allocations/${a.id}`}
                      method="DELETE"
                      label="Remove"
                      confirmText="Remove this allocation?"
                      className="text-xs text-slate-400 hover:text-red-600"
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {access.canManage && (
        <div className="mt-6">
          <ActionButton
            endpoint={`/api/donation-occasions/${occasion.id}`}
            method="DELETE"
            label="Delete occasion"
            redirectTo="/occasions"
            confirmText="Delete this occasion and its allocations?"
          />
        </div>
      )}
    </AppShell>
  );
}

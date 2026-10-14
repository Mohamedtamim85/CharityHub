import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import BackLink from "@/components/BackLink";
import DonationsSubNav from "@/components/DonationsSubNav";
import HubForm from "@/components/HubForm";
import HubTeamForm from "@/components/HubTeamForm";
import ActionButton from "@/components/ActionButton";
import { buildDonorTree, hubAccess } from "@/lib/donations";
import { RELATION_LABELS } from "@/lib/donation-calc";
import { formatEgp, toNumber } from "@/lib/format";

export default async function HubPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const access = await hubAccess(session.userId, id);
  if (!access) notFound();
  const hub = await prisma.donationHub.findUniqueOrThrow({
    where: { id },
    include: {
      owner: { select: { name: true, email: true } },
      members: { include: { user: { select: { id: true, name: true, email: true } } } },
      donors: { orderBy: { name: "asc" } },
      _count: { select: { cases: true } },
    },
  });
  const isOwner = hub.ownerId === session.userId;
  const tree = buildDonorTree(hub.donors);
  const pledged = hub.donors.reduce((s, d) => s + toNumber(d.monthlyAmount), 0);
  const byLayer = hub.donors.reduce<Record<number, number>>((acc, d) => ({ ...acc, [d.layer]: (acc[d.layer] ?? 0) + 1 }), {});

  return (
    <AppShell userName={session.name}>
      <BackLink href="/hubs" label="Hubs" />
      <h1 className="mb-4 text-2xl font-semibold text-slate-900">{hub.name}</h1>
      <DonationsSubNav />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Donors</p>
          <p className="text-xl font-semibold">{hub.donors.length}</p>
          <p className="text-xs text-slate-500">
            {Object.entries(byLayer)
              .map(([l, n]) => `L${l}: ${n}`)
              .join(" · ")}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Monthly pledges</p>
          <p className="text-xl font-semibold">{formatEgp(pledged)}</p>
        </div>
        <Link href={`/cases?hub=${hub.id}`} className="rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-300">
          <p className="text-xs text-slate-500">Cases</p>
          <p className="text-xl font-semibold">{hub._count.cases}</p>
        </Link>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Visibility</p>
          <p className="text-xl font-semibold">{hub.visibility === "PUBLIC" ? "Public" : "Individual"}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">Donor chain</h2>
            {access.canManage && (
              <Link href={`/donors/new?hub=${hub.id}`} className="text-sm font-medium text-brand hover:underline">
                + Add donor
              </Link>
            )}
          </div>
          {tree.length === 0 ? (
            <p className="text-sm text-slate-500">No donors yet.</p>
          ) : (
            <ul className="text-sm">
              {tree.map(({ donor, depth }) => (
                <li key={donor.id} className="py-0.5" style={{ paddingLeft: `${depth * 20}px` }}>
                  {depth > 0 && <span className="text-slate-300">└ </span>}
                  <Link href={`/donors/${donor.id}`} className="text-slate-800 hover:underline">
                    {donor.name}
                  </Link>{" "}
                  <span className="text-xs text-slate-400">
                    L{donor.layer} · {RELATION_LABELS[donor.relation]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-semibold text-slate-800">Team (layer 1 validators)</h2>
            <ul className="mb-3 space-y-1 text-sm">
              <li>
                {hub.owner.name} <span className="text-xs text-slate-400">owner</span>
              </li>
              {hub.members.map((m) => (
                <li key={m.userId} className="flex items-center justify-between">
                  <span>{m.user.name}</span>
                  {isOwner && (
                    <ActionButton
                      endpoint={`/api/donation-hubs/${hub.id}/members?userId=${m.userId}`}
                      method="DELETE"
                      label="Remove"
                      confirmText={`Remove ${m.user.name} from the team?`}
                      className="text-xs text-slate-500 hover:underline"
                    />
                  )}
                </li>
              ))}
            </ul>
            {isOwner && <HubTeamForm hubId={hub.id} />}
          </div>
          {access.canManage && (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-800">Settings</h2>
              <HubForm
                hubId={hub.id}
                canChangeVisibility={isOwner}
                initial={{ name: hub.name, description: hub.description ?? "", visibility: hub.visibility }}
              />
              {isOwner && (
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <ActionButton
                    endpoint={`/api/donation-hubs/${hub.id}`}
                    method="DELETE"
                    label="Delete hub"
                    redirectTo="/hubs"
                    confirmText="Delete this hub with all its donors, cases and donation history? This cannot be undone."
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

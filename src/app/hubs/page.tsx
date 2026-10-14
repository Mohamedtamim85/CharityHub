import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import DonationsSubNav from "@/components/DonationsSubNav";
import HubForm from "@/components/HubForm";
import { hubsVisibleTo } from "@/lib/donations";

export default async function HubsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const hubs = await prisma.donationHub.findMany({
    where: hubsVisibleTo(session.userId),
    include: {
      owner: { select: { name: true } },
      members: { where: { userId: session.userId }, select: { userId: true } },
      _count: { select: { donors: true, cases: true } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <AppShell userName={session.name}>
      <h1 className="mb-4 text-2xl font-semibold text-slate-900">Donation Hub</h1>
      <DonationsSubNav />
      <h2 className="mb-3 text-xl font-semibold text-slate-900">Hubs</h2>
      <p className="mb-4 text-sm text-slate-500">
        Each hub is one source with its own donors and way of working. Run one individually (only you and your team see it) or make it
        public. Cases are always checked against every hub, so you&apos;re warned when someone is already supported elsewhere.
      </p>
      <div className="mb-6 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500">
            <tr>
              <th className="px-3 py-2">Hub</th>
              <th className="px-3 py-2">Owner</th>
              <th className="px-3 py-2">Visibility</th>
              <th className="px-3 py-2">Your role</th>
              <th className="px-3 py-2 text-right">Donors</th>
              <th className="px-3 py-2 text-right">Cases</th>
            </tr>
          </thead>
          <tbody>
            {hubs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                  No hubs yet.
                </td>
              </tr>
            )}
            {hubs.map((h) => (
              <tr key={h.id} className="border-t border-slate-100">
                <td className="px-3 py-2">
                  <Link href={`/hubs/${h.id}`} className="font-medium text-slate-900 hover:underline">
                    {h.name}
                  </Link>
                </td>
                <td className="px-3 py-2 text-slate-600">{h.owner.name}</td>
                <td className="px-3 py-2 text-slate-600">{h.visibility === "PUBLIC" ? "Public" : "Individual"}</td>
                <td className="px-3 py-2 text-slate-600">{h.ownerId === session.userId ? "Owner" : h.members.length ? "Team" : "Viewer"}</td>
                <td className="px-3 py-2 text-right">{h._count.donors}</td>
                <td className="px-3 py-2 text-right">{h._count.cases}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-800">New hub</h3>
        <HubForm />
      </div>
    </AppShell>
  );
}

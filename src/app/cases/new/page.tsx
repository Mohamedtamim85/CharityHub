import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import BackLink from "@/components/BackLink";
import CaseForm, { EMPTY_CASE } from "@/components/CaseForm";
import { manageableHubs } from "@/lib/donations";

export default async function NewCasePage({ searchParams }: { searchParams: Promise<{ hub?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { hub = "" } = await searchParams;
  const hubs = await manageableHubs(session.userId);
  if (!hubs.length) redirect("/hubs");
  const donors = await prisma.donor.findMany({
    where: { hubId: { in: hubs.map((h) => h.id) } },
    select: { id: true, name: true, layer: true, hubId: true },
    orderBy: [{ layer: "asc" }, { name: "asc" }],
  });
  return (
    <AppShell userName={session.name}>
      <BackLink href="/cases" label="Cases" />
      <h1 className="mb-4 text-2xl font-semibold text-slate-900">New case</h1>
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <CaseForm hubs={hubs} donors={donors} initial={{ ...EMPTY_CASE, hubId: hubs.some((h) => h.id === hub) ? hub : hubs[0].id }} />
      </div>
    </AppShell>
  );
}

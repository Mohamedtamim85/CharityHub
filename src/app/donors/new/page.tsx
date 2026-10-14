import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import AppShell from "@/components/AppShell";
import BackLink from "@/components/BackLink";
import DonorForm from "@/components/DonorForm";
import { manageableHubs } from "@/lib/donations";

export default async function NewDonorPage({ searchParams }: { searchParams: Promise<{ hub?: string; invitedBy?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { hub = "", invitedBy = "" } = await searchParams;
  const hubs = await manageableHubs(session.userId);
  if (!hubs.length) redirect("/hubs");
  const donors = await prisma.donor.findMany({
    where: { hubId: { in: hubs.map((h) => h.id) } },
    select: { id: true, name: true, layer: true, hubId: true },
    orderBy: { name: "asc" },
  });
  const hubId = hubs.some((h) => h.id === hub) ? hub : hubs[0].id;
  return (
    <AppShell userName={session.name}>
      <BackLink href="/donors" label="Donors" />
      <h1 className="mb-4 text-2xl font-semibold text-slate-900">New donor</h1>
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <DonorForm
          hubs={hubs}
          donors={donors}
          initial={{
            hubId,
            name: "",
            mobile: "",
            email: "",
            location: "",
            monthlyAmount: "",
            preferredMethod: "",
            notes: "",
            relation: invitedBy ? "FAMILY" : "CLOSE_FRIEND",
            invitedById: invitedBy,
          }}
        />
      </div>
    </AppShell>
  );
}

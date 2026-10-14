import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import AppShell from "@/components/AppShell";
import DonationsSubNav from "@/components/DonationsSubNav";
import ZakatCalculator from "@/components/ZakatCalculator";

export default async function ZakatPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return (
    <AppShell userName={session.name}>
      <h1 className="mb-4 text-2xl font-semibold text-slate-900">Donation Hub</h1>
      <DonationsSubNav />
      <h2 className="mb-1 text-xl font-semibold text-slate-900">Zakat calculator</h2>
      <p className="mb-4 text-sm text-slate-500">
        Zakat al-mal is 2.5% of zakatable wealth you have held for a full hijri year, once it reaches the nisab (the value of 85 g of gold
        or 595 g of silver). Enter today&apos;s values; nothing here is saved.
      </p>
      <ZakatCalculator />
    </AppShell>
  );
}

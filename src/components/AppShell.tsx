"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

/** Page frame: brand, signed-in user and sign out. Section tabs come from DonationsSubNav. */
export default function AppShell({ userName, children }: { userName: string; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-lg font-semibold text-brand">
            CharityHub
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-600 sm:inline">{userName}</span>
            <button
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" });
                router.push("/login");
                router.refresh();
              }}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 lg:py-8">{children}</main>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sendJson } from "./ui";

/** Marks one sponsorship period as received (amount editable before saving). */
export default function InstallmentButton({
  sponsorship,
  periodKey,
}: {
  sponsorship: { id: string; caseId: string; donorId: string; amount: number };
  periodKey: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(sponsorship.amount));
  const [error, setError] = useState<string | null>(null);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs font-medium text-brand hover:underline">
        Received {periodKey}
      </button>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1 text-xs">
      <input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-24 rounded border border-slate-300 px-1 py-0.5" />
      <button
        type="button"
        className="font-medium text-green-700 hover:underline"
        onClick={async () => {
          const res = await sendJson("/api/donations", "POST", {
            caseId: sponsorship.caseId,
            donorId: sponsorship.donorId,
            sponsorshipId: sponsorship.id,
            periodKey,
            amount,
            date: new Date().toISOString().slice(0, 10),
          });
          if (!res.ok) return setError(res.error);
          setOpen(false);
          router.refresh();
        }}
      >
        Save
      </button>
      <button type="button" className="text-slate-500 hover:underline" onClick={() => setOpen(false)}>
        Cancel
      </button>
      {error && <span className="w-full text-red-600">{error}</span>}
    </span>
  );
}

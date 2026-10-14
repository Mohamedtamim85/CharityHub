"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KIND_LABELS } from "@/lib/donation-calc";
import { inputClass, labelClass, primaryButton, sendJson } from "./ui";

const today = () => new Date().toISOString().slice(0, 10);

/** Record a gift, or start a monthly / quarterly sponsorship, on a case. */
export default function DonationForm({
  caseId,
  donors,
  defaultFrequency,
}: {
  caseId: string;
  donors: { id: string; name: string; layer: number }[];
  /** Set for periodic cases: the form starts in "sponsorship" mode. */
  defaultFrequency: "MONTHLY" | "QUARTERLY" | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"gift" | "sponsor">(defaultFrequency ? "sponsor" : "gift");
  const [form, setForm] = useState({
    donorId: "",
    amount: "",
    date: today(),
    kind: "SADAQAH",
    method: "",
    reference: "",
    frequency: defaultFrequency ?? "MONTHLY",
    endDate: "",
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res =
      mode === "gift"
        ? await sendJson("/api/donations", "POST", {
            caseId,
            donorId: form.donorId,
            amount: form.amount,
            date: form.date,
            kind: form.kind,
            method: form.method,
            reference: form.reference,
            notes: form.notes,
          })
        : await sendJson("/api/sponsorships", "POST", {
            caseId,
            donorId: form.donorId,
            amount: form.amount,
            frequency: form.frequency,
            kind: form.kind,
            startDate: form.date,
            endDate: form.endDate || null,
            notes: form.notes,
          });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setForm((f) => ({ ...f, amount: "", reference: "", notes: "" }));
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="radio" checked={mode === "gift"} onChange={() => setMode("gift")} /> One-time donation
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" checked={mode === "sponsor"} onChange={() => setMode("sponsor")} /> Monthly / quarterly sponsorship
        </label>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div>
          <label className={labelClass}>Donor</label>
          <select required className={inputClass} value={form.donorId} onChange={(e) => set("donorId", e.target.value)}>
            <option value="">Pick a donor</option>
            {donors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} (L{d.layer})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Amount (EGP){mode === "sponsor" && " per period"}</label>
          <input required type="number" min="0.01" step="0.01" className={inputClass} value={form.amount} onChange={(e) => set("amount", e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Type</label>
          <select className={inputClass} value={form.kind} onChange={(e) => set("kind", e.target.value)}>
            {Object.entries(KIND_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>{mode === "gift" ? "Date" : "Starts"}</label>
          <input required type="date" className={inputClass} value={form.date} onChange={(e) => set("date", e.target.value)} />
        </div>
        {mode === "gift" ? (
          <>
            <div>
              <label className={labelClass}>Method</label>
              <input className={inputClass} value={form.method} onChange={(e) => set("method", e.target.value)} placeholder="InstaPay, cash ..." />
            </div>
            <div>
              <label className={labelClass}>Reference</label>
              <input className={inputClass} value={form.reference} onChange={(e) => set("reference", e.target.value)} />
            </div>
          </>
        ) : (
          <>
            <div>
              <label className={labelClass}>Every</label>
              <select className={inputClass} value={form.frequency} onChange={(e) => set("frequency", e.target.value)}>
                <option value="MONTHLY">Month</option>
                <option value="QUARTERLY">Quarter</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Until (blank = case end date)</label>
              <input type="date" className={inputClass} value={form.endDate} onChange={(e) => set("endDate", e.target.value)} />
            </div>
          </>
        )}
        <div className="sm:col-span-2">
          <label className={labelClass}>Notes</label>
          <input className={inputClass} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={busy} className={primaryButton}>
        {busy ? "Saving..." : mode === "gift" ? "Record donation" : "Add sponsorship"}
      </button>
    </form>
  );
}

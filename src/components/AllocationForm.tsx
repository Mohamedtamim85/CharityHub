"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { inputClass, labelClass, primaryButton, sendJson } from "./ui";

export default function AllocationForm({
  occasionId,
  unit,
  cases,
  donors,
}: {
  occasionId: string;
  unit: string;
  cases: { id: string; name: string; familySize: number | null }[];
  donors: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [form, setForm] = useState({ caseId: "", donorId: "", quantity: "", amount: "", notes: "" });
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <form
      className="grid grid-cols-1 items-end gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        const res = await sendJson(`/api/donation-occasions/${occasionId}/allocations`, "POST", form);
        if (!res.ok) return setError(res.error);
        setForm({ caseId: "", donorId: "", quantity: "", amount: "", notes: "" });
        router.refresh();
      }}
    >
      <div className="sm:col-span-2">
        <label className={labelClass}>Case</label>
        <select
          required
          className={inputClass}
          value={form.caseId}
          onChange={(e) => {
            const c = cases.find((x) => x.id === e.target.value);
            // Zakat al-fitr is per person: start from the family size.
            setForm((f) => ({ ...f, caseId: e.target.value, quantity: unit === "person" && c?.familySize ? String(c.familySize) : f.quantity }));
          }}
        >
          <option value="">Pick a case</option>
          {cases.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.familySize ? ` (family of ${c.familySize})` : ""}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>Quantity ({unit})</label>
        <input required type="number" min="0.01" step="0.01" className={inputClass} value={form.quantity} onChange={(e) => set("quantity", e.target.value)} />
      </div>
      <div>
        <label className={labelClass}>Value (blank = auto)</label>
        <input type="number" min="0" step="0.01" className={inputClass} value={form.amount} onChange={(e) => set("amount", e.target.value)} />
      </div>
      <div>
        <label className={labelClass}>Given by</label>
        <select className={inputClass} value={form.donorId} onChange={(e) => set("donorId", e.target.value)}>
          <option value="">Hub pool</option>
          {donors.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className={primaryButton}>
        Allocate
      </button>
      {error && <p className="text-sm text-red-600 sm:col-span-6">{error}</p>}
    </form>
  );
}

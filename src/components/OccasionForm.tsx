"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { OCCASION_INFO, type OccasionType } from "@/lib/donation-calc";
import { inputClass, labelClass, primaryButton, sendJson } from "./ui";

export default function OccasionForm({ hubs }: { hubs: { id: string; name: string }[] }) {
  const router = useRouter();
  const [form, setForm] = useState({
    hubId: hubs[0]?.id ?? "",
    type: "ZAKAT_AL_FITR" as OccasionType,
    title: OCCASION_INFO.ZAKAT_AL_FITR.label,
    hijriYear: "",
    startDate: "",
    endDate: "",
    unitValue: "",
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const info = OCCASION_INFO[form.type];
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const res = await sendJson("/api/donation-occasions", "POST", {
          ...form,
          hijriYear: form.hijriYear ? Number(form.hijriYear) : null,
          startDate: form.startDate || null,
          endDate: form.endDate || null,
        });
        setBusy(false);
        if (!res.ok) return setError(res.error);
        router.push(`/occasions/${res.data.occasion.id}`);
        router.refresh();
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div>
          <label className={labelClass}>Hub</label>
          <select required className={inputClass} value={form.hubId} onChange={(e) => set("hubId", e.target.value)}>
            {hubs.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Occasion</label>
          <select
            className={inputClass}
            value={form.type}
            onChange={(e) => {
              const type = e.target.value as OccasionType;
              setForm((f) => ({ ...f, type, title: OCCASION_INFO[type].label }));
            }}
          >
            {(Object.keys(OCCASION_INFO) as OccasionType[]).map((t) => (
              <option key={t} value={t}>
                {OCCASION_INFO[t].label}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass}>Title</label>
          <input required className={inputClass} value={form.title} onChange={(e) => set("title", e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Hijri year</label>
          <input type="number" className={inputClass} value={form.hijriYear} onChange={(e) => set("hijriYear", e.target.value)} placeholder="1448" />
        </div>
        <div>
          <label className={labelClass}>From</label>
          <input type="date" className={inputClass} value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Until</label>
          <input type="date" className={inputClass} value={form.endDate} onChange={(e) => set("endDate", e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Value of one {info.unit} (EGP)</label>
          <input type="number" min="0" step="0.01" className={inputClass} value={form.unitValue} onChange={(e) => set("unitValue", e.target.value)} />
        </div>
      </div>
      <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
        {info.timing && <p className="mb-1 font-medium text-slate-700">{info.timing}</p>}
        <ul className="list-disc pl-5">
          {info.rules.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={busy || !form.hubId} className={primaryButton}>
        {busy ? "Saving..." : "Create occasion"}
      </button>
    </form>
  );
}

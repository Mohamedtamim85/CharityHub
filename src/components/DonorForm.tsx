"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { donorLayer, RELATION_LABELS, type DonorRelation } from "@/lib/donation-calc";
import { inputClass, labelClass, primaryButton, sendJson } from "./ui";

export type DonorFormValues = {
  hubId: string;
  name: string;
  mobile: string;
  email: string;
  location: string;
  monthlyAmount: string;
  preferredMethod: string;
  notes: string;
  relation: DonorRelation;
  invitedById: string;
};

export default function DonorForm({
  donorId,
  initial,
  hubs,
  donors,
}: {
  donorId?: string;
  initial: DonorFormValues;
  hubs: { id: string; name: string }[];
  /** Possible inviters (every donor of the hubs above). */
  donors: { id: string; name: string; layer: number; hubId: string }[];
}) {
  const router = useRouter();
  const editing = Boolean(donorId);
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof DonorFormValues>(k: K, v: DonorFormValues[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setSaved(false);
  };

  const inviters = donors.filter((d) => d.hubId === form.hubId);
  const inviter = inviters.find((d) => d.id === form.invitedById) ?? null;
  const placed = donorLayer(form.relation, form.relation === "TEAM" ? null : inviter);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const info = {
      name: form.name,
      mobile: form.mobile,
      email: form.email,
      location: form.location,
      monthlyAmount: form.monthlyAmount,
      preferredMethod: form.preferredMethod,
      notes: form.notes,
    };
    const res = editing
      ? await sendJson(`/api/donors/${donorId}`, "PATCH", info)
      : await sendJson("/api/donors", "POST", {
          ...info,
          hubId: form.hubId,
          relation: form.relation,
          invitedById: form.relation === "TEAM" ? null : form.invitedById || null,
        });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    if (editing) {
      setSaved(true);
      router.refresh();
    } else {
      router.push(`/donors/${res.data.donor.id}`);
      router.refresh();
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      {!editing && (
        <div className="grid grid-cols-1 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-3">
          <div>
            <label className={labelClass}>Hub</label>
            <select required className={inputClass} value={form.hubId} onChange={(e) => set("hubId", e.target.value)}>
              <option value="">Pick a hub</option>
              {hubs.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Relation</label>
            <select className={inputClass} value={form.relation} onChange={(e) => set("relation", e.target.value as DonorRelation)}>
              {(Object.keys(RELATION_LABELS) as DonorRelation[]).map((r) => (
                <option key={r} value={r}>
                  {RELATION_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          {form.relation !== "TEAM" && (
            <div>
              <label className={labelClass}>Family / close friend of</label>
              <select className={inputClass} value={form.invitedById} onChange={(e) => set("invitedById", e.target.value)}>
                <option value="">Me / my team (layer 2)</option>
                {inviters.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} (layer {d.layer})
                  </option>
                ))}
              </select>
            </div>
          )}
          <p className="text-xs text-slate-600 sm:col-span-3">
            {"error" in placed ? <span className="text-red-600">{placed.error}</span> : <>This donor will be on <strong>layer {placed.layer}</strong> of the chain.</>}
          </p>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Name</label>
          <input required className={inputClass} value={form.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Mobile / WhatsApp</label>
          <input type="tel" className={inputClass} value={form.mobile} onChange={(e) => set("mobile", e.target.value)} placeholder="01001234567" />
        </div>
        <div>
          <label className={labelClass}>Location</label>
          <input className={inputClass} value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Nasr City, Cairo" />
        </div>
        <div>
          <label className={labelClass}>Monthly donation amount (EGP)</label>
          <input type="number" min="0" step="0.01" className={inputClass} value={form.monthlyAmount} onChange={(e) => set("monthlyAmount", e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Email</label>
          <input type="email" className={inputClass} value={form.email} onChange={(e) => set("email", e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Preferred payment method</label>
          <input className={inputClass} value={form.preferredMethod} onChange={(e) => set("preferredMethod", e.target.value)} placeholder="InstaPay, Vodafone Cash, cash, bank transfer" />
        </div>
      </div>
      <div>
        <label className={labelClass}>Notes</label>
        <textarea rows={2} className={inputClass} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-700">Saved.</p>}
      <button type="submit" disabled={busy || (!editing && "error" in placed)} className={primaryButton}>
        {busy ? "Saving..." : editing ? "Save" : "Add donor"}
      </button>
    </form>
  );
}

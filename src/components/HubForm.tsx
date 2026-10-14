"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { inputClass, labelClass, primaryButton, sendJson } from "./ui";

export default function HubForm({
  hubId,
  initial = { name: "", description: "", visibility: "PRIVATE" },
  canChangeVisibility = true,
}: {
  hubId?: string;
  initial?: { name: string; description: string; visibility: "PRIVATE" | "PUBLIC" };
  canChangeVisibility?: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = canChangeVisibility ? form : { name: form.name, description: form.description };
    const res = await sendJson(hubId ? `/api/donation-hubs/${hubId}` : "/api/donation-hubs", hubId ? "PATCH" : "POST", body);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    if (hubId) {
      setSaved(true);
      router.refresh();
    } else {
      router.push(`/hubs/${res.data.hub.id}`);
      router.refresh();
    }
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Hub name</label>
          <input required className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="My family circle" />
        </div>
        <div>
          <label className={labelClass}>Visibility</label>
          <select
            className={inputClass}
            value={form.visibility}
            disabled={!canChangeVisibility}
            onChange={(e) => setForm({ ...form, visibility: e.target.value as "PRIVATE" | "PUBLIC" })}
          >
            <option value="PRIVATE">Individual — only me and my team</option>
            <option value="PUBLIC">Public — every user can see it</option>
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>Description</label>
        <textarea rows={2} className={inputClass} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-700">Saved.</p>}
      <button type="submit" disabled={busy} className={primaryButton}>
        {busy ? "Saving..." : hubId ? "Save" : "Create hub"}
      </button>
    </form>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { inputClass, labelClass, primaryButton } from "./ui";

/** "Import contacts" box: everyone in the file joins as family / close friends of one inviter. */
export default function DonorImportForm({
  hubs,
  donors,
}: {
  hubs: { id: string; name: string }[];
  donors: { id: string; name: string; layer: number; hubId: string }[];
}) {
  const router = useRouter();
  const [hubId, setHubId] = useState(hubs[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);

  async function upload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const body = new FormData(form);
    setBusy(true);
    setMessage(null);
    setSkipped([]);
    try {
      const res = await fetch("/api/donors/import", { method: "POST", body });
      const data: { added?: number; skipped?: string[]; layer?: number; error?: string } = await res.json().catch(() => ({}));
      if (!res.ok) return setMessage(data.error || `Import failed (HTTP ${res.status})`);
      setMessage(`Added ${data.added} donor(s) on layer ${data.layer}${data.skipped?.length ? `, skipped ${data.skipped.length}` : ""}.`);
      setSkipped(data.skipped ?? []);
      form.reset();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
      <summary className="cursor-pointer text-sm font-semibold text-slate-700">Import a contact list</summary>
      <p className="mb-3 mt-2 text-xs text-slate-500">
        <Link href="/api/donors/import/template" className="font-medium text-brand hover:underline">
          Download the template
        </Link>{" "}
        (Name, Mobile, Email, Location, Monthly amount, Relation). Everyone imported must be family or a close friend of the person
        you pick below, so they join one layer under them; rows with another relation, or a mobile already in the hub, are skipped.
      </p>
      <form onSubmit={upload} className="grid grid-cols-1 items-end gap-3 sm:grid-cols-4">
        <div>
          <label className={labelClass}>Hub</label>
          <select name="hubId" className={inputClass} value={hubId} onChange={(e) => setHubId(e.target.value)}>
            {hubs.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Family / close friends of</label>
          <select name="invitedById" className={inputClass} defaultValue="">
            <option value="">Me / my team (layer 2)</option>
            {donors
              .filter((d) => d.hubId === hubId)
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} (layer {d.layer})
                </option>
              ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Relation when the file leaves it blank</label>
          <select name="relation" className={inputClass} defaultValue="CLOSE_FRIEND">
            <option value="CLOSE_FRIEND">Close friend</option>
            <option value="FAMILY">Family</option>
          </select>
        </div>
        <input type="file" name="file" accept=".xlsx" required className={inputClass} />
        <button type="submit" disabled={busy || !hubId} className={`${primaryButton} sm:col-start-4`}>
          {busy ? "Importing..." : "Import"}
        </button>
      </form>
      {message && <p className="mt-2 text-xs text-slate-600">{message}</p>}
      {skipped.length > 0 && (
        <ul className="mt-1 max-h-32 list-disc overflow-y-auto pl-5 text-xs text-slate-500">
          {skipped.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      )}
    </details>
  );
}

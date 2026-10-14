export const inputClass =
  "w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none";
export const labelClass = "mb-1 block text-xs font-medium text-slate-600";
export const primaryButton =
  "rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50";
export const secondaryButton =
  "rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50";

/** POST/PATCH JSON; returns the parsed body plus the status. */
export async function sendJson(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data, error: typeof data.error === "string" ? data.error : `Request failed (HTTP ${res.status})` };
}

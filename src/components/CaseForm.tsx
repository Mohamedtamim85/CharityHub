"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CATEGORY_LABELS, STATUS_LABELS, validityGrade, ZAKAT_CATEGORY_LABELS } from "@/lib/donation-calc";
import type { CaseDuplicate } from "@/lib/donations";
import { inputClass, labelClass, primaryButton, sendJson } from "./ui";

export type CaseFormValues = {
  hubId: string;
  name: string;
  nationalId: string;
  mobile: string;
  gender: string;
  birthYear: string;
  maritalStatus: string;
  governorate: string;
  city: string;
  address: string;
  familySize: string;
  dependents: string;
  monthlyIncome: string;
  monthlyNeed: string;
  category: string;
  zakatCategory: string;
  story: string;
  paymentDetails: string;
  fundingType: "ONE_TIME" | "MONTHLY" | "QUARTERLY";
  goalAmount: string;
  periodAmount: string;
  periodStart: string;
  periodEnd: string;
  validatedBy: string;
  homeVisit: boolean;
  documentsChecked: boolean;
  nextReviewDate: string;
  status: string;
  audience: "CHAIN" | "PRIVATE";
  visibleDonorIds: string[];
};

/** A blank case (everything but the hub). */
export const EMPTY_CASE: Omit<CaseFormValues, "hubId"> = {
  name: "",
  nationalId: "",
  mobile: "",
  gender: "",
  birthYear: "",
  maritalStatus: "",
  governorate: "",
  city: "",
  address: "",
  familySize: "",
  dependents: "",
  monthlyIncome: "",
  monthlyNeed: "",
  category: "OTHER",
  zakatCategory: "",
  story: "",
  paymentDetails: "",
  fundingType: "ONE_TIME",
  goalAmount: "",
  periodAmount: "",
  periodStart: "",
  periodEnd: "",
  validatedBy: "",
  homeVisit: false,
  documentsChecked: false,
  nextReviewDate: "",
  status: "",
  audience: "CHAIN",
  visibleDonorIds: [],
};

const intOrNull = (v: string) => (v.trim() === "" ? null : Number(v));

export default function CaseForm({
  caseId,
  initial,
  hubs,
  donors,
}: {
  caseId?: string;
  initial: CaseFormValues;
  hubs: { id: string; name: string }[];
  donors: { id: string; name: string; layer: number; hubId: string }[];
}) {
  const router = useRouter();
  const editing = Boolean(caseId);
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<CaseDuplicate[]>([]);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof CaseFormValues>(k: K, v: CaseFormValues[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setSaved(false);
    if (k === "nationalId" || k === "mobile") setDuplicates([]);
  };
  const hubDonors = donors.filter((d) => d.hubId === form.hubId);
  const validatorLayer = form.validatedBy === "team" ? 1 : hubDonors.find((d) => d.id === form.validatedBy)?.layer ?? null;
  const grade = validityGrade(validatorLayer);

  async function save(allowDuplicate = false) {
    setBusy(true);
    setError(null);
    const { hubId, birthYear, familySize, dependents, status, ...rest } = form;
    const body = {
      ...rest,
      ...(editing ? {} : { hubId }),
      birthYear: intOrNull(birthYear),
      familySize: intOrNull(familySize),
      dependents: intOrNull(dependents),
      status: status || undefined,
      allowDuplicate,
    };
    const res = await sendJson(editing ? `/api/donation-cases/${caseId}` : "/api/donation-cases", editing ? "PATCH" : "POST", body);
    setBusy(false);
    if (res.status === 409 && res.data.duplicates) {
      setDuplicates(res.data.duplicates);
      return;
    }
    if (!res.ok) return setError(res.error);
    setDuplicates([]);
    if (editing) {
      setSaved(true);
      router.refresh();
    } else {
      router.push(`/cases/${res.data.case.id}`);
      router.refresh();
    }
  }

  const text = (k: keyof CaseFormValues, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label className={labelClass}>{label}</label>
      <input className={inputClass} value={form[k] as string} onChange={(e) => set(k, e.target.value as never)} {...props} />
    </div>
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="space-y-6"
    >
      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-800">Person</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {!editing && (
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
          )}
          {text("name", "Full name", { required: true })}
          {text("nationalId", "National ID", { inputMode: "numeric", placeholder: "14 digits — used to catch duplicates" })}
          {text("mobile", "Mobile", { type: "tel", placeholder: "01001234567" })}
          <div>
            <label className={labelClass}>Gender</label>
            <select className={inputClass} value={form.gender} onChange={(e) => set("gender", e.target.value)}>
              <option value="">-</option>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
            </select>
          </div>
          {text("birthYear", "Birth year", { type: "number", min: 1900, max: 2100 })}
          <div>
            <label className={labelClass}>Marital status</label>
            <select className={inputClass} value={form.maritalStatus} onChange={(e) => set("maritalStatus", e.target.value)}>
              <option value="">-</option>
              {["Single", "Married", "Widowed", "Divorced", "Separated"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          {text("governorate", "Governorate", { placeholder: "Cairo" })}
          {text("city", "City / village")}
          <div className="sm:col-span-3">{text("address", "Address / landmark")}</div>
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-800">Household & need</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          {text("familySize", "Family size", { type: "number", min: 0 })}
          {text("dependents", "Dependents (children, elderly)", { type: "number", min: 0 })}
          {text("monthlyIncome", "Monthly income (EGP)", { type: "number", min: 0, step: "0.01" })}
          {text("monthlyNeed", "Monthly need (EGP)", { type: "number", min: 0, step: "0.01" })}
          <div className="sm:col-span-2">
            <label className={labelClass}>Category</label>
            <select className={inputClass} value={form.category} onChange={(e) => set("category", e.target.value)}>
              {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Zakat eligibility (the 8 categories)</label>
            <select className={inputClass} value={form.zakatCategory} onChange={(e) => set("zakatCategory", e.target.value)}>
              <option value="">Not zakat-eligible — sadaqah only</option>
              {Object.entries(ZAKAT_CATEGORY_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Story / situation (donors see this)</label>
            <textarea rows={3} className={inputClass} value={form.story} onChange={(e) => set("story", e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>How support is handed over (team only)</label>
            <textarea rows={3} className={inputClass} value={form.paymentDetails} onChange={(e) => set("paymentDetails", e.target.value)} placeholder="Vodafone Cash number, pickup point, pharmacy, school ..." />
          </div>
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-800">Funding</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div>
            <label className={labelClass}>Type</label>
            <select className={inputClass} value={form.fundingType} onChange={(e) => set("fundingType", e.target.value as CaseFormValues["fundingType"])}>
              <option value="ONE_TIME">One-time goal</option>
              <option value="MONTHLY">Monthly support</option>
              <option value="QUARTERLY">Quarterly support</option>
            </select>
          </div>
          {form.fundingType === "ONE_TIME"
            ? text("goalAmount", "Goal (EGP)", { type: "number", min: 0, step: "0.01" })
            : text("periodAmount", `Needed per ${form.fundingType === "MONTHLY" ? "month" : "quarter"} (EGP)`, { type: "number", min: 0, step: "0.01" })}
          {form.fundingType !== "ONE_TIME" && text("periodStart", "From", { type: "date" })}
          {form.fundingType !== "ONE_TIME" && text("periodEnd", "Until", { type: "date" })}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-800">Validation</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label className={labelClass}>Who knows this case first-hand?</label>
            <select className={inputClass} value={form.validatedBy} onChange={(e) => set("validatedBy", e.target.value)}>
              <option value="">Not validated yet</option>
              <option value="team">Me / my team (layer 1)</option>
              {hubDonors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} (layer {d.layer})
                </option>
              ))}
            </select>
            {grade && (
              <p className="mt-1 text-xs text-slate-600">
                Validity <strong>{grade.grade}</strong> ({grade.score}%) — {grade.label}
              </p>
            )}
          </div>
          <div>
            <label className={labelClass}>Status</label>
            <select className={inputClass} value={form.status} onChange={(e) => set("status", e.target.value)}>
              <option value="">{editing ? "Keep" : "Automatic"}</option>
              {Object.entries(STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          {text("nextReviewDate", "Re-check on", { type: "date" })}
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.homeVisit} onChange={(e) => set("homeVisit", e.target.checked)} /> Home visit done
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.documentsChecked} onChange={(e) => set("documentsChecked", e.target.checked)} /> ID / documents checked
          </label>
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-800">Who can see it</h3>
        <div className="flex flex-wrap gap-4 text-sm text-slate-700">
          <label className="flex items-center gap-2">
            <input type="radio" checked={form.audience === "CHAIN"} onChange={() => set("audience", "CHAIN")} /> The whole donor chain of the hub
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={form.audience === "PRIVATE"} onChange={() => set("audience", "PRIVATE")} /> Private — only the donors I pick
          </label>
        </div>
        {form.audience === "PRIVATE" && (
          <div className="mt-2 grid max-h-48 grid-cols-1 gap-1 overflow-y-auto rounded-lg border border-slate-200 p-2 sm:grid-cols-3">
            {hubDonors.length === 0 && <p className="text-xs text-slate-500">No donors in this hub yet.</p>}
            {hubDonors.map((d) => (
              <label key={d.id} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.visibleDonorIds.includes(d.id)}
                  onChange={(e) =>
                    set("visibleDonorIds", e.target.checked ? [...form.visibleDonorIds, d.id] : form.visibleDonorIds.filter((x) => x !== d.id))
                  }
                />
                {d.name} <span className="text-xs text-slate-400">L{d.layer}</span>
              </label>
            ))}
          </div>
        )}
      </section>

      {duplicates.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-medium">This person is already registered:</p>
          <ul className="mt-1 list-disc pl-5">
            {duplicates.map((d, i) => (
              <li key={i}>
                {d.id ? (
                  <Link href={`/cases/${d.id}`} className="underline">
                    {d.sameHub ? "In this hub" : d.hubName}
                  </Link>
                ) : (
                  d.hubName
                )}{" "}
                — matched on {d.matchedOn.join(" and ")}, {STATUS_LABELS[d.status] ?? d.status}
                {d.activeSponsorships > 0 && `, ${d.activeSponsorships} active sponsor(s)`}
                {d.donatedLast90Days > 0 && `, received ${d.donatedLast90Days.toLocaleString()} EGP in the last 90 days`}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs">Another donor or source may already be covering this need. Coordinate before duplicating support.</p>
          <button type="button" onClick={() => save(true)} className="mt-1 text-xs font-medium underline">
            Save anyway
          </button>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-700">Saved.</p>}
      <button type="submit" disabled={busy} className={primaryButton}>
        {busy ? "Saving..." : editing ? "Save case" : "Add case"}
      </button>
    </form>
  );
}

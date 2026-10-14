"use client";

import { useState } from "react";
import { calculateZakat, cropZakat, GOLD_NISAB_GRAMS, SILVER_NISAB_GRAMS, type GoldHolding } from "@/lib/zakat-calc";
import { meatThirds, udhiyahShares, zakatAlFitr } from "@/lib/donation-calc";
import { formatEgp } from "@/lib/format";
import { inputClass, labelClass, secondaryButton } from "./ui";

const num = (v: string) => (v.trim() === "" ? 0 : Number(v) || 0);

function Field({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <input type="number" min="0" step="any" className={inputClass} value={value} onChange={(e) => onChange(e.target.value)} />
      {hint && <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between py-1 ${strong ? "font-semibold text-slate-900" : "text-slate-600"}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export default function ZakatCalculator() {
  const [v, setV] = useState({
    cash: "",
    bank: "",
    silverGrams: "",
    goldPrice24k: "",
    silverPrice: "",
    investments: "",
    inventory: "",
    receivables: "",
    otherAssets: "",
    debtsDue: "",
  });
  const [gold, setGold] = useState<{ karat: GoldHolding["karat"]; grams: string; personalUse: boolean }[]>([{ karat: 21, grams: "", personalUse: false }]);
  const [nisabBasis, setNisabBasis] = useState<"gold" | "silver">("gold");
  const [includePersonalJewelry, setIncludeJewelry] = useState(false);
  const [calendar, setCalendar] = useState<"lunar" | "solar">("lunar");
  const [hawlComplete, setHawl] = useState(true);
  const set = (k: keyof typeof v) => (val: string) => setV((s) => ({ ...s, [k]: val }));

  const result = calculateZakat({
    cash: num(v.cash),
    bank: num(v.bank),
    gold: gold.map((g) => ({ karat: g.karat, grams: num(g.grams), personalUse: g.personalUse })),
    silverGrams: num(v.silverGrams),
    goldPrice24k: num(v.goldPrice24k),
    silverPrice: num(v.silverPrice),
    investments: num(v.investments),
    inventory: num(v.inventory),
    receivables: num(v.receivables),
    otherAssets: num(v.otherAssets),
    debtsDue: num(v.debtsDue),
    nisabBasis,
    includePersonalJewelry,
    calendar,
    hawlComplete,
  });

  // Side calculators.
  const [fitr, setFitr] = useState({ persons: "", value: "" });
  const fitrResult = zakatAlFitr(num(fitr.persons), num(fitr.value));
  const [crop, setCrop] = useState({ kg: "", watering: "natural" as "natural" | "irrigated" | "mixed" });
  const cropResult = cropZakat(num(crop.kg), crop.watering);
  const [meat, setMeat] = useState({ animal: "SHEEP" as "SHEEP" | "GOAT" | "COW" | "CAMEL", kg: "" });
  const thirds = meatThirds(num(meat.kg));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 lg:col-span-2">
          <h3 className="text-sm font-semibold text-slate-800">Zakat al-Mal — what you own today</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Cash at hand" value={v.cash} onChange={set("cash")} />
            <Field label="Bank balances & savings" value={v.bank} onChange={set("bank")} hint="Certificates and deposits too (the principal)" />
            <Field label="Trading shares / funds" value={v.investments} onChange={set("investments")} hint="Market value of what you hold to trade" />
            <Field label="Business stock" value={v.inventory} onChange={set("inventory")} hint="At today's selling price" />
            <Field label="Money owed to you" value={v.receivables} onChange={set("receivables")} hint="Only what you expect to collect" />
            <Field label="Other zakatable assets" value={v.otherAssets} onChange={set("otherAssets")} hint="Rent collected and kept, crypto ..." />
          </div>

          <div>
            <p className={labelClass}>Gold</p>
            <div className="space-y-2">
              {gold.map((g, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <select
                    className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                    value={g.karat}
                    onChange={(e) => setGold(gold.map((x, j) => (j === i ? { ...x, karat: Number(e.target.value) as GoldHolding["karat"] } : x)))}
                  >
                    {[24, 22, 21, 18].map((k) => (
                      <option key={k} value={k}>
                        {k}k
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="grams"
                    className="w-28 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                    value={g.grams}
                    onChange={(e) => setGold(gold.map((x, j) => (j === i ? { ...x, grams: e.target.value } : x)))}
                  />
                  <label className="flex items-center gap-1 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={g.personalUse}
                      onChange={(e) => setGold(gold.map((x, j) => (j === i ? { ...x, personalUse: e.target.checked } : x)))}
                    />
                    Jewellery worn regularly
                  </label>
                  {gold.length > 1 && (
                    <button type="button" className="text-xs text-slate-500 hover:underline" onClick={() => setGold(gold.filter((_, j) => j !== i))}>
                      Remove
                    </button>
                  )}
                </div>
              ))}
              <button type="button" className={secondaryButton} onClick={() => setGold([...gold, { karat: 21, grams: "", personalUse: false }])}>
                + Gold item
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Gold price / gram (24k)" value={v.goldPrice24k} onChange={set("goldPrice24k")} hint="Today's market price" />
            <Field label="Silver held (grams)" value={v.silverGrams} onChange={set("silverGrams")} />
            <Field label="Silver price / gram" value={v.silverPrice} onChange={set("silverPrice")} />
            <Field label="Debts due now" value={v.debtsDue} onChange={set("debtsDue")} hint="Bills and instalments due now — not a whole long-term loan" />
          </div>

          <div className="grid grid-cols-1 gap-3 text-sm text-slate-700 sm:grid-cols-2">
            <div>
              <p className={labelClass}>Nisab based on</p>
              <label className="mr-4 inline-flex items-center gap-1">
                <input type="radio" checked={nisabBasis === "gold"} onChange={() => setNisabBasis("gold")} /> Gold ({GOLD_NISAB_GRAMS} g)
              </label>
              <label className="inline-flex items-center gap-1">
                <input type="radio" checked={nisabBasis === "silver"} onChange={() => setNisabBasis("silver")} /> Silver ({SILVER_NISAB_GRAMS} g)
              </label>
            </div>
            <div>
              <p className={labelClass}>Year used</p>
              <label className="mr-4 inline-flex items-center gap-1">
                <input type="radio" checked={calendar === "lunar"} onChange={() => setCalendar("lunar")} /> Hijri (2.5%)
              </label>
              <label className="inline-flex items-center gap-1">
                <input type="radio" checked={calendar === "solar"} onChange={() => setCalendar("solar")} /> Gregorian (2.577%)
              </label>
            </div>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={includePersonalJewelry} onChange={(e) => setIncludeJewelry(e.target.checked)} /> Count worn jewellery (Hanafi view)
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={hawlComplete} onChange={(e) => setHawl(e.target.checked)} /> A full year has passed above the nisab
            </label>
          </div>
        </div>

        <div className="h-fit rounded-lg border border-slate-200 bg-white p-4 text-sm lg:sticky lg:top-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-800">Result</h3>
          <Row label={`Gold (${result.pureGoldGrams} g pure)`} value={formatEgp(result.goldValue)} />
          <Row label="Silver" value={formatEgp(result.silverValue)} />
          <Row label="Total zakatable assets" value={formatEgp(result.totalAssets)} />
          <Row label="Less debts due" value={`- ${formatEgp(result.deductions)}`} />
          <Row label="Net wealth" value={formatEgp(result.netWealth)} strong />
          <Row label={`Nisab (${nisabBasis})`} value={formatEgp(result.nisabValue)} />
          <div className="mt-3 rounded-lg bg-slate-50 p-3 text-center">
            <p className="text-xs text-slate-500">Zakat due ({(result.rate * 100).toFixed(3).replace(/0+$/, "")}%)</p>
            <p className="text-2xl font-semibold text-slate-900">{formatEgp(result.zakatDue)}</p>
          </div>
          {result.notes.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-xs text-slate-500">
              {result.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
          <h3 className="mb-2 font-semibold text-slate-800">Zakat al-Fitr</h3>
          <div className="grid grid-cols-2 gap-2">
            <Field label="People you support" value={fitr.persons} onChange={(x) => setFitr({ ...fitr, persons: x })} />
            <Field label="Value / person" value={fitr.value} onChange={(x) => setFitr({ ...fitr, value: x })} hint="Dar al-Ifta's yearly figure" />
          </div>
          <p className="mt-2 text-slate-700">
            {fitrResult.kg} kg of staple food, or <strong>{formatEgp(fitrResult.amount)}</strong>. Give it before the Eid prayer.
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
          <h3 className="mb-2 font-semibold text-slate-800">Crops & fruit</h3>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Harvest (kg)" value={crop.kg} onChange={(x) => setCrop({ ...crop, kg: x })} hint="Nisab ≈ 653 kg" />
            <div>
              <label className={labelClass}>Watering</label>
              <select className={inputClass} value={crop.watering} onChange={(e) => setCrop({ ...crop, watering: e.target.value as typeof crop.watering })}>
                <option value="natural">Rain / river (10%)</option>
                <option value="irrigated">Paid irrigation (5%)</option>
                <option value="mixed">Half and half (7.5%)</option>
              </select>
            </div>
          </div>
          <p className="mt-2 text-slate-700">
            {cropResult.meetsNisab ? (
              <>
                Due on harvest day: <strong>{cropResult.dueKg} kg</strong> (or its value).
              </>
            ) : (
              "Below the nisab — nothing due."
            )}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
          <h3 className="mb-2 font-semibold text-slate-800">Udhiyah (Eid al-Adha)</h3>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelClass}>Animal</label>
              <select className={inputClass} value={meat.animal} onChange={(e) => setMeat({ ...meat, animal: e.target.value as typeof meat.animal })}>
                <option value="SHEEP">Sheep</option>
                <option value="GOAT">Goat</option>
                <option value="COW">Cow</option>
                <option value="CAMEL">Camel</option>
              </select>
            </div>
            <Field label="Meat (kg)" value={meat.kg} onChange={(x) => setMeat({ ...meat, kg: x })} />
          </div>
          <p className="mt-2 text-slate-700">
            Covers {udhiyahShares(meat.animal)} share(s). Thirds: {thirds.household} kg household, {thirds.gifts} kg gifts,{" "}
            <strong>{thirds.poor} kg to the poor</strong>.
          </p>
        </div>
      </div>
      <p className="text-xs text-slate-400">
        A guide based on the majority positions, with the main differences of opinion as options. For an unusual situation (business
        partnerships, pensions, livestock) ask a trusted scholar or Dar al-Ifta.
      </p>
    </div>
  );
}

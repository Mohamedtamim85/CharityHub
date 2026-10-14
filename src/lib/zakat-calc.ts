/// Zakat al-mal calculator (pure). Majority positions by default, with the
/// main differences of opinion exposed as options:
/// - nisab: 85 g of pure gold, or 595 g of silver (lower, so more people pay —
///   preferred by many contemporary councils as better for the poor);
/// - personal-use gold jewellery: exempt for the Maliki/Shafi'i/Hanbali
///   schools, zakatable for the Hanafi school;
/// - 2.5% per lunar (hijri) year; ~2.577% when a solar year is used instead.

export const GOLD_NISAB_GRAMS = 85;
export const SILVER_NISAB_GRAMS = 595;
export const LUNAR_RATE = 0.025;
/** 2.5% scaled by 365.25 / 354.37 days. */
export const SOLAR_RATE = 0.02577;
/** Five awsuq of grain/fruit, about 653 kg. */
export const CROP_NISAB_KG = 653;

export const KARAT_PURITY: Record<number, number> = { 24: 1, 22: 22 / 24, 21: 21 / 24, 18: 18 / 24 };

export type GoldHolding = { karat: 24 | 22 | 21 | 18; grams: number; personalUse: boolean };

export type ZakatInput = {
  cash: number;
  bank: number;
  gold: GoldHolding[];
  silverGrams: number;
  /** Price of one gram of 24k gold, and of silver, in the same currency as the cash. */
  goldPrice24k: number;
  silverPrice: number;
  /** Shares/funds held for trading at market value (long-term holdings: the zakatable part only). */
  investments: number;
  /** Business stock at current selling value. */
  inventory: number;
  /** Money owed to you that you expect to collect. */
  receivables: number;
  otherAssets: number;
  /** Debts and bills due now (this month's instalments, not a whole mortgage). */
  debtsDue: number;
  nisabBasis: "gold" | "silver";
  includePersonalJewelry: boolean;
  calendar: "lunar" | "solar";
  /** A full year has passed with wealth above nisab. */
  hawlComplete: boolean;
};

export type ZakatResult = {
  goldValue: number;
  pureGoldGrams: number;
  silverValue: number;
  totalAssets: number;
  deductions: number;
  netWealth: number;
  nisabValue: number;
  meetsNisab: boolean;
  rate: number;
  zakatDue: number;
  notes: string[];
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const pos = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

export function calculateZakat(input: ZakatInput): ZakatResult {
  const notes: string[] = [];
  const counted = input.gold.filter((g) => input.includePersonalJewelry || !g.personalUse);
  const pureGoldGrams = counted.reduce((s, g) => s + pos(g.grams) * (KARAT_PURITY[g.karat] ?? 1), 0);
  const goldValue = pureGoldGrams * pos(input.goldPrice24k);
  const silverValue = pos(input.silverGrams) * pos(input.silverPrice);
  if (!input.includePersonalJewelry && input.gold.some((g) => g.personalUse && g.grams > 0)) {
    notes.push("Personal-use jewellery is excluded (majority view). The Hanafi school includes it.");
  }

  const totalAssets =
    pos(input.cash) +
    pos(input.bank) +
    goldValue +
    silverValue +
    pos(input.investments) +
    pos(input.inventory) +
    pos(input.receivables) +
    pos(input.otherAssets);
  const deductions = Math.min(pos(input.debtsDue), totalAssets);
  const netWealth = totalAssets - deductions;

  const nisabValue =
    input.nisabBasis === "gold" ? GOLD_NISAB_GRAMS * pos(input.goldPrice24k) : SILVER_NISAB_GRAMS * pos(input.silverPrice);
  if (nisabValue === 0) notes.push(`Enter the ${input.nisabBasis} price to work out the nisab.`);
  const meetsNisab = nisabValue > 0 && netWealth >= nisabValue;
  const rate = input.calendar === "lunar" ? LUNAR_RATE : SOLAR_RATE;

  let zakatDue = 0;
  if (!meetsNisab) {
    if (nisabValue > 0) notes.push("Your net zakatable wealth is below the nisab, so no zakat al-mal is due.");
  } else if (!input.hawlComplete) {
    notes.push("Zakat becomes due once a full year (hawl) passes with your wealth at or above the nisab.");
  } else {
    zakatDue = netWealth * rate;
  }

  return {
    goldValue: r2(goldValue),
    pureGoldGrams: r2(pureGoldGrams),
    silverValue: r2(silverValue),
    totalAssets: r2(totalAssets),
    deductions: r2(deductions),
    netWealth: r2(netWealth),
    nisabValue: r2(nisabValue),
    meetsNisab,
    rate,
    zakatDue: r2(zakatDue),
    notes,
  };
}

/** Zakat on a harvest: 10% if rain/river-fed, 5% with paid irrigation, 7.5% for half and half. */
export function cropZakat(harvestKg: number, watering: "natural" | "irrigated" | "mixed"): { meetsNisab: boolean; rate: number; dueKg: number } {
  const rate = watering === "natural" ? 0.1 : watering === "irrigated" ? 0.05 : 0.075;
  const meetsNisab = pos(harvestKg) >= CROP_NISAB_KG;
  return { meetsNisab, rate, dueKg: meetsNisab ? r2(harvestKg * rate) : 0 };
}

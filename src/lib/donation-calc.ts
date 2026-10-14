/// Donation Hub rules (pure): trust layers and validity grades, sponsorship
/// periods, case funding progress and occasion (Eid, Ramadan ...) guidance.

export type DonorRelation = "TEAM" | "FAMILY" | "CLOSE_FRIEND";
export type SponsorshipFrequency = "MONTHLY" | "QUARTERLY";
export type FundingType = "ONE_TIME" | "MONTHLY" | "QUARTERLY";

/** Deepest layer a donor (and so a validator) may sit at. */
export const MAX_LAYER = 6;

export const RELATION_LABELS: Record<DonorRelation, string> = {
  TEAM: "Hub team",
  FAMILY: "Family",
  CLOSE_FRIEND: "Close friend",
};

/**
 * The layer a new donor lands on.
 * - TEAM (the hub's own people) is layer 1 and is never "invited" by a donor.
 * - Family / close friends added directly by the hub are layer 2.
 * - Family / close friends of a layer-n donor are layer n + 1.
 */
export function donorLayer(
  relation: DonorRelation,
  inviter: { layer: number } | null,
): { layer: number } | { error: string } {
  if (relation === "TEAM") {
    if (inviter) return { error: "Hub team members are added by the hub, not invited by a donor." };
    return { layer: 1 };
  }
  const layer = inviter ? inviter.layer + 1 : 2;
  if (layer > MAX_LAYER) {
    return { error: `The chain is limited to ${MAX_LAYER} layers; this donor would be on layer ${layer}.` };
  }
  return { layer };
}

export type ValidityGrade = { grade: "A" | "B" | "C" | "D" | "E"; score: number; label: string };

/** Validity degree of a case from the layer of whoever vouched for it. */
export function validityGrade(layer: number | null | undefined): ValidityGrade | null {
  if (!layer || layer < 1) return null;
  switch (layer) {
    case 1:
      return { grade: "A", score: 100, label: "Known first-hand by the hub team" };
    case 2:
      return { grade: "B", score: 80, label: "Known by family / a close friend of the team" };
    case 3:
      return { grade: "C", score: 60, label: "Known by a friend of a friend" };
    case 4:
      return { grade: "D", score: 40, label: "Layer 4 of the chain" };
    default:
      return { grade: "E", score: 20, label: `Layer ${layer} of the chain — verify before large support` };
  }
}

export const GRADE_STYLES: Record<ValidityGrade["grade"], string> = {
  A: "bg-green-100 text-green-800",
  B: "bg-emerald-50 text-emerald-700",
  C: "bg-amber-50 text-amber-800",
  D: "bg-orange-100 text-orange-800",
  E: "bg-red-50 text-red-700",
};

// --- Sponsorship periods ----------------------------------------------------

/** "2026-10" for monthly, "2026-Q4" for quarterly (UTC dates). */
export function periodKey(frequency: SponsorshipFrequency, date: Date): string {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  return frequency === "MONTHLY" ? `${y}-${String(m + 1).padStart(2, "0")}` : `${y}-Q${Math.floor(m / 3) + 1}`;
}

/** Every period from `start` through `until` (inclusive), oldest first. */
export function periodKeysBetween(frequency: SponsorshipFrequency, start: Date, until: Date): string[] {
  const keys: string[] = [];
  const step = frequency === "MONTHLY" ? 1 : 3;
  const first = frequency === "MONTHLY" ? start.getUTCMonth() : Math.floor(start.getUTCMonth() / 3) * 3;
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), first, 1));
  while (cursor <= until) {
    keys.push(periodKey(frequency, cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + step);
  }
  return keys;
}

export type SponsorshipSchedule = {
  /** Periods that have started so far (bounded by the end date). */
  due: string[];
  paid: string[];
  /** Started periods before the current one that have no payment. */
  overdue: string[];
  currentKey: string | null;
  currentPaid: boolean;
};

export function sponsorshipSchedule(
  s: { frequency: SponsorshipFrequency; startDate: Date; endDate: Date | null; active: boolean },
  paidKeys: string[],
  today: Date,
): SponsorshipSchedule {
  const until = s.endDate && s.endDate < today ? s.endDate : today;
  const due = s.startDate > until ? [] : periodKeysBetween(s.frequency, s.startDate, until);
  const paid = new Set(paidKeys);
  const todayKey = periodKey(s.frequency, today);
  const currentKey = s.active && due.includes(todayKey) ? todayKey : null;
  return {
    due,
    paid: due.filter((k) => paid.has(k)),
    overdue: due.filter((k) => k !== todayKey && !paid.has(k)),
    currentKey,
    currentPaid: currentKey ? paid.has(currentKey) : false,
  };
}

/** A sponsorship amount expressed per case period (a monthly pledge counts 3x toward a quarterly need). */
export function amountPerPeriod(amount: number, from: SponsorshipFrequency, to: SponsorshipFrequency): number {
  if (from === to) return amount;
  return from === "MONTHLY" ? amount * 3 : amount / 3;
}

export type FundingProgress = {
  target: number | null;
  /** ONE_TIME: everything donated. Periodic: active commitments per period. */
  covered: number;
  percent: number | null;
  gap: number | null;
};

export function fundingProgress(
  c: { fundingType: FundingType; goalAmount: number | null; periodAmount: number | null },
  donationsTotal: number,
  activeSponsorships: { amount: number; frequency: SponsorshipFrequency }[],
): FundingProgress {
  if (c.fundingType === "ONE_TIME") {
    const target = c.goalAmount;
    return {
      target,
      covered: donationsTotal,
      percent: target ? Math.min(100, Math.round((donationsTotal / target) * 100)) : null,
      gap: target !== null ? Math.max(0, target - donationsTotal) : null,
    };
  }
  const freq: SponsorshipFrequency = c.fundingType;
  const covered = round2(activeSponsorships.reduce((sum, s) => sum + amountPerPeriod(s.amount, s.frequency, freq), 0));
  const target = c.periodAmount;
  return {
    target,
    covered,
    percent: target ? Math.min(100, Math.round((covered / target) * 100)) : null,
    gap: target !== null ? Math.max(0, round2(target - covered)) : null,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// --- Occasions ----------------------------------------------------------------

export type OccasionType =
  | "ZAKAT_AL_FITR"
  | "EID_AL_ADHA"
  | "RAMADAN"
  | "AQIQAH"
  | "KAFFARAH"
  | "FIDYAH"
  | "WINTER"
  | "BACK_TO_SCHOOL"
  | "ASHURA"
  | "OTHER";

export const OCCASION_INFO: Record<OccasionType, { label: string; unit: string; timing: string; rules: string[] }> = {
  ZAKAT_AL_FITR: {
    label: "Zakat al-Fitr (Eid al-Fitr)",
    unit: "person",
    timing: "Due by every Muslim who has food beyond the day of Eid; give before the Eid prayer (may be given from the start of Ramadan; most scholars allow 1–2 days early at the latest).",
    rules: [
      "One sa' (about 2.5 kg of the local staple — rice, wheat, dates) per person, for yourself and everyone you support, including newborns.",
      "Paying its cash value is accepted by the Hanafi school and by Egypt's Dar al-Ifta, which announces the amount each Ramadan — set it as the unit value.",
      "Recipients: the poor and needy (fuqara / masakin) only.",
      "Giving it after the Eid prayer counts as ordinary sadaqah, not zakat al-fitr.",
    ],
  },
  EID_AL_ADHA: {
    label: "Eid al-Adha — Udhiyah meat",
    unit: "kg",
    timing: "Slaughter after the Eid prayer on 10 Dhul-Hijjah until sunset on 13 Dhul-Hijjah (the days of Tashreeq).",
    rules: [
      "A sheep or goat counts for one person (and their household); a cow or camel may be shared by up to seven.",
      "Minimum ages: sheep 6 months (jadha'), goat 1 year, cow 2 years, camel 5 years; no clear defect (blind, lame, sick, very thin).",
      "Recommended split: one third for the household, one third as gifts, one third for the poor — at least some must reach the poor.",
      "The hide or any part may not be sold, and the butcher is not paid with the meat.",
    ],
  },
  RAMADAN: {
    label: "Ramadan — iftar / food boxes",
    unit: "box",
    timing: "Throughout Ramadan; reward is multiplied and feeding a fasting person earns the reward of their fast.",
    rules: ["General sadaqah: any person in need may receive it.", "Zakat money may also be given as food boxes to zakat-eligible cases."],
  },
  AQIQAH: {
    label: "Aqiqah (newborn)",
    unit: "sheep",
    timing: "Preferably on the 7th day after birth (else the 14th or 21st).",
    rules: ["Two sheep for a boy, one for a girl.", "Same animal conditions as the udhiyah; the meat may be cooked and shared or given to the poor."],
  },
  KAFFARAH: {
    label: "Kaffarah (oath expiation)",
    unit: "poor person fed",
    timing: "After breaking an oath.",
    rules: [
      "Feed ten poor people a meal each (or clothe them); only if unable, fast three days (Al-Ma'idah 5:89).",
      "Use quantity = number of people fed and the unit value = one meal.",
    ],
  },
  FIDYAH: {
    label: "Fidyah (missed fasts)",
    unit: "day",
    timing: "For those who cannot fast and cannot make it up (chronic illness, old age).",
    rules: ["Feed one poor person for each day missed (one meal, or about half a sa' of staple food)."],
  },
  WINTER: {
    label: "Winter — blankets & clothes",
    unit: "family",
    timing: "Before the cold season.",
    rules: ["General sadaqah; zakat may also be used for zakat-eligible cases."],
  },
  BACK_TO_SCHOOL: {
    label: "Back to school",
    unit: "student",
    timing: "Before the school year.",
    rules: ["Fees, books and uniforms. Zakat may cover it for poor families."],
  },
  ASHURA: {
    label: "Ashura / Day of Arafah sadaqah",
    unit: "family",
    timing: "10 Muharram / 9 Dhul-Hijjah.",
    rules: ["Voluntary sadaqah on blessed days."],
  },
  OTHER: { label: "Other occasion", unit: "unit", timing: "", rules: [] },
};

/** Shares a udhiyah animal covers. */
export function udhiyahShares(animal: "SHEEP" | "GOAT" | "COW" | "CAMEL"): number {
  return animal === "SHEEP" || animal === "GOAT" ? 1 : 7;
}

/** The recommended thirds of the udhiyah meat. */
export function meatThirds(totalKg: number): { household: number; gifts: number; poor: number } {
  const third = Math.round((totalKg / 3) * 100) / 100;
  return { household: third, gifts: third, poor: Math.round((totalKg - 2 * third) * 100) / 100 };
}

/** Zakat al-fitr for a household: per person, in food (kg) and in money. */
export function zakatAlFitr(persons: number, valuePerPerson: number, kgPerPerson = 2.5): { kg: number; amount: number } {
  const n = Math.max(0, Math.floor(persons));
  return { kg: Math.round(n * kgPerPerson * 100) / 100, amount: Math.round(n * valuePerPerson * 100) / 100 };
}

export const ZAKAT_CATEGORY_LABELS: Record<string, string> = {
  FUQARA: "Al-Fuqara — the poor",
  MASAKIN: "Al-Masakin — the needy",
  AMILIN: "Al-Amilin — zakat workers",
  MUALLAF: "Al-Mu'allafah — hearts to be reconciled",
  RIQAB: "Ar-Riqab — freeing captives",
  GHARIMIN: "Al-Gharimin — people in debt",
  FI_SABILILLAH: "Fi Sabilillah — in the cause of Allah",
  IBN_SABIL: "Ibn as-Sabil — the stranded traveller",
};

export const CATEGORY_LABELS: Record<string, string> = {
  FOOD: "Food",
  MEDICAL: "Medical",
  ORPHAN: "Orphan",
  WIDOW: "Widow",
  ELDERLY: "Elderly",
  DISABILITY: "Disability",
  EDUCATION: "Education",
  HOUSING: "Housing / rent",
  DEBT: "Debt",
  MARRIAGE: "Marriage",
  EMERGENCY: "Emergency",
  OTHER: "Other",
};

export const KIND_LABELS: Record<string, string> = {
  ZAKAT: "Zakat al-Mal",
  SADAQAH: "Sadaqah",
  ZAKAT_AL_FITR: "Zakat al-Fitr",
  UDHIYAH: "Udhiyah",
  KAFFARAH: "Kaffarah",
  FIDYAH: "Fidyah",
  AQIQAH: "Aqiqah",
  NADHR: "Nadhr (vow)",
  WAQF: "Waqf",
  OTHER: "Other",
};

export const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending validation",
  ACTIVE: "Active",
  FUNDED: "Funded",
  CLOSED: "Closed",
};

/**
 * Whether a donation of `kind` may go to a case. Zakat al-mal needs one of the
 * eight categories; zakat al-fitr and fidyah/kaffarah go to the poor and needy.
 */
export function donationAllowed(kind: string, zakatCategory: string | null): string | null {
  const poor = zakatCategory === "FUQARA" || zakatCategory === "MASAKIN";
  if (kind === "ZAKAT" && !zakatCategory) {
    return "This case isn't marked as zakat-eligible; record it as sadaqah or set its zakat category.";
  }
  if ((kind === "ZAKAT_AL_FITR" || kind === "KAFFARAH" || kind === "FIDYAH") && !poor) {
    return "Zakat al-fitr, kaffarah and fidyah go to the poor or needy (fuqara / masakin) only.";
  }
  return null;
}

/** "Sara Hassan Ali" -> "Sara H." — what donors see on their shared page. */
export function displayName(name: string): string {
  const [first, ...rest] = name.trim().split(/\s+/);
  return rest.length ? `${first} ${rest[0][0]}.` : (first ?? "");
}

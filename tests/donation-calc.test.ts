import { describe, it, expect } from "vitest";
import {
  amountPerPeriod,
  displayName,
  donationAllowed,
  donorLayer,
  fundingProgress,
  MAX_LAYER,
  meatThirds,
  periodKey,
  periodKeysBetween,
  sponsorshipSchedule,
  udhiyahShares,
  validityGrade,
  zakatAlFitr,
} from "../src/lib/donation-calc";
import { calculateZakat, cropZakat, type ZakatInput } from "../src/lib/zakat-calc";

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe("trust layers", () => {
  it("places the team on layer 1 and each family/friend one layer below who brought them", () => {
    expect(donorLayer("TEAM", null)).toEqual({ layer: 1 });
    expect(donorLayer("FAMILY", null)).toEqual({ layer: 2 });
    expect(donorLayer("CLOSE_FRIEND", { layer: 2 })).toEqual({ layer: 3 });
    expect(donorLayer("TEAM", { layer: 1 })).toHaveProperty("error");
    expect(donorLayer("FAMILY", { layer: MAX_LAYER })).toHaveProperty("error");
  });

  it("grades validity by the validator's layer", () => {
    expect(validityGrade(1)).toMatchObject({ grade: "A", score: 100 });
    expect(validityGrade(2)).toMatchObject({ grade: "B", score: 80 });
    expect(validityGrade(3)).toMatchObject({ grade: "C", score: 60 });
    expect(validityGrade(4)).toMatchObject({ grade: "D", score: 40 });
    expect(validityGrade(6)).toMatchObject({ grade: "E", score: 20 });
    expect(validityGrade(null)).toBeNull();
  });
});

describe("sponsorship periods", () => {
  it("keys months and quarters", () => {
    expect(periodKey("MONTHLY", d("2026-01-31"))).toBe("2026-01");
    expect(periodKey("QUARTERLY", d("2026-10-14"))).toBe("2026-Q4");
    expect(periodKeysBetween("MONTHLY", d("2026-11-20"), d("2027-02-01"))).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"]);
    expect(periodKeysBetween("QUARTERLY", d("2026-02-15"), d("2026-10-14"))).toEqual(["2026-Q1", "2026-Q2", "2026-Q3", "2026-Q4"]);
  });

  it("finds overdue periods, ignores the current one and stops at the end date", () => {
    const s = { frequency: "MONTHLY" as const, startDate: d("2026-07-05"), endDate: null, active: true };
    const sched = sponsorshipSchedule(s, ["2026-07", "2026-09"], d("2026-10-14"));
    expect(sched.due).toEqual(["2026-07", "2026-08", "2026-09", "2026-10"]);
    expect(sched.overdue).toEqual(["2026-08"]);
    expect(sched.currentKey).toBe("2026-10");
    expect(sched.currentPaid).toBe(false);

    const ended = sponsorshipSchedule({ ...s, endDate: d("2026-08-31") }, ["2026-07", "2026-08"], d("2026-10-14"));
    expect(ended.due).toEqual(["2026-07", "2026-08"]);
    expect(ended.overdue).toEqual([]);
    expect(ended.currentKey).toBeNull();
  });

  it("measures periodic coverage in the case's own period", () => {
    expect(amountPerPeriod(500, "MONTHLY", "QUARTERLY")).toBe(1500);
    const p = fundingProgress({ fundingType: "QUARTERLY", goalAmount: null, periodAmount: 3000 }, 0, [
      { amount: 500, frequency: "MONTHLY" },
      { amount: 600, frequency: "QUARTERLY" },
    ]);
    expect(p).toEqual({ target: 3000, covered: 2100, percent: 70, gap: 900 });
    expect(fundingProgress({ fundingType: "ONE_TIME", goalAmount: 1000, periodAmount: null }, 1200, [])).toMatchObject({ percent: 100, gap: 0 });
  });
});

describe("islamic giving rules", () => {
  it("keeps zakat for eligible cases and fitr/kaffarah/fidyah for the poor", () => {
    expect(donationAllowed("ZAKAT", null)).toBeTruthy();
    expect(donationAllowed("ZAKAT", "GHARIMIN")).toBeNull();
    expect(donationAllowed("ZAKAT_AL_FITR", "GHARIMIN")).toBeTruthy();
    expect(donationAllowed("ZAKAT_AL_FITR", "MASAKIN")).toBeNull();
    expect(donationAllowed("SADAQAH", null)).toBeNull();
  });

  it("splits udhiyah meat in thirds and counts shares", () => {
    expect(meatThirds(20)).toEqual({ household: 6.67, gifts: 6.67, poor: 6.66 });
    expect(udhiyahShares("SHEEP")).toBe(1);
    expect(udhiyahShares("COW")).toBe(7);
    expect(zakatAlFitr(5, 35)).toEqual({ kg: 12.5, amount: 175 });
  });

  it("shortens names for donors", () => {
    expect(displayName("Sara Hassan Ali")).toBe("Sara H.");
    expect(displayName("Mona")).toBe("Mona");
  });
});

describe("zakat calculator", () => {
  const base: ZakatInput = {
    cash: 0,
    bank: 0,
    gold: [],
    silverGrams: 0,
    goldPrice24k: 4000,
    silverPrice: 50,
    investments: 0,
    inventory: 0,
    receivables: 0,
    otherAssets: 0,
    debtsDue: 0,
    nisabBasis: "gold",
    includePersonalJewelry: false,
    calendar: "lunar",
    hawlComplete: true,
  };

  it("charges 2.5% of net wealth above the gold nisab", () => {
    // Nisab = 85 g x 4000 = 340,000.
    const r = calculateZakat({ ...base, cash: 100_000, bank: 300_000, debtsDue: 20_000 });
    expect(r.nisabValue).toBe(340_000);
    expect(r.netWealth).toBe(380_000);
    expect(r.meetsNisab).toBe(true);
    expect(r.zakatDue).toBe(9_500);
  });

  it("owes nothing below the nisab or before a full year", () => {
    expect(calculateZakat({ ...base, cash: 300_000 }).zakatDue).toBe(0);
    const early = calculateZakat({ ...base, cash: 500_000, hawlComplete: false });
    expect(early.meetsNisab).toBe(true);
    expect(early.zakatDue).toBe(0);
  });

  it("uses the lower silver nisab and the solar rate when chosen", () => {
    const r = calculateZakat({ ...base, cash: 40_000, nisabBasis: "silver", calendar: "solar" });
    expect(r.nisabValue).toBe(29_750);
    expect(r.zakatDue).toBe(1030.8);
  });

  it("converts gold karats to pure grams and excludes worn jewellery unless asked", () => {
    const gold = [
      { karat: 21 as const, grams: 80, personalUse: false },
      { karat: 18 as const, grams: 40, personalUse: true },
    ];
    const majority = calculateZakat({ ...base, gold });
    expect(majority.pureGoldGrams).toBe(70); // 80 x 21/24
    expect(majority.meetsNisab).toBe(false);
    const hanafi = calculateZakat({ ...base, gold, includePersonalJewelry: true });
    expect(hanafi.pureGoldGrams).toBe(100); // + 40 x 18/24
    expect(hanafi.zakatDue).toBe(10_000);
  });

  it("rates crops by how they are watered", () => {
    expect(cropZakat(1000, "natural")).toEqual({ meetsNisab: true, rate: 0.1, dueKg: 100 });
    expect(cropZakat(1000, "irrigated").dueKg).toBe(50);
    expect(cropZakat(500, "natural").dueKg).toBe(0);
  });
});

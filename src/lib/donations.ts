import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { mobileKey } from "@/lib/phone";
import { fundingProgress, sponsorshipSchedule, validityGrade, type SponsorshipFrequency } from "@/lib/donation-calc";
import { toNumber } from "@/lib/format";
import { cairoToday } from "@/lib/dates";

/** Hubs a user can see: their own, ones they're on the team of, and public ones. */
export function hubsVisibleTo(userId: string): Prisma.DonationHubWhereInput {
  return { OR: [{ ownerId: userId }, { members: { some: { userId } } }, { visibility: "PUBLIC" }] };
}

/** Hubs a user can change: owner or team member. */
export function hubsManagedBy(userId: string): Prisma.DonationHubWhereInput {
  return { OR: [{ ownerId: userId }, { members: { some: { userId } } }] };
}

export type HubAccess = { hub: { id: string; name: string; ownerId: string; visibility: "PRIVATE" | "PUBLIC" }; canManage: boolean };

export async function hubAccess(userId: string, hubId: string): Promise<HubAccess | null> {
  const hub = await prisma.donationHub.findFirst({
    where: { id: hubId, ...hubsVisibleTo(userId) },
    select: { id: true, name: true, ownerId: true, visibility: true, members: { where: { userId }, select: { userId: true } } },
  });
  if (!hub) return null;
  const { members, ...rest } = hub;
  return { hub: rest, canManage: hub.ownerId === userId || members.length > 0 };
}

export function manageableHubs(userId: string) {
  return prisma.donationHub.findMany({ where: hubsManagedBy(userId), select: { id: true, name: true }, orderBy: { name: "asc" } });
}

export type CaseDuplicate = {
  /** Only set when the user can open that case. */
  id: string | null;
  hubName: string;
  sameHub: boolean;
  status: string;
  matchedOn: ("national ID" | "mobile")[];
  activeSponsorships: number;
  donatedLast90Days: number;
};

/**
 * The same person registered anywhere (every hub, so separate sources don't
 * fund one case twice without knowing). Matches national ID or mobile.
 */
export async function findCaseDuplicates(
  userId: string,
  hubId: string,
  nationalId: string | null | undefined,
  mobile: string | null | undefined,
  excludeId?: string,
): Promise<CaseDuplicate[]> {
  const nid = nationalId?.replace(/\s/g, "") || null;
  const mKey = mobileKey(mobile);
  if (!nid && !mKey) return [];
  const since = new Date(Date.now() - 90 * 24 * 3600 * 1000);
  const rows = await prisma.donationCase.findMany({
    where: {
      id: excludeId ? { not: excludeId } : undefined,
      OR: [...(nid ? [{ nationalId: nid }] : []), ...(mKey ? [{ mobileKey: mKey }] : [])],
    },
    select: {
      id: true,
      hubId: true,
      status: true,
      nationalId: true,
      mobileKey: true,
      hub: { select: { name: true, ownerId: true, visibility: true, members: { where: { userId }, select: { userId: true } } } },
      _count: { select: { sponsorships: { where: { active: true } } } },
      donations: { where: { date: { gte: since } }, select: { amount: true } },
    },
  });
  return rows.map((r) => {
    const visible = r.hub.ownerId === userId || r.hub.members.length > 0 || r.hub.visibility === "PUBLIC";
    const matchedOn: CaseDuplicate["matchedOn"] = [];
    if (nid && r.nationalId === nid) matchedOn.push("national ID");
    if (mKey && r.mobileKey === mKey) matchedOn.push("mobile");
    return {
      id: visible ? r.id : null,
      hubName: r.hub.name,
      sameHub: r.hubId === hubId,
      status: r.status,
      matchedOn,
      activeSponsorships: r._count.sponsorships,
      donatedLast90Days: r.donations.reduce((s, d) => s + toNumber(d.amount), 0),
    };
  });
}

/** Cases a donor may see: the hub's CHAIN cases, plus PRIVATE ones they were picked for or validated. */
export function casesVisibleToDonor(donor: { id: string; hubId: string }): Prisma.DonationCaseWhereInput {
  return {
    hubId: donor.hubId,
    status: { in: ["ACTIVE", "FUNDED"] },
    OR: [{ audience: "CHAIN" }, { visibleTo: { some: { donorId: donor.id } } }, { validatedByDonorId: donor.id }],
  };
}

export const caseSummaryInclude = {
  hub: { select: { id: true, name: true } },
  donations: { select: { amount: true } },
  sponsorships: { where: { active: true }, select: { amount: true, frequency: true } },
  validatedByDonor: { select: { id: true, name: true, layer: true } },
  validatedByUser: { select: { name: true } },
} satisfies Prisma.DonationCaseInclude;

type CaseForSummary = Prisma.DonationCaseGetPayload<{ include: typeof caseSummaryInclude }>;

export function summarizeCase(c: CaseForSummary) {
  const raised = c.donations.reduce((s, d) => s + toNumber(d.amount), 0);
  return {
    raised,
    grade: validityGrade(c.validationLayer),
    progress: fundingProgress(
      { fundingType: c.fundingType, goalAmount: c.goalAmount ? toNumber(c.goalAmount) : null, periodAmount: c.periodAmount ? toNumber(c.periodAmount) : null },
      raised,
      c.sponsorships.map((s) => ({ amount: toNumber(s.amount), frequency: s.frequency })),
    ),
    validator: c.validatedByUser ? `${c.validatedByUser.name} (team)` : c.validatedByDonor?.name ?? null,
  };
}

/** Which of these cases are also registered by another hub (by national ID or mobile). */
export async function crossHubFlags(cases: { id: string; hubId: string; nationalId: string | null; mobileKey: string | null }[]) {
  const nids = cases.map((c) => c.nationalId).filter((v): v is string => Boolean(v));
  const mobiles = cases.map((c) => c.mobileKey).filter((v): v is string => Boolean(v));
  if (!nids.length && !mobiles.length) return new Set<string>();
  const others = await prisma.donationCase.findMany({
    where: { OR: [{ nationalId: { in: nids } }, { mobileKey: { in: mobiles } }] },
    select: { id: true, hubId: true, nationalId: true, mobileKey: true },
  });
  const flagged = new Set<string>();
  for (const c of cases) {
    if (
      others.some(
        (o) => o.id !== c.id && o.hubId !== c.hubId && ((c.nationalId && o.nationalId === c.nationalId) || (c.mobileKey && o.mobileKey === c.mobileKey)),
      )
    ) {
      flagged.add(c.id);
    }
  }
  return flagged;
}

/** Sponsorships with their period status, for the sponsorships page, a case and a donor. */
export async function sponsorshipsWithSchedule(where: Prisma.SponsorshipWhereInput) {
  const today = cairoToday();
  const rows = await prisma.sponsorship.findMany({
    where,
    include: {
      case: { select: { id: true, name: true, hubId: true, hub: { select: { name: true } } } },
      donor: { select: { id: true, name: true, mobile: true } },
      donations: { select: { periodKey: true } },
    },
    orderBy: [{ active: "desc" }, { startDate: "desc" }],
  });
  return rows.map((s) => ({
    ...s,
    amountNumber: toNumber(s.amount),
    schedule: sponsorshipSchedule(
      { frequency: s.frequency as SponsorshipFrequency, startDate: s.startDate, endDate: s.endDate, active: s.active },
      s.donations.map((d) => d.periodKey).filter((k): k is string => Boolean(k)),
      today,
    ),
  }));
}

/** A donor's whole downline (everyone they brought in, and so on), for the chain view. */
export function buildDonorTree<T extends { id: string; invitedById: string | null }>(donors: T[]) {
  const children = new Map<string | null, T[]>();
  for (const d of donors) {
    const key = d.invitedById && donors.some((x) => x.id === d.invitedById) ? d.invitedById : null;
    children.set(key, [...(children.get(key) ?? []), d]);
  }
  const walk = (parent: string | null, depth: number): { donor: T; depth: number }[] =>
    (children.get(parent) ?? []).flatMap((d) => [{ donor: d, depth }, ...walk(d.id, depth + 1)]);
  return walk(null, 0);
}

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import ExcelJS from "exceljs";
import { login, signup, authedFetch, authedJson, url } from "./helpers/api";
import { prisma, closeDb } from "./helpers/db";
import { signDonorToken } from "../src/lib/donor-link";
import { testEnv } from "./helpers/test-env";

let cookie: string;
let otherCookie: string;
let hubId: string;
let otherHubId: string;
const tag = Date.now();
const digits = String(tag).slice(-8);
const nid = (n: number) => `29${n}${digits}0000`.slice(0, 14);

async function json<T = Record<string, unknown>>(res: Response, status: number): Promise<T> {
  const body = await res.json();
  expect(res.status, JSON.stringify(body)).toBe(status);
  return body as T;
}

async function addDonor(body: Record<string, unknown>) {
  return (await json<{ donor: { id: string; layer: number } }>(await authedJson(cookie, "/api/donors", "POST", { hubId, ...body }), 201)).donor;
}

beforeAll(async () => {
  process.env.JWT_SECRET = testEnv.JWT_SECRET;
  cookie = await signup("Hub Owner", `owner-${tag}@charityhub.test`, "Owner12345");
  otherCookie = await signup(`Other ${tag}`, `other-${tag}@charityhub.test`, "Other12345");
  hubId = (await json<{ hub: { id: string } }>(await authedJson(cookie, "/api/donation-hubs", "POST", { name: `Family circle ${tag}` }), 201)).hub.id;
  otherHubId = (await json<{ hub: { id: string } }>(await authedJson(otherCookie, "/api/donation-hubs", "POST", { name: `Other source ${tag}` }), 201)).hub.id;
}, 60_000);

afterAll(closeDb);

describe("accounts", () => {
  it("sign up once per email, sign in with the right password only, and guard the app", async () => {
    expect((await fetch(url("/api/auth/signup"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Again", email: `OWNER-${tag}@charityhub.test`, password: "Owner12345" }) })).status).toBe(409);
    await expect(login(`owner-${tag}@charityhub.test`, "wrong-password")).rejects.toThrow();
    expect(await login(`owner-${tag}@charityhub.test`, "Owner12345")).toContain("charityhub_session=");
    expect((await fetch(url("/api/donation-hubs"))).status).toBe(401);
    const page = await fetch(url("/cases"), { redirect: "manual" });
    expect(page.status).toBe(307);
    expect(page.headers.get("location")).toContain("/login");
    expect((await authedFetch(cookie, "/")).status).toBe(200);
  }, 30_000);
});

describe("donation hubs", () => {
  it("keep individual hubs private and let only the owner's team manage them", async () => {
    expect((await authedJson(otherCookie, "/api/donors", "POST", { hubId, name: "X", relation: "FAMILY" })).status).toBe(404);
    const hubs = await json<{ hubs: { id: string }[] }>(await authedFetch(otherCookie, "/api/donation-hubs"), 200);
    expect(hubs.hubs.map((h) => h.id)).not.toContain(hubId);

    // Public: visible, still not editable by non-team users.
    await json(await authedJson(cookie, `/api/donation-hubs/${hubId}`, "PATCH", { visibility: "PUBLIC" }), 200);
    const after = await json<{ hubs: { id: string }[] }>(await authedFetch(otherCookie, "/api/donation-hubs"), 200);
    expect(after.hubs.map((h) => h.id)).toContain(hubId);
    expect((await authedJson(otherCookie, "/api/donors", "POST", { hubId, name: "X", relation: "FAMILY" })).status).toBe(403);
    await json(await authedJson(cookie, `/api/donation-hubs/${hubId}`, "PATCH", { visibility: "PRIVATE" }), 200);
  }, 30_000);
});

describe("donor chain", () => {
  it("places donors on layers by who brought them in", async () => {
    const team = await addDonor({ name: "Team Member", relation: "TEAM" });
    expect(team.layer).toBe(1);
    const brother = await addDonor({ name: "Brother", relation: "FAMILY", mobile: `010${digits}` });
    expect(brother.layer).toBe(2);
    const friend = await addDonor({ name: "Brother's Friend", relation: "CLOSE_FRIEND", invitedById: brother.id });
    expect(friend.layer).toBe(3);
    const dup = await authedJson(cookie, "/api/donors", "POST", { hubId, name: "Same phone", relation: "FAMILY", mobile: `+2010${digits}` });
    expect(dup.status).toBe(409);
    const badTeam = await authedJson(cookie, "/api/donors", "POST", { hubId, name: "x", relation: "TEAM", invitedById: brother.id });
    expect(badTeam.status).toBe(400);
  }, 30_000);

  it("imports a contact list one layer under the inviter, skipping other relations", async () => {
    const inviter = await prisma.donor.findFirstOrThrow({ where: { hubId, name: "Brother" } });
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet("Sheet1");
    sheet.addRow(["Name", "Mobile", "Location", "Monthly amount", "Relation"]);
    sheet.addRow(["Cousin Ali", `011${digits}`, "Giza", 300, "Family"]);
    sheet.addRow(["Neighbour", `012${digits}`, "Giza", 100, "Neighbour"]);
    sheet.addRow(["Old friend", `015${digits}`, "Cairo", "", ""]);
    sheet.addRow(["Brother again", `010${digits}`, "", "", "Family"]);
    const body = new FormData();
    body.append("file", new Blob([new Uint8Array(await wb.xlsx.writeBuffer())]), "donors.xlsx");
    body.append("hubId", hubId);
    body.append("invitedById", inviter.id);
    const res = await json<{ added: number; skipped: string[]; layer: number }>(
      await authedFetch(cookie, "/api/donors/import", { method: "POST", body }),
      200,
    );
    expect(res.added).toBe(2);
    expect(res.layer).toBe(3);
    expect(res.skipped).toHaveLength(2);
    const imported = await prisma.donor.findMany({ where: { hubId, invitedById: inviter.id, name: { in: ["Cousin Ali", "Old friend"] } } });
    expect(imported.map((d) => [d.name, d.relation, d.layer]).sort()).toEqual([
      ["Cousin Ali", "FAMILY", 3],
      ["Old friend", "CLOSE_FRIEND", 3],
    ]);
  }, 30_000);
});

describe("cases", () => {
  it("grades a case by its validator and refuses activation without one", async () => {
    const friend = await prisma.donor.findFirstOrThrow({ where: { hubId, name: "Brother's Friend" } });
    const unvalidated = await authedJson(cookie, "/api/donation-cases", "POST", { hubId, name: "No one knows", status: "ACTIVE" });
    expect(unvalidated.status).toBe(400);
    const pending = await json<{ case: { status: string } }>(await authedJson(cookie, "/api/donation-cases", "POST", { hubId, name: "Pending one" }), 201);
    expect(pending.case.status).toBe("PENDING");

    const created = await json<{ case: { id: string; validationLayer: number; status: string } }>(
      await authedJson(cookie, "/api/donation-cases", "POST", {
        hubId,
        name: "Umm Ahmed Widow",
        nationalId: nid(1),
        mobile: `0100${digits.slice(0, 7)}`,
        category: "WIDOW",
        zakatCategory: "FUQARA",
        fundingType: "ONE_TIME",
        goalAmount: "1000",
        validatedBy: friend.id,
      }),
      201,
    );
    expect(created.case.validationLayer).toBe(3);
    expect(created.case.status).toBe("ACTIVE");
    const teamCase = await json<{ case: { validationLayer: number; validatedByUserId: string } }>(
      await authedJson(cookie, "/api/donation-cases", "POST", { hubId, name: "Known by us", validatedBy: "team" }),
      201,
    );
    expect(teamCase.case.validationLayer).toBe(1);
  }, 30_000);

  it("warns when another source already registered the same person", async () => {
    const res = await authedJson(otherCookie, "/api/donation-cases", "POST", {
      hubId: otherHubId,
      name: "Same widow, other source",
      nationalId: nid(1),
      validatedBy: "team",
    });
    const body = await json<{ duplicates: { id: string | null; hubName: string; sameHub: boolean; matchedOn: string[] }[] }>(res, 409);
    expect(body.duplicates).toHaveLength(1);
    expect(body.duplicates[0]).toMatchObject({ id: null, sameHub: false, matchedOn: ["national ID"], hubName: `Family circle ${tag}` });
    const forced = await authedJson(otherCookie, "/api/donation-cases", "POST", {
      hubId: otherHubId,
      name: "Same widow, other source",
      nationalId: nid(1),
      validatedBy: "team",
      allowDuplicate: true,
    });
    expect(forced.status).toBe(201);
    // Same mobile written another way is a match too.
    const byMobile = await authedJson(cookie, "/api/donation-cases", "POST", { hubId, name: "x", mobile: `+20100${digits.slice(0, 7)}` });
    expect(byMobile.status).toBe(409);
  }, 30_000);
});

describe("donations", () => {
  it("applies zakat rules and marks a one-time case funded at its goal", async () => {
    const c = await prisma.donationCase.findFirstOrThrow({ where: { hubId, name: "Umm Ahmed Widow" } });
    const sadaqahOnly = await prisma.donationCase.findFirstOrThrow({ where: { hubId, name: "Known by us" } });
    const pending = await prisma.donationCase.findFirstOrThrow({ where: { hubId, name: "Pending one" } });
    const donor = await prisma.donor.findFirstOrThrow({ where: { hubId, name: "Brother" } });
    const give = (caseId: string, body: Record<string, unknown>) =>
      authedJson(cookie, "/api/donations", "POST", { caseId, donorId: donor.id, date: "2026-10-01", ...body });

    expect((await give(sadaqahOnly.id, { amount: 100, kind: "ZAKAT" })).status).toBe(400);
    expect((await give(pending.id, { amount: 100 })).status).toBe(400);
    await json(await give(c.id, { amount: 600, kind: "ZAKAT" }), 201);
    expect((await prisma.donationCase.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("ACTIVE");
    await json(await give(c.id, { amount: 400 }), 201);
    expect((await prisma.donationCase.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("FUNDED");
  }, 30_000);

  it("tracks monthly sponsorship installments once per period", async () => {
    const donor = await prisma.donor.findFirstOrThrow({ where: { hubId, name: "Brother's Friend" } });
    const c = await json<{ case: { id: string } }>(
      await authedJson(cookie, "/api/donation-cases", "POST", {
        hubId,
        name: "Orphan school fees",
        fundingType: "MONTHLY",
        periodAmount: "800",
        periodStart: "2026-09-01",
        periodEnd: "2027-06-30",
        validatedBy: "team",
      }),
      201,
    );
    const s = await json<{ sponsorship: { id: string; endDate: string } }>(
      await authedJson(cookie, "/api/sponsorships", "POST", {
        caseId: c.case.id,
        donorId: donor.id,
        amount: 500,
        frequency: "MONTHLY",
        startDate: "2026-09-01",
      }),
      201,
    );
    expect(s.sponsorship.endDate.slice(0, 10)).toBe("2027-06-30");
    const pay = (periodKey: string) =>
      authedJson(cookie, "/api/donations", "POST", { caseId: c.case.id, donorId: donor.id, sponsorshipId: s.sponsorship.id, periodKey, amount: 500, date: "2026-10-05" });
    await json(await pay("2026-09"), 201);
    expect((await pay("2026-09")).status).toBe(409);
    await json(await pay("2026-10"), 201);
    const paid = await prisma.donation.findMany({ where: { sponsorshipId: s.sponsorship.id }, orderBy: { periodKey: "asc" } });
    expect(paid.map((p) => p.periodKey)).toEqual(["2026-09", "2026-10"]);
  }, 30_000);
});

describe("occasions", () => {
  it("allocates zakat al-fitr per person to poor cases only", async () => {
    const occ = await json<{ occasion: { id: string } }>(
      await authedJson(cookie, "/api/donation-occasions", "POST", { hubId, type: "ZAKAT_AL_FITR", title: "Fitr 1448", unitValue: 35 }),
      201,
    );
    const poor = await prisma.donationCase.findFirstOrThrow({ where: { hubId, name: "Umm Ahmed Widow" } });
    const notPoor = await prisma.donationCase.findFirstOrThrow({ where: { hubId, name: "Known by us" } });
    const a = await json<{ allocation: { id: string; amount: string } }>(
      await authedJson(cookie, `/api/donation-occasions/${occ.occasion.id}/allocations`, "POST", { caseId: poor.id, quantity: 5 }),
      201,
    );
    expect(Number(a.allocation.amount)).toBe(175);
    expect((await authedJson(cookie, `/api/donation-occasions/${occ.occasion.id}/allocations`, "POST", { caseId: poor.id, quantity: 1 })).status).toBe(409);
    expect((await authedJson(cookie, `/api/donation-occasions/${occ.occasion.id}/allocations`, "POST", { caseId: notPoor.id, quantity: 2 })).status).toBe(400);
    const done = await json<{ allocation: { delivered: boolean; deliveredAt: string | null } }>(
      await authedJson(cookie, `/api/occasion-allocations/${a.allocation.id}`, "PATCH", { delivered: true }),
      200,
    );
    expect(done.allocation.delivered).toBe(true);
    expect(done.allocation.deliveredAt).not.toBeNull();
  }, 30_000);
});

describe("donor page", () => {
  it("shows chain cases and only the private cases a donor was picked for", async () => {
    const brother = await prisma.donor.findFirstOrThrow({ where: { hubId, name: "Brother" } });
    const cousin = await prisma.donor.findFirstOrThrow({ where: { hubId, name: "Cousin Ali" } });
    await json(
      await authedJson(cookie, "/api/donation-cases", "POST", {
        hubId,
        name: "Private Medical Case",
        audience: "PRIVATE",
        visibleDonorIds: [cousin.id],
        validatedBy: "team",
      }),
      201,
    );
    const page = async (donorId: string) => (await fetch(url(`/give/${signDonorToken(donorId)}`))).text();
    const cousinPage = await page(cousin.id);
    const brotherPage = await page(brother.id);
    expect(cousinPage).toContain("Private M.");
    expect(brotherPage).not.toContain("Private M.");
    expect(brotherPage).toContain("Known b.");
    // Contact details never reach the donor page.
    expect(cousinPage).not.toContain(nid(1));
    expect(await (await fetch(url("/give/not-a-token"))).text()).toContain("expired");
  }, 60_000);
});

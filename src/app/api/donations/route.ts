import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { donationSchema, firstIssue } from "@/lib/donation-schemas";
import { hubAccess } from "@/lib/donations";
import { donationAllowed, periodKey } from "@/lib/donation-calc";
import { toNumber } from "@/lib/format";

/** Records a gift (or one sponsorship installment) to a case. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = donationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  const data = parsed.data;

  const target = await prisma.donationCase.findUnique({
    where: { id: data.caseId },
    select: { id: true, hubId: true, status: true, zakatCategory: true, fundingType: true, goalAmount: true },
  });
  const access = target && (await hubAccess(session.userId, target.hubId));
  if (!target || !access) return NextResponse.json({ error: "Case not found" }, { status: 404 });
  if (!access.canManage) return NextResponse.json({ error: "Only the hub's team can record donations" }, { status: 403 });
  if (target.status === "PENDING") return NextResponse.json({ error: "Validate the case before it receives donations." }, { status: 400 });
  const donor = await prisma.donor.findFirst({ where: { id: data.donorId, hubId: target.hubId }, select: { id: true } });
  if (!donor) return NextResponse.json({ error: "The donor isn't in this case's hub" }, { status: 400 });

  let key = data.periodKey;
  let kind = data.kind;
  if (data.sponsorshipId) {
    const s = await prisma.sponsorship.findFirst({ where: { id: data.sponsorshipId, caseId: target.id, donorId: donor.id } });
    if (!s) return NextResponse.json({ error: "That sponsorship isn't this donor's for this case" }, { status: 400 });
    key = key ?? periodKey(s.frequency, data.date);
    kind = s.kind;
  } else {
    key = null;
  }
  const notAllowed = donationAllowed(kind, target.zakatCategory);
  if (notAllowed) return NextResponse.json({ error: notAllowed }, { status: 400 });

  try {
    const donation = await prisma.$transaction(async (tx) => {
      const created = await tx.donation.create({ data: { ...data, kind, periodKey: key, recordedById: session.userId } });
      // A one-time case that has reached its goal is marked funded.
      if (target.fundingType === "ONE_TIME" && target.goalAmount && target.status === "ACTIVE") {
        const sum = await tx.donation.aggregate({ where: { caseId: target.id }, _sum: { amount: true } });
        if (toNumber(sum._sum.amount) >= toNumber(target.goalAmount)) {
          await tx.donationCase.update({ where: { id: target.id }, data: { status: "FUNDED" } });
        }
      }
      return created;
    });
    return NextResponse.json({ donation }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: `The ${key} installment is already recorded.` }, { status: 409 });
    }
    throw err;
  }
}

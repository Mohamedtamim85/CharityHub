import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { firstIssue, sponsorshipSchema } from "@/lib/donation-schemas";
import { hubAccess } from "@/lib/donations";
import { donationAllowed } from "@/lib/donation-calc";

/** A donor's monthly / quarterly commitment to a case. */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = sponsorshipSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  const data = parsed.data;
  const target = await prisma.donationCase.findUnique({
    where: { id: data.caseId },
    select: { hubId: true, status: true, zakatCategory: true, periodEnd: true },
  });
  const access = target && (await hubAccess(session.userId, target.hubId));
  if (!target || !access) return NextResponse.json({ error: "Case not found" }, { status: 404 });
  if (!access.canManage) return NextResponse.json({ error: "Only the hub's team can add sponsorships" }, { status: 403 });
  if (target.status === "PENDING") return NextResponse.json({ error: "Validate the case before it gets sponsors." }, { status: 400 });
  if (data.endDate && data.endDate < data.startDate) return NextResponse.json({ error: "The end date is before the start date" }, { status: 400 });
  const donor = await prisma.donor.findFirst({ where: { id: data.donorId, hubId: target.hubId }, select: { id: true } });
  if (!donor) return NextResponse.json({ error: "The donor isn't in this case's hub" }, { status: 400 });
  const notAllowed = donationAllowed(data.kind, target.zakatCategory);
  if (notAllowed) return NextResponse.json({ error: notAllowed }, { status: 400 });
  const sponsorship = await prisma.sponsorship.create({ data: { ...data, endDate: data.endDate ?? target.periodEnd } });
  return NextResponse.json({ sponsorship }, { status: 201 });
}

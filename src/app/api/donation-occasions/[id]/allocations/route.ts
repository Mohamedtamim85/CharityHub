import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { allocationSchema, firstIssue } from "@/lib/donation-schemas";
import { hubAccess } from "@/lib/donations";
import { donationAllowed } from "@/lib/donation-calc";
import { toNumber } from "@/lib/format";

type RouteContext = { params: Promise<{ id: string }> };

/** What a case receives in this occasion; the value defaults to quantity x the occasion's unit value. */
export async function POST(request: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const occasion = await prisma.donationOccasion.findUnique({ where: { id } });
  const access = occasion && (await hubAccess(session.userId, occasion.hubId));
  if (!occasion || !access) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!access.canManage) return NextResponse.json({ error: "Only the hub's team can allocate" }, { status: 403 });
  const parsed = allocationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  const data = parsed.data;

  const target = await prisma.donationCase.findFirst({
    where: { id: data.caseId, hubId: occasion.hubId },
    select: { id: true, status: true, zakatCategory: true },
  });
  if (!target) return NextResponse.json({ error: "The case isn't in this occasion's hub" }, { status: 400 });
  if (target.status === "PENDING") return NextResponse.json({ error: "Validate the case first." }, { status: 400 });
  if (data.donorId && !(await prisma.donor.findFirst({ where: { id: data.donorId, hubId: occasion.hubId }, select: { id: true } }))) {
    return NextResponse.json({ error: "The donor isn't in this hub" }, { status: 400 });
  }
  const ruleKind = { ZAKAT_AL_FITR: "ZAKAT_AL_FITR", KAFFARAH: "KAFFARAH", FIDYAH: "FIDYAH" }[occasion.type as string];
  const notAllowed = ruleKind ? donationAllowed(ruleKind, target.zakatCategory) : null;
  if (notAllowed) return NextResponse.json({ error: notAllowed }, { status: 400 });

  const amount = data.amount ?? (occasion.unitValue ? Math.round(data.quantity * toNumber(occasion.unitValue) * 100) / 100 : null);
  try {
    const allocation = await prisma.occasionAllocation.create({ data: { ...data, amount, occasionId: id } });
    return NextResponse.json({ allocation }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json({ error: "This case already has an allocation in this occasion; edit it instead." }, { status: 409 });
    }
    throw err;
  }
}

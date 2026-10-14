import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { donorSchema, firstIssue } from "@/lib/donation-schemas";
import { hubAccess, hubsVisibleTo } from "@/lib/donations";
import { donorLayer } from "@/lib/donation-calc";
import { mobileKey } from "@/lib/phone";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const hubId = new URL(request.url).searchParams.get("hubId") || undefined;
  const donors = await prisma.donor.findMany({
    where: { hubId, hub: hubsVisibleTo(session.userId) },
    orderBy: [{ layer: "asc" }, { name: "asc" }],
  });
  return NextResponse.json({ donors });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = donorSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  const { hubId, invitedById, relation, ...data } = parsed.data;
  const access = await hubAccess(session.userId, hubId);
  if (!access) return NextResponse.json({ error: "Hub not found" }, { status: 404 });
  if (!access.canManage) return NextResponse.json({ error: "Only the hub's team can add donors" }, { status: 403 });

  const inviter = invitedById
    ? await prisma.donor.findFirst({ where: { id: invitedById, hubId }, select: { id: true, layer: true } })
    : null;
  if (invitedById && !inviter) return NextResponse.json({ error: "The inviting donor isn't in this hub" }, { status: 400 });
  const placed = donorLayer(relation, inviter);
  if ("error" in placed) return NextResponse.json({ error: placed.error }, { status: 400 });

  const mKey = mobileKey(data.mobile);
  if (mKey) {
    const same = await prisma.donor.findMany({ where: { hubId, mobile: { contains: mKey.slice(-7) } }, select: { id: true, name: true, mobile: true } });
    const dup = same.find((d) => mobileKey(d.mobile) === mKey);
    if (dup) return NextResponse.json({ error: `${dup.name} already has this mobile in the hub.`, duplicate: dup }, { status: 409 });
  }

  const donor = await prisma.donor.create({
    data: { ...data, hubId, relation, invitedById: inviter?.id ?? null, layer: placed.layer, addedById: session.userId },
  });
  return NextResponse.json({ donor }, { status: 201 });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { hubAccess } from "@/lib/donations";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const donation = await prisma.donation.findUnique({ where: { id }, select: { case: { select: { hubId: true } } } });
  const access = donation && (await hubAccess(session.userId, donation.case.hubId));
  if (!donation || !access) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!access.canManage) return NextResponse.json({ error: "Only the hub's team can remove donations" }, { status: 403 });
  await prisma.donation.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { allocationPatchSchema, firstIssue } from "@/lib/donation-schemas";
import { hubAccess } from "@/lib/donations";

type RouteContext = { params: Promise<{ id: string }> };

async function load(userId: string, id: string) {
  const a = await prisma.occasionAllocation.findUnique({ where: { id }, select: { occasion: { select: { hubId: true } } } });
  return a ? hubAccess(userId, a.occasion.hubId) : null;
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const access = await load(session.userId, id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!access.canManage) return NextResponse.json({ error: "Only the hub's team can change allocations" }, { status: 403 });
  const parsed = allocationPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  const { delivered, ...data } = parsed.data;
  const allocation = await prisma.occasionAllocation.update({
    where: { id },
    data: { ...data, ...(delivered !== undefined && { delivered, deliveredAt: delivered ? new Date() : null }) },
  });
  return NextResponse.json({ allocation });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const access = await load(session.userId, id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!access.canManage) return NextResponse.json({ error: "Only the hub's team can change allocations" }, { status: 403 });
  await prisma.occasionAllocation.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

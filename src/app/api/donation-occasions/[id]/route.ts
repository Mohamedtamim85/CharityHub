import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { firstIssue, occasionPatchSchema } from "@/lib/donation-schemas";
import { hubAccess } from "@/lib/donations";

type RouteContext = { params: Promise<{ id: string }> };

async function load(userId: string, id: string) {
  const o = await prisma.donationOccasion.findUnique({ where: { id }, select: { hubId: true } });
  return o ? hubAccess(userId, o.hubId) : null;
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const access = await load(session.userId, id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!access.canManage) return NextResponse.json({ error: "Only the hub's team can change occasions" }, { status: 403 });
  const parsed = occasionPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  const occasion = await prisma.donationOccasion.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ occasion });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const access = await load(session.userId, id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!access.canManage) return NextResponse.json({ error: "Only the hub's team can delete occasions" }, { status: 403 });
  await prisma.donationOccasion.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

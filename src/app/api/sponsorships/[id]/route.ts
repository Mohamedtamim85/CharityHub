import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { firstIssue, sponsorshipPatchSchema } from "@/lib/donation-schemas";
import { hubAccess } from "@/lib/donations";

type RouteContext = { params: Promise<{ id: string }> };

async function load(userId: string, id: string) {
  const s = await prisma.sponsorship.findUnique({ where: { id }, select: { id: true, case: { select: { hubId: true } } } });
  const access = s && (await hubAccess(userId, s.case.hubId));
  return s && access ? access : null;
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const access = await load(session.userId, id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!access.canManage) return NextResponse.json({ error: "Only the hub's team can change sponsorships" }, { status: 403 });
  const parsed = sponsorshipPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  const sponsorship = await prisma.sponsorship.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ sponsorship });
}

/** Deletes a sponsorship with no payments; one with payments is stopped (inactive) instead. */
export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const access = await load(session.userId, id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!access.canManage) return NextResponse.json({ error: "Only the hub's team can change sponsorships" }, { status: 403 });
  const paid = await prisma.donation.count({ where: { sponsorshipId: id } });
  if (paid) {
    await prisma.sponsorship.update({ where: { id }, data: { active: false } });
    return NextResponse.json({ ok: true, stopped: true });
  }
  await prisma.sponsorship.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { donorPatchSchema, firstIssue } from "@/lib/donation-schemas";
import { hubAccess } from "@/lib/donations";

type RouteContext = { params: Promise<{ id: string }> };

async function load(userId: string, id: string) {
  const donor = await prisma.donor.findUnique({ where: { id } });
  if (!donor) return null;
  const access = await hubAccess(userId, donor.hubId);
  return access ? { donor, canManage: access.canManage } : null;
}

export async function GET(_request: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const found = await load(session.userId, (await params).id);
  if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ donor: found.donor });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const found = await load(session.userId, id);
  if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!found.canManage) return NextResponse.json({ error: "Only the hub's team can edit donors" }, { status: 403 });
  const parsed = donorPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  const donor = await prisma.donor.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ donor });
}

/** Refused while the donor has people under them or a giving history. */
export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const found = await load(session.userId, id);
  if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!found.canManage) return NextResponse.json({ error: "Only the hub's team can remove donors" }, { status: 403 });
  const counts = await prisma.donor.findUniqueOrThrow({
    where: { id },
    select: { _count: { select: { invitees: true, donations: true, sponsorships: true } } },
  });
  if (counts._count.invitees) return NextResponse.json({ error: "This donor brought in other donors; remove or move them first." }, { status: 409 });
  if (counts._count.donations || counts._count.sponsorships) {
    return NextResponse.json({ error: "This donor has donations or sponsorships on record." }, { status: 409 });
  }
  await prisma.donor.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

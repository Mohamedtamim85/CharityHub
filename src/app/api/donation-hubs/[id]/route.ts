import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { firstIssue, hubPatchSchema } from "@/lib/donation-schemas";
import { hubAccess } from "@/lib/donations";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const access = await hubAccess(session.userId, id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!access.canManage) return NextResponse.json({ error: "Only the hub's team can change it" }, { status: 403 });
  const parsed = hubPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  if (parsed.data.visibility && access.hub.ownerId !== session.userId) {
    return NextResponse.json({ error: "Only the owner can make the hub public or private" }, { status: 403 });
  }
  const hub = await prisma.donationHub.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ hub });
}

/** Owner only; removes its donors, cases and history with it. */
export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const access = await hubAccess(session.userId, id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (access.hub.ownerId !== session.userId) return NextResponse.json({ error: "Only the owner can delete the hub" }, { status: 403 });
  // Donors reference each other (Restrict), so clear the chain before the cascade.
  await prisma.$transaction([
    prisma.donor.updateMany({ where: { hubId: id }, data: { invitedById: null } }),
    prisma.donationHub.delete({ where: { id } }),
  ]);
  return NextResponse.json({ ok: true });
}

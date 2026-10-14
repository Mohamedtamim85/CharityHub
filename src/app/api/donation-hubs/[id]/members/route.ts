import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { firstIssue, hubMemberSchema } from "@/lib/donation-schemas";
import { hubAccess } from "@/lib/donations";

type RouteContext = { params: Promise<{ id: string }> };

/** Adds a user (by email) to the hub's team. Owner only. */
export async function POST(request: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const access = await hubAccess(session.userId, id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (access.hub.ownerId !== session.userId) return NextResponse.json({ error: "Only the owner can change the team" }, { status: 403 });
  const parsed = hubMemberSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  const user = await prisma.user.findFirst({ where: { email: { equals: parsed.data.email, mode: "insensitive" } }, select: { id: true, name: true } });
  if (!user) return NextResponse.json({ error: "No account has that email yet — ask them to sign up first" }, { status: 404 });
  if (user.id === access.hub.ownerId) return NextResponse.json({ error: "The owner is already on the team" }, { status: 409 });
  await prisma.donationHubMember.upsert({
    where: { hubId_userId: { hubId: id, userId: user.id } },
    update: {},
    create: { hubId: id, userId: user.id },
  });
  return NextResponse.json({ member: user }, { status: 201 });
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const access = await hubAccess(session.userId, id);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (access.hub.ownerId !== session.userId) return NextResponse.json({ error: "Only the owner can change the team" }, { status: 403 });
  const userId = new URL(request.url).searchParams.get("userId") ?? "";
  await prisma.donationHubMember.deleteMany({ where: { hubId: id, userId } });
  return NextResponse.json({ ok: true });
}

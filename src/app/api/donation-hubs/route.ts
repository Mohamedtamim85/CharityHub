import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { firstIssue, hubSchema } from "@/lib/donation-schemas";
import { hubsVisibleTo } from "@/lib/donations";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const hubs = await prisma.donationHub.findMany({
    where: hubsVisibleTo(session.userId),
    include: { owner: { select: { name: true } }, _count: { select: { donors: true, cases: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ hubs });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = hubSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  const hub = await prisma.donationHub.create({ data: { ...parsed.data, ownerId: session.userId } });
  return NextResponse.json({ hub }, { status: 201 });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { firstIssue, occasionSchema } from "@/lib/donation-schemas";
import { hubAccess } from "@/lib/donations";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = occasionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  const access = await hubAccess(session.userId, parsed.data.hubId);
  if (!access) return NextResponse.json({ error: "Hub not found" }, { status: 404 });
  if (!access.canManage) return NextResponse.json({ error: "Only the hub's team can add occasions" }, { status: 403 });
  const occasion = await prisma.donationOccasion.create({ data: parsed.data });
  return NextResponse.json({ occasion }, { status: 201 });
}

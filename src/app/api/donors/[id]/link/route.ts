import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { hubAccess } from "@/lib/donations";
import { DONOR_LINK_DAYS, signDonorToken } from "@/lib/donor-link";

type RouteContext = { params: Promise<{ id: string }> };

/** A read-only page link for the donor: the cases they're allowed to see. */
export async function GET(request: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const donor = await prisma.donor.findUnique({ where: { id }, select: { id: true, hubId: true } });
  const access = donor && (await hubAccess(session.userId, donor.hubId));
  if (!donor || !access) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!access.canManage) return NextResponse.json({ error: "Only the hub's team can share donor links" }, { status: 403 });
  const url = `${new URL(request.url).origin}/give/${signDonorToken(donor.id)}`;
  return NextResponse.json({ url, days: DONOR_LINK_DAYS });
}

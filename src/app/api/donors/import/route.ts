import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { hubAccess } from "@/lib/donations";
import { donorLayer } from "@/lib/donation-calc";
import { parseDonorsSheet } from "@/lib/donors-import";
import { mobileKey } from "@/lib/phone";

/**
 * Imports a contact list into a hub under one inviter (or the hub itself).
 * Everyone imported must be family or a close friend of that inviter, so they
 * land one layer below them. Mobiles already in the hub are skipped.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const hubId = String(form?.get("hubId") ?? "");
  const invitedById = String(form?.get("invitedById") ?? "") || null;
  const defaultRelation = form?.get("relation") === "FAMILY" ? "FAMILY" : "CLOSE_FRIEND";
  if (!(file instanceof File)) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

  const access = await hubAccess(session.userId, hubId);
  if (!access) return NextResponse.json({ error: "Hub not found" }, { status: 404 });
  if (!access.canManage) return NextResponse.json({ error: "Only the hub's team can import donors" }, { status: 403 });
  const inviter = invitedById ? await prisma.donor.findFirst({ where: { id: invitedById, hubId }, select: { id: true, layer: true } }) : null;
  if (invitedById && !inviter) return NextResponse.json({ error: "The inviting donor isn't in this hub" }, { status: 400 });
  const placed = donorLayer(defaultRelation, inviter);
  if ("error" in placed) return NextResponse.json({ error: placed.error }, { status: 400 });

  let parsed;
  try {
    parsed = await parseDonorsSheet(Buffer.from(await file.arrayBuffer()));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to parse file" }, { status: 400 });
  }

  const existing = await prisma.donor.findMany({ where: { hubId }, select: { mobile: true } });
  const mobiles = new Set(existing.map((d) => mobileKey(d.mobile)).filter(Boolean));
  const skipped = [...parsed.skipped];
  let added = 0;
  for (const row of parsed.rows) {
    const mKey = mobileKey(row.mobile);
    if (mKey && mobiles.has(mKey)) {
      skipped.push(`${row.name} — mobile already in the hub`);
      continue;
    }
    await prisma.donor.create({
      data: {
        hubId,
        name: row.name,
        mobile: row.mobile,
        email: row.email,
        location: row.location,
        monthlyAmount: row.monthlyAmount,
        relation: row.relation ?? defaultRelation,
        invitedById: inviter?.id ?? null,
        layer: placed.layer,
        addedById: session.userId,
      },
    });
    if (mKey) mobiles.add(mKey);
    added++;
  }
  return NextResponse.json({ added, skipped, layer: placed.layer });
}

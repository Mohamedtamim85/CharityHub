import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { caseSchema, firstIssue } from "@/lib/donation-schemas";
import { findCaseDuplicates, hubAccess, hubsVisibleTo } from "@/lib/donations";
import { hubDonorIds, identityKeys, resolveValidator } from "@/lib/donation-cases";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const hubId = new URL(request.url).searchParams.get("hubId") || undefined;
  const cases = await prisma.donationCase.findMany({
    where: { hubId, hub: hubsVisibleTo(session.userId) },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ cases });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = caseSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  const { hubId, validatedBy, visibleDonorIds, allowDuplicate, status, ...data } = parsed.data;
  const access = await hubAccess(session.userId, hubId);
  if (!access) return NextResponse.json({ error: "Hub not found" }, { status: 404 });
  if (!access.canManage) return NextResponse.json({ error: "Only the hub's team can add cases" }, { status: 403 });

  const keys = identityKeys(data.nationalId, data.mobile);
  if (!allowDuplicate) {
    const duplicates = await findCaseDuplicates(session.userId, hubId, keys.nationalId, data.mobile);
    if (duplicates.length) {
      return NextResponse.json({ error: "This person is already registered.", duplicates }, { status: 409 });
    }
  }
  const validation = await resolveValidator(hubId, validatedBy, session.userId);
  if ("error" in validation) return NextResponse.json({ error: validation.error }, { status: 400 });
  const finalStatus = status ?? (validation.validationLayer ? "ACTIVE" : "PENDING");
  if (finalStatus !== "PENDING" && !validation.validationLayer) {
    return NextResponse.json({ error: "Pick who validated the case before activating it." }, { status: 400 });
  }
  const visible = data.audience === "PRIVATE" ? await hubDonorIds(hubId, visibleDonorIds ?? []) : [];

  const created = await prisma.donationCase.create({
    data: {
      ...data,
      ...keys,
      ...validation,
      status: finalStatus,
      hubId,
      createdById: session.userId,
      visibleTo: { create: visible.map((donorId) => ({ donorId })) },
    },
  });
  return NextResponse.json({ case: created }, { status: 201 });
}

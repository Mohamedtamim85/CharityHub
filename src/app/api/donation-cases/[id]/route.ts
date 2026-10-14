import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { casePatchSchema, firstIssue } from "@/lib/donation-schemas";
import { findCaseDuplicates, hubAccess } from "@/lib/donations";
import { hubDonorIds, identityKeys, resolveValidator } from "@/lib/donation-cases";

type RouteContext = { params: Promise<{ id: string }> };

async function load(userId: string, id: string) {
  const found = await prisma.donationCase.findUnique({ where: { id } });
  if (!found) return null;
  const access = await hubAccess(userId, found.hubId);
  return access ? { found, canManage: access.canManage } : null;
}

export async function GET(_request: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const loaded = await load(session.userId, (await params).id);
  if (!loaded) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const duplicates = await findCaseDuplicates(session.userId, loaded.found.hubId, loaded.found.nationalId, loaded.found.mobile, loaded.found.id);
  return NextResponse.json({ case: loaded.found, duplicates });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const loaded = await load(session.userId, id);
  if (!loaded) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!loaded.canManage) return NextResponse.json({ error: "Only the hub's team can edit cases" }, { status: 403 });
  const existing = loaded.found;
  const parsed = casePatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: firstIssue(parsed.error) }, { status: 400 });
  const { validatedBy, visibleDonorIds, allowDuplicate, ...data } = parsed.data;

  const identityChanged = data.nationalId !== undefined || data.mobile !== undefined;
  const nationalId = data.nationalId !== undefined ? data.nationalId : existing.nationalId;
  const mobile = data.mobile !== undefined ? data.mobile : existing.mobile;
  if (identityChanged && !allowDuplicate) {
    const duplicates = await findCaseDuplicates(session.userId, existing.hubId, nationalId, mobile, id);
    if (duplicates.length) return NextResponse.json({ error: "This person is already registered.", duplicates }, { status: 409 });
  }

  let validation = {};
  let layer = existing.validationLayer;
  // Re-picking the same validator keeps the original validation date.
  const currentValidator = existing.validatedByUserId ? "team" : existing.validatedByDonorId;
  const sameValidator = validatedBy === currentValidator || (validatedBy === "team" && Boolean(existing.validatedByUserId));
  if (validatedBy !== undefined && !sameValidator) {
    const resolved = await resolveValidator(existing.hubId, validatedBy, session.userId);
    if ("error" in resolved) return NextResponse.json({ error: resolved.error }, { status: 400 });
    validation = resolved;
    layer = resolved.validationLayer;
  }
  const status = data.status ?? (layer ? existing.status : "PENDING");
  if (status !== "PENDING" && !layer) {
    return NextResponse.json({ error: "Pick who validated the case before activating it." }, { status: 400 });
  }
  const audience = data.audience ?? existing.audience;

  const updated = await prisma.$transaction(async (tx) => {
    if (visibleDonorIds !== undefined || audience === "CHAIN") {
      await tx.caseVisibleDonor.deleteMany({ where: { caseId: id } });
      const ids = audience === "PRIVATE" ? await hubDonorIds(existing.hubId, visibleDonorIds ?? []) : [];
      if (ids.length) await tx.caseVisibleDonor.createMany({ data: ids.map((donorId) => ({ caseId: id, donorId })) });
    }
    return tx.donationCase.update({
      where: { id },
      data: {
        ...data,
        ...(identityChanged ? identityKeys(nationalId, mobile) : {}),
        ...validation,
        status,
      },
    });
  });
  return NextResponse.json({ case: updated });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const loaded = await load(session.userId, id);
  if (!loaded) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!loaded.canManage) return NextResponse.json({ error: "Only the hub's team can delete cases" }, { status: 403 });
  const donations = await prisma.donation.count({ where: { caseId: id } });
  if (donations) return NextResponse.json({ error: "This case has donations on record; close it instead." }, { status: 409 });
  await prisma.donationCase.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

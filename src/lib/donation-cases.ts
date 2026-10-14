import { prisma } from "@/lib/prisma";
import { mobileKey } from "@/lib/phone";

/**
 * Who vouches for a case and the layer it gets:
 * "team" = the signed-in user (hub team, layer 1); a donor id = that donor's layer.
 */
export async function resolveValidator(
  hubId: string,
  validatedBy: string | null,
  userId: string,
): Promise<
  | { validatedByUserId: string | null; validatedByDonorId: string | null; validationLayer: number | null; validatedAt: Date | null }
  | { error: string }
> {
  if (!validatedBy) return { validatedByUserId: null, validatedByDonorId: null, validationLayer: null, validatedAt: null };
  if (validatedBy === "team") return { validatedByUserId: userId, validatedByDonorId: null, validationLayer: 1, validatedAt: new Date() };
  const donor = await prisma.donor.findFirst({ where: { id: validatedBy, hubId }, select: { id: true, layer: true } });
  if (!donor) return { error: "The validating donor isn't in this hub" };
  return { validatedByUserId: null, validatedByDonorId: donor.id, validationLayer: donor.layer, validatedAt: new Date() };
}

/** Keeps only donors of this hub. */
export async function hubDonorIds(hubId: string, ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const rows = await prisma.donor.findMany({ where: { hubId, id: { in: ids } }, select: { id: true } });
  return rows.map((r) => r.id);
}

export function identityKeys(nationalId: string | null | undefined, mobile: string | null | undefined) {
  return { nationalId: nationalId?.replace(/\s/g, "") || null, mobileKey: mobileKey(mobile) };
}

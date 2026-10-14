import { createHmac, timingSafeEqual } from "crypto";

/** Donor page links stop working after this many days (re-share to renew). */
export const DONOR_LINK_DAYS = 90;

function sign(payload: string): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET is not set");
  return createHmac("sha256", s).update(`donor:${payload}`).digest("base64url");
}

/** A tamper-proof, expiring token for one donor's read-only page (/give/<token>). */
export function signDonorToken(donorId: string, now: Date = new Date()): string {
  const exp = Math.floor(now.getTime() / 1000) + DONOR_LINK_DAYS * 24 * 3600;
  const payload = Buffer.from(JSON.stringify({ d: donorId, e: exp })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyDonorToken(token: string, now: Date = new Date()): string | null {
  const [payload, mac] = token.split(".");
  if (!payload || !mac) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { d: unknown; e: unknown };
    if (typeof data.e !== "number" || data.e * 1000 < now.getTime() || typeof data.d !== "string") return null;
    return data.d;
  } catch {
    return null;
  }
}

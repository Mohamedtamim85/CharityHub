import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is not set");
}
const secretKey = new TextEncoder().encode(JWT_SECRET);

export const SESSION_COOKIE = "charityhub_session";

export type SessionPayload = {
  userId: string;
  email: string;
  name: string;
};

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("7d").sign(secretKey);
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    if (typeof payload.userId !== "string") return null;
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

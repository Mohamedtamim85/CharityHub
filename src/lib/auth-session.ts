import { NextResponse } from "next/server";
import { SESSION_COOKIE, signSession } from "@/lib/auth";

/** Signs the user in: a JSON response that sets the session cookie. */
export async function sessionResponse(user: { id: string; email: string; name: string }, status = 200) {
  const token = await signSession({ userId: user.id, email: user.email, name: user.name });
  const response = NextResponse.json({ user }, { status });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}

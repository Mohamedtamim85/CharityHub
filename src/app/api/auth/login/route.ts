import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth";
import { sessionResponse } from "@/lib/auth-session";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: unknown; password?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "Wrong email or password" }, { status: 401 });
  }
  return sessionResponse({ id: user.id, email: user.email, name: user.name });
}

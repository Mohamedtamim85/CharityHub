import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { sessionResponse } from "@/lib/auth-session";

const signupSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(120),
  email: z.email("Enter a valid email").transform((e) => e.trim().toLowerCase()),
  password: z.string().min(8, "Use at least 8 characters").max(200),
});

/** Anyone can open an account and run their own hub. */
export async function POST(request: Request) {
  const parsed = signupSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  const { name, email, password } = parsed.data;
  if (await prisma.user.findUnique({ where: { email } })) {
    return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
  }
  const user = await prisma.user.create({
    data: { name, email, passwordHash: await hashPassword(password) },
    select: { id: true, email: true, name: true },
  });
  return sessionResponse(user, 201);
}

import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/signup", "/api/auth/login", "/api/auth/signup", "/api/auth/logout"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    PUBLIC_PATHS.includes(pathname) ||
    // A donor's read-only page; the signed token in the URL is checked by the page.
    pathname.startsWith("/give/") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    /\.(png|jpg|jpeg|svg|webp|gif|ico)$/.test(pathname)
  ) {
    return NextResponse.next();
  }
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySession(token) : null;
  if (!session) {
    if (pathname.startsWith("/api")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

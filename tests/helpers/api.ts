import { BASE_URL } from "./test-env";

export function url(pathname: string): string {
  return `${BASE_URL}${pathname}`;
}

function cookieFrom(res: Response): string {
  const cookie = res.headers.get("set-cookie");
  if (!cookie) throw new Error("no session cookie was set");
  return cookie.split(";")[0];
}

/** Creates an account and returns its session cookie for `authedFetch`. */
export async function signup(name: string, email: string, password: string): Promise<string> {
  const res = await fetch(url("/api/auth/signup"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  if (res.status !== 201) throw new Error(`signup failed: ${res.status} ${await res.text()}`);
  return cookieFrom(res);
}

export async function login(email: string, password: string): Promise<string> {
  const res = await fetch(url("/api/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`login failed: ${res.status} ${await res.text()}`);
  return cookieFrom(res);
}

export function authedFetch(cookie: string, pathname: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url(pathname), { ...init, headers: { ...(init.headers ?? {}), Cookie: cookie } });
}

export function authedJson(cookie: string, pathname: string, method: string, body: unknown): Promise<Response> {
  return authedFetch(cookie, pathname, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

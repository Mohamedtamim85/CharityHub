"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { inputClass, labelClass, primaryButton, sendJson } from "@/components/ui";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const from = useSearchParams().get("from");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const signup = mode === "signup";

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const res = await sendJson(signup ? "/api/auth/signup" : "/api/auth/login", "POST", form);
        setBusy(false);
        if (!res.ok) return setError(res.error);
        router.push(from && from.startsWith("/") && !from.startsWith("//") ? from : "/");
        router.refresh();
      }}
    >
      {signup && (
        <div>
          <label className={labelClass}>Name</label>
          <input required className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
      )}
      <div>
        <label className={labelClass}>Email</label>
        <input required type="email" autoComplete="email" className={inputClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </div>
      <div>
        <label className={labelClass}>Password{signup && " (8+ characters)"}</label>
        <input
          required
          type="password"
          autoComplete={signup ? "new-password" : "current-password"}
          minLength={signup ? 8 : undefined}
          className={inputClass}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={busy} className={`${primaryButton} w-full`}>
        {busy ? "..." : signup ? "Create account" : "Sign in"}
      </button>
      <p className="text-center text-sm text-slate-500">
        {signup ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-brand hover:underline">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link href="/signup" className="font-medium text-brand hover:underline">
              Create an account
            </Link>
          </>
        )}
      </p>
    </form>
  );
}

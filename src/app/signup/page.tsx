import { Suspense } from "react";
import AuthForm from "@/components/AuthForm";

export default function Page() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="mb-1 text-center text-xl font-semibold text-brand">CharityHub</p>
        <h1 className="mb-6 text-center text-sm text-slate-500">Create your account</h1>
        <Suspense>
          <AuthForm mode="signup" />
        </Suspense>
      </div>
    </main>
  );
}

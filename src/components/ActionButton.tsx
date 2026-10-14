"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { secondaryButton } from "./ui";

/** A one-click PATCH/POST/DELETE (optionally confirmed) that refreshes the page or navigates away. */
export default function ActionButton({
  endpoint,
  method,
  body,
  label,
  confirmText,
  redirectTo,
  className = secondaryButton,
}: {
  endpoint: string;
  method: "POST" | "PATCH" | "DELETE";
  body?: unknown;
  label: string;
  confirmText?: string;
  redirectTo?: string;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        disabled={busy}
        className={className}
        onClick={async () => {
          if (confirmText && !confirm(confirmText)) return;
          setBusy(true);
          setError(null);
          const res = await fetch(endpoint, {
            method,
            headers: body ? { "Content-Type": "application/json" } : undefined,
            body: body ? JSON.stringify(body) : undefined,
          });
          setBusy(false);
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            setError(typeof data.error === "string" ? data.error : "Failed");
            return;
          }
          if (redirectTo) router.push(redirectTo);
          router.refresh();
        }}
      >
        {busy ? "..." : label}
      </button>
      {error && <span className="mt-1 text-xs text-red-600">{error}</span>}
    </span>
  );
}

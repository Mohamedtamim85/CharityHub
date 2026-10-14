"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { inputClass, secondaryButton, sendJson } from "./ui";

export default function HubTeamForm({ hubId }: { hubId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="flex flex-wrap items-start gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        const res = await sendJson(`/api/donation-hubs/${hubId}/members`, "POST", { email });
        if (!res.ok) return setError(res.error);
        setEmail("");
        router.refresh();
      }}
    >
      <input type="email" required className={`${inputClass} sm:w-72`} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@example.com" />
      <button type="submit" className={secondaryButton}>
        Add to team
      </button>
      {error && <p className="w-full text-xs text-red-600">{error}</p>}
    </form>
  );
}

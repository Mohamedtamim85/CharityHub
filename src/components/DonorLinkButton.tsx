"use client";

import { useState } from "react";
import { whatsappNumber, whatsappUrl } from "@/lib/phone";
import { secondaryButton } from "./ui";

/** Creates the donor's read-only page link and offers copy / WhatsApp. */
export default function DonorLinkButton({ donorId, donorName, mobile }: { donorId: string; donorName: string; mobile: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const phone = whatsappNumber(mobile);
  const text = url ? `Assalamu alaikum ${donorName.split(" ")[0]}, these are the validated cases you can support: ${url}` : "";
  return (
    <div className="space-y-2">
      <button
        type="button"
        className={secondaryButton}
        onClick={async () => {
          setError(null);
          const res = await fetch(`/api/donors/${donorId}/link`);
          const data = await res.json().catch(() => ({}));
          if (!res.ok) return setError(data.error ?? "Failed");
          setUrl(data.url);
        }}
      >
        Share donor page
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {url && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <input readOnly value={url} className="w-full rounded border border-slate-300 px-2 py-1 font-mono sm:w-96" />
          <button
            type="button"
            className="font-medium text-brand hover:underline"
            onClick={async () => {
              await navigator.clipboard.writeText(url);
              setCopied(true);
            }}
          >
            {copied ? "Copied" : "Copy"}
          </button>
          {phone && (
            <a
              className="font-medium text-green-700 hover:underline"
              target="_blank"
              rel="noreferrer"
              href={whatsappUrl(text, phone)}
            >
              Send on WhatsApp
            </a>
          )}
          <span className="text-slate-500">Valid for 90 days.</span>
        </div>
      )}
    </div>
  );
}

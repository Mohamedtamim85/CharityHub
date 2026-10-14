import Link from "next/link";

export default function BackLink({
  href,
  label = "Back",
}: {
  href: string;
  label?: string;
}) {
  return (
    <Link
      href={href}
      className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
    >
      <span aria-hidden="true">&larr;</span> {label}
    </Link>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CharityHub",
  description: "Validated cases, a trusted donor chain, zakat and seasonal giving",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}

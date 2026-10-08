import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NTSBench — Network Time Server Performance Lab",
  description: "A deterministic research prototype for comparing NTS deployment performance and resilience.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  );
}

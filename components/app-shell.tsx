"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, FlaskConical, Network, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/", label: "Performance Lab", icon: FlaskConical },
  { href: "/resilience", label: "Resilience", icon: Network },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#061019] text-slate-100 selection:bg-cyan-300/30">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_82%_0%,rgba(20,173,205,.12),transparent_32%),linear-gradient(rgba(54,227,255,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(54,227,255,.025)_1px,transparent_1px)] bg-[size:auto,42px_42px,42px_42px]" />
      <header className="sticky top-0 z-40 border-b border-white/8 bg-[#061019]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="group flex items-center gap-3" aria-label="NTSBench home">
            <span className="grid size-9 place-items-center rounded-lg border border-cyan-300/30 bg-cyan-300/8 shadow-[inset_0_0_18px_rgba(54,227,255,.08)]">
              <Activity className="size-[19px] text-cyan-300" />
            </span>
            <span>
              <span className="block text-[15px] font-semibold tracking-[0.04em]">NTSBENCH</span>
              <span className="hidden text-[10px] uppercase tracking-[0.22em] text-slate-500 sm:block">Research instrument</span>
            </span>
          </Link>

          <nav className="ml-auto flex items-center gap-1 rounded-lg border border-white/8 bg-white/[0.025] p-1 sm:ml-8" aria-label="Primary navigation">
            {nav.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex h-8 items-center gap-2 rounded-md px-2.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm",
                    active ? "bg-cyan-300/12 text-cyan-200" : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
                  )}
                >
                  <item.icon className="size-4" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto hidden items-center gap-2 text-xs text-slate-400 lg:flex">
            <ShieldCheck className="size-4 text-emerald-400" />
            Deterministic model
          </div>
        </div>
      </header>
      <main className="relative mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      <footer className="relative border-t border-white/8 px-4 py-5 text-center text-xs text-slate-500">
        Synthetic research prototype · Not measured Netnod data · TLS is modeled only during NTS key establishment
      </footer>
    </div>
  );
}

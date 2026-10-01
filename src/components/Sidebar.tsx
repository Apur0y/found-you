"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", match: ["/", "/leads"], label: "Leads", icon: "◎" },
  { href: "/games", match: ["/games"], label: "Games", icon: "▶" },
  { href: "/websites", match: ["/websites"], label: "Websites", icon: "◈" },
  { href: "/outreach", match: ["/outreach"], label: "Outreach", icon: "✉" },
  { href: "/command", match: ["/command"], label: "Command Center", icon: "⌘" },
  { href: "/settings", match: ["/settings"], label: "Settings", icon: "⚙" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-zinc-200 bg-white lg:flex">
      <div className="flex h-16 items-center gap-2 border-b border-zinc-200 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-sm font-semibold text-white">
          GM
        </div>
        <div>
          <div className="text-sm font-semibold leading-none text-zinc-900">
            Game Mining
          </div>
          <div className="mt-0.5 text-[11px] leading-none text-zinc-500">
            Recruiting video leads
          </div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV.map((item) => {
          const active = item.match.some(
            (p) => (p === "/" ? pathname === "/" : pathname.startsWith(p))
          );
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-zinc-100 font-medium text-zinc-900"
                  : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
              }`}
            >
              <span className="w-4 text-center text-zinc-400">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-zinc-200 px-5 py-4 text-[11px] leading-relaxed text-zinc-400">
        Distinguish facts from AI inference. You approve every message before it
        goes out.
      </div>
    </aside>
  );
}
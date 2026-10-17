"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive } from "@/lib/nav";

export function NavLinks({ links }: { links: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Secciones" className="flex gap-1 whitespace-nowrap">
      {links.map((l) => {
        const active = isActive(pathname, l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-sm px-3 py-2 text-sm font-medium hover:bg-ledger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              active ? "text-accent underline decoration-2 underline-offset-8" : "text-ink-muted"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

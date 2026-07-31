"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { linkAtivo, NAV_LINKS } from "./nav-links";

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="mt-8 grid gap-1 text-sm">
      {NAV_LINKS.map(({ href, label, Icon }) => {
        const ativo = linkAtivo(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 rounded-md px-3 py-2 transition ${
              ativo
                ? "bg-stone-100 font-medium text-stone-950 dark:bg-stone-800 dark:text-stone-100"
                : "text-stone-700 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800"
            }`}
          >
            <Icon size={17} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

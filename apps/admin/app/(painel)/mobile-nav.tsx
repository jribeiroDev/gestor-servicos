"use client";

import { ThemeToggle } from "@gestor/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "./logout-button";
import { linkAtivo, NAV_LINKS } from "./nav-links";

export function MobileNav() {
  const pathname = usePathname();

  return (
    <div className="sticky top-0 z-20 border-b border-stone-200 bg-white lg:hidden dark:border-stone-800 dark:bg-stone-900">
      <div className="flex items-center justify-between px-4 py-3">
        <h1 className="text-base font-semibold text-stone-950 dark:text-stone-100">
          Admin
        </h1>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LogoutButton />
        </div>
      </div>
      <nav className="flex gap-2 overflow-x-auto px-4 pb-3">
        {NAV_LINKS.map(({ href, label, Icon }) => {
          const ativo = linkAtivo(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition ${
                ativo
                  ? "bg-stone-900 text-white dark:bg-white dark:text-stone-950"
                  : "bg-stone-100 text-stone-700 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
              }`}
            >
              <Icon size={15} />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

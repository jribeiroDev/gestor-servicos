"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "./logout-button";
import { linkAtivo, NAV_LINKS } from "./nav-links";

export function MobileNav() {
  const pathname = usePathname();

  return (
    <div className="sticky top-0 z-20 border-b border-stone-200 bg-white lg:hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <h1 className="text-base font-semibold text-stone-950">Admin Reservas</h1>
        <LogoutButton />
      </div>
      <nav className="flex gap-2 overflow-x-auto px-4 pb-3">
        {NAV_LINKS.map(({ href, label, Icon }) => {
          const ativo = linkAtivo(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition ${
                ativo ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-700 hover:bg-stone-200"
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

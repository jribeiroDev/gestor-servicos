import { ThemeToggle } from "@gestor/ui";
import { requireUser } from "../../lib/auth";
import { LogoutButton } from "./logout-button";
import { MobileNav } from "./mobile-nav";
import { SidebarNav } from "./sidebar-nav";

export default async function PainelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-stone-200 bg-white p-5 lg:flex dark:border-stone-800 dark:bg-stone-900">
        <h1 className="text-xl font-semibold text-stone-950 dark:text-stone-100">
          Admin
        </h1>
        <SidebarNav />
        <div className="mt-auto border-t border-stone-200 pt-4 dark:border-stone-800">
          <div className="mb-1 flex items-center justify-between gap-2 px-3 pb-2">
            <p className="truncate text-xs text-stone-400 dark:text-stone-500">
              {user.email}
            </p>
            <ThemeToggle />
          </div>
          <LogoutButton />
        </div>
      </aside>
      <MobileNav />
      <div className="lg:pl-64">{children}</div>
    </div>
  );
}

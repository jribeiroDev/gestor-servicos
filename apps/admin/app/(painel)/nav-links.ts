import {
  Bell,
  CalendarDays,
  Clock,
  LayoutDashboard,
  Settings,
  Users,
  UsersRound,
} from "lucide-react";

export const NAV_LINKS = [
  { href: "/", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/agenda", label: "Agenda", Icon: CalendarDays },
  { href: "/servicos", label: "Serviços", Icon: Settings },
  { href: "/equipa", label: "Equipa", Icon: UsersRound },
  { href: "/clientes", label: "Clientes", Icon: Users },
  { href: "/horarios", label: "Horários", Icon: Clock },
  { href: "/notificacoes", label: "Notificações", Icon: Bell },
] as const;

export function linkAtivo(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

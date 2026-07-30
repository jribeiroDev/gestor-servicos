import { Bell, CalendarDays, Clock, Settings, Users } from "lucide-react";

export const NAV_LINKS = [
  { href: "/", label: "Calendário", Icon: CalendarDays },
  { href: "/servicos", label: "Serviços", Icon: Settings },
  { href: "/clientes", label: "Clientes", Icon: Users },
  { href: "/horarios", label: "Horários", Icon: Clock },
  { href: "/notificacoes", label: "Notificações", Icon: Bell },
] as const;

export function linkAtivo(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

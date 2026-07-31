import { dateKey } from "@gestor/utils";
import { fetchDashboard } from "../../lib/admin-data";
import { DashboardClient } from "./dashboard-client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const hoje = dateKey(new Date());
  const dados = await fetchDashboard(hoje);
  return <DashboardClient diaInicial={hoje} dadosIniciais={dados} />;
}

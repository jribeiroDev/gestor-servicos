import { fetchServicos } from "../../../lib/admin-data";
import { ServicosClient } from "./servicos-client";

export const dynamic = "force-dynamic";

export default async function ServicosPage() {
  const servicos = await fetchServicos();
  return <ServicosClient servicos={servicos} />;
}

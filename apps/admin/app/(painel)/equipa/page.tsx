import { fetchEquipa } from "../../../lib/admin-data";
import { EquipaClient } from "./equipa-client";

export const dynamic = "force-dynamic";

export default async function EquipaPage() {
  const equipa = await fetchEquipa();
  return <EquipaClient equipa={equipa} />;
}

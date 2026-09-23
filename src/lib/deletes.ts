import { supabase } from "@/integrations/supabase/client";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Returns a blocking message if the lead still has post-sale records; null when it can be deleted. */
export async function leadDeleteBlocker(leadId: string): Promise<string | null> {
  const [c, f] = await Promise.all([
    supabase.from("clients").select("id", { count: "exact", head: true }).eq("lead_id", leadId),
    supabase.from("financial_entries").select("id", { count: "exact", head: true }).eq("lead_id", leadId),
  ]);
  const items: string[] = [];
  if (c.count) items.push(plural(c.count, "cliente", "clientes"));
  if (f.count) items.push(plural(f.count, "lançamento financeiro", "lançamentos financeiros"));
  return items.length
    ? `Este lead possui registros vinculados (${items.join(", ")}). Exclua primeiro os dados de pós-venda relacionados.`
    : null;
}

/** Returns a blocking message if the client still has projects or financial entries; null when it can be deleted. */
export async function clientDeleteBlocker(clientId: string): Promise<string | null> {
  const [p, f] = await Promise.all([
    supabase.from("site_projects").select("id", { count: "exact", head: true }).eq("client_id", clientId),
    supabase.from("financial_entries").select("id", { count: "exact", head: true }).eq("client_id", clientId),
  ]);
  const items: string[] = [];
  if (p.count) items.push(plural(p.count, "projeto de site", "projetos de site"));
  if (f.count) items.push(plural(f.count, "lançamento financeiro", "lançamentos financeiros"));
  return items.length
    ? `Não é possível excluir este cliente enquanto existirem registros vinculados: ${items.join(", ")}. Exclua primeiro os registros vinculados e tente novamente.`
    : null;
}

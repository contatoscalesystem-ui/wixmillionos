import type { Database } from "@/integrations/supabase/types";

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type Lead = Tables<"leads">;
export type Garimpo = Tables<"garimpos">;
export type LeadStatus = Database["public"]["Enums"]["lead_status"];
export type Priority = Database["public"]["Enums"]["lead_priority"];
export type WebsiteStatus = Database["public"]["Enums"]["website_status"];
export type GarimpoStatus = Database["public"]["Enums"]["garimpo_status"];
export type ProjectStatus = Database["public"]["Enums"]["project_status"];
export type FinancialStatus = Database["public"]["Enums"]["financial_status"];

export const LEAD_STATUS: { value: LeadStatus; label: string }[] = [
  { value: "novo", label: "Novo" },
  { value: "validar", label: "Validar" },
  { value: "pronto_contato", label: "Pronto para contato" },
  { value: "abordagem_enviada", label: "Abordagem enviada" },
  { value: "sem_resposta", label: "Sem resposta" },
  { value: "respondeu", label: "Respondeu" },
  { value: "interessado", label: "Interessado" },
  { value: "valor_apresentado", label: "Valor apresentado" },
  { value: "oferta_apresentada", label: "Oferta apresentada" },
  { value: "link_enviado", label: "Link enviado" },
  { value: "convertido", label: "Convertido" },
  { value: "recuperacao", label: "Recuperação" },
  { value: "perdido", label: "Perdido" },
  { value: "nao_qualificado", label: "Não qualificado" },
];
export const KANBAN_STATUSES: LeadStatus[] = [
  "novo", "pronto_contato", "abordagem_enviada", "respondeu", "interessado",
  "valor_apresentado", "oferta_apresentada", "link_enviado", "convertido", "recuperacao",
];
export const statusLabel = (s?: string | null) => LEAD_STATUS.find((x) => x.value === s)?.label ?? "—";

export const PRIORITIES: Priority[] = ["A", "B", "C", "D"];

export const WEBSITE_STATUS: { value: WebsiteStatus; label: string }[] = [
  { value: "nao_possui", label: "Não possui site" },
  { value: "site_fraco", label: "Site fraco" },
  { value: "site_razoavel", label: "Site razoável" },
  { value: "site_profissional", label: "Site profissional" },
  { value: "nao_confirmado", label: "Não confirmado" },
];
export const websiteLabel = (s?: string | null) => WEBSITE_STATUS.find((x) => x.value === s)?.label ?? "—";

export const GARIMPO_STATUS: { value: GarimpoStatus; label: string }[] = [
  { value: "rascunho", label: "Rascunho" },
  { value: "processado", label: "Processado" },
  { value: "ativo", label: "Ativo" },
  { value: "arquivado", label: "Arquivado" },
];

export const PROJECT_STATUS: { value: ProjectStatus; label: string }[] = [
  { value: "aguardando", label: "Aguardando" },
  { value: "coleta_dados", label: "Coleta de dados" },
  { value: "producao", label: "Produção" },
  { value: "primeira_versao", label: "Primeira versão" },
  { value: "revisao", label: "Revisão" },
  { value: "aprovado", label: "Aprovado" },
  { value: "transferencia", label: "Transferência" },
  { value: "publicado", label: "Publicado" },
];

export const FINANCIAL_STATUS: { value: FinancialStatus; label: string }[] = [
  { value: "pendente", label: "Pendente" },
  { value: "confirmado", label: "Confirmado" },
  { value: "a_receber", label: "A receber" },
  { value: "recebido", label: "Recebido" },
  { value: "cancelado", label: "Cancelado" },
];

export const labelOf = (list: { value: string; label: string }[], v?: string | null) =>
  list.find((x) => x.value === v)?.label ?? "—";

/** Normalizes Brazilian numbers to wa.me format: "+55 75 99999-9999" -> "5575999999999". */
export function normalizeBrPhone(raw?: string | null): string | null {
  if (!raw) return null;
  let d = raw.replace(/\D/g, "");
  if (!d) return null;
  d = d.replace(/^0+/, "");
  if (d.startsWith("55") && d.length >= 12) return d;
  if (d.length === 10 || d.length === 11) return "55" + d;
  return d.length >= 8 ? d : null;
}
export const waLink = (phone: string, text?: string) =>
  `https://wa.me/${phone}${text ? `?text=${encodeURIComponent(text)}` : ""}`;

export function fillTemplate(content: string, lead: Pick<Lead, "company_name" | "niche" | "city">) {
  return content
    .replaceAll("[NOME_DA_EMPRESA]", lead.company_name || "[NOME_DA_EMPRESA]")
    .replaceAll("[NICHO]", lead.niche || "[NICHO]")
    .replaceAll("[CIDADE]", lead.city || "[CIDADE]");
}

export function fmtDate(v?: string | null, withTime = false) {
  if (!v) return "—";
  const d = new Date(v.length === 10 ? v + "T12:00:00" : v);
  return d.toLocaleDateString("pt-BR", withTime ? { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" } : { day: "2-digit", month: "2-digit", year: "numeric" });
}
export function fmtMoney(v: number, currency = "BRL") {
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(v);
  } catch {
    return `${currency} ${v.toFixed(2)}`;
  }
}

export const friendlyError = (e: unknown) => {
  console.error(e);
  const msg = String((e as { message?: string } | null)?.message ?? "");
  if (msg.includes("LAST_ADMIN")) return "O espaço de trabalho precisa ter pelo menos um admin.";
  if (msg.includes("SIGNUP_INVITE_ONLY")) return "Novos acessos são liberados somente por convite.";
  if (msg.includes("CANNOT_CHANGE_SUPER_ADMIN")) return "A conta do Super Admin não pode ser bloqueada, banida nem excluída.";
  if (msg.includes("REASON_REQUIRED")) return "Informe o motivo.";
  if (msg.includes("INVALID_UNTIL")) return "Escolha uma data e hora no futuro.";
  if (msg.includes("INVALID_STATUS")) return "Esta ação não está disponível para a situação atual da conta.";
  if (msg.includes("RESET_FAILED")) return "Não foi possível enviar o link de recuperação.";
  if (msg.includes("PASSWORD_UPDATE_FAILED")) return "Não foi possível alterar a senha. Tente uma senha mais forte.";
  if (msg.includes("AUTH_DELETE_FAILED")) return "Os dados foram removidos, mas o acesso não pôde ser apagado. Tente de novo.";
  if (msg.includes("ACCOUNT_NOT_FOUND")) return "Conta não encontrada.";
  if (msg.includes("FORBIDDEN")) return "Você não tem permissão para esta ação.";
  if (msg.includes("LEAD_NOT_FOUND")) return "Lead não encontrado.";
  if (msg.includes("BATCH_NOT_FOUND")) return "Lote de importação não encontrado.";
  if (msg.includes("BATCH_NOT_READY")) return "Este lote já foi importado ou cancelado.";
  if (msg.includes("BATCH_AUDIT_BLOCKED")) return "A auditoria automática bloqueou este lote. Corrija o relatório e importe de novo.";
  if (msg.includes("ASSIGNEE_NOT_MEMBER")) return "O responsável escolhido não faz parte da equipe.";
  if (msg.includes("INVALID_INITIAL_STATUS")) return "Status inicial inválido para importação.";
  if (/duplicate key|unique/i.test(msg)) return "Já existe um registro com esses dados.";
  if (/foreign key/i.test(msg)) return "Não é possível excluir: existem registros vinculados. Exclua-os primeiro e tente novamente.";
  if (/row-level security|permission denied/i.test(msg)) return "Você não tem permissão para esta ação.";
  return "Não foi possível concluir a ação. Tente novamente.";
};

/** Sums amounts grouped by currency, so values in different currencies are never mixed. */
export function sumByCurrency(rows: Tables<"financial_entries">[], pick: (e: Tables<"financial_entries">) => [number | null, string]) {
  const m: Record<string, number> = {};
  for (const r of rows) { const [v, c] = pick(r); if (v != null) m[c] = (m[c] ?? 0) + Number(v); }
  const entries = Object.entries(m);
  return entries.length ? entries.map(([c, v]) => fmtMoney(v, c)).join(" · ") : fmtMoney(0);
}


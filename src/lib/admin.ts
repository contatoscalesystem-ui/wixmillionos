import { supabase } from "@/integrations/supabase/client";
import type { AccountStatus } from "@/hooks/use-auth";

// RPCs added in the SaaS layer; typed loosely so the app doesn't depend on regenerated types.
export async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn as never, args as never);
  if (error) throw error;
  return data as T;
}

export type AdminUser = {
  user_id: string; full_name: string | null; email: string | null; status: AccountStatus;
  created_at: string; last_seen_at: string | null; workspace_id: string | null; is_super_admin: boolean;
  leads: number; novos: number; abordagens: number; respostas: number; interessados: number; links: number; convertidos: number;
  garimpos: number; clientes: number; projetos: number; publicados: number; faturamento: number; comissao: number;
  ultima_atividade: string | null;
};

export type PlatformEvent = {
  id: string; event_type: string; entity_type: string | null; metadata: Record<string, unknown>;
  created_at: string; user_id: string | null; workspace_id: string | null;
  full_name: string | null; email: string | null; workspace_name: string | null;
};

export const ACCOUNT_STATUS_LABEL: Record<AccountStatus, string> = {
  pending: "Aguardando aprovação", approved: "Ativo", blocked: "Bloqueado", temp_blocked: "Bloqueado temporariamente",
  banned: "Banido", rejected: "Rejeitado", deleted: "Excluído",
};
export const ACCOUNT_STATUS_CLASS: Record<AccountStatus, string> = {
  pending: "bg-gold-soft text-gold border-gold/40",
  approved: "bg-success-soft text-success border-success/30",
  blocked: "bg-destructive/10 text-destructive border-destructive/30",
  temp_blocked: "bg-gold-soft text-destructive border-destructive/30",
  banned: "bg-destructive text-destructive-foreground border-destructive",
  rejected: "bg-muted text-muted-foreground border-border",
  deleted: "bg-muted text-muted-foreground border-dashed border-muted-foreground/40 line-through",
};

export const EVENT_LABEL: Record<string, string> = {
  LOGIN: "Entrou no sistema",
  LOGOUT: "Saiu do sistema",
  GARIMPO_CREATED: "Garimpo criado",
  IMPORT_COMPLETED: "Importação concluída",
  LEAD_CREATED: "Lead criado",
  LEAD_UPDATED: "Lead editado",
  LEAD_STATUS_CHANGED: "Status do lead alterado",
  FOLLOWUP_CREATED: "Retorno agendado",
  CLIENT_CONVERTED: "Lead convertido em cliente",
  PROJECT_CREATED: "Projeto criado",
  PROJECT_UPDATED: "Projeto atualizado",
  FINANCIAL_ENTRY_CREATED: "Lançamento financeiro criado",
  FINANCIAL_ENTRY_UPDATED: "Lançamento financeiro editado",
};

export function eventSentence(e: { event_type: string; metadata: Record<string, unknown>; full_name?: string | null; email?: string | null }) {
  const who = e.full_name || e.email || "Alguém";
  const label = (e.metadata?.label as string) || "";
  const q = label ? ` "${label}"` : "";
  switch (e.event_type) {
    case "LOGIN": return `${who} entrou no sistema.`;
    case "LOGOUT": return `${who} saiu do sistema.`;
    case "GARIMPO_CREATED": return `${who} criou o garimpo${q}.`;
    case "IMPORT_COMPLETED": return `${who} importou ${e.metadata?.imported_rows ?? 0} leads.`;
    case "LEAD_CREATED": return `${who} criou o lead${q}.`;
    case "LEAD_UPDATED": return `${who} editou o lead${q}.`;
    case "LEAD_STATUS_CHANGED": return `${who} mudou o status do lead${q}.`;
    case "FOLLOWUP_CREATED": return `${who} agendou um retorno para${q || " um lead"}.`;
    case "CLIENT_CONVERTED": return `${who} converteu um lead em cliente${q}.`;
    case "PROJECT_CREATED": return `${who} criou um projeto de site${q}.`;
    case "PROJECT_UPDATED": return `${who} atualizou um projeto de site${q}.`;
    case "FINANCIAL_ENTRY_CREATED": return `${who} registrou um lançamento financeiro.`;
    case "FINANCIAL_ENTRY_UPDATED": return `${who} editou um lançamento financeiro.`;
    default: return `${who}: ${e.event_type}`;
  }
}

export const money = (v: number | null | undefined) =>
  Number(v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const dt = (v?: string | null) => (v ? new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");
export const d = (v?: string | null) => (v ? new Date(v).toLocaleDateString("pt-BR") : "—");
export const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 1000) / 10}%` : "0%");

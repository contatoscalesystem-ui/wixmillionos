import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export async function logActivity(lead_id: string | null, activity_type: string, description: string, metadata: Json = {}) {
  const { error } = await supabase.from("lead_activities").insert({ lead_id, activity_type, description, metadata });
  if (error) console.error(error);
}

export const ACTIVITY_LABEL: Record<string, string> = {
  lead_created: "Lead criado",
  lead_updated: "Lead atualizado",
  status_changed: "Status alterado",
  whatsapp_opened: "WhatsApp aberto",
  whatsapp_message_opened: "Script — mensagem aberta no WhatsApp",
  approach_generated: "Abordagem gerada",
  approach_sent: "Abordagem enviada",
  note_created: "Nota criada",
  followup_created: "Follow-up agendado",
  link_sent: "Link enviado",
  converted: "Convertido em cliente",
  project_created: "Projeto criado",
  tag_added: "Etiqueta adicionada",
  archived: "Lead arquivado",
  restored: "Lead restaurado",
  import_completed: "Importação concluída",
  script_copied: "Script — mensagem copiada",
  script_sent: "Script — mensagem enviada",
  script_stage_done: "Script — etapa concluída",
  script_stage_undone: "Script — etapa desmarcada",
};

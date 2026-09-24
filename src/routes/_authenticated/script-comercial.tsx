import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, PageHeader, StatusBadge } from "@/components/crm";
import { ScriptPlaybook } from "@/components/script-playbook";
import { useAuth } from "@/hooks/use-auth";
import { friendlyError } from "@/lib/crm";
import { useInvalidate } from "@/lib/queries";
import type { Scope } from "@/lib/script";

export const Route = createFileRoute("/_authenticated/script-comercial")({
  validateSearch: z.object({ lead: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Script Comercial — WIX MILLION OS" },
      { name: "description", content: "Roteiro comercial guiado: etapas, mensagens, objeções e próximos passos." },
      { property: "og:title", content: "Script Comercial — WIX MILLION OS" },
      { property: "og:description", content: "Roteiro comercial guiado com etapas e objeções." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ScriptPage,
});

function ScriptPage() {
  const { lead: leadId } = Route.useSearch();
  const { isSuperAdmin } = useAuth();
  const invalidate = useInvalidate();
  const [editing, setEditing] = useState(false);
  const [scope, setScope] = useState<Scope>("workspace");
  const [reset, setReset] = useState(false);

  const leadQ = useQuery({
    queryKey: [`lead-${leadId}`],
    enabled: !!leadId,
    queryFn: async () => {
      const { data, error } = await supabase.from("leads").select("*").eq("id", leadId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const lead = leadId ? leadQ.data : null;

  const restore = async () => {
    setReset(false);
    const { error } = await supabase.rpc("copy_global_script", { _replace: true });
    if (error) return toast.error(friendlyError(error));
    toast.success("Script padrão restaurado.");
    invalidate("script_stages", "script_objections", "lead_script_progress");
  };

  return (
    <div>
      <PageHeader
        title="Script Comercial"
        subtitle={scope === "global" ? "Editando o SCRIPT GLOBAL PADRÃO — novos espaços recebem uma cópia dele." : "Guia de conversa, roteiro, objeções e passo a passo de conversão."}
        actions={
          <div className="flex flex-wrap gap-2">
            {isSuperAdmin && !lead && (
              <Button variant="outline" onClick={() => { setScope(scope === "global" ? "workspace" : "global"); setEditing(true); }}>
                {scope === "global" ? "Voltar ao meu script" : "Script global padrão"}
              </Button>
            )}
            {!lead && scope === "workspace" && editing && <Button variant="outline" onClick={() => setReset(true)}>Restaurar padrão</Button>}
            {!lead && <Button variant={editing ? "default" : "outline"} onClick={() => { setEditing(!editing); if (editing) setScope("workspace"); }}>{editing ? "Concluir edição" : "Editar script"}</Button>}
          </div>
        }
      />

      {leadId && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-lg border bg-card px-4 py-3 text-sm">
          <Button asChild variant="ghost" size="sm"><Link to="/leads/$id" params={{ id: leadId }}><ArrowLeft className="mr-1 h-4 w-4" />Voltar à ficha</Link></Button>
          {leadQ.isLoading ? <span className="text-muted-foreground">Carregando lead...</span> : lead ? (
            <><span className="font-semibold">{lead.company_name}</span><StatusBadge s={lead.status} /><span className="text-muted-foreground">{[lead.niche, lead.city].filter(Boolean).join(" · ")}</span></>
          ) : <span className="text-muted-foreground">Lead não encontrado.</span>}
        </div>
      )}
      {!leadId && !editing && (
        <p className="mb-4 text-sm text-muted-foreground">Abra pela ficha de um lead para preencher as variáveis, enviar pelo WhatsApp e acompanhar o progresso.</p>
      )}

      <ScriptPlaybook key={scope} lead={lead} scope={scope} editable={editing && !lead} />

      <ConfirmDialog open={reset} onOpenChange={setReset} title="Restaurar script padrão?"
        text="Suas etapas e objeções serão substituídas pela cópia do script global padrão. O progresso dos leads no script atual será perdido."
        confirmLabel="Restaurar" destructive onConfirm={restore} />
    </div>
  );
}

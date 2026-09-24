import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { currentStage, useLeadProgress, useScriptStages } from "@/lib/script";

export function LeadScriptCard({ leadId }: { leadId: string }) {
  const { data: all, isLoading } = useScriptStages();
  const { data: prog } = useLeadProgress(leadId);
  const stages = (all ?? []).filter((s) => s.is_active);
  const done = new Set((prog ?? []).map((p) => p.stage_id));
  const cur = currentStage(stages, done);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <section className="rounded-lg border bg-card p-5">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Script comercial</h2>
      {isLoading ? <p className="text-sm text-muted-foreground">Carregando...</p> : !stages.length ? (
        <p className="text-sm text-muted-foreground">Nenhuma etapa ativa no script.</p>
      ) : (
        <>
          <div className="text-sm">Etapa atual: <span className="font-semibold">{cur ? `${pad(stages.indexOf(cur) + 1)} — ${cur.name}` : "Todas concluídas"}</span></div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {stages.map((s, i) => {
              const d = done.has(s.id); const c = cur?.id === s.id;
              return (
                <span key={s.id} title={s.name}
                  className={"flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold " +
                    (d ? "bg-gold text-gold-foreground" : c ? "border-2 border-gold" : "bg-muted text-muted-foreground")}>
                  {d ? <Check className="h-3.5 w-3.5" /> : c ? `${i + 1} ATUAL` : i + 1}
                </span>
              );
            })}
          </div>
          <Button asChild className="mt-4 w-full bg-gold text-gold-foreground hover:bg-gold/90">
            <Link to="/script-comercial" search={{ lead: leadId }}>Abrir roteiro</Link>
          </Button>
        </>
      )}
    </section>
  );
}

import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { KANBAN_STATUSES, friendlyError, statusLabel, type Lead, type LeadStatus } from "@/lib/crm";
import { logActivity } from "@/lib/activity";
import { PriorityBadge, Score } from "@/components/crm";
import { cn } from "@/lib/utils";
import { DualScroll } from "@/components/dual-scroll";

function Card({ lead }: { lead: Lead }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: lead.id });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined}
      className={cn("cursor-grab rounded-md border bg-card p-3 text-sm touch-none", isDragging && "z-50 opacity-80 shadow-lg")}
    >
      <div className="flex items-start justify-between gap-2">
        <Link to="/leads/$id" params={{ id: lead.id }} className="font-medium leading-tight hover:text-gold" onPointerDown={(e) => e.stopPropagation()}>
          {lead.company_name}
        </Link>
        <PriorityBadge p={lead.priority} />
      </div>
      {(lead.status === "sem_resposta" || lead.status === "recuperacao") && (
        <span className="mt-1.5 inline-flex rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">{statusLabel(lead.status)}</span>
      )}
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span className="truncate">{[lead.niche, lead.city].filter(Boolean).join(" · ") || "—"}</span>
        <Score v={lead.score} />
      </div>
    </div>
  );
}

// "sem_resposta" is shown in the Recuperação column without changing the stored status.
const columnOf = (s: LeadStatus): LeadStatus => (s === "sem_resposta" ? "recuperacao" : s);

function Column({ status, leads, wide, emptyText }: { status: LeadStatus; leads: Lead[]; wide?: boolean; emptyText?: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div ref={setNodeRef} className={cn(cn("flex shrink-0 flex-col", wide ? "w-full max-w-[400px]" : "w-64")," rounded-lg border bg-muted/50", isOver && "border-gold")}>
      <div className="flex items-center justify-between px-3 py-2.5 text-xs font-semibold uppercase tracking-wide">
        <span>{statusLabel(status)}</span>
        <span className="tabular-nums text-muted-foreground">{leads.length}</span>
      </div>
      <div className="flex min-h-24 flex-1 flex-col gap-2 p-2">{leads.map((l) => <Card key={l.id} lead={l} />)}{!leads.length && emptyText && <p className="px-1 py-6 text-center text-xs text-muted-foreground">{emptyText}</p>}</div>
    </div>
  );
}

export function Kanban({ leads, statusFilter }: { leads: Lead[]; statusFilter?: LeadStatus | null }) {
  // A specific status filter shows only its column (sem_resposta lives in Recuperação).
  const cols = statusFilter ? [columnOf(statusFilter)] : KANBAN_STATUSES;
  const qc = useQueryClient();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const onDragEnd = async (e: DragEndEvent) => {
    const to = e.over?.id as LeadStatus | undefined;
    const lead = leads.find((l) => l.id === e.active.id);
    if (!to || !lead || lead.status === to) return;
    const prev = qc.getQueryData<Lead[]>(["leads"]);
    qc.setQueryData<Lead[]>(["leads"], (old) => old?.map((l) => (l.id === lead.id ? { ...l, status: to } : l)));
    if (to === "convertido") {
      // Conversion creates the client + status + activity in one transaction.
      const { error } = await supabase.rpc("convert_lead_to_client", { _lead_id: lead.id });
      if (error) { qc.setQueryData(["leads"], prev); return toast.error(friendlyError(error)); }
      toast.success("Lead convertido em cliente.");
      qc.invalidateQueries({ queryKey: ["activities"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      return;
    }
    const { error } = await supabase.from("leads").update({ status: to }).eq("id", lead.id);
    if (error) {
      qc.setQueryData(["leads"], prev);
      return toast.error(friendlyError(error));
    }
    await logActivity(lead.id, "status_changed", `Status alterado de ${statusLabel(lead.status)} para ${statusLabel(to)}`, { from: lead.status, to, via: "kanban" });
    toast.success(`Movido para ${statusLabel(to)}.`);
    qc.invalidateQueries({ queryKey: ["activities"] });
  };

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      {statusFilter ? (
        <div className="flex gap-3 pb-4">
          {cols.map((s) => <Column key={s} status={s} wide emptyText="Nenhum lead encontrado." leads={leads.filter((l) => columnOf(l.status) === s)} />)}
        </div>
      ) : (
        <DualScroll>
          <div className="flex w-max gap-3 pb-4 pt-2">
            {cols.map((s) => <Column key={s} status={s} leads={leads.filter((l) => columnOf(l.status) === s)} />)}
          </div>
        </DualScroll>
      )}
    </DndContext>
  );
}

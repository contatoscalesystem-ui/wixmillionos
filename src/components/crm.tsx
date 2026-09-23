import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { statusLabel } from "@/lib/crm";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/** Destructive confirmation that requires typing a phrase (case-insensitive, trimmed). Defaults to "EXCLUIR". */
export function StrongConfirmDialog({ open, onOpenChange, title = "Excluir definitivamente?", text, phrase = "EXCLUIR", confirmLabel = "Excluir definitivamente", onConfirm }: {
  open: boolean; onOpenChange: (o: boolean) => void; title?: string; text: string; phrase?: string; confirmLabel?: string; onConfirm: () => void;
}) {
  const [v, setV] = useState("");
  useEffect(() => { if (!open) setV(""); }, [open]);
  const ok = v.trim().toLowerCase() === phrase.trim().toLowerCase();
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{text} Esta ação não pode ser desfeita.</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1.5">
          <p className="text-sm">Para confirmar, digite: <span className="font-semibold">{phrase}</span></p>
          <Input aria-label="Confirmação" value={v} onChange={(e) => setV(e.target.value)} />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <Button variant="destructive" disabled={!ok} onClick={onConfirm}>{confirmLabel}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}


export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, text, children }: { title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed bg-card px-6 py-14 text-center">
      <p className="font-semibold">{title}</p>
      {text && <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{text}</p>}
      {children && <div className="mt-5 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}

export function PriorityBadge({ p }: { p?: string | null }) {
  if (!p) return <span className="text-muted-foreground">—</span>;
  const cls = {
    A: "bg-gold text-gold-foreground",
    B: "bg-gold-soft text-foreground border border-gold/40",
    C: "bg-secondary text-foreground",
    D: "text-muted-foreground border",
  }[p];
  return <span className={cn("inline-flex h-6 w-6 items-center justify-center rounded text-xs font-bold", cls)}>{p}</span>;
}

export function StatusBadge({ s }: { s?: string | null }) {
  const strong = s === "convertido" || s === "interessado" || s === "link_enviado";
  const muted = s === "perdido" || s === "nao_qualificado";
  return (
    <span className={cn(
      "inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium",
      strong && "border-gold/50 bg-gold-soft",
      muted && "text-muted-foreground",
    )}>{statusLabel(s)}</span>
  );
}

export function Score({ v }: { v?: number | null }) {
  if (v == null) return <span className="text-muted-foreground">—</span>;
  return <span className="font-semibold tabular-nums text-gold">{Number(v)}</span>;
}

export function ConfirmDialog({ open, onOpenChange, title, text, confirmLabel = "Confirmar", onConfirm, destructive }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; text?: string; confirmLabel?: string;
  onConfirm: () => void; destructive?: boolean;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {text && <AlertDialogDescription>{text}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction className={destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""} onClick={onConfirm}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ComingSoon({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <PageHeader title={title} />
      <div className="rounded-lg border bg-card px-6 py-16 text-center">
        <span className="rounded-full border border-gold/50 bg-gold-soft px-3 py-1 text-xs font-semibold uppercase tracking-wider">Próximo MVP</span>
        <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

export function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm">{children || children === 0 ? children : "—"}</dd>
    </div>
  );
}

export function StatCard({ label, value, highlight }: { label: string; value: ReactNode; highlight?: boolean }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-2xl font-bold tabular-nums", highlight && "text-gold")}>{value}</div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SlidersHorizontal, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { KANBAN_STATUSES, LEAD_STATUS, WEBSITE_STATUS } from "@/lib/crm";
import { useGarimpos, useProfiles } from "@/lib/queries";

export type DashFilters = {
  periodo?: string; de?: string; ate?: string; garimpo?: string; cidade?: string;
  nicho?: string; resp?: string; status?: string; site?: string;
};

export const PERIODS: { value: string; label: string; days?: number }[] = [
  { value: "hoje", label: "Hoje", days: 0 },
  { value: "7d", label: "Últimos 7 dias", days: 7 },
  { value: "15d", label: "Últimos 15 dias", days: 15 },
  { value: "30d", label: "Últimos 30 dias", days: 30 },
  { value: "60d", label: "Últimos 60 dias", days: 60 },
  { value: "90d", label: "Últimos 90 dias", days: 90 },
  { value: "180d", label: "Últimos 180 dias", days: 180 },
  { value: "12m", label: "Últimos 12 meses" },
  { value: "custom", label: "Data personalizada" },
];
export const DEFAULT_PERIOD = "30d";
const FILTER_KEYS = ["garimpo", "cidade", "nicho", "resp", "status", "site"] as const;

export function validateDashSearch(s: Record<string, unknown>): DashFilters {
  const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
  const out: DashFilters = {};
  for (const k of ["periodo", "de", "ate", ...FILTER_KEYS] as const) out[k] = str(s[k]);
  return out;
}

/** Resolves the selected period into [from, to) ISO bounds. Custom applies only when both dates exist. */
export function periodRange(f: DashFilters): { from: string; to: string | null; label: string } {
  if (f.periodo === "custom" && f.de && f.ate) {
    const from = new Date(`${f.de}T00:00:00`), to = new Date(`${f.ate}T00:00:00`);
    to.setDate(to.getDate() + 1);
    const fmt = (d: string) => d.split("-").reverse().join("/");
    return { from: from.toISOString(), to: to.toISOString(), label: `${fmt(f.de)} – ${fmt(f.ate)}` };
  }
  const p = PERIODS.find((x) => x.value === f.periodo && x.value !== "custom") ?? PERIODS.find((x) => x.value === DEFAULT_PERIOD)!;
  const from = new Date(); from.setHours(0, 0, 0, 0);
  if (p.value === "12m") from.setFullYear(from.getFullYear() - 1);
  else if (p.days) from.setDate(from.getDate() - (p.days - 1));
  return { from: from.toISOString(), to: null, label: p.label };
}

export function activeCount(f: DashFilters) {
  const periodChanged = (f.periodo ?? DEFAULT_PERIOD) !== DEFAULT_PERIOD && !(f.periodo === "custom" && !(f.de && f.ate));
  return FILTER_KEYS.filter((k) => f[k]).length + (periodChanged ? 1 : 0);
}

const SITE_OPTIONS = [{ value: "com_site", label: "Com site" }, ...WEBSITE_STATUS];
const STATUS_OPTIONS = LEAD_STATUS.filter((s) => KANBAN_STATUSES.includes(s.value));

export function DashboardFilters({ value, onChange, busy }: { value: DashFilters; onChange: (f: DashFilters) => void; busy?: boolean }) {
  const [open, setOpen] = useState(false);
  const { data: garimpos } = useGarimpos();
  const { data: profiles } = useProfiles();
  const places = useQuery({
    queryKey: ["leads", "places"],
    queryFn: async () => {
      const { data, error } = await supabase.from("leads").select("city, niche").is("archived_at", null).limit(10000);
      if (error) throw error;
      const uniq = (xs: (string | null)[]) => [...new Set(xs.map((x) => x?.trim()).filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, "pt-BR"));
      return { cities: uniq(data.map((d) => d.city)), niches: uniq(data.map((d) => d.niche)) };
    },
  });

  const periodo = value.periodo ?? DEFAULT_PERIOD;
  const [de, setDe] = useState(value.de ?? "");
  const [ate, setAte] = useState(value.ate ?? "");
  const [customPending, setCustomPending] = useState(false);
  useEffect(() => { setDe(value.de ?? ""); setAte(value.ate ?? ""); }, [value.de, value.ate]);

  const set = (patch: Partial<DashFilters>) => onChange({ ...value, ...patch });
  const n = activeCount(value);
  const showCustom = periodo === "custom" || customPending;
  const setDate = (a: string, b: string) => { setDe(a); setAte(b); if (a && b && a <= b) { setCustomPending(false); set({ periodo: "custom", de: a, ate: b }); } };

  const sel = (label: string, v: string | undefined, key: keyof DashFilters, allLabel: string, opts: { value: string; label: string }[]) => (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
      <select value={v ?? ""} onChange={(e) => set({ [key]: e.target.value || undefined })}
        className="h-10 w-full min-w-0 rounded-[10px] border border-border bg-card px-3 text-[14px] text-foreground outline-none focus:border-gold">
        <option value="">{allLabel}</option>
        {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );

  const panel = (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 xl:items-end">
      <label className="flex min-w-0 flex-col gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Período</span>
        <select value={showCustom ? "custom" : periodo}
          onChange={(e) => {
            const p = e.target.value;
            if (p === "custom") { setCustomPending(true); if (de && ate) set({ periodo: "custom", de, ate }); }
            else { setCustomPending(false); set({ periodo: p === DEFAULT_PERIOD ? undefined : p, de: undefined, ate: undefined }); }
          }}
          className="h-10 w-full min-w-0 rounded-[10px] border border-border bg-card px-3 text-[14px] text-foreground outline-none focus:border-gold">
          {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
      </label>
      {sel("Garimpo", value.garimpo, "garimpo", "Todos os garimpos", (garimpos ?? []).map((g) => ({ value: g.id, label: g.name })))}
      {sel("Cidade", value.cidade, "cidade", "Todas as cidades", (places.data?.cities ?? []).map((c) => ({ value: c, label: c })))}
      {sel("Nicho", value.nicho, "nicho", "Todos os nichos", (places.data?.niches ?? []).map((c) => ({ value: c, label: c })))}
      {sel("Responsável", value.resp, "resp", "Todos os responsáveis", (profiles ?? []).map((p) => ({ value: p.id, label: p.full_name || p.email || "—" })))}
      {sel("Status", value.status, "status", "Todos os status", STATUS_OPTIONS)}
      {sel("Site", value.site, "site", "Todos", SITE_OPTIONS)}
      <button type="button" onClick={() => { setCustomPending(false); onChange({}); }}
        className="h-10 rounded-[10px] border border-border bg-card px-4 text-[13px] font-semibold text-foreground transition-colors hover:border-gold hover:text-gold">
        Limpar filtros
      </button>
      {showCustom && (
        <div className="grid grid-cols-2 gap-3 sm:col-span-2 lg:col-span-4 xl:col-span-8 xl:max-w-md">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Data inicial</span>
            <input type="date" value={de} max={ate || undefined} onChange={(e) => setDate(e.target.value, ate)}
              className="h-10 rounded-[10px] border border-border bg-card px-3 text-[14px]" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Data final</span>
            <input type="date" value={ate} min={de || undefined} onChange={(e) => setDate(de, e.target.value)}
              className="h-10 rounded-[10px] border border-border bg-card px-3 text-[14px]" />
          </label>
          {!(de && ate) && <p className="col-span-2 text-[12px] text-muted-foreground">Escolha as duas datas para aplicar o período.</p>}
        </div>
      )}
    </div>
  );

  return (
    <section className="db-panel p-3 sm:p-4">
      <div className="flex items-center justify-between gap-3 lg:hidden">
        <div className="min-w-0 text-[13px]">
          <span className="text-muted-foreground">Período: </span>
          <span className="font-semibold">{periodRange(value).label}</span>
          {busy && <span className="ml-2 text-[12px] text-muted-foreground">Atualizando…</span>}
        </div>
        <button type="button" onClick={() => setOpen((o) => !o)}
          className="flex h-10 shrink-0 items-center gap-2 rounded-[10px] border border-border bg-card px-3 text-[13px] font-semibold">
          {open ? <X className="h-4 w-4" /> : <SlidersHorizontal className="h-4 w-4 text-gold" />}
          Filtros{n ? ` (${n})` : ""}
        </button>
      </div>
      <div className={`${open ? "mt-3 block" : "hidden"} lg:mt-0 lg:block`}>
        <div className="mb-2 hidden items-center justify-between lg:flex">
          <span className="text-[12px] font-bold uppercase tracking-[0.2em]">Filtros{n ? ` (${n})` : ""}</span>
          {busy && <span className="text-[12px] text-muted-foreground">Atualizando…</span>}
        </div>
        {panel}
      </div>
    </section>
  );
}

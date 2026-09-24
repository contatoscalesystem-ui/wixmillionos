import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ClipboardPaste, FileUp, Loader2, Pencil, Scale, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { friendlyError, websiteLabel, WEBSITE_STATUS, PRIORITIES } from "@/lib/crm";
import { useProfiles } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/crm";
import { chooseMainTable, MAX_ROWS, parseTableRows, validate, type Parsed, type RawTable, type ScoredTable } from "@/lib/import/parser";
import { findDuplicates, summarizeParsed, type ExistingLead } from "@/lib/import/duplicates";
import { ReadError, readFile, readText, validateFile, extOf } from "@/lib/import/readers";
import {
  cancelBatch, commitBatch, createStagedBatch, fetchExistingLeads, loadRows, refreshCounts, reprocessBatch, saveRow, setSelected,
  type CommitResult, type GarimpoInput, type StagedRow,
} from "@/lib/import/service";

const STEPS = ["Garimpo", "Arquivo", "Processamento", "Preview", "Duplicidades", "Confirmação", "Resultado"];
const STATUS_CHIP: Record<string, { label: string; cls: string }> = {
  valid: { label: "Válido", cls: "border-foreground/20 bg-card" },
  review: { label: "Revisar", cls: "border-gold/60 bg-gold-soft" },
  duplicate: { label: "Possível duplicado", cls: "border-foreground/40 bg-muted" },
  invalid: { label: "Inválido", cls: "border-destructive/50 text-destructive" },
};
const PAGE = 50;
const today = () => new Date().toISOString().slice(0, 10);
const fmtBytes = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);
const eligible = (r: StagedRow) => r.status !== "invalid" && (r.status !== "duplicate" || r.duplicate_action === "import_anyway");

function Chip({ status }: { status: string }) {
  const c = STATUS_CHIP[status];
  return <span className={cn("inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium", c?.cls)}>{c?.label ?? status}</span>;
}

export function ImportWizard({ resumeBatch }: { resumeBatch?: string }) {
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: profiles } = useProfiles();

  const [step, setStep] = useState(1);
  const [g, setG] = useState<GarimpoInput>({ name: "", niche: "", city: "", state: "", research_date: today(), source: "Manus" });
  const [mode, setMode] = useState<"file" | "paste">("file");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [drag, setDrag] = useState(false);
  const [stage, setStage] = useState("");
  const [procError, setProcError] = useState("");
  const [choices, setChoices] = useState<{ tables: ScoredTable[]; label: string } | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [garimpoId, setGarimpoId] = useState<string | null>(null);
  const [rows, setRows] = useState<StagedRow[]>([]);
  const [existing, setExisting] = useState<ExistingLead[] | null>(null);
  const [filter, setFilter] = useState<"all" | "valid" | "review" | "duplicate" | "invalid">("all");
  const [prio, setPrio] = useState("all");
  const [minScore, setMinScore] = useState("");
  const [page, setPage] = useState(0);
  const [edit, setEdit] = useState<StagedRow | null>(null);
  const [compare, setCompare] = useState<StagedRow | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [assignee, setAssignee] = useState("");
  const [initial, setInitial] = useState<"novo" | "pronto_contato">("novo");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CommitResult | null>(null);
  const [resuming, setResuming] = useState(!!resumeBatch);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => { if (userId && !assignee) setAssignee(userId); }, [userId, assignee]);

  // Resume after F5: batch id lives in the URL
  useEffect(() => {
    if (!resumeBatch || batchId) { setResuming(false); return; }
    (async () => {
      const { data: b } = await supabase.from("import_batches").select("*").eq("id", resumeBatch).maybeSingle();
      if (!b) { setResuming(false); return; }
      const { data: gar } = b.garimpo_id ? await supabase.from("garimpos").select("*").eq("id", b.garimpo_id).maybeSingle() : { data: null };
      if (gar) setG({ name: gar.name, niche: gar.niche ?? "", city: gar.city ?? "", state: gar.state ?? "", research_date: gar.research_date ?? "", source: gar.source ?? "" });
      setBatchId(b.id); setGarimpoId(b.garimpo_id);
      if (b.status === "completed") {
        setResult({ imported: b.imported_rows, total: b.total_rows, valid: b.valid_rows, invalid: b.invalid_rows, duplicates: b.duplicate_rows, review: Math.max(0, b.total_rows - b.valid_rows - b.invalid_rows - b.duplicate_rows) });
        setStep(7);
      } else if (["preview", "ready", "failed"].includes(b.status)) {
        setRows(await loadRows(b.id)); setStep(4);
      }
      setResuming(false);
    })().catch(() => setResuming(false));
  }, [resumeBatch, batchId]);

  const paint = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

  const pickFile = (f: File | undefined) => {
    if (!f) return;
    const err = validateFile(f);
    if (err) { toast.error(err); return; }
    setFile(f); setMode("file");
  };

  const process = async () => {
    setProcError(""); setChoices(null); setStep(3);
    try {
      setStage("Lendo arquivo..."); await paint();
      const read = mode === "file" && file ? await readFile(file) : await readText(text);
      setStage("Identificando tabela..."); await paint();
      if (!read.tables.length) throw new ReadError("Nenhuma tabela foi encontrada neste conteúdo. O relatório precisa ter uma tabela (Markdown, CSV ou planilha) com as empresas.");
      const choice = chooseMainTable(read.tables);
      if (!choice.best) throw new ReadError("Não encontramos uma tabela de leads. A tabela precisa ter uma coluna com o nome da empresa (ex.: Empresa, Barbearia, Nome).");
      if (read.sheets && read.sheets.length > 1 && choice.candidates.length > 1) {
        setChoices({ tables: choice.candidates, label: "Qual planilha deseja importar?" }); return;
      }
      if (choice.ambiguous) { setChoices({ tables: choice.candidates, label: "Encontramos mais de uma tabela parecida. Qual é a tabela principal de leads?" }); return; }
      await continueWith(choice.best);
    } catch (e) {
      setProcError(e instanceof ReadError ? e.message : friendlyError(e));
    }
  };

  const continueWith = async (t: RawTable) => {
    setChoices(null); setProcError("");
    try {
      if (t.rows.length > MAX_ROWS) throw new ReadError(`Este relatório tem ${t.rows.length} linhas. O limite é de ${MAX_ROWS} leads por importação — divida o arquivo e importe em partes.`);
      setStage("Normalizando campos..."); await paint();
      const parsed = parseTableRows(t, { city: g.city || null, state: g.state.toUpperCase() || null, niche: g.niche || null });
      if (!parsed.length) throw new ReadError("A tabela encontrada não possui linhas com dados.");
      setStage("Verificando duplicidades..."); await paint();
      const ex = await fetchExistingLeads(); setExisting(ex);
      const dups = findDuplicates(parsed, ex);
      setStage("Preparando preview..."); await paint();
      const { batchId: b, garimpoId: gid } = await createStagedBatch({ garimpo: g, file: mode === "file" ? file : null, rows: parsed, dups, userId });
      setBatchId(b); setGarimpoId(gid);
      setRows(await loadRows(b));
      navigate({ to: "/garimpos/importar", search: { batch: b }, replace: true });
      setPage(0); setStep(4);
    } catch (e) {
      setProcError(e instanceof ReadError ? e.message : friendlyError(e));
    }
  };

  const ensureExisting = async (): Promise<ExistingLead[]> => existing ?? (await fetchExistingLeads().then((x) => { setExisting(x); return x; }));

  const patchRows = async (changed: StagedRow[]) => {
    const map = new Map(changed.map((r) => [r.id, r]));
    setRows((rs) => rs.map((r) => map.get(r.id) ?? r));
    try { for (const r of changed) await saveRow(r); if (batchId) await refreshCounts(batchId); }
    catch (e) { toast.error(friendlyError(e)); if (batchId) setRows(await loadRows(batchId)); }
  };

  const toggle = (r: StagedRow, v: boolean) => {
    if (v && !eligible(r)) return;
    patchRows([{ ...r, selected_for_import: v }]);
  };

  const bulk = async (pred: ((r: StagedRow) => boolean) | null) => {
    const next = rows.map((r) => ({ ...r, selected_for_import: pred ? eligible(r) && pred(r) : false }));
    setRows(next);
    try {
      const on = next.filter((r) => r.selected_for_import).map((r) => r.id);
      const off = next.filter((r) => !r.selected_for_import).map((r) => r.id);
      await setSelected(on, true); await setSelected(off, false);
      toast.success(`${on.length} selecionados para importar.`);
    } catch (e) { toast.error(friendlyError(e)); }
  };

  const saveEdit = async (r: StagedRow, p: Parsed) => {
    const ex = await ensureExisting();
    const others = rows.filter((x) => x.id !== r.id && x.row_number < r.row_number).map((x) => ({ row_number: x.row_number, parsed: x.parsed_data }));
    const dm = findDuplicates([...others, { row_number: r.row_number, parsed: p }], ex).get(r.row_number) ?? [];
    const v = validate(p, r.warnings);
    const isDup = dm.length > 0 && v.status !== "invalid";
    const action = isDup ? (r.duplicate_action ?? "skip") : null;
    const next: StagedRow = {
      ...r, parsed_data: p, warnings: v.warnings, duplicate_matches: dm, status: isDup ? "duplicate" : v.status, duplicate_action: action,
      selected_for_import: v.status === "invalid" ? false : isDup ? action === "import_anyway" : r.status === "invalid" ? true : r.selected_for_import,
    };
    await patchRows([next]); setEdit(null); toast.success("Linha atualizada.");
  };

  const setDupAction = (r: StagedRow, a: "skip" | "import_anyway") => {
    patchRows([{ ...r, duplicate_action: a, selected_for_import: a === "import_anyway" }]); setCompare(null);
  };

  const doCancel = async () => {
    setCancelOpen(false);
    if (batchId) { try { await cancelBatch(batchId, garimpoId); } catch (e) { toast.error(friendlyError(e)); return; } }
    toast.success("Importação cancelada. Nenhum lead foi criado.");
    qc.invalidateQueries();
    setBatchId(null); setGarimpoId(null); setRows([]); setFile(null); setText(""); setStep(1); setResult(null);
    navigate({ to: "/garimpos/importar", search: {}, replace: true });
  };

  const confirm = async () => {
    if (!batchId) return;
    setBusy(true);
    try {
      await refreshCounts(batchId, "ready");
      const r = await commitBatch(batchId, assignee || userId, initial);
      setResult(r); setStep(7); qc.invalidateQueries();
      toast.success(`${r.imported} leads importados.`);
    } catch (e) { toast.error(friendlyError(e)); }
    finally { setBusy(false); }
  };

  const counts = useMemo(() => {
    const c = (s: string) => rows.filter((r) => r.status === s).length;
    const sel = rows.filter((r) => r.selected_for_import && eligible(r));
    return {
      total: rows.length, valid: c("valid"), review: c("review"), duplicate: c("duplicate"), invalid: c("invalid"), selected: sel.length,
      selReview: sel.filter((r) => r.status === "review").length, selDup: sel.filter((r) => r.status === "duplicate").length,
    };
  }, [rows]);

  const filtered = useMemo(() => rows.filter((r) =>
    (filter === "all" || r.status === filter) &&
    (prio === "all" || r.parsed_data.priority === prio) &&
    (!minScore || (r.parsed_data.score ?? -1) >= Number(minScore))), [rows, filter, prio, minScore]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const pageRows = filtered.slice(page * PAGE, page * PAGE + PAGE);
  useEffect(() => { if (page >= pages) setPage(0); }, [pages, page]);

  const members = (profiles ?? []) as { id: string; full_name: string | null; email: string | null }[];

  if (resuming) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Carregando importação...</div>;

  return (
    <div className="space-y-6">
      {/* progress */}
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <span className={cn("flex items-center gap-1.5 rounded-full border px-2.5 py-1",
              step === i + 1 ? "border-gold bg-gold-soft font-semibold" : step > i + 1 ? "border-foreground/20 text-foreground" : "border-border text-muted-foreground")}>
              {step > i + 1 ? <Check className="h-3 w-3" /> : <span className="tabular-nums">{String(i + 1).padStart(2, "0")}</span>}{s}
            </span>
            {i < STEPS.length - 1 && <span className="text-muted-foreground">→</span>}
          </li>
        ))}
      </ol>

      {step === 1 && (
        <section className="max-w-2xl rounded-lg border bg-card p-5">
          <h2 className="mb-4 font-semibold">Dados do garimpo</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {([["name", "Nome do garimpo", "Garimpo 01 — Barbearias Feira de Santana"], ["niche", "Nicho", "Barbearias"], ["city", "Cidade", "Feira de Santana"], ["state", "Estado", "BA"], ["research_date", "Data da pesquisa", ""], ["source", "Fonte", "Manus"]] as const).map(([k, l, ph]) => (
              <div key={k} className={cn("space-y-1.5", k === "name" && "sm:col-span-2")}>
                <Label htmlFor={`g-${k}`}>{l}{k === "name" && " *"}</Label>
                <Input id={`g-${k}`} type={k === "research_date" ? "date" : "text"} maxLength={k === "state" ? 2 : 160} placeholder={ph} value={g[k]} onChange={(e) => setG({ ...g, [k]: e.target.value })} />
              </div>
            ))}
          </div>
          <div className="mt-5 flex justify-end">
            <Button className="bg-gold text-gold-foreground hover:bg-gold/90" disabled={!g.name.trim()} onClick={() => setStep(2)}>Continuar</Button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="max-w-2xl space-y-4 rounded-lg border bg-card p-5">
          <h2 className="font-semibold">Relatório da Manus</h2>
          <div className="flex gap-2 text-sm">
            <Button variant={mode === "file" ? "default" : "outline"} size="sm" onClick={() => setMode("file")}><FileUp className="mr-1 h-4 w-4" />Arquivo</Button>
            <Button variant={mode === "paste" ? "default" : "outline"} size="sm" onClick={() => setMode("paste")}><ClipboardPaste className="mr-1 h-4 w-4" />Colar conteúdo</Button>
          </div>
          {mode === "file" ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); pickFile(e.dataTransfer.files[0]); }}
              onClick={() => fileInput.current?.click()}
              className={cn("flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-10 text-center", drag ? "border-gold bg-gold-soft" : "border-border")}
            >
              <FileUp className="h-6 w-6 text-muted-foreground" />
              <p className="font-medium">Arraste seu relatório da Manus aqui</p>
              <p className="text-xs text-muted-foreground">TXT, MD, CSV, XLSX ou PDF (com texto) — até 10 MB</p>
              <input ref={fileInput} type="file" className="hidden" accept=".txt,.md,.markdown,.csv,.xlsx,.pdf" onChange={(e) => pickFile(e.target.files?.[0])} />
              {file && (
                <div className="mt-2 rounded-md border bg-background px-3 py-2 text-sm">
                  <span className="font-medium">{file.name}</span> · {extOf(file.name).toUpperCase()} · {fmtBytes(file.size)}
                </div>
              )}
              <p className="mt-2 text-xs text-muted-foreground">OU</p>
              <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setMode("paste"); }}>Colar conteúdo</Button>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="paste">Cole aqui o relatório copiado da Manus</Label>
              <Textarea id="paste" rows={14} className="font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} placeholder="| Posição | Score | Prioridade | Barbearia | ..." />
            </div>
          )}
          <div className="flex justify-between">
            <Button variant="ghost" onClick={() => setStep(1)}>Voltar</Button>
            <Button className="bg-gold text-gold-foreground hover:bg-gold/90" disabled={mode === "file" ? !file : !text.trim()} onClick={process}>Processar</Button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="max-w-2xl space-y-4 rounded-lg border bg-card p-5">
          {procError ? (
            <>
              <p className="text-sm text-destructive">{procError}</p>
              <Button variant="outline" onClick={() => setStep(2)}>Voltar para o arquivo</Button>
            </>
          ) : choices ? (
            <>
              <p className="font-medium">{choices.label}</p>
              <div className="space-y-2">
                {choices.tables.map((t) => (
                  <button key={t.index} onClick={() => continueWith(t)} className="w-full rounded-md border p-3 text-left text-sm hover:border-gold">
                    <div className="font-medium">{t.sheet ?? t.title ?? `Tabela ${t.index + 1}`} — {t.rows.length} linhas</div>
                    <div className="truncate text-xs text-muted-foreground">{t.headers.join(" · ")}</div>
                  </button>
                ))}
              </div>
              <Button variant="ghost" onClick={() => setStep(2)}>Voltar</Button>
            </>
          ) : (
            <div className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" />{stage}</div>
          )}
        </section>
      )}

      {(step === 4 || step === 5) && (
        <section className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {([["Registros encontrados", counts.total, "all"], ["Válidos", counts.valid, "valid"], ["Revisar", counts.review, "review"], ["Possíveis duplicados", counts.duplicate, "duplicate"], ["Inválidos", counts.invalid, "invalid"], ["Selecionados para importar", counts.selected, null]] as const).map(([l, v, f]) => (
              <button key={l} disabled={!f} onClick={() => f && (setFilter(f), setStep(4))} className={cn("rounded-lg border bg-card p-3 text-left", f && filter === f && "border-gold")}>
                <div className="text-xs text-muted-foreground">{l}</div>
                <div className={cn("text-2xl font-semibold tabular-nums", !f && "text-gold")}>{v}</div>
              </button>
            ))}
          </div>

          {step === 4 ? (
            <>
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex flex-wrap gap-1">
                  {(["all", "valid", "review", "duplicate", "invalid"] as const).map((f) => (
                    <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => { setFilter(f); setPage(0); }}>
                      {f === "all" ? "Todos" : f === "valid" ? "Válidos" : f === "review" ? "Revisar" : f === "duplicate" ? "Duplicados" : "Inválidos"}
                    </Button>
                  ))}
                </div>
                <Select value={prio} onValueChange={(v) => { setPrio(v); setPage(0); }}>
                  <SelectTrigger className="h-9 w-36"><SelectValue placeholder="Prioridade" /></SelectTrigger>
                  <SelectContent><SelectItem value="all">Toda prioridade</SelectItem>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>Prioridade {p}</SelectItem>)}</SelectContent>
                </Select>
                <Input className="h-9 w-32" type="number" min={0} max={100} placeholder="Score mín." value={minScore} onChange={(e) => { setMinScore(e.target.value); setPage(0); }} />
              </div>
              <div className="flex flex-wrap gap-1 text-xs">
                <Button size="sm" variant="outline" onClick={() => bulk((r) => r.status === "valid")}>Selecionar todos os válidos</Button>
                <Button size="sm" variant="outline" onClick={() => bulk((r) => r.parsed_data.priority === "A")}>Selecionar Prioridade A</Button>
                <Button size="sm" variant="outline" onClick={() => bulk((r) => r.parsed_data.priority === "A" || r.parsed_data.priority === "B")}>Selecionar A + B</Button>
                <Button size="sm" variant="outline" onClick={() => bulk((r) => (r.parsed_data.score ?? -1) >= 80)}>Score ≥ 80</Button>
                <Button size="sm" variant="outline" onClick={() => bulk((r) => (r.parsed_data.score ?? -1) >= 70)}>Score ≥ 70</Button>
                <Button size="sm" variant="ghost" onClick={() => bulk(null)}>Desmarcar todos</Button>
              </div>

              <PreviewTable rows={pageRows} onToggle={toggle} onEdit={setEdit} onCompare={setCompare} />
              <PreviewCards rows={pageRows} onToggle={toggle} onEdit={setEdit} onCompare={setCompare} />
              {!filtered.length && <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma linha com esses filtros.</p>}
              {pages > 1 && (
                <div className="flex items-center justify-center gap-2 text-sm">
                  <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Anterior</Button>
                  <span className="tabular-nums">{page + 1} / {pages}</span>
                  <Button size="sm" variant="outline" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Próxima</Button>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-2">
              {!rows.some((r) => r.status === "duplicate") && <p className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">Nenhum possível duplicado encontrado.</p>}
              {rows.filter((r) => r.status === "duplicate").map((r) => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3 text-sm">
                  <div>
                    <div className="font-medium">#{r.row_number} {r.parsed_data.company_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.duplicate_matches.map((m) => `${m.source === "crm" ? "CRM" : `linha ${m.row_number} do arquivo`}: ${m.company_name} — ${m.reasons.join(", ")}`).join(" · ")}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs">{r.duplicate_action === "import_anyway" ? "Importar mesmo assim" : "Não importar"}</span>
                    <Button size="sm" variant="outline" onClick={() => setCompare(r)}><Scale className="mr-1 h-4 w-4" />Comparar</Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap justify-between gap-2 border-t pt-4">
            <Button variant="outline" className="text-destructive" onClick={() => setCancelOpen(true)}><X className="mr-1 h-4 w-4" />Cancelar importação</Button>
            <div className="flex gap-2">
              {step === 4 && batchId && <Button variant="outline" disabled={busy} onClick={async () => {
                setBusy(true);
                try { const n = await reprocessBatch(batchId, { city: g.city || null, state: g.state || null, niche: g.niche || null }); setRows(await loadRows(batchId)); toast.success(`Leitura refeita. ${n} linha(s) atualizada(s).`); }
                catch (e) { toast.error(friendlyError(e)); } finally { setBusy(false); }
              }}>Reprocessar leitura</Button>}
              {step === 5 && <Button variant="ghost" onClick={() => setStep(4)}>Voltar ao preview</Button>}
              <Button className="bg-gold text-gold-foreground hover:bg-gold/90" onClick={() => setStep(step === 4 ? 5 : 6)}>{step === 4 ? "Revisar duplicidades" : "Continuar"}</Button>
            </div>
          </div>
        </section>
      )}

      {step === 6 && (
        <section className="max-w-2xl space-y-4 rounded-lg border bg-card p-5">
          <h2 className="font-semibold">Confirmar importação</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {([["Garimpo", g.name], ["Nicho", g.niche || "—"], ["Cidade", [g.city, g.state].filter(Boolean).join("/") || "—"], ["Registros encontrados", counts.total], ["Selecionados", counts.selected], ["Revisar (incluídos)", counts.selReview], ["Duplicados incluídos", counts.selDup], ["Ignorados", counts.total - counts.selected]] as const).map(([k, v]) => (
              <div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd className="font-medium tabular-nums">{v}</dd></div>
            ))}
          </dl>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Responsável pelos leads</Label>
              <Select value={assignee} onValueChange={setAssignee}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.id === userId ? "Eu" : m.full_name || m.email}</SelectItem>)}
                  {!members.some((m) => m.id === userId) && userId && <SelectItem value={userId}>Eu</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status inicial</Label>
              <Select value={initial} onValueChange={(v) => setInitial(v as "novo" | "pronto_contato")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="novo">Novo</SelectItem><SelectItem value="pronto_contato">Pronto para contato</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap justify-between gap-2 border-t pt-4">
            <Button variant="outline" className="text-destructive" disabled={busy} onClick={() => setCancelOpen(true)}>Cancelar importação</Button>
            <div className="flex gap-2">
              <Button variant="ghost" disabled={busy} onClick={() => setStep(5)}>Voltar</Button>
              <Button className="bg-gold text-gold-foreground hover:bg-gold/90" disabled={busy || counts.selected === 0} onClick={confirm}>
                {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Confirmar importação
              </Button>
            </div>
          </div>
          {counts.selected === 0 && <p className="text-xs text-muted-foreground">Selecione ao menos uma linha para importar.</p>}
        </section>
      )}

      {step === 7 && result && (
        <section className="max-w-2xl space-y-4 rounded-lg border bg-card p-5">
          <h2 className="font-semibold">Importação concluída</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {([["Encontrados", result.total], ["Importados", result.imported], ["Ignorados", result.total - result.imported], ["Duplicados", result.duplicates], ["Revisados", result.review], ["Inválidos", result.invalid]] as const).map(([l, v]) => (
              <div key={l} className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">{l}</div><div className={cn("text-2xl font-semibold tabular-nums", l === "Importados" && "text-gold")}>{v}</div></div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {garimpoId && <Button asChild variant="outline"><Link to="/garimpos/$id" params={{ id: garimpoId }}>Ver garimpo</Link></Button>}
            {batchId && <Button asChild variant="outline"><Link to="/leads" search={{ import_batch: batchId }}>Ver leads importados</Link></Button>}
            <Button asChild variant="outline"><Link to="/pipeline">Ir para pipeline</Link></Button>
            <Button className="bg-gold text-gold-foreground hover:bg-gold/90" onClick={() => {
              setBatchId(null); setGarimpoId(null); setRows([]); setFile(null); setText(""); setResult(null); setExisting(null);
              setG({ name: "", niche: "", city: "", state: "", research_date: today(), source: "Manus" }); setStep(1);
              navigate({ to: "/garimpos/importar", search: {}, replace: true });
            }}>Fazer nova importação</Button>
          </div>
        </section>
      )}

      {edit && <EditRowDialog row={edit} onClose={() => setEdit(null)} onSave={saveEdit} />}
      {compare && <CompareDialog row={compare} onClose={() => setCompare(null)} onAction={setDupAction} />}
      <ConfirmDialog open={cancelOpen} onOpenChange={setCancelOpen} destructive title="Cancelar importação?" text="Nenhum lead será criado e o rascunho do garimpo será descartado." confirmLabel="Cancelar importação" onConfirm={doCancel} />
    </div>
  );
}

// ---------------------------------------------------------------- preview (desktop table)
type RowProps = { rows: StagedRow[]; onToggle: (r: StagedRow, v: boolean) => void; onEdit: (r: StagedRow) => void; onCompare: (r: StagedRow) => void };
const T = ({ v, max = 28 }: { v: string | number | null | undefined; max?: number }) => {
  if (v == null || v === "") return <span className="text-muted-foreground">—</span>;
  const s = String(v);
  return <span title={s}>{s.length > max ? s.slice(0, max) + "…" : s}</span>;
};
const U = ({ url }: { url: string | null }) => url && /^https?:\/\//i.test(url)
  ? <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="underline decoration-dotted hover:text-gold" title={url}>{url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 22)}{url.length > 30 ? "…" : ""}</a>
  : <span className="text-muted-foreground">—</span>;

function PreviewTable({ rows, onToggle, onEdit, onCompare }: RowProps) {
  const H = ["Importar?", "Status", "Posição", "Empresa", "Score", "Prioridade", "Cidade", "Bairro", "Telefone", "WhatsApp", "Instagram", "Seguidores", "Google", "Avaliações", "Site", "Status do site", "Agendamento", "Alertas", "Ações"];
  return (
    <div className="hidden overflow-x-auto rounded-lg border bg-card md:block">
      <table className="w-full text-xs">
        <thead className="border-b text-left uppercase tracking-wide text-muted-foreground">
          <tr>{H.map((h) => <th key={h} className="whitespace-nowrap px-2 py-2 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r) => { const p = r.parsed_data; return (
            <tr key={r.id} className={cn("border-b align-top last:border-0", !r.selected_for_import && "text-muted-foreground")}>
              <td className="px-2 py-2"><Checkbox aria-label={`Importar ${p.company_name ?? r.row_number}`} checked={r.selected_for_import} disabled={!eligible(r)} onCheckedChange={(v) => onToggle(r, !!v)} /></td>
              <td className="px-2 py-2"><Chip status={r.status} /></td>
              <td className="px-2 py-2 tabular-nums"><T v={p.position} /></td>
              <td className="px-2 py-2 font-medium text-foreground"><T v={p.company_name} max={32} /></td>
              <td className="px-2 py-2 tabular-nums font-semibold"><T v={p.score} /></td>
              <td className="px-2 py-2"><T v={p.priority} /></td>
              <td className="px-2 py-2"><T v={p.city} /></td>
              <td className="px-2 py-2"><T v={p.neighborhood} /></td>
              <td className="whitespace-nowrap px-2 py-2"><T v={p.phone} />{p.extra_phones?.length ? <span className="text-muted-foreground"> +{p.extra_phones.length}</span> : null}</td>
              <td className="whitespace-nowrap px-2 py-2"><T v={p.whatsapp} />{p.whatsapp && <span className="block text-[10px] text-muted-foreground">{p.whatsapp_confirmed ? "confirmado" : "não confirmado"}</span>}</td>
              <td className="px-2 py-2"><U url={p.instagram_url} /></td>
              <td className="px-2 py-2 tabular-nums"><T v={p.instagram_followers} /></td>
              <td className="px-2 py-2"><T v={p.google_rating} />{p.google_maps_url && <> · <U url={p.google_maps_url} /></>}</td>
              <td className="px-2 py-2 tabular-nums"><T v={p.google_reviews} /></td>
              <td className="px-2 py-2"><U url={p.website_url} /></td>
              <td className="px-2 py-2"><T v={p.website_status ? websiteLabel(p.website_status) : null} /></td>
              <td className="px-2 py-2"><T v={p.scheduling_type} /></td>
              <td className="px-2 py-2"><Warnings w={r.warnings} /></td>
              <td className="whitespace-nowrap px-2 py-2">
                <Button size="icon" variant="ghost" aria-label="Editar linha" onClick={() => onEdit(r)}><Pencil className="h-4 w-4" /></Button>
                {r.status === "duplicate" && <Button size="icon" variant="ghost" aria-label="Comparar" onClick={() => onCompare(r)}><Scale className="h-4 w-4" /></Button>}
              </td>
            </tr>
          ); })}
        </tbody>
      </table>
    </div>
  );
}
function Warnings({ w }: { w: string[] }) {
  if (!w.length) return <span className="text-muted-foreground">—</span>;
  return <span title={w.join("\n")} className="block max-w-48 text-[11px] leading-tight">{w.slice(0, 3).join(" · ")}{w.length > 3 ? ` +${w.length - 3}` : ""}</span>;
}

// ---------------------------------------------------------------- preview (mobile cards)
function PreviewCards({ rows, onToggle, onEdit, onCompare }: RowProps) {
  return (
    <div className="space-y-2 md:hidden">
      {rows.map((r) => { const p = r.parsed_data; return (
        <div key={r.id} className="rounded-lg border bg-card p-3 text-sm">
          <div className="flex items-start gap-2">
            <Checkbox className="mt-0.5" aria-label={`Importar ${p.company_name ?? r.row_number}`} checked={r.selected_for_import} disabled={!eligible(r)} onCheckedChange={(v) => onToggle(r, !!v)} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><span className="font-medium">{p.position != null && `${p.position}. `}{p.company_name ?? "Sem nome"}</span><Chip status={r.status} /></div>
              <div className="mt-1 text-xs text-muted-foreground">
                {[p.score != null && `Score ${p.score}`, p.priority && `Prioridade ${p.priority}`, p.neighborhood, p.phone].filter(Boolean).join(" · ")}
              </div>
              {r.warnings.length > 0 && <div className="mt-1 text-[11px]">{r.warnings.join(" · ")}</div>}
            </div>
          </div>
          <div className="mt-2 flex justify-end gap-1">
            <Button size="sm" variant="outline" onClick={() => onEdit(r)}><Pencil className="mr-1 h-3 w-3" />Editar</Button>
            {r.status === "duplicate" && <Button size="sm" variant="outline" onClick={() => onCompare(r)}><Scale className="mr-1 h-3 w-3" />Comparar</Button>}
          </div>
        </div>
      ); })}
    </div>
  );
}

// ---------------------------------------------------------------- edit dialog
const EDIT_FIELDS: [keyof Parsed, string, "text" | "number"][] = [
  ["company_name", "Empresa", "text"], ["position", "Posição", "number"], ["score", "Score", "number"],
  ["city", "Cidade", "text"], ["state", "Estado", "text"], ["neighborhood", "Bairro", "text"], ["address", "Endereço", "text"],
  ["phone", "Telefone", "text"], ["whatsapp", "WhatsApp", "text"], ["instagram_url", "Instagram", "text"],
  ["instagram_followers", "Seguidores", "number"], ["google_maps_url", "Google Maps", "text"], ["google_rating", "Nota Google", "number"],
  ["google_reviews", "Avaliações", "number"], ["website_url", "Site", "text"], ["scheduling_type", "Agendamento", "text"],
  ["scheduling_url", "Link de agendamento", "text"], ["digital_presence", "Presença digital", "text"], ["photo_quality", "Fotos", "text"],
];
function EditRowDialog({ row, onClose, onSave }: { row: StagedRow; onClose: () => void; onSave: (r: StagedRow, p: Parsed) => Promise<void> }) {
  const [p, setP] = useState<Parsed>({ ...row.parsed_data });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof Parsed, v: string, t: "text" | "number") =>
    setP({ ...p, [k]: v === "" ? null : t === "number" ? Number(v.replace(",", ".")) : v });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Editar linha {row.row_number}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {EDIT_FIELDS.map(([k, l, t]) => (
            <div key={k} className="space-y-1">
              <Label className="text-xs">{l}</Label>
              <Input type={t === "number" ? "number" : "text"} step="any" value={(p[k] as string | number | null) ?? ""} onChange={(e) => set(k, e.target.value, t)} />
            </div>
          ))}
          <div className="space-y-1">
            <Label className="text-xs">Prioridade</Label>
            <Select value={p.priority ?? "none"} onValueChange={(v) => setP({ ...p, priority: v === "none" ? null : (v as Parsed["priority"]) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none">—</SelectItem>{PRIORITIES.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Status do site</Label>
            <Select value={p.website_status ?? "none"} onValueChange={(v) => setP({ ...p, website_status: v === "none" ? null : (v as Parsed["website_status"]) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="none">—</SelectItem>{WEBSITE_STATUS.map((x) => <SelectItem key={x.value} value={x.value}>{x.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <Checkbox checked={p.whatsapp_confirmed} onCheckedChange={(v) => setP({ ...p, whatsapp_confirmed: !!v })} />WhatsApp confirmado
          </label>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Observação comercial</Label>
            <Textarea rows={4} value={p.commercial_observation ?? ""} onChange={(e) => setP({ ...p, commercial_observation: e.target.value || null })} />
          </div>
          <details className="sm:col-span-2 text-xs">
            <summary className="cursor-pointer text-muted-foreground">Dado original (não é alterado)</summary>
            <dl className="mt-2 space-y-1">{Object.entries(row.raw_data).map(([k, v]) => <div key={k}><dt className="font-medium">{k}</dt><dd className="break-words text-muted-foreground">{v || "—"}</dd></div>)}</dl>
          </details>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button disabled={saving} onClick={async () => { setSaving(true); try { await onSave(row, p); } finally { setSaving(false); } }}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------- compare dialog
function CompareDialog({ row, onClose, onAction }: { row: StagedRow; onClose: () => void; onAction: (r: StagedRow, a: "skip" | "import_anyway") => void }) {
  const mine = summarizeParsed(row.parsed_data) as Record<string, string | number | null>;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>Possível duplicado — linha {row.row_number}</DialogTitle></DialogHeader>
        {row.duplicate_matches.map((m, i) => {
          const keys = [...new Set([...Object.keys(mine), ...Object.keys(m.existing)])];
          return (
            <div key={i} className="space-y-2">
              <p className="text-sm"><span className="font-medium">{m.source === "crm" ? "Lead já existente no CRM" : `Linha ${m.row_number} do mesmo arquivo`}</span> — motivo: {m.reasons.join(", ")}
                {m.lead_id && <> · <Link to="/leads/$id" params={{ id: m.lead_id }} target="_blank" className="underline hover:text-gold">abrir lead</Link></>}</p>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-xs">
                  <thead className="border-b bg-muted/40 text-left"><tr><th className="px-2 py-1.5">Campo</th><th className="px-2 py-1.5">Novo registro</th><th className="px-2 py-1.5">Registro existente</th></tr></thead>
                  <tbody>{keys.map((k) => {
                    const a = mine[k] ?? null; const b = m.existing[k] ?? null; const diff = String(a ?? "") !== String(b ?? "");
                    return <tr key={k} className={cn("border-b last:border-0", diff && "bg-gold-soft/60")}><td className="px-2 py-1.5 font-medium">{k}</td><td className="break-all px-2 py-1.5">{a ?? "—"}</td><td className="break-all px-2 py-1.5">{b ?? "—"}</td></tr>;
                  })}</tbody>
                </table>
              </div>
            </div>
          );
        })}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onAction(row, "skip")}>Não importar</Button>
          <Button onClick={() => onAction(row, "import_anyway")}>Importar mesmo assim</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

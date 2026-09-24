import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { extOf } from "./readers";
import { parseTableRows, validate, type Parsed, type ParsedRow, type RowStatus } from "./parser";
import type { DuplicateMatch, ExistingLead } from "./duplicates";
import { auditBatch, type AuditReport } from "./audit";

export type StagedRow = {
  id: string; row_number: number; raw_data: Record<string, string>; parsed_data: Parsed; status: RowStatus;
  warnings: string[]; duplicate_matches: DuplicateMatch[]; selected_for_import: boolean; duplicate_action: "skip" | "import_anyway" | null; parse_confidence?: number | null;
};

export type GarimpoInput = { name: string; niche: string; city: string; state: string; research_date: string; source: string };

export async function fetchExistingLeads(): Promise<ExistingLead[]> {
  const all: ExistingLead[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("leads")
      .select("id, company_name, city, neighborhood, phone, whatsapp, instagram_url, google_maps_url, website_url, score, priority, status, archived_at")
      .range(from, from + 999);
    if (error) throw error;
    all.push(...(data as ExistingLead[]));
    if (!data || data.length < 1000) break;
  }
  return all;
}

const pad = (n: number) => String(n).padStart(2, "0");
export const pastedName = (d = new Date()) =>
  `Conteúdo colado — ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Creates draft garimpo + batch, uploads original file, stages rows. Rolls back on failure. */
export async function createStagedBatch(opts: {
  garimpo: GarimpoInput; file: File | null; rows: ParsedRow[]; dups: Map<number, DuplicateMatch[]>; userId: string;
}): Promise<{ batchId: string; garimpoId: string }> {
  const { data: ws, error: wsErr } = await supabase.rpc("current_workspace_id");
  if (wsErr || !ws) throw wsErr ?? new Error("NOT_AUTHORIZED");
  const g = opts.garimpo;
  const { data: gar, error: gErr } = await supabase.from("garimpos").insert({
    name: g.name.trim(), niche: g.niche.trim() || null, city: g.city.trim() || null, state: g.state.trim().toUpperCase() || null,
    research_date: g.research_date || null, source: g.source.trim() || null, status: "rascunho", created_by: opts.userId,
  }).select("id").single();
  if (gErr) throw gErr;
  const file = opts.file;
  const { data: batch, error: bErr } = await supabase.from("import_batches").insert({
    garimpo_id: gar.id, created_by: opts.userId, status: "uploaded",
    file_name: file ? file.name : pastedName(), file_type: file ? extOf(file.name) : "pasted_text",
  }).select("id").single();
  if (bErr) { await supabase.from("garimpos").delete().eq("id", gar.id); throw bErr; }
  try {
    if (file) {
      const safe = file.name.normalize("NFD").replace(/[^\w.-]+/g, "_").slice(-120);
      const path = `${ws}/${batch.id}/${safe}`;
      const { error: upErr } = await supabase.storage.from("garimpo-imports").upload(path, file, { contentType: file.type || undefined, upsert: false });
      if (upErr) throw upErr;
      await supabase.from("garimpos").update({ original_file_name: file.name, original_file_url: path }).eq("id", gar.id);
      await supabase.from("import_batches").update({ file_url: path }).eq("id", batch.id);
    }
    await supabase.from("import_batches").update({ status: "processing" }).eq("id", batch.id);
    const payload = opts.rows.map((r) => {
      const v = validate(r.parsed, r.warnings);
      const dm = opts.dups.get(r.row_number) ?? [];
      const isDup = dm.length > 0 && v.status !== "invalid";
      return {
        import_batch_id: batch.id, row_number: r.row_number, raw_data: r.raw as unknown as Json,
        parsed_data: r.parsed as unknown as Json, warnings: v.warnings as unknown as Json,
        duplicate_matches: dm as unknown as Json, status: isDup ? "duplicate" : v.status,
        selected_for_import: v.status === "valid" && !isDup, duplicate_action: isDup ? "skip" : null,
      };
    });
    for (let i = 0; i < payload.length; i += 200) {
      const { error } = await supabase.from("import_batch_rows").insert(payload.slice(i, i + 200));
      if (error) throw error;
    }
    await refreshCounts(batch.id, "preview");
    return { batchId: batch.id, garimpoId: gar.id };
  } catch (e) {
    await supabase.from("import_batch_rows").delete().eq("import_batch_id", batch.id);
    await supabase.from("import_batches").update({ status: "failed" }).eq("id", batch.id);
    await supabase.from("garimpos").delete().eq("id", gar.id).eq("status", "rascunho");
    throw e;
  }
}

export async function loadRows(batchId: string): Promise<StagedRow[]> {
  const all: StagedRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("import_batch_rows").select("*").eq("import_batch_id", batchId).order("row_number").range(from, from + 999);
    if (error) throw error;
    all.push(...(data as unknown as StagedRow[]));
    if (!data || data.length < 1000) break;
  }
  return all;
}

export async function refreshCounts(batchId: string, status?: "preview" | "ready") {
  const { data } = await supabase.from("import_batch_rows").select("status").eq("import_batch_id", batchId);
  const c = (s: string) => (data ?? []).filter((r) => r.status === s).length;
  await supabase.from("import_batches").update({
    total_rows: data?.length ?? 0, valid_rows: c("valid"), invalid_rows: c("invalid"), duplicate_rows: c("duplicate"),
    ...(status ? { status } : {}),
  }).eq("id", batchId);
}

export async function saveRow(r: StagedRow) {
  const { error } = await supabase.from("import_batch_rows").update({
    parsed_data: r.parsed_data as unknown as Json, status: r.status, warnings: r.warnings as unknown as Json,
    duplicate_matches: r.duplicate_matches as unknown as Json, selected_for_import: r.selected_for_import, duplicate_action: r.duplicate_action,
    ...(r.parse_confidence != null ? { parse_confidence: r.parse_confidence } : {}),
  }).eq("id", r.id);
  if (error) throw error;
}

export async function setSelected(ids: string[], selected: boolean) {
  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await supabase.from("import_batch_rows").update({ selected_for_import: selected }).in("id", ids.slice(i, i + 200));
    if (error) throw error;
  }
}

/** Cancel before confirmation: no leads created, staging cleared, empty draft garimpo removed. */
export async function cancelBatch(batchId: string, garimpoId: string | null) {
  await supabase.from("import_batch_rows").delete().eq("import_batch_id", batchId);
  await supabase.from("import_batches").update({ status: "cancelled", completed_at: new Date().toISOString() }).eq("id", batchId);
  if (garimpoId) await supabase.from("garimpos").delete().eq("id", garimpoId).eq("status", "rascunho").eq("total_leads", 0);
}

export type CommitResult = { imported: number; total: number; valid: number; invalid: number; duplicates: number; review: number };
export async function commitBatch(batchId: string, assignedTo: string, initialStatus: "novo" | "pronto_contato"): Promise<CommitResult> {
  const { data, error } = await supabase.rpc("commit_import_batch", { _batch_id: batchId, _assigned_to: assignedTo, _initial_status: initialStatus });
  if (error) {
    await supabase.from("import_batches").update({ status: "failed" }).eq("id", batchId);
    throw error;
  }
  return data as unknown as CommitResult;
}

/** Re-run the current parser over the stored original cells. Updates only staged rows (no leads, no new batch/garimpo). */
export async function reprocessBatch(batchId: string, defaults: { city?: string | null; state?: string | null; niche?: string | null }) {
  const rows = await loadRows(batchId);
  let changed = 0;
  for (const r of rows) {
    const headers = Object.keys(r.raw_data);
    const [pr] = parseTableRows({ headers, rows: [headers.map((h) => r.raw_data[h] ?? "")] }, defaults);
    if (!pr) continue;
    // full re-read from raw_data: no previously interpreted values are reused
    const v = validate(pr.parsed, pr.warnings);
    const isDup = r.status === "duplicate" && v.status !== "invalid";
    const next: StagedRow = {
      ...r, parsed_data: pr.parsed, warnings: v.warnings, status: isDup ? "duplicate" : v.status,
      selected_for_import: isDup ? r.duplicate_action === "import_anyway" : v.status === "valid",
    };
    if (JSON.stringify([next.parsed_data, next.warnings, next.status]) !== JSON.stringify([r.parsed_data, r.warnings, r.status])) changed++;
    await saveRow(next);
  }
  await refreshCounts(batchId);
  return changed;
}

/** Automatic deterministic audit: fixes rows (never raw_data), stores report on the batch. */
export async function runAudit(batchId: string): Promise<{ rows: StagedRow[]; report: AuditReport }> {
  const { data: b, error } = await supabase.from("import_batches").select("file_name, garimpos(name)").eq("id", batchId).single();
  if (error) throw error;
  const rows = await loadRows(batchId);
  const { rows: out, report } = auditBatch(rows, {
    batch_id: batchId, file_name: b.file_name, garimpo: (b.garimpos as { name: string } | null)?.name ?? null,
    headers: rows[0] ? Object.keys(rows[0].raw_data) : [],
  });
  const before = new Map(rows.map((r) => [r.id, JSON.stringify(r)]));
  for (const r of out as StagedRow[]) if (before.get(r.id) !== JSON.stringify(r)) await saveRow(r);
  await refreshCounts(batchId);
  const { error: uErr } = await supabase.from("import_batches").update({ audit: report as unknown as Json }).eq("id", batchId);
  if (uErr) throw uErr;
  return { rows: out as StagedRow[], report };
}

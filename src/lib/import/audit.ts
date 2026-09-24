import {
  CTX_NEGATIVE, PARSER_VERSION, WA_NEGATION, extractLinks, extractPhones, isSchedulingUrl, isThirdPartyUrl, mapHeaders,
  normKey, normPhone, parseInstagramFollowers, resolveScheduling, resolveWhatsapp, SCHEDULING_PLATFORMS, stripMd, validate,
  type Field, type Parsed, type RowStatus,
} from "./parser";
import { findDuplicates, type DuplicateMatch } from "./duplicates";

export const AUDIT_VERSION = "audit-v1";

export type AuditRow = {
  id: string; row_number: number; raw_data: Record<string, string>; parsed_data: Parsed; status: RowStatus;
  warnings: string[]; duplicate_matches: DuplicateMatch[]; selected_for_import: boolean;
  duplicate_action: "skip" | "import_anyway" | null; parse_confidence?: number | null;
};

export type AuditStatus = "approved" | "attention" | "blocked";
export type CorrectionKind =
  | "wa_negated" | "wa_recovered" | "wa_copied_from_phone" | "site_third_party" | "site_rejected_context"
  | "scheduling_negated" | "followers_fixed" | "followers_other_network" | "reviews_other_directory"
  | "selection_fixed" | "internal_duplicate";

export const CORRECTION_LABEL: Record<CorrectionKind, string> = {
  wa_negated: "WhatsApps não confirmados descartados",
  wa_recovered: "WhatsApps explícitos recuperados",
  wa_copied_from_phone: "Telefones copiados indevidamente para WhatsApp",
  site_third_party: "URLs de plataforma rejeitadas como site",
  site_rejected_context: "Sites rejeitados pelo contexto do relatório",
  scheduling_negated: "Menções negativas de agendamento ignoradas",
  followers_fixed: "Contagens de publicações/seguindo removidas de seguidores",
  followers_other_network: "Seguidores de outra rede removidos",
  reviews_other_directory: "Avaliações de outros diretórios removidas do Google",
  selection_fixed: "Seleções inconsistentes corrigidas",
  internal_duplicate: "Duplicados dentro do arquivo",
};

export type AuditReport = {
  batch_id: string; parser_version: string; audit_version: string; audited_at: string; file_name: string | null; garimpo: string | null;
  status: AuditStatus;
  total_rows: number; valid: number; review: number; duplicate: number; invalid: number; selected: number;
  whatsapp_confirmed_count: number; phone_only_count: number; website_count: number; no_website_count: number; scheduling_count: number;
  warnings_count: number; critical_errors_count: number; critical_errors: string[];
  corrections_count: number; corrections: Partial<Record<CorrectionKind, number>>;
  warnings_by_type: Record<string, number>;
  separated: { row_number: number; company_name: string | null; status: RowStatus; reasons: string[] }[];
  corrected_rows: { row_number: number; company_name: string | null; changes: string[] }[];
  avg_confidence: number;
};

const OTHER_DIRECTORY = /wanderboat|cybo|cylex|apontador|guia ?mais|tripadvisor|facebook|foursquare|yelp|telelistas|solutudo|diretorio/i;
const SITE_EXTRA_NEG = /expirad|terceir|nao e (?:o )?site|nao oficial|fora do ar/;
const REVIEW_REASON = "Auditoria: dado conflitante separado para revisão";
const isValidationWarning = (w: string) =>
  ["Score ausente", "Prioridade ausente", "Instagram ausente", "Google Maps ausente", "WhatsApp não confirmado"].includes(w);

/** Raw cells grouped by the field their header maps to (raw_data is never modified). */
function rawCells(raw: Record<string, string>) {
  const headers = Object.keys(raw);
  const map = mapHeaders(headers);
  const cell = (f: Field) => { const i = map.indexOf(f); return i >= 0 ? raw[headers[i]!] ?? "" : ""; };
  return { cell, all: headers.map((h) => raw[h] ?? "").join(" ; ") };
}

type RowOutcome = { row: AuditRow; changes: string[]; kinds: CorrectionKind[] };

function auditRow(r: AuditRow): RowOutcome {
  const p: Parsed = { ...r.parsed_data, extra_phones: [...(r.parsed_data.extra_phones ?? [])] };
  const w = [...r.warnings];
  const changes: string[] = []; const kinds: CorrectionKind[] = [];
  const fix = (k: CorrectionKind, msg: string) => { kinds.push(k); changes.push(msg); w.push(`Auditoria: ${msg}`); };
  let forceReview = false;
  const { cell, all } = rawCells(r.raw_data);
  const phoneCell = cell("phone"), waCell = cell("whatsapp"), schedCell = cell("scheduling"), obsCell = cell("commercial_observation");
  const waText = normKey(stripMd([phoneCell, waCell, schedCell, obsCell].join(" ; ")));

  // 4A — report says WhatsApp NOT confirmed but parsed says confirmed
  if (WA_NEGATION.test(waText) && (p.whatsapp_confirmed || p.whatsapp)) {
    p.whatsapp = null; p.whatsapp_confirmed = false;
    fix("wa_negated", "WhatsApp marcado como não confirmado no relatório — descartado");
  }
  // 4B — explicit WhatsApp in raw, parsed empty → re-associate deterministically
  const explicitWa = /wa\.me|api\.whatsapp|whats ?app (?:confirmad|\+?55|\(?\d{2}\)?\s?9)/i.test(stripMd(all).replace(/\s+/g, " ")) || /wa\.me|api\.whatsapp/i.test(all);
  if (!p.whatsapp && explicitWa && !WA_NEGATION.test(waText)) {
    const again = resolveWhatsapp({ phoneCell, waCell, schedCell, obsCell });
    if (again.whatsapp) { p.whatsapp = again.whatsapp; p.whatsapp_confirmed = true; fix("wa_recovered", `WhatsApp explícito recuperado (${again.whatsapp})`); }
    else { w.push("Auditoria: WhatsApp citado sem número associável"); }
  }
  // 4C — raw has distinct phone and WhatsApp numbers but parsed copied one into both
  const rawNums = [...new Set([...extractPhones(phoneCell), ...extractPhones(waCell)].map((x) => normPhone(x)).filter(Boolean))];
  if (p.phone && p.whatsapp && normPhone(p.phone) === normPhone(p.whatsapp) && rawNums.length >= 2) {
    const other = [...extractPhones(phoneCell), ...extractPhones(waCell)].find((x) => normPhone(x) !== normPhone(p.whatsapp));
    if (other) { p.phone = other; fix("wa_copied_from_phone", "Telefone e WhatsApp diferentes no relatório — telefone restaurado"); }
  }

  // 5/6 — site
  const siteCell = cell("website_url");
  if (p.website_url && isThirdPartyUrl(p.website_url)) {
    const u = p.website_url; p.website_url = null;
    if (isSchedulingUrl(u) && !p.scheduling_url) {
      p.scheduling_url = u; p.scheduling_type ??= SCHEDULING_PLATFORMS.find(([re]) => re.test(u))?.[1] ?? null;
    }
    fix("site_third_party", `URL de plataforma não é site próprio: ${u}`);
  }
  const siteK = normKey(stripMd(siteCell + " " + cell("website_status")));
  if (p.website_url && (CTX_NEGATIVE.test(siteK) || SITE_EXTRA_NEG.test(siteK))) {
    const u = p.website_url; p.website_url = null;
    fix("site_rejected_context", `Site rejeitado pelo contexto do relatório: ${u}`);
  }
  if (p.website_url && p.website_status === "nao_possui") {
    forceReview = true; w.push("Auditoria: status 'não possui site' com URL de site preenchida");
  }

  // 7 — scheduling never taken from a negated mention
  if (p.scheduling_type && schedCell) {
    const again = resolveScheduling(schedCell, p.company_name);
    const fromSite = !!p.scheduling_url && extractLinks(siteCell).some((l) => l.url === p.scheduling_url);
    if (!fromSite && again.type !== p.scheduling_type && again.rejected.includes(p.scheduling_type)) {
      const t = p.scheduling_type; p.scheduling_type = again.type; p.scheduling_url = again.url;
      fix("scheduling_negated", `Agendamento "${t}" ignorado (mencionado como não localizado/não confirmado)`);
    }
  }

  // 8/9 — followers only from Instagram "seguidores"
  const folCell = cell("instagram_followers");
  if (p.instagram_followers != null) {
    if (!p.instagram_url) {
      p.instagram_followers = null; fix("followers_other_network", "Seguidores removidos: Instagram não localizado");
    } else if (folCell) {
      const again = parseInstagramFollowers(folCell, true);
      if (again.value !== p.instagram_followers) {
        const old = p.instagram_followers; p.instagram_followers = again.value;
        fix(/facebook|tiktok|youtube/i.test(folCell) ? "followers_other_network" : "followers_fixed", `Seguidores ${old} → ${again.value ?? "vazio"}`);
      }
    }
  }

  // 10 — reviews tied to another directory are not Google reviews
  const rvCell = stripMd(cell("google_reviews"));
  if (p.google_reviews != null && rvCell) {
    const seg = rvCell.split(/[;|]|,\s(?=\D)/).find((s) => new RegExp(`(^|\\D)${p.google_reviews}(\\D|$)`).test(s.replace(/\./g, "")));
    if (seg && OTHER_DIRECTORY.test(seg) && !/google/i.test(seg)) {
      const old = p.google_reviews; p.google_reviews = null;
      fix("reviews_other_directory", `${old} avaliações pertencem a outro diretório, não ao Google`);
    }
  }

  // recompute status (duplicate status is preserved)
  const v = validate(p, w);
  let status: RowStatus = r.status === "duplicate" && v.status !== "invalid" ? "duplicate" : v.status;
  const warnings = [...v.warnings];
  if (forceReview && status === "valid") { status = "review"; warnings.push(REVIEW_REASON); }
  return { row: { ...r, parsed_data: p, warnings: [...new Set(warnings)], status }, changes, kinds };
}

function confidence(r: AuditRow, corrections: number): number {
  if (r.status === "invalid") return 0;
  const conflicts = r.warnings.filter((w) => !isValidationWarning(w) && !w.startsWith("Auditoria:")).length;
  const minor = r.warnings.filter(isValidationWarning).length;
  let c = 100 - conflicts * 10 - corrections * 8 - minor * 2;
  if (r.status === "review") c = Math.min(c, 49);
  return Math.max(0, Math.min(100, c));
}

/** Deterministic audit (no AI). Returns corrected rows + batch report. Never touches raw_data. */
export function auditBatch(input: AuditRow[], meta: { batch_id: string; file_name: string | null; garimpo: string | null; headers?: string[] }) {
  const critical: string[] = [];
  const kindsCount: Partial<Record<CorrectionKind, number>> = {};
  const corrected_rows: AuditReport["corrected_rows"] = [];
  const bump = (k: CorrectionKind) => { kindsCount[k] = (kindsCount[k] ?? 0) + 1; };

  let rows = input.map((r) => {
    const o = auditRow(r);
    o.kinds.forEach(bump);
    if (o.changes.length) corrected_rows.push({ row_number: r.row_number, company_name: o.row.parsed_data.company_name, changes: o.changes });
    return { ...o, row: o.row };
  });

  // 16 — duplicates inside the file (phone, WhatsApp, Instagram, Maps, site, name+city)
  const internal = findDuplicates(rows.map((o) => ({ row_number: o.row.row_number, parsed: o.row.parsed_data })), []);
  rows = rows.map((o) => {
    const fileMatches = (internal.get(o.row.row_number) ?? []).filter((m) => m.source === "file");
    if (!fileMatches.length || o.row.status === "invalid" || o.row.status === "duplicate") return o;
    bump("internal_duplicate");
    return { ...o, row: { ...o.row, status: "duplicate" as RowStatus, duplicate_action: "skip" as const, duplicate_matches: [...o.row.duplicate_matches, ...fileMatches] } };
  });

  // 11/12/13 — selection invariants
  const out: AuditRow[] = rows.map((o) => {
    const r = o.row;
    let sel = r.selected_for_import;
    if (r.status === "review" || r.status === "invalid") sel = false;
    if (r.status === "duplicate" && r.duplicate_action !== "import_anyway") sel = false;
    if (r.status === "valid" && o.kinds.length && !r.selected_for_import && input.find((x) => x.id === r.id)?.status !== "valid") sel = true;
    if (sel !== r.selected_for_import && (r.status !== "valid")) bump("selection_fixed");
    const corrections = o.kinds.length;
    const next = { ...r, selected_for_import: sel };
    return { ...next, parse_confidence: confidence(next, corrections) };
  });

  const c = (s: RowStatus) => out.filter((r) => r.status === s).length;
  const total = out.length;
  const valid = c("valid"), review = c("review"), duplicate = c("duplicate"), invalid = c("invalid");
  const selected = out.filter((r) => r.selected_for_import).length;

  // structural checks (block)
  if (total === 0) critical.push("Nenhuma empresa encontrada no relatório.");
  if (valid + review + duplicate + invalid !== total) critical.push("Contadores inconsistentes (válidos + revisar + duplicados + inválidos ≠ total).");
  if (selected > total) critical.push("Selecionados maior que o total de registros.");
  const nameless = out.filter((r) => !r.parsed_data.company_name).length;
  if (total > 0 && nameless / total > 0.3) critical.push(`${nameless} de ${total} linhas sem nome de empresa — a tabela provavelmente não é a de leads.`);
  const names = out.map((r) => normKey(r.parsed_data.company_name ?? "")).filter(Boolean);
  const repeated = names.length - new Set(names).size;
  if (total >= 10 && repeated / total > 0.2) critical.push(`${repeated} nomes repetidos — o relatório parece ter misturado a tabela principal com TOP 10/TOP 3.`);
  if (meta.headers && meta.headers.length && meta.headers.length <= 5 && /motivo|destaque/i.test(meta.headers.join(" ")))
    critical.push("A tabela escolhida parece ser um ranking parcial (TOP 10/TOP 3), não a tabela principal.");

  const warnings_by_type: Record<string, number> = {};
  for (const r of out) for (const w of r.warnings) {
    const key = w.replace(/:\s.*$/, "").replace(/\s\d+\s→.*$/, "");
    warnings_by_type[key] = (warnings_by_type[key] ?? 0) + 1;
  }
  const corrections_count = Object.values(kindsCount).reduce((a, b) => a + (b ?? 0), 0);
  const status: AuditStatus = critical.length ? "blocked" : review + duplicate + invalid > 0 ? "attention" : "approved";

  const report: AuditReport = {
    batch_id: meta.batch_id, parser_version: PARSER_VERSION, audit_version: AUDIT_VERSION, audited_at: new Date().toISOString(),
    file_name: meta.file_name, garimpo: meta.garimpo, status,
    total_rows: total, valid, review, duplicate, invalid, selected,
    whatsapp_confirmed_count: out.filter((r) => r.parsed_data.whatsapp_confirmed && r.parsed_data.whatsapp).length,
    phone_only_count: out.filter((r) => r.parsed_data.phone && !r.parsed_data.whatsapp_confirmed).length,
    website_count: out.filter((r) => r.parsed_data.website_url).length,
    no_website_count: out.filter((r) => !r.parsed_data.website_url).length,
    scheduling_count: out.filter((r) => r.parsed_data.scheduling_type).length,
    warnings_count: out.reduce((a, r) => a + r.warnings.length, 0),
    critical_errors_count: critical.length, critical_errors: critical,
    corrections_count, corrections: kindsCount, warnings_by_type,
    separated: out.filter((r) => r.status !== "valid").map((r) => ({
      row_number: r.row_number, company_name: r.parsed_data.company_name, status: r.status,
      reasons: r.status === "duplicate"
        ? r.duplicate_matches.map((m) => `${m.source === "crm" ? "já existe no CRM" : `repete a linha ${m.row_number} do arquivo`} (${m.reasons.join(", ")})`)
        : r.warnings.filter((w) => !isValidationWarning(w)),
    })),
    corrected_rows,
    avg_confidence: total ? Math.round(out.reduce((a, r) => a + (r.parse_confidence ?? 0), 0) / total) : 0,
  };
  return { rows: out, report };
}

const STATUS_TXT: Record<AuditStatus, string> = { approved: "APROVADO", attention: "ATENÇÃO", blocked: "BLOQUEADO" };
const ROW_STATUS_TXT: Record<RowStatus, string> = { valid: "Válido", review: "Revisar", duplicate: "Possível duplicado", invalid: "Inválido" };
export const auditStatusLabel = (s: AuditStatus) => STATUS_TXT[s];

/** Markdown with exceptions only (optionally full per-row details). */
export function auditMarkdown(a: AuditReport, full?: AuditRow[]): string {
  const L: string[] = [];
  L.push("# WIX MILLION OS — AUDITORIA DE IMPORTAÇÃO", "");
  L.push(`Lote: ${a.batch_id}`, `Arquivo: ${a.file_name ?? "—"}`, `Garimpo: ${a.garimpo ?? "—"}`, `Parser: ${a.parser_version}`, `Auditoria: ${a.audit_version}`, `Data: ${new Date(a.audited_at).toLocaleString("pt-BR")}`, "");
  L.push("## Resumo", "");
  L.push(`Encontrados: ${a.total_rows}`, `Válidos: ${a.valid}`, `Revisar: ${a.review}`, `Duplicados: ${a.duplicate}`, `Inválidos: ${a.invalid}`, `Selecionados: ${a.selected}`, "");
  L.push(`WhatsApps confirmados: ${a.whatsapp_confirmed_count}`, `Somente telefone: ${a.phone_only_count}`, `Sites próprios confirmados: ${a.website_count}`, `Sem site próprio: ${a.no_website_count}`, `Com agendamento: ${a.scheduling_count}`, `Confiança média da leitura: ${a.avg_confidence}/100`, "");
  L.push(`Status: ${STATUS_TXT[a.status]}`, "");
  L.push("## Registros separados automaticamente", "");
  if (!a.separated.length) L.push("Nenhum.", "");
  for (const s of a.separated) {
    L.push(`### ${s.company_name ?? `(linha ${s.row_number} sem nome)`}`, `Linha: ${s.row_number} · ${ROW_STATUS_TXT[s.status]}`, "Motivo:");
    L.push(...(s.reasons.length ? s.reasons.map((r) => `- ${r}`) : ["- Dados insuficientes"]), "");
  }
  L.push(`## Correções automáticas: ${a.corrections_count}`, "");
  const kinds = Object.entries(a.corrections).filter(([, n]) => n);
  if (!kinds.length) L.push("Nenhuma.", "");
  else { for (const [k, n] of kinds) L.push(`- ${n} ${CORRECTION_LABEL[k as CorrectionKind].toLowerCase()}`); L.push(""); }
  for (const c of a.corrected_rows) L.push(`- #${c.row_number} ${c.company_name ?? ""}: ${c.changes.join("; ")}`);
  if (a.corrected_rows.length) L.push("");
  L.push(`## Warnings encontrados (${a.warnings_count})`, "");
  const ws = Object.entries(a.warnings_by_type).sort((x, y) => y[1] - x[1]);
  if (!ws.length) L.push("Nenhum.");
  for (const [w, n] of ws) L.push(`- ${w}: ${n}`);
  L.push("", "## Erros críticos", "");
  L.push(...(a.critical_errors.length ? a.critical_errors.map((e) => `- ${e}`) : ["Nenhum."]));
  if (full?.length) {
    L.push("", "## Detalhes completos", "");
    for (const r of full) {
      const p = r.parsed_data;
      L.push(`### #${r.row_number} ${p.company_name ?? "(sem nome)"} — ${ROW_STATUS_TXT[r.status]} · confiança ${r.parse_confidence ?? "—"}`);
      L.push(`- Score ${p.score ?? "—"} · Prioridade ${p.priority ?? "—"} · Telefone ${p.phone ?? "—"} · WhatsApp ${p.whatsapp ? `${p.whatsapp}${p.whatsapp_confirmed ? " (confirmado)" : ""}` : "—"}`);
      L.push(`- Instagram ${p.instagram_url ?? "—"} (${p.instagram_followers ?? "—"} seguidores) · Google ${p.google_rating ?? "—"}/${p.google_reviews ?? "—"} · Site ${p.website_url ?? "—"} (${p.website_status ?? "—"}) · Agendamento ${p.scheduling_type ?? "—"}`);
      if (r.warnings.length) L.push(`- Alertas: ${r.warnings.join("; ")}`);
      L.push("");
    }
  }
  return L.join("\n");
}

/**
 * WIX MILLION OS — deterministic importer (MVP 2, parser mvp2-v1).
 * No AI, no external services: tables, aliases, regex and normalization rules.
 */
export const PARSER_VERSION = "mvp2-v1";
export const MAX_ROWS = 1000;

export type RawTable = { headers: string[]; rows: string[][]; title?: string; sheet?: string };
export type ScoredTable = RawTable & { index: number; fitScore: number; mapped: Partial<Record<Field, number>>; hasCompany: boolean; isTopList: boolean };

export type Field =
  | "position" | "score" | "priority" | "company_name" | "neighborhood" | "city" | "state" | "address"
  | "phone" | "whatsapp" | "instagram_url" | "instagram_followers" | "google_maps_url" | "google_reviews"
  | "google_rating" | "website_status" | "website_url" | "scheduling" | "digital_presence" | "photo_quality"
  | "commercial_observation" | "niche";

export type Parsed = {
  company_name: string | null;
  position: number | null;
  score: number | null;
  priority: "A" | "B" | "C" | "D" | null;
  city: string | null;
  state: string | null;
  neighborhood: string | null;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  whatsapp_confirmed: boolean;
  extra_phones: string[];
  instagram_url: string | null;
  instagram_followers: number | null;
  google_maps_url: string | null;
  google_rating: number | null;
  google_reviews: number | null;
  website_url: string | null;
  website_status: "nao_possui" | "site_fraco" | "site_razoavel" | "site_profissional" | "nao_confirmado" | null;
  scheduling_type: string | null;
  scheduling_url: string | null;
  digital_presence: string | null;
  photo_quality: string | null;
  commercial_observation: string | null;
  niche: string | null;
};

export type RowStatus = "valid" | "review" | "duplicate" | "invalid";

export type ParsedRow = {
  row_number: number;
  raw: Record<string, string>;
  parsed: Parsed;
  warnings: string[]; // parse-time (conflict) warnings
};

// ---------------------------------------------------------------- text helpers
export const normKey = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9#]+/g, " ").trim();

const EMPTY = new Set([
  "", "-", "--", "—", "–", "n a", "na", "nao localizado", "nao confirmado", "sem informacao", "nao encontrado",
  "nao encontrada", "nao informado", "nenhum", "nenhuma", "sem site", "nao possui", "inexistente", "null", "none", "x", "?",
]);
export const isEmptyValue = (s: string | null | undefined) => EMPTY.has(normKey(stripMd(s ?? "")).replace(/#/g, ""));

/** Remove markdown/html decoration, keep visible text (never render HTML). */
export function stripMd(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, "; ")
    .replace(/<[^>]*>/g, "")
    .replace(/\[([^\]]*)\]\(([^)]*)\)/g, "$1")
    .replace(/\*\*|__|`/g, "")
    .replace(/\\\|/g, "|")
    .replace(/\s+/g, " ")
    .trim();
}

export type Link = { text: string; url: string };
export function extractLinks(s: string): Link[] {
  const out: Link[] = [];
  const md = /\[([^\]]*)\]\(\s*<?([^)\s>]+)>?[^)]*\)/g;
  let m: RegExpExecArray | null;
  let rest = s;
  while ((m = md.exec(s))) out.push({ text: m[1].trim(), url: cleanUrl(m[2]) });
  rest = s.replace(md, " ");
  const bare = /\b((?:https?:\/\/|www\.)[^\s<>()|\]]+|(?:wa\.me|instagram\.com|instagr\.am|maps\.app\.goo\.gl|goo\.gl\/maps|g\.page)\/[^\s<>()|\]]*)/gi;
  while ((m = bare.exec(rest))) out.push({ text: "", url: cleanUrl(m[1]) });
  return out;
}
function cleanUrl(u: string) {
  let x = u.trim().replace(/[.,;:!?]+$/, "");
  if (!/^https?:\/\//i.test(x)) x = "https://" + x.replace(/^\/+/, "");
  return x;
}
export function isValidUrl(u: string) {
  try { const p = new URL(u); return (p.protocol === "http:" || p.protocol === "https:") && p.hostname.includes("."); } catch { return false; }
}

const SCHEDULING_PLATFORMS: [RegExp, string][] = [
  [/booksy/i, "Booksy"], [/trinks/i, "Trinks"], [/appbarber|app barber/i, "AppBarber"], [/fresha/i, "Fresha"],
  [/avec\.|\bavec\b/i, "Avec"], [/simples ?agenda/i, "Simples Agenda"], [/agendapro/i, "AgendaPro"],
  [/calendly/i, "Calendly"], [/gendo/i, "Gendo"], [/beleza ?na ?web|belezanaweb/i, "Beleza na Web"],
  [/whats\s*app|wa\.me/i, "WhatsApp"], [/instagram/i, "Instagram"],
];
const isSchedulingUrl = (u: string) => SCHEDULING_PLATFORMS.slice(0, 10).some(([r]) => r.test(u));
const isSocialUrl = (u: string) => /instagram\.com|instagr\.am|facebook\.com|fb\.com|tiktok\.com|wa\.me|api\.whatsapp|linktr\.ee/i.test(u);
const isMapsUrl = (u: string) => /google\.[a-z.]+\/maps|maps\.google|maps\.app\.goo\.gl|goo\.gl\/maps|g\.page|share\.google/i.test(u);

// ---------------------------------------------------------------- aliases
const ALIASES: Record<Field, string[]> = {
  position: ["posicao", "ranking", "ordem", "rank", "#", "pos"],
  score: ["score", "pontuacao", "wix million score", "score wix", "nota wix"],
  priority: ["prioridade", "prio"],
  company_name: ["barbearia", "empresa", "negocio", "estabelecimento", "nome da empresa", "nome", "clinica", "restaurante", "loja", "profissional", "nome fantasia", "razao social", "salao", "studio", "estudio", "academia", "consultorio", "escritorio", "pet shop", "petshop"],
  neighborhood: ["bairro", "regiao", "zona"],
  city: ["cidade", "municipio"],
  state: ["estado", "uf"],
  address: ["endereco", "endereco completo", "localizacao", "logradouro"],
  phone: ["telefone", "telefone whatsapp", "telefones", "contato", "celular", "fone", "tel", "telefone wa"],
  whatsapp: ["whatsapp", "wa", "zap", "whats"],
  instagram_url: ["instagram", "instagram url", "perfil instagram", "ig", "insta", "@ instagram"],
  instagram_followers: ["seguidores", "followers", "seguidores instagram"],
  google_maps_url: ["google", "google maps", "mapa", "ficha google", "maps", "google meu negocio", "gmn", "perfil google"],
  google_reviews: ["avaliacoes", "reviews", "avaliacoes google", "n avaliacoes", "qtd avaliacoes", "numero de avaliacoes", "quantidade de avaliacoes"],
  google_rating: ["nota google", "rating", "nota", "avaliacao media", "nota media", "estrelas"],
  website_status: ["status do site", "status site", "situacao do site", "classificacao do site", "site status"],
  website_url: ["site", "website", "url", "site proprio", "pagina"],
  scheduling: ["agendamento", "canal de agendamento", "sistema de agendamento", "agenda online", "plataforma de agendamento"],
  digital_presence: ["presenca digital", "presenca online"],
  photo_quality: ["fotos", "qualidade das fotos", "qualidade fotos", "fotos qualidade"],
  commercial_observation: ["observacao comercial", "observacoes", "observacao", "analise comercial", "analise", "motivo", "detalhes", "obs", "comentario", "comentarios", "oportunidade", "justificativa"],
  niche: ["nicho", "segmento", "categoria", "ramo"],
};

/** Map each header to a field (or null). Exact alias wins, then longest token-contained alias. */
export function mapHeaders(headers: string[]): (Field | null)[] {
  const used = new Set<Field>();
  const keys = headers.map(normKey);
  const out: (Field | null)[] = keys.map(() => null);
  // pass 1: exact
  keys.forEach((k, i) => {
    for (const f of Object.keys(ALIASES) as Field[]) {
      if (!used.has(f) && ALIASES[f].includes(k)) { out[i] = f; used.add(f); return; }
    }
  });
  // pass 2: contained (token boundaries), longest alias first
  keys.forEach((k, i) => {
    if (out[i]) return;
    const padded = ` ${k} `;
    let best: { f: Field; len: number } | null = null;
    for (const f of Object.keys(ALIASES) as Field[]) {
      if (used.has(f)) continue;
      for (const a of ALIASES[f]) {
        if (a.length > 1 && padded.includes(` ${a} `) && (!best || a.length > best.len)) best = { f, len: a.length };
      }
    }
    if (best) { out[i] = best.f; used.add(best.f); }
  });
  return out;
}

const FIELD_WEIGHT: Partial<Record<Field, number>> = {
  company_name: 3, phone: 2, whatsapp: 2, instagram_url: 2, google_maps_url: 2, score: 1, priority: 1,
  city: 1, neighborhood: 1, website_url: 1, website_status: 1, address: 1, google_reviews: 1, instagram_followers: 1,
};

export function scoreTables(tables: RawTable[]): ScoredTable[] {
  return tables.map((t, index) => {
    const map = mapHeaders(t.headers);
    const mapped: Partial<Record<Field, number>> = {};
    map.forEach((f, i) => { if (f && mapped[f] == null) mapped[f] = i; });
    const hasCompany = mapped.company_name != null;
    let fit = 0;
    for (const f of Object.keys(mapped) as Field[]) fit += FIELD_WEIGHT[f] ?? 0.5;
    const isTopList = /\btop\s*\d+\b|\bdestaque|ranking final|melhores/i.test(normKey(t.title ?? ""));
    if (!hasCompany) fit = Math.min(fit, 2);
    return { ...t, index, fitScore: fit, mapped, hasCompany, isTopList };
  });
}

export type TableChoice = { candidates: ScoredTable[]; best: ScoredTable | null; ambiguous: boolean };

/** Pick the main lead table. Ambiguous when two lead-like tables are close in fit AND size. */
export function chooseMainTable(tables: RawTable[]): TableChoice {
  const scored = scoreTables(tables).filter((t) => t.rows.length > 0);
  const leadLike = scored.filter((t) => t.hasCompany && t.fitScore >= 5);
  const rank = (t: ScoredTable) => t.fitScore + Math.min(t.rows.length, 200) / 20 - (t.isTopList ? 4 : 0);
  leadLike.sort((a, b) => rank(b) - rank(a));
  const best = leadLike[0] ?? null;
  let ambiguous = false;
  if (best && leadLike[1]) {
    const s = leadLike[1];
    const closeFit = s.fitScore >= best.fitScore * 0.85;
    const closeSize = Math.abs(s.rows.length - best.rows.length) <= Math.max(2, best.rows.length * 0.2);
    ambiguous = closeFit && closeSize;
  }
  return { candidates: leadLike, best, ambiguous };
}

// ---------------------------------------------------------------- source readers (text)
function splitRow(line: string): string[] {
  let l = line.trim();
  if (l.startsWith("|")) l = l.slice(1);
  if (l.endsWith("|") && !l.endsWith("\\|")) l = l.slice(0, -1);
  const cells: string[] = [];
  let cur = ""; let depth = 0;
  for (let i = 0; i < l.length; i++) {
    const c = l[i];
    if (c === "\\" && l[i + 1] === "|") { cur += "|"; i++; continue; }
    if (c === "[" || c === "(") depth++;
    if ((c === "]" || c === ")") && depth > 0) depth--;
    if (c === "|" && depth === 0) { cells.push(cur.trim()); cur = ""; continue; }
    cur += c;
  }
  cells.push(cur.trim());
  return cells;
}
const isSeparator = (line: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);

/** Markdown pipe tables (with header + separator). Also tab-separated blocks. */
export function extractTextTables(text: string): RawTable[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const tables: RawTable[] = [];
  let lastTitle = "";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    if (t && !t.includes("|") && !t.includes("\t")) {
      lastTitle = t.replace(/^#+\s*/, "").replace(/\*\*/g, "").slice(0, 160);
    }
    if (t.includes("|") && i + 1 < lines.length && isSeparator(lines[i + 1])) {
      const headers = splitRow(t).map(stripMd);
      const rows: string[][] = [];
      let j = i + 2;
      while (j < lines.length && lines[j].includes("|") && lines[j].trim()) {
        if (!isSeparator(lines[j])) rows.push(splitRow(lines[j]));
        j++;
      }
      tables.push({ headers, rows: rows.map((r) => fit(r, headers.length)), title: lastTitle });
      i = j - 1;
      continue;
    }
    // TSV block (pasted from spreadsheet)
    if (t.includes("\t") && t.split("\t").length >= 3) {
      const block: string[][] = [];
      let j = i;
      while (j < lines.length && lines[j].includes("\t")) { block.push(lines[j].split("\t").map((c) => c.trim())); j++; }
      if (block.length >= 2) {
        const headers = block[0].map(stripMd);
        tables.push({ headers, rows: block.slice(1).map((r) => fit(r, headers.length)), title: lastTitle });
        i = j - 1;
      }
    }
  }
  return tables;
}
const fit = (r: string[], n: number) => (r.length >= n ? r.slice(0, n) : [...r, ...Array(n - r.length).fill("")]);

/** CSV (UTF-8) with auto-detected delimiter , ; or tab. Handles quoted fields. */
export function parseCsv(text: string): RawTable {
  const src = text.replace(/^\uFEFF/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const count = (ch: string) => { let n = 0, q = false; for (const c of firstLine) { if (c === '"') q = !q; else if (c === ch && !q) n++; } return n; };
  const cands = [";", ",", "\t"].map((d) => [d, count(d)] as const).sort((a, b) => b[1] - a[1]);
  const d = cands[0][1] > 0 ? cands[0][0] : ",";
  const rows: string[][] = [];
  let row: string[] = []; let cur = ""; let q = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"' && src[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === d) { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cur); rows.push(row); row = []; cur = "";
    } else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  const clean = rows.filter((r) => r.some((c) => c.trim()));
  const headers = (clean[0] ?? []).map((h) => stripMd(h));
  return { headers, rows: clean.slice(1).map((r) => fit(r.map((c) => c.trim()), headers.length)), title: "CSV" };
}

// ---------------------------------------------------------------- value parsers
const PHONE_RE = /(?:\+?\s?55[\s.-]?)?\(?\s?\d{2}\s?\)?[\s.-]?9?\s?\d{4}[\s.-]?\d{4}/g;
export const phoneDigits = (s: string) => s.replace(/\D/g, "");
export function extractPhones(s: string): string[] {
  const text = stripMd(s);
  const found: string[] = [];
  const wa = /wa\.me\/(\d{10,13})/gi; let m: RegExpExecArray | null;
  while ((m = wa.exec(s))) found.push(m[1]);
  for (const x of text.match(PHONE_RE) ?? []) {
    const d = phoneDigits(x);
    if (d.length >= 10 && d.length <= 13) found.push(x.trim());
  }
  const seen = new Set<string>(); const out: string[] = [];
  for (const f of found) { const k = normPhone(f); if (k && !seen.has(k)) { seen.add(k); out.push(f); } }
  return out;
}
export function normPhone(s: string | null | undefined): string | null {
  const d = phoneDigits(s ?? "");
  if (!d) return null;
  return d.length >= 12 && d.startsWith("55") ? d.slice(2) : d;
}
const WA_HINT = /whats\s*app|\bwa\b|wa\.me|\bzap\b|\(wa\)/i;

export function parseFollowers(s: string): number | null {
  const t = stripMd(s).toLowerCase().replace(/seguidores|followers|\+/g, "").trim();
  if (!t || isEmptyValue(t)) return null;
  const m = t.match(/(\d+(?:[.,]\d+)*)\s*(k|mil|mi|m)?\b/);
  if (!m) return null;
  const num = m[1]; const suf = m[2];
  if (suf) {
    const v = parseFloat(num.replace(/\./g, (_, i) => (num.indexOf(",") >= 0 ? "" : ".")).replace(",", "."));
    if (!isFinite(v)) return null;
    return Math.round(v * (suf === "k" || suf === "mil" ? 1000 : 1_000_000));
  }
  if (/^\d{1,3}([.,]\d{3})+$/.test(num)) return parseInt(num.replace(/[.,]/g, ""), 10);
  if (/^\d+$/.test(num)) return parseInt(num, 10);
  return null;
}

export function parseRatings(s: string): number[] {
  const out: number[] = [];
  const text = s.replace(/\]\([^)]*\)/g, "]");
  const re = /(\d)[.,](\d)\s*(?:\/\s*5|★|⭐|estrelas?)?/g; let m: RegExpExecArray | null;
  while ((m = re.exec(text))) { const v = parseFloat(`${m[1]}.${m[2]}`); if (v >= 0 && v <= 5) out.push(v); }
  if (!out.length) { const w = text.match(/\b([0-5])\s*(?:\/\s*5|★|⭐|estrelas?)/); if (w) out.push(parseFloat(w[1])); }
  return [...new Set(out)];
}

/** Returns preferred count (Google-related first) and all counts found. */
export function parseReviews(s: string): { value: number | null; all: number[]; conflict: boolean } {
  const text = stripMd(s);
  if (!text || isEmptyValue(text)) return { value: null, all: [], conflict: false };
  const segs = text.split(/[;|]|\s\/\s|\be\b|,\s(?=\d)/i).map((x) => x.trim()).filter(Boolean);
  const vals: { n: number; google: boolean }[] = [];
  for (const seg of segs) {
    const cleaned = seg.replace(/\d[.,]\d\s*(\/\s*5|★|⭐|estrelas?)/g, " ");
    const m = cleaned.match(/(\d{1,3}(?:\.\d{3})+|\d+)/);
    if (m) vals.push({ n: parseInt(m[1].replace(/\./g, ""), 10), google: /google|maps/i.test(seg) });
  }
  if (!vals.length) return { value: null, all: [], conflict: false };
  const g = vals.find((v) => v.google);
  const all = [...new Set(vals.map((v) => v.n))];
  return { value: (g ?? vals[0]).n, all, conflict: all.length > 1 };
}

export function parseScore(s: string): number | null {
  const t = stripMd(s);
  if (!t || isEmptyValue(t)) return null;
  const m = t.match(/-?\d+(?:[.,]\d+)?/);
  if (!m) return null;
  return Math.round(parseFloat(m[0].replace(",", ".")));
}
export function parsePriority(s: string): Parsed["priority"] {
  const t = stripMd(s).toUpperCase().replace(/PRIORIDADE|PRIO\.?/g, " ").replace(/[^A-Z0-9 ]/g, " ");
  const m = t.match(/(?:^|\s)([ABCD])(?:\s|$)/);
  return (m?.[1] as Parsed["priority"]) ?? null;
}
export function parseWebsiteStatus(s: string): Parsed["website_status"] {
  const k = normKey(stripMd(s));
  if (!k) return null;
  if (/nao possui|sem site|nao tem|inexistente/.test(k)) return "nao_possui";
  if (/fraco|ruim|basico|desatualizado/.test(k)) return "site_fraco";
  if (/razoavel|medio|mediano|regular/.test(k)) return "site_razoavel";
  if (/profissional|bom|otimo|forte/.test(k)) return "site_profissional";
  if (/nao confirmado|nao localizado|incerto|verificar/.test(k)) return "nao_confirmado";
  const letter = k.match(/^([abcd])\b/);
  if (letter) return ({ a: "nao_possui", b: "site_fraco", c: "site_razoavel", d: "site_profissional" } as const)[letter[1] as "a"];
  return null;
}
export function parsePhotoQuality(s: string): string | null {
  const t = stripMd(s);
  if (!t) return null;
  const k = normKey(t);
  if (/nao confirmad|nao localizad/.test(k)) return "Não confirmado";
  if (/excelente|otima/.test(k)) return "Excelente";
  if (/\bboa?s?\b/.test(k)) return "Boa";
  if (/media|regular|razoavel/.test(k)) return "Média";
  if (/baixa|ruim|fraca/.test(k)) return "Baixa";
  return t;
}
export function normalizeInstagram(s: string): { url: string | null; invalid: boolean } {
  const links = extractLinks(s).filter((l) => /instagram\.com|instagr\.am/i.test(l.url));
  if (links.length) return { url: links[0].url.replace(/^http:/, "https:"), invalid: false };
  const t = stripMd(s);
  if (!t || isEmptyValue(t)) return { url: null, invalid: false };
  const h = t.match(/@([A-Za-z0-9._]{2,30})/);
  if (h) return { url: `https://instagram.com/${h[1]}`, invalid: false };
  const bare = t.match(/^([A-Za-z0-9._]{3,30})$/);
  if (bare && /[._]|\d/.test(bare[1])) return { url: `https://instagram.com/${bare[1]}`, invalid: false };
  return { url: null, invalid: true };
}

// ---------------------------------------------------------------- row parsing
export type GarimpoDefaults = { city?: string | null; state?: string | null; niche?: string | null };

export function emptyParsed(): Parsed {
  return {
    company_name: null, position: null, score: null, priority: null, city: null, state: null, neighborhood: null,
    address: null, phone: null, whatsapp: null, whatsapp_confirmed: false, extra_phones: [], instagram_url: null,
    instagram_followers: null, google_maps_url: null, google_rating: null, google_reviews: null, website_url: null,
    website_status: null, scheduling_type: null, scheduling_url: null, digital_presence: null, photo_quality: null,
    commercial_observation: null, niche: null,
  };
}

const textOrNull = (s: string | undefined) => { const t = stripMd(s ?? ""); return t && !isEmptyValue(t) ? t : null; };

export function parseTableRows(table: RawTable, defaults: GarimpoDefaults): ParsedRow[] {
  const map = mapHeaders(table.headers);
  const idx = (f: Field) => map.indexOf(f);
  const out: ParsedRow[] = [];
  table.rows.forEach((cells, i) => {
    if (!cells.some((c) => stripMd(c))) return; // fully empty line
    const cell = (f: Field) => { const j = idx(f); return j >= 0 ? cells[j] ?? "" : ""; };
    const raw: Record<string, string> = {};
    table.headers.forEach((h, j) => { raw[h || `Coluna ${j + 1}`] = cells[j] ?? ""; });
    const p = emptyParsed();
    const w: string[] = [];

    const name = stripMd(cell("company_name"));
    p.company_name = name && !isEmptyValue(name) ? name : null;
    const pos = parseScore(cell("position")); p.position = pos != null && pos >= 0 ? pos : null;
    p.score = parseScore(cell("score"));
    p.priority = parsePriority(cell("priority"));
    p.neighborhood = textOrNull(cell("neighborhood"));
    if (p.neighborhood && /\s\/\s|;|\bou\b/.test(p.neighborhood)) w.push("Bairro conflitante");
    p.address = textOrNull(cell("address"));
    if (p.address && /;|\bou\b/.test(p.address)) w.push("Endereço conflitante");
    p.city = textOrNull(cell("city")) ?? defaults.city ?? null;
    p.state = textOrNull(cell("state")) ?? defaults.state ?? null;
    p.niche = textOrNull(cell("niche")) ?? defaults.niche ?? null;

    // phones / whatsapp
    const phoneCell = cell("phone"); const waCell = cell("whatsapp");
    const phones = extractPhones(phoneCell);
    const waPhones = extractPhones(waCell);
    if (phones.length) p.phone = phones[0];
    if (phones.length > 1) { p.extra_phones = phones.slice(1); w.push("Múltiplos telefones"); }
    const waHintPhone = WA_HINT.test(phoneCell);
    const waHintCol = WA_HINT.test(waCell);
    if (waPhones.length) {
      p.whatsapp = waPhones[0];
      p.whatsapp_confirmed = waHintCol || /confirmad/i.test(waCell);
      if (p.phone && normPhone(p.phone) !== normPhone(p.whatsapp)) w.push("Telefone conflitante");
      if (!p.phone) p.phone = null;
    } else if (waHintPhone && phones.length) {
      // e.g. "(75) 99999-9999 (WhatsApp)" or wa.me link
      const waLink = phoneCell.match(/wa\.me\/(\d{10,13})/i);
      p.whatsapp = waLink ? waLink[1] : phones[0];
      p.whatsapp_confirmed = true;
    }

    // instagram
    const ig = normalizeInstagram(cell("instagram_url"));
    p.instagram_url = ig.url;
    if (ig.invalid) w.push("URL inválida");
    p.instagram_followers = parseFollowers(cell("instagram_followers"));

    // google
    const gCell = cell("google_maps_url");
    const gLinks = extractLinks(gCell);
    const maps = gLinks.find((l) => isMapsUrl(l.url)) ?? gLinks.find((l) => /google/i.test(l.url));
    p.google_maps_url = maps?.url ?? null;
    if (!maps && gLinks.length) w.push("URL inválida");
    const ratingCell = cell("google_rating");
    const ratings = [...parseRatings(gCell), ...parseRatings(ratingCell)];
    const uniqR = [...new Set(ratings)];
    p.google_rating = uniqR[0] ?? null;
    if (uniqR.length > 1) w.push("Google rating conflitante");
    const rv = parseReviews(cell("google_reviews"));
    p.google_reviews = rv.value;
    if (rv.conflict) w.push("Quantidade de avaliações conflitante");
    if (p.google_reviews == null) {
      const inG = stripMd(gCell).match(/(\d+)\s*(avalia|reviews)/i);
      if (inG) p.google_reviews = parseInt(inG[1], 10);
    }

    // website + status
    const siteCell = cell("website_url");
    const siteLinks = extractLinks(siteCell);
    const own = siteLinks.find((l) => !isSchedulingUrl(l.url) && !isSocialUrl(l.url) && !isMapsUrl(l.url));
    const schedFromSite = siteLinks.find((l) => isSchedulingUrl(l.url));
    p.website_url = own?.url ?? null;
    if (own && !isValidUrl(own.url)) { p.website_url = null; w.push("URL inválida"); }
    if (!own && /nao confirmado/.test(normKey(stripMd(siteCell)))) w.push("Site não confirmado");
    if (!siteLinks.length && textOrNull(siteCell) && /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(stripMd(siteCell))) {
      const u = cleanUrl(stripMd(siteCell));
      if (isValidUrl(u) && !isSchedulingUrl(u)) p.website_url = u;
    }
    p.website_status = parseWebsiteStatus(cell("website_status"));
    if (!p.website_status && idx("website_status") < 0) {
      const k = normKey(stripMd(siteCell));
      if (/nao possui|sem site/.test(k)) p.website_status = "nao_possui";
    }
    if (p.website_status === "nao_confirmado" && !w.includes("Site não confirmado")) w.push("Site não confirmado");

    // scheduling
    const sCell = cell("scheduling");
    const sLinks = extractLinks(sCell);
    const sText = stripMd(sCell);
    const plat = SCHEDULING_PLATFORMS.find(([r]) => r.test(sCell));
    p.scheduling_type = plat?.[1] ?? (sText && !isEmptyValue(sText) ? sText : null);
    p.scheduling_url = sLinks[0]?.url ?? null;
    if (!p.scheduling_url && schedFromSite) {
      p.scheduling_url = schedFromSite.url;
      p.scheduling_type ??= SCHEDULING_PLATFORMS.find(([r]) => r.test(schedFromSite.url))?.[1] ?? null;
    }

    p.digital_presence = textOrNull(cell("digital_presence"));
    p.photo_quality = parsePhotoQuality(cell("photo_quality")) ;
    if (p.photo_quality && isEmptyValue(p.photo_quality) ) p.photo_quality = null;
    const obs = stripMd(cell("commercial_observation"));
    p.commercial_observation = obs || null;

    out.push({ row_number: i + 1, raw, parsed: p, warnings: [...new Set(w)] });
  });
  return out;
}

// ---------------------------------------------------------------- validation
const VALIDATION_WARNINGS = new Set([
  "Empresa ausente", "Dados insuficientes", "Score ausente", "Score fora do intervalo", "Prioridade ausente",
  "Instagram ausente", "Google Maps ausente", "WhatsApp não confirmado",
]);

/** Recompute validation status + validation warnings, keeping parse-time conflict warnings. */
export function validate(p: Parsed, parseWarnings: string[]): { status: Exclude<RowStatus, "duplicate">; warnings: string[] } {
  const w = parseWarnings.filter((x) => !VALIDATION_WARNINGS.has(x));
  if (!p.company_name?.trim()) return { status: "invalid", warnings: ["Empresa ausente", ...w] };
  let status: "valid" | "review" = "valid";
  const hasContact = !!(p.phone || p.whatsapp || p.instagram_url || p.google_maps_url || p.address || p.website_url);
  if (!hasContact) { status = "review"; w.push("Dados insuficientes"); }
  if (p.score == null) w.push("Score ausente");
  else if (p.score < 0 || p.score > 100) { status = "review"; w.push("Score fora do intervalo"); }
  if (!p.priority) w.push("Prioridade ausente");
  if (!p.instagram_url) w.push("Instagram ausente");
  if (!p.google_maps_url) w.push("Google Maps ausente");
  if ((p.phone || p.whatsapp) && !p.whatsapp_confirmed) w.push("WhatsApp não confirmado");
  return { status, warnings: [...new Set(w)] };
}

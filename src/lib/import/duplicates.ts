import { normKey, normPhone, type Parsed } from "./parser";

export type ExistingLead = {
  id: string; company_name: string; city: string | null; neighborhood: string | null; phone: string | null;
  whatsapp: string | null; instagram_url: string | null; google_maps_url: string | null; website_url: string | null;
  score: number | null; priority: string | null; status: string; archived_at: string | null;
};

export type DuplicateMatch = {
  source: "crm" | "file";
  lead_id?: string;
  row_number?: number;
  company_name: string;
  reasons: string[];
  existing: Record<string, string | number | null>;
};

/** URL comparison key: lowercase, no protocol, no www, no trailing slash; drops tracking query on social links only. */
export function normUrl(u: string | null | undefined): string | null {
  if (!u) return null;
  let x = u.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "");
  if (/^(instagram\.com|instagr\.am|facebook\.com)/.test(x)) x = x.replace(/[?#].*$/, "");
  x = x.replace(/[/?#]+$/, "");
  return x || null;
}
const nameKey = (s: string | null | undefined) => (s ? normKey(s) : "");

type Keys = { phones: string[]; ig: string | null; maps: string | null; site: string | null; name: string; city: string };
function keysOf(x: { phone?: string | null; whatsapp?: string | null; instagram_url?: string | null; google_maps_url?: string | null; website_url?: string | null; company_name?: string | null; city?: string | null }, extra: string[] = []): Keys {
  return {
    phones: [x.whatsapp, x.phone, ...extra].map((p) => normPhone(p)).filter((p): p is string => !!p && p.length >= 8),
    ig: normUrl(x.instagram_url), maps: normUrl(x.google_maps_url), site: normUrl(x.website_url),
    name: nameKey(x.company_name), city: nameKey(x.city),
  };
}

function reasonsBetween(a: Keys, aWa: string | null, b: Keys, bWa: string | null): string[] {
  const r: string[] = [];
  const aw = normPhone(aWa); const bw = normPhone(bWa);
  if (aw && bw && aw === bw) r.push("Mesmo WhatsApp");
  else if (a.phones.some((p) => b.phones.includes(p))) r.push("Mesmo telefone");
  if (a.ig && a.ig === b.ig) r.push("Mesmo Instagram");
  if (a.maps && a.maps === b.maps) r.push("Mesmo Google Maps");
  if (a.site && a.site === b.site) r.push("Mesmo site");
  if (a.name && a.name === b.name && a.city === b.city) r.push("Mesmo nome + cidade");
  return r;
}

const summary = (x: Partial<Parsed> & { status?: string; archived_at?: string | null }) => ({
  Empresa: x.company_name ?? null, Cidade: x.city ?? null, Bairro: x.neighborhood ?? null, Telefone: x.phone ?? null,
  WhatsApp: x.whatsapp ?? null, Instagram: x.instagram_url ?? null, "Google Maps": x.google_maps_url ?? null,
  Site: x.website_url ?? null, Score: x.score ?? null, Prioridade: x.priority ?? null,
  ...(x.status ? { "Status no CRM": x.status + (x.archived_at ? " (arquivado)" : "") } : {}),
});

export function findDuplicates(rows: { row_number: number; parsed: Parsed }[], existing: ExistingLead[]): Map<number, DuplicateMatch[]> {
  const out = new Map<number, DuplicateMatch[]>();
  const ex = existing.map((l) => ({ l, k: keysOf(l) }));
  const seen: { row_number: number; parsed: Parsed; k: Keys }[] = [];
  for (const r of rows) {
    if (!r.parsed.company_name) continue;
    const k = keysOf(r.parsed, r.parsed.extra_phones);
    const matches: DuplicateMatch[] = [];
    for (const e of ex) {
      const reasons = reasonsBetween(k, r.parsed.whatsapp, e.k, e.l.whatsapp);
      if (reasons.length) matches.push({ source: "crm", lead_id: e.l.id, company_name: e.l.company_name, reasons, existing: summary(e.l as never) });
    }
    for (const s of seen) {
      const reasons = reasonsBetween(k, r.parsed.whatsapp, s.k, s.parsed.whatsapp);
      if (reasons.length) matches.push({ source: "file", row_number: s.row_number, company_name: s.parsed.company_name ?? "", reasons, existing: summary(s.parsed) });
    }
    if (matches.length) out.set(r.row_number, matches);
    seen.push({ ...r, k });
  }
  return out;
}

export const summarizeParsed = (p: Parsed) => summary(p);

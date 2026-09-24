import { describe, expect, it } from "vitest";
import { auditBatch, auditMarkdown, type AuditRow } from "./audit";
import { emptyParsed } from "./parser";

const row = (n: number, raw: Record<string, string>, p: Partial<ReturnType<typeof emptyParsed>>, extra: Partial<AuditRow> = {}): AuditRow => ({
  id: `r${n}`, row_number: n, raw_data: raw, parsed_data: { ...emptyParsed(), company_name: `Empresa ${n}`, phone: `(75) 9800${n}-000${n}`, ...p },
  status: "valid", warnings: [], duplicate_matches: [], selected_for_import: true, duplicate_action: null, ...extra,
});

describe("audit", () => {
  it("fixes negated WhatsApp, platform site, followers, other-directory reviews, review selection", () => {
    const rows = [
      row(1, { Barbearia: "Empresa 1", Telefone: "(75) 98001-0001 — WhatsApp NÃO CONFIRMADO" }, { whatsapp: "(75) 98001-0001", whatsapp_confirmed: true }),
      row(2, { Barbearia: "Empresa 2", Site: "https://booksy.com/x" }, { website_url: "https://booksy.com/x" }),
      row(3, { Barbearia: "Empresa 3", Instagram: "@e3", Seguidores: "3,3 mil seguidores; 305 publicações" }, { instagram_url: "https://instagram.com/e3", instagram_followers: 305 }),
      row(4, { Barbearia: "Empresa 4", Seguidores: "Facebook: 377 seguidores" }, { instagram_followers: 377 }),
      row(5, { Barbearia: "Empresa 5", Avaliações: "17 no Wanderboat" }, { google_reviews: 17 }),
      row(6, { Barbearia: "Empresa 6" }, { phone: null }, { status: "review", selected_for_import: true }),
    ];
    const { rows: out, report } = auditBatch(rows, { batch_id: "b", file_name: "f.md", garimpo: "G" });
    expect(out[0]!.parsed_data.whatsapp).toBeNull();
    expect(out[0]!.parsed_data.whatsapp_confirmed).toBe(false);
    expect(out[1]!.parsed_data.website_url).toBeNull();
    expect(out[1]!.parsed_data.scheduling_url).toBe("https://booksy.com/x");
    expect(out[2]!.parsed_data.instagram_followers).toBe(3300);
    expect(out[3]!.parsed_data.instagram_followers).toBeNull();
    expect(out[4]!.parsed_data.google_reviews).toBeNull();
    expect(out[5]!.selected_for_import).toBe(false);
    expect(report.status).toBe("attention");
    expect(report.critical_errors_count).toBe(0);
    expect(rows[0]!.raw_data.Telefone).toContain("NÃO CONFIRMADO");
    expect(auditMarkdown(report)).toContain("Status: ATENÇÃO");
  });

  it("blocks on empty batch and repeated TOP lists; flags internal duplicates", () => {
    expect(auditBatch([], { batch_id: "b", file_name: null, garimpo: null }).report.status).toBe("blocked");
    const rep = Array.from({ length: 12 }, (_, i) => row(i + 1, { Barbearia: `X${i % 5}` }, { company_name: `X${i % 5}`, phone: null, instagram_url: `https://instagram.com/x${i}` }));
    expect(auditBatch(rep, { batch_id: "b", file_name: null, garimpo: null }).report.status).toBe("blocked");
    const d = auditBatch([row(1, {}, { phone: "(75) 99999-1111" }), row(2, {}, { phone: "(75) 99999-1111" })], { batch_id: "b", file_name: null, garimpo: null });
    expect(d.rows[1]!.status).toBe("duplicate");
    expect(d.rows[1]!.selected_for_import).toBe(false);
  });
});

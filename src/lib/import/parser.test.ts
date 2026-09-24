import { describe, expect, it } from "vitest";
import { chooseMainTable, extractTextTables, parseCsv, parseFollowers, parsePriority, parseReviews, parseScore, parseTableRows, parseWebsiteStatus, validate, normalizeInstagram } from "./parser";
import { findDuplicates } from "./duplicates";

const main = (n: number) => Array.from({ length: n }, (_, i) =>
  `| ${i + 1} | ${90 - i} | 🔥 PRIORIDADE ${"ABCD"[i % 4]} | Barbearia Teste ${i + 1} | Centro | (75) 9${String(8000 + i).padStart(4, "0")}-${String(1000 + i)} ${i % 2 ? "(WhatsApp)" : ""} | [@barb${i}](https://instagram.com/barb${i}) | 3,${i} mil | [4,${i % 10}/5](https://maps.app.goo.gl/x${i}) | ${20 + i} no Google; ${i} em diretórios | NÃO LOCALIZADO | A — NÃO POSSUI SITE | [AppBarber](https://appbarber.com.br/b${i}) | Média | Boa | Obs completa ${i}. |`).join("\n");

const DOC = `# Garimpo 01 — Barbearias
Resumo executivo...

## Tabela principal
| Posição | Score | Prioridade | Barbearia | Bairro | Telefone/WhatsApp | Instagram | Seguidores | Google | Avaliações | Site | Status do site | Agendamento | Presença digital | Fotos | Observação comercial |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
${main(30)}

## TOP 10
| Posição | Barbearia | Score | Prioridade | Motivo |
|---|---|---|---|---|
${Array.from({ length: 10 }, (_, i) => `| ${i + 1} | Barbearia Teste ${i + 1} | ${90 - i} | A | x |`).join("\n")}

## TOP 3
1. Barbearia Teste 1
2. Barbearia Teste 2

## Referências
| # | Fonte | URL |
|---|---|---|
| 1 | Google | https://google.com |
`;

describe("parser", () => {
  it("picks the main table and ignores TOP 10/TOP 3/references", () => {
    const tables = extractTextTables(DOC);
    expect(tables.length).toBe(3);
    const c = chooseMainTable(tables);
    expect(c.ambiguous).toBe(false);
    expect(c.best!.rows.length).toBe(30);
    const rows = parseTableRows(c.best!, { city: "Feira de Santana", state: "BA", niche: "Barbearias" });
    expect(rows.length).toBe(30);
    const r = rows[1]!.parsed;
    expect(r.company_name).toBe("Barbearia Teste 2");
    expect(r.priority).toBe("B");
    expect(r.instagram_url).toBe("https://instagram.com/barb1");
    expect(r.instagram_followers).toBe(3100);
    expect(r.google_rating).toBe(4.1);
    expect(r.google_maps_url).toBe("https://maps.app.goo.gl/x1");
    expect(r.google_reviews).toBe(21);
    expect(rows[1]!.warnings).toContain("Quantidade de avaliações conflitante");
    expect(r.website_url).toBeNull();
    expect(r.website_status).toBe("nao_possui");
    expect(r.scheduling_type).toBe("AppBarber");
    expect(r.scheduling_url).toBe("https://appbarber.com.br/b1");
    expect(r.whatsapp_confirmed).toBe(true);
    expect(rows[0]!.parsed.whatsapp_confirmed).toBe(false);
    expect(rows[0]!.parsed.whatsapp).toBeNull();
    expect(r.city).toBe("Feira de Santana");
    expect(r.commercial_observation).toBe("Obs completa 1.");
    expect(validate(r, rows[1]!.warnings).status).toBe("valid");
  });

  it("detects duplicates on re-import and inside the same file", () => {
    const t = chooseMainTable(extractTextTables(DOC)).best!;
    const rows = parseTableRows(t, { city: "Feira de Santana" });
    const existing = rows.slice(0, 5).map((r, i) => ({ id: `l${i}`, company_name: r.parsed.company_name!, city: r.parsed.city, neighborhood: null, phone: r.parsed.phone, whatsapp: r.parsed.whatsapp, instagram_url: r.parsed.instagram_url, google_maps_url: null, website_url: null, score: null, priority: null, status: "novo", archived_at: null }));
    const d = findDuplicates(rows.slice(0, 10), existing);
    expect(d.size).toBe(5);
    const dupFile = findDuplicates([...rows.slice(0, 2), { ...rows[0]!, row_number: 99 }], []);
    expect(dupFile.get(99)?.[0]?.source).toBe("file");
  });

  it("normalizes values", () => {
    expect(parseFollowers("3.040")).toBe(3040);
    expect(parseFollowers("3,040")).toBe(3040);
    expect(parseFollowers("3.0K")).toBe(3000);
    expect(parseFollowers("3,3 mil")).toBe(3300);
    expect(parseFollowers("4.8K+")).toBe(4800);
    expect(parseScore("80/100")).toBe(80);
    expect(parseScore("Score 80")).toBe(80);
    expect(parsePriority("🟡 B")).toBe("B");
    expect(parsePriority("Prioridade A")).toBe("A");
    expect(parseWebsiteStatus("B — POSSUI SITE FRACO")).toBe("site_fraco");
    expect(parseWebsiteStatus("NÃO CONFIRMADO")).toBe("nao_confirmado");
    expect(parseReviews("58 avaliações").value).toBe(58);
    expect(parseReviews("35 no Google Maps").value).toBe(35);
    expect(normalizeInstagram("@corte.fino").url).toBe("https://instagram.com/corte.fino");
  });

  it("parses CSV with ; and accents", () => {
    const t = parseCsv("Empresa;Telefone;Cidade\n\"Clínica São João\";(75) 3221-1234;Salvador\n");
    const rows = parseTableRows(t, {});
    expect(rows[0]!.parsed.company_name).toBe("Clínica São João");
    expect(rows[0]!.parsed.city).toBe("Salvador");
    expect(rows[0]!.parsed.phone).toBe("(75) 3221-1234");
  });

  it("marks name-only rows for review and nameless rows invalid", () => {
    const t = parseCsv("Nome,Instagram\nSó Nome,-\n,@x_y\n");
    const rows = parseTableRows(t, {});
    expect(validate(rows[0]!.parsed, rows[0]!.warnings).status).toBe("review");
    expect(validate(rows[1]!.parsed, rows[1]!.warnings).status).toBe("invalid");
  });

  it("expired own domain → no own site, valid, informational warning", () => {
    const t = parseCsv("Empresa;Site;Status do site;Observação\nBarbershop MD;barbeariamd.shop;A — NÃO POSSUI SITE;Domínio próprio expirado\n");
    const [r] = parseTableRows(t, {});
    expect(r!.parsed.website_url).toBeNull();
    expect(r!.parsed.website_status).toBe("nao_possui");
    expect(r!.warnings).toContain("Domínio próprio localizado, porém expirado/inativo.");
    expect(r!.raw["Site"]).toBe("barbeariamd.shop");
  });
});

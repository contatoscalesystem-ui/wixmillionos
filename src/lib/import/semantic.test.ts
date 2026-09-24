import { describe, expect, it } from "vitest";
import { parseCsv, parseTableRows, validate, SITE_PLATFORM_CONFLICT, WA_AMBIGUOUS } from "./parser";

const H = "Barbearia|Telefone/WhatsApp|Instagram|Seguidores|Site|Status do site|Agendamento|Observação comercial";
const rowsOf = (lines: string[]) => parseTableRows(parseCsv([H, ...lines].join("\n").replace(/\|/g, "\t")), { city: "Feira de Santana" });
const one = (line: string) => { const r = rowsOf([line])[0]!; return { p: r.parsed, w: r.warnings, v: validate(r.parsed, r.warnings) }; };

describe("semantic WhatsApp / followers / site", () => {
  it("Corte Fino: WhatsApp explícito + conflito de telefones", () => {
    const { p, w } = one("Barbearia Corte Fino|(75) 3221-4455; WhatsApp +55 75 98709-8210; (75) 99100-2233|@cortefino|3,2 mil|-|A — NÃO POSSUI SITE|WhatsApp|");
    expect(p.whatsapp).toBe("+55 75 98709-8210"); expect(p.whatsapp_confirmed).toBe(true);
    expect(w).toContain("Telefone conflitante");
  });
  it("Mister D: negação explícita", () => {
    const { p } = one("Barbearia Mister D|+55 75 99261-4991 (WhatsApp NÃO CONFIRMADO)|@misterd|1 mil|-|A|Instagram|");
    expect(p.phone).toBe("+55 75 99261-4991"); expect(p.whatsapp).toBeNull(); expect(p.whatsapp_confirmed).toBe(false);
  });
  it("Studio R.: telefones conflitantes, sem WhatsApp", () => {
    const { p, w } = one("Barbearia Studio R.|(75) 99138-5024; (75) 98877-6655|@studior|800|-|A|Instagram|WhatsApp não confirmado.");
    expect(p.phone).toBe("(75) 99138-5024"); expect(p.whatsapp).toBeNull(); expect(p.whatsapp_confirmed).toBe(false);
    expect(w).toContain("Telefone conflitante");
  });
  it("Lima / Jadson: confirmação no agendamento", () => {
    for (const [n, tel] of [["Barbearia Lima", "+55 75 99862-3680"], ["Barbearia Jadson Barber", "+55 75 98313-7171"]]) {
      const { p } = one(`${n}|${tel}|@x.y|500|-|A|WhatsApp ${tel}|`);
      expect(p.phone).toBe(tel); expect(p.whatsapp).toBe(tel); expect(p.whatsapp_confirmed).toBe(true);
    }
  });
  it("Dom Mustache: números diferentes", () => {
    const { p, w } = one("Dom Mustache Barbearia|+55 75 3623-7831; WhatsApp: +55 75 98891-0428|@dom.m|2 mil|-|A|WhatsApp|");
    expect(p.phone).toBe("+55 75 3623-7831"); expect(p.whatsapp).toBe("+55 75 98891-0428"); expect(p.whatsapp_confirmed).toBe(true);
    expect(w).not.toContain("Telefone conflitante");
  });
  it("Junior Cortes / The Barber / Caio / Wilson: indicação ambígua", () => {
    const cases: [string, string, string][] = [
      ["Barbearia Junior Cortes", "+55 75 99220-3290", "WhatsApp de agendamento indicado"],
      ["The Barber Barbearia", "+55 75 98834-4961", "Linkme/WhatsApp"],
      ["Caio Barber", "(75) 98222-8791", "Instagram indica agendamento; links para WhatsApp"],
      ["Wilson Barbershop", "+55 75 98251-9870", "WhatsApp não foi explicitamente confirmado"],
    ];
    for (const [n, tel, sched] of cases) {
      const { p } = one(`${n}|${tel}|@x.y|500|-|A|${sched}|`);
      expect(p.phone).toBe(tel); expect(p.whatsapp).toBeNull(); expect(p.whatsapp_confirmed).toBe(false);
    }
    expect(one(`Barbearia Junior Cortes|+55 75 99220-3290|@x.y|1|-|A|WhatsApp de agendamento indicado|`).w).toContain(WA_AMBIGUOUS);
  });
  it("Barbershop MD: link wa.me", () => {
    const { p } = one("Barbershop MD|-|@md|1 mil|-|A|[Agendar](https://wa.me/5575992635572)|");
    expect(p.whatsapp).toBe("5575992635572"); expect(p.whatsapp_confirmed).toBe(true);
  });
  it("Nettu's: seguidores do Facebook não viram Instagram", () => {
    const r = rowsOf(["Nettu's Barbearia|(75) 3000-1111|NÃO LOCALIZADO|Facebook: 377 seguidores|-|A|-|"])[0]!;
    expect(r.parsed.instagram_followers).toBeNull();
    expect(Object.values(r.raw).join(" ")).toContain("377");
  });
  it("Varnor: AppBarber não é site próprio → revisar", () => {
    const { p, w, v } = one("Varnor Barber|(75) 99999-0000|@varnor|1 mil|https://sites.appbarber.com.br/varnorbarber|B — POSSUI SITE FRACO|-|");
    expect(p.website_url).toBeNull(); expect(p.scheduling_url).toBe("https://sites.appbarber.com.br/varnorbarber");
    expect(w).toContain(SITE_PLATFORM_CONFLICT); expect(v.status).toBe("review");
  });
});

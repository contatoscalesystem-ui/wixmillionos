import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/crm";
import { useAuth } from "@/hooks/use-auth";
import { friendlyError, type Tables } from "@/lib/crm";
import { useInvalidate, useProfiles, useTemplates } from "@/lib/queries";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — WIX MILLION OS" },
      { name: "description", content: "Perfil, equipe, templates e integrações." },
      { property: "og:title", content: "Configurações — WIX MILLION OS" },
      { property: "og:description", content: "Perfil, equipe, templates e integrações." },
    ],
  }),
  component: Config,
});

function Box({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border bg-card p-5">{children}</div>;
}

function Config() {
  return (
    <div>
      <PageHeader title="Configurações" />
      <Tabs defaultValue="perfil">
        <TabsList className="flex h-auto flex-wrap">
          {["perfil", "equipe", "templates", "whatsapp", "integracoes", "valores"].map((t) => (
            <TabsTrigger key={t} value={t} className="capitalize">{t === "integracoes" ? "Integrações" : t === "whatsapp" ? "WhatsApp" : t}</TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="perfil"><Profile /></TabsContent>
        <TabsContent value="equipe"><Team /></TabsContent>
        <TabsContent value="templates"><Templates /></TabsContent>
        <TabsContent value="whatsapp">
          <Box>
            <div className="flex items-center gap-3"><span className="font-semibold">WhatsApp</span><span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">Não conectado</span></div>
            <p className="mt-2 text-sm text-muted-foreground">Integração direta com WhatsApp será disponibilizada em próximo MVP.</p>
            <p className="mt-1 text-sm text-muted-foreground">Por enquanto use o botão “Abrir WhatsApp” na ficha de cada lead.</p>
          </Box>
        </TabsContent>
        <TabsContent value="integracoes">
          <Box>
            <ul className="divide-y">
              {["OpenAI", "Google Drive", "Google Calendar"].map((n) => (
                <li key={n} className="flex items-center justify-between py-3 text-sm"><span className="font-medium">{n}</span><span className="text-muted-foreground">Não conectado</span></li>
              ))}
            </ul>
          </Box>
        </TabsContent>
        <TabsContent value="valores">
          <Box><p className="text-sm text-muted-foreground">Nenhum valor padrão é fixado no sistema. Valores de venda e comissão são informados em cada lançamento no Financeiro. Tabela de preços configurável chega em um próximo MVP.</p></Box>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Profile() {
  const { profile, role, refreshProfile } = useAuth();
  const invalidate = useInvalidate();
  const [name, setName] = useState("");
  useEffect(() => setName(profile?.full_name ?? ""), [profile]);
  const save = async () => {
    const { error } = await supabase.from("profiles").update({ full_name: name.trim() || null }).eq("id", profile!.id);
    if (error) return toast.error(friendlyError(error));
    toast.success("Perfil atualizado.");
    refreshProfile(); invalidate("profiles");
  };
  return (
    <Box>
      <div className="grid max-w-md gap-3">
        <div className="space-y-1.5"><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>E-mail</Label><Input value={profile?.email ?? ""} disabled /></div>
        <div className="text-sm text-muted-foreground">Papel: <span className="font-medium capitalize text-foreground">{role}</span></div>
        <Button className="w-fit" onClick={save}>Salvar</Button>
      </div>
    </Box>
  );
}

function Team() {
  const { role, session } = useAuth();
  const { data: profiles } = useProfiles();
  const invalidate = useInvalidate();
  const rolesQ = useQuery({
    queryKey: ["user_roles"],
    queryFn: async () => { const { data, error } = await supabase.from("user_roles").select("*"); if (error) throw error; return data; },
  });
  const roleOf = (id: string) => (rolesQ.data?.some((r) => r.user_id === id && r.role === "admin") ? "admin" : "operador");
  const toggle = async (p: Tables<"profiles">) => {
    const makeAdmin = roleOf(p.id) !== "admin";
    const { error } = makeAdmin
      ? await supabase.from("user_roles").insert({ user_id: p.id, workspace_id: p.workspace_id, role: "admin" })
      : await supabase.from("user_roles").delete().eq("user_id", p.id).eq("role", "admin");
    if (error) return toast.error(friendlyError(error));
    toast.success("Papel atualizado.");
    invalidate("user_roles");
  };
  return (
    <Box>
      <p className="mb-3 text-sm text-muted-foreground">Novos operadores entram criando conta na tela de login.</p>
      <ul className="divide-y">
        {(profiles ?? []).map((p) => (
          <li key={p.id} className="flex items-center justify-between py-3 text-sm">
            <div><div className="font-medium">{p.full_name || "—"}</div><div className="text-xs text-muted-foreground">{p.email}</div></div>
            <div className="flex items-center gap-3">
              <span className="capitalize text-muted-foreground">{roleOf(p.id)}</span>
              {role === "admin" && p.id !== session?.user.id && <Button size="sm" variant="outline" onClick={() => toggle(p)}>{roleOf(p.id) === "admin" ? "Tornar operador" : "Tornar admin"}</Button>}
            </div>
          </li>
        ))}
      </ul>
    </Box>
  );
}

function Templates() {
  const { data } = useTemplates();
  const invalidate = useInvalidate();
  const [edit, setEdit] = useState<{ id?: string; name: string; stage: string; content: string; is_active: boolean } | null>(null);
  const save = async () => {
    if (!edit?.name.trim() || !edit.content.trim()) return toast.error("Preencha nome e texto.");
    const payload = { name: edit.name.trim(), stage: edit.stage || null, content: edit.content, is_active: edit.is_active };
    const { error } = edit.id ? await supabase.from("message_templates").update(payload).eq("id", edit.id) : await supabase.from("message_templates").insert(payload);
    if (error) return toast.error(friendlyError(error));
    toast.success("Template salvo.");
    setEdit(null); invalidate("message_templates");
  };
  return (
    <Box>
      <p className="mb-3 text-sm text-muted-foreground">Variáveis disponíveis: [NOME_DA_EMPRESA], [NICHO], [CIDADE].</p>
      {edit ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Nome</Label><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Etapa</Label><Input value={edit.stage} onChange={(e) => setEdit({ ...edit, stage: e.target.value })} /></div>
          </div>
          <Textarea rows={14} value={edit.content} onChange={(e) => setEdit({ ...edit, content: e.target.value })} />
          <div className="flex items-center gap-2"><Switch checked={edit.is_active} onCheckedChange={(v) => setEdit({ ...edit, is_active: v })} id="act" /><Label htmlFor="act">Ativo</Label></div>
          <div className="flex gap-2"><Button onClick={save}>Salvar</Button><Button variant="outline" onClick={() => setEdit(null)}>Cancelar</Button></div>
        </div>
      ) : (
        <>
          <ul className="divide-y">
            {(data ?? []).map((t) => (
              <li key={t.id} className="flex items-center justify-between py-3 text-sm">
                <div><div className="font-medium">{t.name}</div><div className="text-xs text-muted-foreground">{t.stage ?? "—"} · {t.is_active ? "Ativo" : "Inativo"}</div></div>
                <Button size="sm" variant="outline" onClick={() => setEdit({ id: t.id, name: t.name, stage: t.stage ?? "", content: t.content, is_active: t.is_active })}>Editar</Button>
              </li>
            ))}
          </ul>
          <Button className="mt-3" variant="outline" onClick={() => setEdit({ name: "", stage: "", content: "", is_active: true })}>Novo template</Button>
        </>
      )}
    </Box>
  );
}

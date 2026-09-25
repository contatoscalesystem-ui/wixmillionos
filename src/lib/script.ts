import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/lib/crm";

export type ScriptStage = Tables<"script_stages">;
export type ScriptObjection = Tables<"script_objections">;
export type Material = { type: string; label: string; url: string };
export type Scope = "workspace" | "global";

export const MATERIAL_TYPES = ["Vídeo", "Link", "PDF", "Imagem", "Portfólio"];

export const materialsOf = (s: ScriptStage): Material[] =>
  Array.isArray(s.materials) ? (s.materials as unknown as Material[]).filter((m) => m && m.url) : [];

const scoped = <T extends { is: (c: string, v: null) => T; not: (c: string, o: string, v: null) => T }>(q: T, scope: Scope) =>
  scope === "global" ? q.is("workspace_id", null) : q.not("workspace_id", "is", null);

export const useScriptStages = (scope: Scope = "workspace") =>
  useQuery({
    queryKey: ["script_stages", scope],
    queryFn: async () => {
      let { data, error } = await scoped(supabase.from("script_stages").select("*"), scope).order("position");
      if (error) throw error;
      // First access of a workspace: receive its own copy of the global default script.
      if (scope === "workspace" && !data?.length) {
        const r = await supabase.rpc("copy_global_script", { _replace: false });
        if (!r.error && r.data) {
          ({ data, error } = await scoped(supabase.from("script_stages").select("*"), scope).order("position"));
          if (error) throw error;
        }
      }
      return data ?? [];
    },
  });

export const useScriptObjections = (scope: Scope = "workspace") =>
  useQuery({
    queryKey: ["script_objections", scope],
    queryFn: async () => {
      const { data, error } = await scoped(supabase.from("script_objections").select("*"), scope).order("position");
      if (error) throw error;
      return data ?? [];
    },
  });

export const useLeadProgress = (leadId?: string) =>
  useQuery({
    queryKey: ["lead_script_progress", leadId],
    enabled: !!leadId,
    queryFn: async () => {
      const { data, error } = await supabase.from("lead_script_progress").select("*").eq("lead_id", leadId!);
      if (error) throw error;
      return data ?? [];
    },
  });

/** Current stage = first active stage not yet completed. */
export function currentStage(stages: ScriptStage[], done: Set<string>) {
  return stages.filter((s) => s.is_active).find((s) => !done.has(s.id)) ?? null;
}

export const AFFILIATE_VAR = "[LINK_AFILIADO]";

/** Workspace affiliate link (per workspace, RLS-scoped). */
export const useAffiliateLink = () =>
  useQuery({
    queryKey: ["workspace_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("workspace_settings" as never).select("*").maybeSingle();
      if (error) throw error;
      return (data as { workspace_id: string; affiliate_link_name: string; affiliate_link: string | null } | null) ?? null;
    },
  });

export const applyAffiliate = (t: string, link?: string | null) =>
  link?.trim() ? t.replaceAll(AFFILIATE_VAR, link.trim()) : t;

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

async function unwrap<T>(p: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw error;
  return (data ?? []) as T;
}

/** Active (non-archived) leads — used everywhere by default. */
export const useLeads = () =>
  useQuery({ queryKey: ["leads"], queryFn: () => unwrap(supabase.from("leads").select("*").is("archived_at", null).order("created_at", { ascending: false })) });
export const useArchivedLeads = (enabled: boolean) =>
  useQuery({ enabled, queryKey: ["leads", "archived"], queryFn: () => unwrap(supabase.from("leads").select("*").not("archived_at", "is", null).order("archived_at", { ascending: false })) });
export const useGarimpos = () =>
  useQuery({ queryKey: ["garimpos"], queryFn: () => unwrap(supabase.from("garimpos").select("*").order("created_at", { ascending: false })) });
export const useProfiles = () =>
  useQuery({ queryKey: ["profiles"], queryFn: () => unwrap(supabase.from("profiles").select("*").order("full_name")) });
export const useClients = () =>
  useQuery({ queryKey: ["clients"], queryFn: () => unwrap(supabase.from("clients").select("*").order("created_at", { ascending: false })) });
export const useProjects = () =>
  useQuery({ queryKey: ["site_projects"], queryFn: () => unwrap(supabase.from("site_projects").select("*").order("created_at", { ascending: false })) });
export const useFinance = () =>
  useQuery({ queryKey: ["financial_entries"], queryFn: () => unwrap(supabase.from("financial_entries").select("*").order("created_at", { ascending: false })) });
export const useTags = () =>
  useQuery({ queryKey: ["lead_tags"], queryFn: () => unwrap(supabase.from("lead_tags").select("*").order("name")) });
export const useTemplates = () =>
  useQuery({ queryKey: ["message_templates"], queryFn: () => unwrap(supabase.from("message_templates").select("*").order("created_at")) });

export function useInvalidate() {
  const qc = useQueryClient();
  return (...keys: string[]) => Promise.all(keys.map((k) => qc.invalidateQueries({ queryKey: [k] })));
}

export function profileName(profiles: { id: string; full_name: string | null; email: string | null }[] | undefined, id?: string | null) {
  if (!id) return "—";
  const p = profiles?.find((x) => x.id === id);
  return p?.full_name || p?.email || "—";
}

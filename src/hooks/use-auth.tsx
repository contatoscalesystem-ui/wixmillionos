import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/lib/crm";

type AuthCtx = {
  session: Session | null;
  loading: boolean;
  profile: Tables<"profiles"> | null;
  role: "admin" | "operador" | null;
  refreshProfile: () => Promise<void>;
  /** true once profile/role were loaded for the current session */
  checked: boolean;
};
const Ctx = createContext<AuthCtx>({ session: null, loading: true, profile: null, role: null, refreshProfile: async () => {}, checked: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);
  const [role, setRole] = useState<AuthCtx["role"]>(null);
  const [checkedUid, setCheckedUid] = useState<string | null>(null);

  const loadProfile = async (uid?: string) => {
    if (!uid) { setProfile(null); setRole(null); setCheckedUid(null); return; }
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);
    if (!r?.length) {
      // Signed in without access: accept a pending invite for this e-mail, if any.
      const { data: accepted } = await supabase.rpc("accept_pending_invite");
      if (accepted) return loadProfile(uid);
    }
    setProfile(r?.length ? (p ?? null) : null);
    setRole(r?.some((x) => x.role === "admin") ? "admin" : r?.length ? "operador" : null);
    setCheckedUid(uid);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setTimeout(() => void loadProfile(s?.user.id), 0);
    });
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadProfile(data.session?.user.id);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <Ctx.Provider value={{ session, loading, profile, role, refreshProfile: () => loadProfile(session?.user.id), checked: !!session && checkedUid === session.user.id }}>
      {children}
    </Ctx.Provider>
  );
}
export const useAuth = () => useContext(Ctx);

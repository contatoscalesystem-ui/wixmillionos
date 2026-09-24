import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/lib/crm";

export type AccountStatus = "pending" | "approved" | "blocked" | "temp_blocked" | "banned" | "rejected" | "deleted";
type Account = { status: AccountStatus; is_super_admin: boolean; show_welcome: boolean; full_name: string | null; must_change_password?: boolean; blocked_until?: string | null };

type AuthCtx = {
  session: Session | null;
  loading: boolean;
  profile: Tables<"profiles"> | null;
  role: "admin" | "operador" | null;
  account: Account | null;
  isSuperAdmin: boolean;
  refreshProfile: () => Promise<void>;
  /** true once profile/role were loaded for the current session */
  checked: boolean;
};
const Ctx = createContext<AuthCtx>({
  session: null, loading: true, profile: null, role: null, account: null, isSuperAdmin: false,
  refreshProfile: async () => {}, checked: false,
});

export function statusPath(s: AccountStatus | undefined | null, mustChange?: boolean) {
  if (s === "pending" || !s) return "/aguardando-aprovacao";
  if (s === "blocked" || s === "temp_blocked") return "/conta-bloqueada";
  if (s === "banned") return "/conta-banida";
  if (s === "deleted") return "/conta-excluida";
  if (s === "rejected") return "/cadastro-rejeitado";
  return mustChange ? "/alterar-senha-obrigatoria" : "/dashboard";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);
  const [role, setRole] = useState<AuthCtx["role"]>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [checkedUid, setCheckedUid] = useState<string | null>(null);

  const loadProfile = async (uid?: string): Promise<void> => {
    if (!uid) { setProfile(null); setRole(null); setAccount(null); setCheckedUid(null); return; }
    const { data: acc } = await supabase.rpc("my_account" as never);
    let a = (acc as Account | null) ?? null;
    let [{ data: p }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);
    if (!r?.length && a?.status !== "blocked" && a?.status !== "rejected") {
      // Signed in without access: accept a pending invite for this e-mail, if any.
      const { data: accepted } = await supabase.rpc("accept_pending_invite");
      if (accepted) return loadProfile(uid);
    }
    if (a?.status !== "approved") { p = null; r = []; }
    setAccount(a);
    setProfile(r?.length ? (p ?? null) : null);
    setRole(r?.some((x) => x.role === "admin") ? "admin" : r?.length ? "operador" : null);
    setCheckedUid(uid);
    void supabase.rpc("touch_last_seen" as never);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((e, s) => {
      setSession(s);
      if (e === "SIGNED_IN" || e === "SIGNED_OUT" || e === "USER_UPDATED") setTimeout(() => void loadProfile(s?.user.id), 0);
    });
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadProfile(data.session?.user.id);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <Ctx.Provider value={{
      session, loading, profile, role, account, isSuperAdmin: !!account?.is_super_admin,
      refreshProfile: () => loadProfile(session?.user.id),
      checked: !!session && checkedUid === session.user.id,
    }}>
      {children}
    </Ctx.Provider>
  );
}
export const useAuth = () => useContext(Ctx);

export async function signOutWithLog() {
  try { await supabase.rpc("log_event" as never, { _type: "LOGOUT" } as never); } catch { /* ignore */ }
  await supabase.auth.signOut();
}

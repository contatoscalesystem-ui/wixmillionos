import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: { rpc: (fn: never, args?: never) => PromiseLike<{ data: unknown; error: { message: string } | null }> } };

async function assertSuperAdmin(ctx: Ctx) {
  const { data, error } = await ctx.supabase.rpc("is_super_admin" as never);
  if (error || !data) throw new Error("FORBIDDEN");
}
async function logEvent(ctx: Ctx, userId: string, action: string, mustChange = false) {
  const { data, error } = await ctx.supabase.rpc("admin_password_event" as never, { _user_id: userId, _action: action, _must_change: mustChange } as never);
  if (error) throw new Error(error.message);
  return data as { email: string | null };
}

function strongPassword() {
  const sets = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnpqrstuvwxyz", "23456789", "!@#$%&*?"];
  const all = sets.join("");
  const rnd = (n: number) => { const b = new Uint32Array(1); crypto.getRandomValues(b); return (b[0] ?? 0) % n; };
  const chars: string[] = sets.map((s) => s.charAt(rnd(s.length)));
  while (chars.length < 14) chars.push(all.charAt(rnd(all.length)));
  for (let i = chars.length - 1; i > 0; i--) { const j = rnd(i + 1); const t = chars[i]!; chars[i] = chars[j]!; chars[j] = t; }
  return chars.join("");
}

const uid = z.object({ userId: z.string().uuid() });

export const adminSendPasswordReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => uid.extend({ redirectTo: z.string().url() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context as unknown as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u, error: ue } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (ue || !u.user?.email) throw new Error("ACCOUNT_NOT_FOUND");
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(u.user.email, { redirectTo: data.redirectTo });
    if (error) { console.error(error); throw new Error("RESET_FAILED"); }
    await logEvent(context as unknown as Ctx, data.userId, "PASSWORD_RESET_SENT");
    return { ok: true };
  });

export const adminSetPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => uid.extend({ password: z.string().min(8).max(72), mustChange: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context as unknown as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { password: data.password });
    if (error) { console.error(error.message); throw new Error("PASSWORD_UPDATE_FAILED"); }
    await logEvent(context as unknown as Ctx, data.userId, "PASSWORD_CHANGED_BY_ADMIN", data.mustChange);
    return { ok: true };
  });

export const adminTempPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => uid.parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context as unknown as Ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const password = strongPassword();
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { password });
    if (error) { console.error(error.message); throw new Error("PASSWORD_UPDATE_FAILED"); }
    await logEvent(context as unknown as Ctx, data.userId, "TEMP_PASSWORD_CREATED", true);
    return { password };
  });

export const adminPurgeAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => uid.parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    await assertSuperAdmin(ctx);
    const { data: ws, error } = await ctx.supabase.rpc("admin_purge_account" as never, { _user_id: data.userId } as never);
    if (error) throw new Error(error.message);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (ws) {
      try {
        const bucket = supabaseAdmin.storage.from("garimpo-imports");
        const walk = async (prefix: string): Promise<string[]> => {
          const { data: items } = await bucket.list(prefix, { limit: 1000 });
          const out: string[] = [];
          for (const it of items ?? []) {
            const p = `${prefix}/${it.name}`;
            if (it.id) out.push(p); else out.push(...(await walk(p)));
          }
          return out;
        };
        const files = await walk(String(ws));
        if (files.length) await bucket.remove(files);
      } catch (e) { console.error("storage cleanup", e); }
    }
    const { error: de } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (de) { console.error(de.message); throw new Error("AUTH_DELETE_FAILED"); }
    return { ok: true };
  });

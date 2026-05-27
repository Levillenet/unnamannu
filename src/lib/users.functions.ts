import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { writeAudit } from "./audit.server";

const RoleSchema = z.enum(["admin", "user"]);

export const getCurrentRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (data ?? []).map((r) => r.role as string);
    const role = roles.includes("admin")
      ? "admin"
      : roles.includes("user")
        ? "user"
        : roles.includes("manager")
          ? "admin"
          : null;
    return {
      userId,
      email: (claims as { email?: string }).email ?? null,
      role: role as "admin" | "user" | null,
    };
  });

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    // Admin gate
    const { data: isAdminData } = await supabase.rpc("is_admin", { _user_id: userId });
    if (!isAdminData) throw new Error("Vain admin voi tarkastella käyttäjälistaa");

    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("id,email,display_name,created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id,role");
    const rolesByUser = new Map<string, string[]>();
    for (const r of roles ?? []) {
      const list = rolesByUser.get(r.user_id) ?? [];
      list.push(r.role as string);
      rolesByUser.set(r.user_id, list);
    }

    // Fetch last sign-in via admin Auth API (paginated; for now grab first 200)
    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    const lastSignInByUser = new Map<string, string | null>();
    for (const u of authUsers?.users ?? []) {
      lastSignInByUser.set(u.id, u.last_sign_in_at ?? null);
    }

    return (profiles ?? []).map((p) => {
      const list = rolesByUser.get(p.id) ?? [];
      const role: "admin" | "user" | null = list.includes("admin")
        ? "admin"
        : list.includes("user")
          ? "user"
          : list.includes("manager")
            ? "admin"
            : null;
      return {
        id: p.id,
        email: p.email,
        display_name: p.display_name,
        created_at: p.created_at,
        role,
        last_sign_in_at: lastSignInByUser.get(p.id) ?? null,
      };
    });
  });

export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      email: z.string().trim().email().max(255),
      role: RoleSchema,
      redirectTo: z.string().url(),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const { data: isAdminData } = await supabase.rpc("is_admin", { _user_id: userId });
    if (!isAdminData) throw new Error("Vain admin voi kutsua käyttäjiä");

    const { data: invited, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      redirectTo: data.redirectTo,
    });
    if (error) throw new Error(error.message);
    const newUserId = invited.user?.id;
    if (!newUserId) throw new Error("Kutsu epäonnistui");

    // Ensure profile row exists (trigger should handle this, belt+braces)
    await supabaseAdmin
      .from("profiles")
      .upsert({ id: newUserId, email: data.email }, { onConflict: "id" });

    // Assign role
    await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newUserId, role: data.role });

    await writeAudit(supabase, userId, (claims as { email?: string }).email ?? null, {
      action: "user.invite",
      entity_type: "user",
      entity_id: newUserId,
      details: { email: data.email, role: data.role },
    });

    return { ok: true, userId: newUserId };
  });

export const updateUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ userId: z.string().uuid(), role: RoleSchema }).parse,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const { data: isAdminData } = await supabase.rpc("is_admin", { _user_id: userId });
    if (!isAdminData) throw new Error("Vain admin voi muuttaa rooleja");
    if (data.userId === userId && data.role !== "admin") {
      throw new Error("Et voi alentaa omaa rooliasi");
    }

    // Replace roles: delete existing app roles then insert new one
    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .in("role", ["admin", "user", "manager"]);
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.userId, role: data.role });
    if (error) throw new Error(error.message);

    await writeAudit(supabase, userId, (claims as { email?: string }).email ?? null, {
      action: "user.role_change",
      entity_type: "user",
      entity_id: data.userId,
      details: { role: data.role },
    });

    return { ok: true };
  });

export const removeUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ userId: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const { data: isAdminData } = await supabase.rpc("is_admin", { _user_id: userId });
    if (!isAdminData) throw new Error("Vain admin voi poistaa käyttäjiä");
    if (data.userId === userId) throw new Error("Et voi poistaa omaa tunnustasi");

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);

    await writeAudit(supabase, userId, (claims as { email?: string }).email ?? null, {
      action: "user.remove",
      entity_type: "user",
      entity_id: data.userId,
    });

    return { ok: true };
  });

export const listAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      limit: z.number().int().min(1).max(500).optional(),
      action: z.string().max(60).optional(),
      userId: z.string().uuid().optional(),
    }).optional().parse,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdminData } = await supabase.rpc("is_admin", { _user_id: userId });
    if (!isAdminData) throw new Error("Vain admin voi tarkastella lokia");

    let q = supabaseAdmin
      .from("audit_log")
      .select("id,ts,user_id,user_email,action,entity_type,entity_id,details")
      .order("ts", { ascending: false })
      .limit(data?.limit ?? 200);
    if (data?.action) q = q.eq("action", data.action);
    if (data?.userId) q = q.eq("user_id", data.userId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    // Fallback emails from profiles when audit row's user_email is null
    const missing = (rows ?? []).filter((r) => !r.user_email && r.user_id).map((r) => r.user_id!);
    let emailMap = new Map<string, string>();
    if (missing.length > 0) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id,email")
        .in("id", missing);
      emailMap = new Map((profs ?? []).map((p) => [p.id, p.email]));
    }
    return (rows ?? []).map((r) => ({
      ...r,
      user_email: r.user_email ?? (r.user_id ? emailMap.get(r.user_id) ?? null : null),
    }));
  });

export const sendPasswordReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ email: z.string().email(), redirectTo: z.string().url() }).parse,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId, claims } = context;
    const { data: isAdminData } = await supabase.rpc("is_admin", { _user_id: userId });
    if (!isAdminData) throw new Error("Vain admin voi lähettää salasanan palautuksen");

    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(data.email, {
      redirectTo: data.redirectTo,
    });
    if (error) throw new Error(error.message);

    await writeAudit(supabase, userId, (claims as { email?: string }).email ?? null, {
      action: "user.password_reset_sent",
      entity_type: "user",
      details: { email: data.email },
    });
    return { ok: true };
  });

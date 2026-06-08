import { createFileRoute } from "@tanstack/react-router";

// Cron hook: pg_cron calls this every 5 minutes to refresh thermostat state
// from the Ebeco API even when no admin is using the app.
//
// Authenticated via the project's anon `apikey` header (standard /api/public
// pattern). Uses the service-role admin client because there's no signed-in
// user during cron execution.
export const Route = createFileRoute("/api/public/hooks/ebeco-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        const provided =
          request.headers.get("apikey") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          "";
        if (!expected || provided !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { syncEbecoIntoSupabase } = await import("@/lib/ebeco-sync.server");
          const result = await syncEbecoIntoSupabase(supabaseAdmin);

          await supabaseAdmin.from("audit_log").insert({
            user_id: null,
            actor_email: "cron@ebeco-sync",
            action: "ebeco.sync.cron",
            entity_type: "ebeco",
            entity_id: null,
            details: result,
          });

          return new Response(JSON.stringify({ ok: true, ...result }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error("[ebeco-sync hook] failed:", message);
          return new Response(JSON.stringify({ ok: false, error: message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});

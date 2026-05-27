import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runChildLockDiagnostics } from "./ebeco-diagnose.server";

export const diagnoseEbecoChildLock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.number().int().positive(), enable: z.boolean() }).parse(input),
  )
  .handler(async ({ data }) => {
    return runChildLockDiagnostics(data.id, data.enable);
  });

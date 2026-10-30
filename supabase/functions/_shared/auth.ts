import { createClient } from "npm:@supabase/supabase-js@2";
import type { Database } from "../../../src/lib/supabase/types.ts";

function getDefaultApiKey(
  environmentName: "SUPABASE_PUBLISHABLE_KEYS" | "SUPABASE_SECRET_KEYS",
) {
  const rawKeys = Deno.env.get(environmentName);
  if (!rawKeys) {
    throw new Error(
      `${environmentName} is not configured in the Edge Function environment.`,
    );
  }

  const keys: unknown = JSON.parse(rawKeys);
  if (
    typeof keys !== "object" ||
    keys === null ||
    !("default" in keys) ||
    typeof keys.default !== "string" ||
    keys.default.length === 0
  ) {
    throw new Error(`${environmentName} must contain a default API key.`);
  }

  return keys.default;
}

function getSupabaseUrl() {
  const value = Deno.env.get("SUPABASE_URL");
  if (!value) {
    throw new Error(
      "SUPABASE_URL is not configured in the Edge Function environment.",
    );
  }
  return value;
}

export function createCallerClient(authorization: string) {
  return createClient<Database>(
    getSupabaseUrl(),
    getDefaultApiKey("SUPABASE_PUBLISHABLE_KEYS"),
    {
      global: { headers: { Authorization: authorization } },
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  );
}

export function createRollbackClient() {
  return createClient<Database>(
    getSupabaseUrl(),
    getDefaultApiKey("SUPABASE_SECRET_KEYS"),
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  );
}

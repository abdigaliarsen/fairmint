import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Create a server-side Supabase client.
 *
 * Prefers the service role key (bypasses RLS) when available.
 * Falls back to the anon key for read-only operations when the
 * service role key is not configured.
 *
 * IMPORTANT: Never import this module from client-side code.
 */
export function createServerSupabaseClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing environment variable: NEXT_PUBLIC_SUPABASE_URL");
  }

  // Use service role key if available and valid, otherwise fall back to anon key
  const isServiceKeyValid =
    supabaseServiceRoleKey &&
    !supabaseServiceRoleKey.startsWith("<") &&
    supabaseServiceRoleKey !== "placeholder";

  const key = isServiceKeyValid ? supabaseServiceRoleKey : supabaseAnonKey;

  if (!key) {
    throw new Error(
      "Missing Supabase key: set SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  if (!isServiceKeyValid) {
    console.warn(
      "SUPABASE_SERVICE_ROLE_KEY not configured — using anon key (read-only for most tables)"
    );
  }

  return createClient(supabaseUrl, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

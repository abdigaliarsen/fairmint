import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Create a server-side Supabase client using the service role key.
 *
 * This client bypasses Row Level Security (RLS) and should only be used
 * in server-side contexts (API routes, server components, services).
 *
 * IMPORTANT: Never import this module from client-side code.
 */
export function createServerSupabaseClient(): SupabaseClient<Database> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing environment variable: NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!supabaseServiceRoleKey) {
    throw new Error("Missing environment variable: SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

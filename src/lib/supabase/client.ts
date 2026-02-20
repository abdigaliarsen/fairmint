import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

let clientInstance: SupabaseClient<Database> | null = null;

/**
 * Get a singleton client-side Supabase client using the anon (public) key.
 *
 * This client respects Row Level Security (RLS) and is safe to use in
 * browser / client components. The singleton pattern prevents creating
 * multiple GoTrue client instances.
 */
export function getSupabaseClient(): SupabaseClient<Database> {
  if (clientInstance) {
    return clientInstance;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing environment variable: NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!supabaseAnonKey) {
    throw new Error("Missing environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  clientInstance = createClient<Database>(supabaseUrl, supabaseAnonKey);

  return clientInstance;
}

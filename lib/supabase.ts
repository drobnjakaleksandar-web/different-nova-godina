import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

// Prihvata i imena koja upisuje Supabase-Vercel integracija
export const supabaseUrl = () => process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
export const supabaseKey = () => process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// Server-only: koristi tajni ključ, nikad se ne šalje u pregledač.
export function db(): SupabaseClient {
  if (client) return client;
  const url = supabaseUrl();
  const key = supabaseKey();
  if (!url || !key) throw new Error("SUPABASE_URL ili SUPABASE_SECRET_KEY nije podešen");
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return client;
}

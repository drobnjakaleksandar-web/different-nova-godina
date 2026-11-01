import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

// Prihvata i imena koja upisuje Supabase-Vercel integracija
// Skida razmake, navodnike, kosu crtu i "/rest/v1" ako je nalepljena puna Data API adresa
export const supabaseUrl = () => {
  const raw = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim().replace(/^["']|["']$/g, "");
  if (!raw) return "";
  try {
    const u = new URL(raw);
    return u.origin;
  } catch {
    return raw.replace(/\/(rest|auth)\/v1.*$/i, "").replace(/\/+$/, "");
  }
};
export const supabaseKey = () =>
  (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim().replace(/^["']|["']$/g, "");

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

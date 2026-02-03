import type { SupabaseClient } from "@supabase/supabase-js";

export async function requireAuth(supabase: SupabaseClient) {
  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session) {
    return null;
  }

  return data.session;
}

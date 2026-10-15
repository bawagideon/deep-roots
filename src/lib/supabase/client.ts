import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export async function getOrCreateUserSession() {
  if (typeof window === "undefined") return null;

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user) {
      return session.user;
    }

    // Try creating anonymous guest session if supported
    const { data, error } = await supabase.auth.signInAnonymously();
    if (!error && data?.user) {
      return data.user;
    }

    return null;
  } catch (err) {
    console.warn("Supabase auth session lookup warning:", err);
    return null;
  }
}

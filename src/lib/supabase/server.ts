import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-key";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey || anonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export interface VerifiedUser {
  id: string;
  email?: string;
  isAnonymous?: boolean;
  role?: string;
}

/**
 * Authoritatively verifies the caller's session on the server.
 * Uses Clerk session verification first, with Supabase Bearer token fallback.
 * NEVER trusts spoofable headers like x-user-id.
 */
export async function getServerUser(req: NextRequest): Promise<VerifiedUser | null> {
  try {
    // 1. Authoritative verification via Clerk session
    try {
      const { userId } = auth();
      if (userId) {
        let role = "user";

        // Check if user is an configured admin
        const adminIds = (process.env.ADMIN_USER_IDS || "").split(",").map((s) => s.trim());
        if (adminIds.includes(userId)) {
          role = "admin";
        }

        // Fetch or sync user profile role in Supabase
        try {
          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("role, plan")
            .eq("id", userId)
            .single();

          if (profile?.role) {
            role = profile.role;
          } else {
            // Lazy profile creation for new Clerk users
            await supabaseAdmin.from("profiles").upsert(
              {
                id: userId,
                role,
                plan: "free",
                updated_at: new Date().toISOString(),
              },
              { onConflict: "id" }
            );
          }
        } catch {}

        return {
          id: userId,
          role,
          isAnonymous: false,
        };
      }
    } catch {
      // Clerk auth() context might not be active (e.g. non-Clerk request or static generation)
    }

    // 2. Check Bearer Authorization header
    const authHeader = req.headers.get("authorization");
    let token: string | undefined;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7).trim();
    }

    // 3. Check Supabase auth cookie if no header
    if (!token) {
      const cookieHeader = req.headers.get("cookie") || "";
      const match = cookieHeader.match(/sb-access-token=([^;]+)/);
      if (match) token = match[1];
    }

    if (!token) {
      return null;
    }

    // Verify token authoritatively with Supabase Auth
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return null;
    }

    let role = "user";
    try {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (profile?.role) role = profile.role;
    } catch {}

    return {
      id: user.id,
      email: user.email,
      isAnonymous: user.is_anonymous || false,
      role,
    };
  } catch (err) {
    console.error("Server authentication verification error:", err);
    return null;
  }
}

/**
 * Checks if the caller has admin permissions in the database or env config.
 */
export async function isServerAdmin(user: VerifiedUser | null): Promise<boolean> {
  if (!user) return false;
  if (user.role === "admin") return true;

  const adminIds = (process.env.ADMIN_USER_IDS || "").split(",").map((s) => s.trim());
  if (adminIds.includes(user.id)) return true;

  try {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    return profile?.role === "admin";
  } catch {
    return false;
  }
}

/**
 * Server-controlled operations settings (e.g. kill switches).
 * Checks the database app_settings table first; falls back to env vars.
 */
export async function getServerSetting<T>(key: string, defaultValue: T): Promise<T> {
  const envKey = key.toUpperCase();
  if (process.env[envKey] !== undefined) {
    const raw = process.env[envKey];
    if (raw === "true") return true as any;
    if (raw === "false") return false as any;
    return raw as any;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", key)
      .single();

    if (!error && data?.value !== undefined) {
      return data.value as T;
    }
  } catch {}

  return defaultValue;
}

/**
 * Updates a server-controlled operations setting.
 */
export async function setServerSetting(key: string, value: any): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from("app_settings")
      .upsert({
        key,
        value,
        updated_at: new Date().toISOString(),
      });

    return !error;
  } catch (err) {
    console.error("Failed to update server setting:", err);
    return false;
  }
}

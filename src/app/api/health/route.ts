import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabaseAdmin, getServerUser, isServerAdmin, getServerSetting } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  const requestId = `health-${Date.now()}`;

  // Optional: check admin authorization for full details, or provide basic status
  const user = await getServerUser(req);
  const isAdmin = await isServerAdmin(user);

  const results: Record<string, any> = {
    requestId,
    timestamp: new Date().toISOString(),
    status: "healthy",
  };

  // 1. Check Kill Switch
  const isKillSwitchActive = await getServerSetting("scan_kill_switch", false);
  results.killSwitch = isKillSwitchActive ? "ACTIVE (SCANS_BLOCKED)" : "STANDBY";

  // 2. Check Database Connectivity
  try {
    const dbStart = Date.now();
    const { error } = await supabaseAdmin.from("app_settings").select("key").limit(1);
    results.database = {
      connected: !error,
      latencyMs: Date.now() - dbStart,
      status: error ? error.message : "ready",
    };
  } catch (err: any) {
    results.database = {
      connected: false,
      status: err.message,
    };
  }

  // 3. Probe Primary AI Model (1-token ping)
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    results.primaryModel = {
      model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
      status: "missing_api_key",
    };
    results.status = "degraded";
  } else {
    try {
      const modelStart = Date.now();
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({
        model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
        generationConfig: { maxOutputTokens: 1 },
      });
      await model.generateContent("ping");
      results.primaryModel = {
        model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
        status: "alive",
        latencyMs: Date.now() - modelStart,
      };
    } catch (err: any) {
      results.primaryModel = {
        model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
        status: "error",
        error: err.message,
      };
      results.status = "degraded";
    }
  }

  // 4. Fallback Model
  results.fallbackModel = {
    model: process.env.GEMINI_FALLBACK_MODEL || "gemini-3.7-flash",
    configured: !!geminiKey,
  };

  results.totalLatencyMs = Date.now() - startTime;

  return NextResponse.json(results, {
    status: results.status === "healthy" ? 200 : 503,
  });
}

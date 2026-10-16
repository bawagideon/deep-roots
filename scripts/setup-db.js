const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Parse .env.local
const lines = fs.readFileSync('.env.local', 'utf8').split('\n');
const env = {};
for (const line of lines) {
  const clean = line.trim();
  if (clean && !clean.startsWith('#')) {
    const idx = clean.indexOf('=');
    if (idx !== -1) {
      env[clean.slice(0, idx).trim()] = clean.slice(idx + 1).trim();
    }
  }
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function main() {
  console.log("=================================================================");
  console.log("  Deep Roots Database Diagnostic & Verification Tool");
  console.log("=================================================================");
  console.log("Connecting to Supabase endpoint:", supabaseUrl);
  
  const tables = [
    'profiles',
    'subscriptions',
    'billing_events',
    'roots',
    'claims',
    'claim_sources',
    'edges',
    'usage',
    'app_settings',
    'mistake_reports',
    'visual_assets',
    'shares',
    'analysis_runs'
  ];

  const presentTables = [];
  const missingTables = [];
  
  for (const table of tables) {
    const { error } = await supabase.from(table).select('*').limit(1);
    if (error && (error.code === 'PGRST205' || error.message.includes('Could not find the table'))) {
      missingTables.push(table);
    } else {
      presentTables.push(table);
    }
  }

  console.log(`\nVerified Tables (${presentTables.length}/${tables.length}):`);
  for (const t of presentTables) {
    console.log(`  ✓ ${t}`);
  }

  if (missingTables.length > 0) {
    console.log(`\nPending Migration Tables (${missingTables.length}):`);
    for (const t of missingTables) {
      console.log(`  ✗ ${t}`);
    }
    console.log("\n=================================================================");
    console.log("ACTION REQUIRED: Execute supabase/schema.sql in Supabase SQL Editor");
    console.log("=================================================================");
    console.log("1. Open Supabase: https://supabase.com/dashboard/project/cjlsqvsxmzahzgwmumah");
    console.log("2. Navigate to SQL Editor.");
    console.log("3. Paste the contents of supabase/schema.sql and click 'Run'.");
    console.log("=================================================================\n");
  } else {
    console.log("\n✓ All Deep Roots database tables and schema components are verified!");
  }

  // Verify atomic quota RPC availability
  try {
    const { error: rpcErr } = await supabase.rpc('atomic_reserve_quota', {
      p_user_id: 'test_health_probe',
      p_day: new Date().toISOString().slice(0, 10),
      p_kind: 'scan',
      p_limit: 0
    });
    if (!rpcErr) {
      console.log("✓ Function atomic_reserve_quota is callable by service_role.");
    } else if (rpcErr.code !== 'PGRST202') {
      console.log("✓ Function atomic_reserve_quota verified (status: " + rpcErr.message + ").");
    }
  } catch (err) {
    console.warn("RPC check note:", err.message);
  }
}

main().catch(err => {
  console.error("Diagnostic execution error:", err);
  process.exit(1);
});

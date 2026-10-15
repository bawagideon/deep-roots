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
  console.log("Checking Supabase connection to:", supabaseUrl);
  
  // Test query on tables
  const tables = ['profiles', 'roots', 'claims', 'claim_sources', 'edges', 'usage', 'app_settings', 'mistake_reports', 'visual_assets'];
  const missingTables = [];
  
  for (const table of tables) {
    const { error } = await supabase.from(table).select('*').limit(1);
    if (error && (error.code === 'PGRST205' || error.message.includes('Could not find the table'))) {
      missingTables.push(table);
    }
  }

  if (missingTables.length === 0) {
    console.log("✓ All Deep Roots database tables exist and are connected!");
  } else {
    console.log("Missing tables detected:", missingTables.join(", "));
    console.log("\n=================================================================");
    console.log("ACTION REQUIRED: Run the SQL Schema in Supabase");
    console.log("=================================================================");
    console.log("1. Open your Supabase Dashboard: https://supabase.com/dashboard/project/cjlsqvsxmzahzgwmumah");
    console.log("2. Click on the 'SQL Editor' tab on the left navigation.");
    console.log("3. Copy the entire contents of 'supabase/schema.sql' and paste it into the editor.");
    console.log("4. Click 'Run' to create all tables, indexes, RLS policies and functions.");
    console.log("=================================================================\n");
  }
}

main().catch(err => {
  console.error("Setup script failed:", err);
  process.exit(1);
});

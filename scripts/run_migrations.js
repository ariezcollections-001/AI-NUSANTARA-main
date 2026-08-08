#!/usr/bin/env node
/**
 * Run SQL migration file against a Postgres connection specified by env var DATABASE_URL.
 * Falls back to SUPABASE_DB_URL if provided. Exits if no connection string found.
 */
const fs = require('fs');
const path = require('path');

async function main() {
  const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '001_initial_schema.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error('Migration file not found:', sqlPath);
    process.exit(2);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');
  const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || process.env.SUPABASE_DATABASE_URL;
  if (!dbUrl) {
    console.error('No DATABASE_URL / SUPABASE_DB_URL found in environment. Cannot run migrations.');
    process.exit(3);
  }

  // Lazy require pg to avoid throwing if not installed
  let Client;
  try {
    Client = require('pg').Client;
  } catch (e) {
    console.error('pg package not installed. Run "npm install pg" before executing this script.');
    process.exit(5);
  }

  const client = new Client({ connectionString: dbUrl });
  try {
    await client.connect();
    console.log('Connected to DB, starting migration...');
    await client.query(sql);
    console.log('Migration executed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message || err);
    process.exit(4);
  } finally {
    try { await client.end(); } catch {}
  }
}

main();

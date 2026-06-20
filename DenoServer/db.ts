import { SqliteDatabase } from "./db/sqlite.ts";
import { SupabaseDatabase } from "./db/supabase.ts";
import type { Database } from "./db/database.ts";

function createDatabase(): Database {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_SECRET_KEY");
  const clientId = Deno.env.get("CLIENT");

  if (supabaseUrl && supabaseKey) {
    if (!clientId) {
      throw new Error("CLIENT env var is required when using Supabase");
    }
    console.log(`Using Supabase Postgres database (client: ${clientId})`);
    return new SupabaseDatabase(supabaseUrl, supabaseKey, clientId);
  }

  console.log("Using local SQLite database");
  return new SqliteDatabase("./data/local.db");
}

export const db: Database = createDatabase();

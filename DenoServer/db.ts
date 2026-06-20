import { SqliteDatabase } from "./db/sqlite.ts";
import { SupabaseDatabase } from "./db/supabase.ts";
import type { Database } from "./db/database.ts";

function createDatabase(): Database {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (supabaseUrl && supabaseKey) {
    console.log("Using Supabase Postgres database");
    return new SupabaseDatabase(supabaseUrl, supabaseKey);
  }

  console.log("Using local SQLite database");
  return new SqliteDatabase("./data/local.db");
}

export const db: Database = createDatabase();

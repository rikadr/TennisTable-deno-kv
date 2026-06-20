import { SupabaseDatabase } from "./db/supabase.ts";
import type { Database } from "./db/database.ts";

async function createDatabase(): Promise<Database> {
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

  if (Deno.env.get("DENO_DEPLOYMENT_ID")) {
    throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set on Deno Deploy");
  }

  console.log("Using local SQLite database");
  const { SqliteDatabase } = await import("./db/sqlite.ts");
  return new SqliteDatabase("./data/local.db");
}

export const db: Database = await createDatabase();

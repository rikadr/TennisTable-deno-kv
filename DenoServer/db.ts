import { SupabaseDatabase } from "./db/supabase.ts";
import type { Database } from "./db/database.ts";

async function createDatabaseFactory(): Promise<(client: string) => Database> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_SECRET_KEY");

  if (supabaseUrl && supabaseKey) {
    console.log("Using Supabase Postgres database");
    return (client) => new SupabaseDatabase(supabaseUrl, supabaseKey, client);
  }

  if (Deno.env.get("DENO_DEPLOYMENT_ID")) {
    throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY must be set on Deno Deploy");
  }

  console.log("Using local SQLite databases, one file per client");
  const { SqliteDatabase } = await import("./db/sqlite.ts");
  return (client) => new SqliteDatabase(`./data/${client}.db`);
}

const createDatabase = await createDatabaseFactory();
const databases = new Map<string, Database>();

/**
 * The database of one client. Only call it with a client from `CLIENTS`: the
 * SQLite file name comes from the client id.
 */
export function getDb(client: string): Database {
  let db = databases.get(client);
  if (!db) {
    db = createDatabase(client);
    databases.set(client, db);
  }
  return db;
}

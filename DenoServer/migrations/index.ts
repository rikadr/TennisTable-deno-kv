import { kv } from "../db.ts";

/**
 * Migration execution
 */

export async function runMigrations() {
  console.log("\nRunning migrations .......................");

  // Collect migration scripts
  const migrationFiles: string[] = [];
  for await (const entry of Deno.readDir("./migrations/scripts")) {
    if (entry.isFile && entry.name.endsWith(".ts")) {
      migrationFiles.push(entry.name);
    }
  }

  // Sort by file name
  migrationFiles.sort();

  // Execute in order
  for (const fileName of migrationFiles) {
    const migrationStatus = await getMigrationStatus(fileName);
    if (migrationStatus) {
      console.log(`*Skip* Migration already executed: ${fileName} at ${migrationStatus.timestamp}`);
      continue;
    }
    console.log(`Executing migration: ${fileName}`);
    const filePath = new URL(`./scripts/${fileName}`, import.meta.url).href;
    await import(filePath);
    console.log(`Completed migration: ${fileName}`);
    await registerSuccessfulMigration(fileName);
  }

  console.log("Migrations completed .....................");
}

/**
 * Migration status tracking
 */

type MigrationStatus = { timestamp: number };

async function registerSuccessfulMigration(migrationName: string) {
  const value: MigrationStatus = { timestamp: new Date().getTime() };
  const res = await kv.set(migrationKey(migrationName), value);
  if (!res.ok) {
    throw new Error("Failed to register successful migration");
  }
}

async function getMigrationStatus(migrationName: string): Promise<MigrationStatus | null> {
  const res = await kv.get<MigrationStatus>(migrationKey(migrationName));
  return res.value ?? null;
}

function migrationKey(migrationName: string): string[] {
  return ["migrations", migrationName];
}

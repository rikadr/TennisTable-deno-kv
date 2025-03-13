import { kv } from "../db.ts";
import { migrations } from "./migrations.ts";

/**
 * Migration execution
 */

export async function runMigrations() {
  console.log("\nRunning migrations .......................");

  // Execute in order
  for (const migration of migrations) {
    const migrationStatus = await getMigrationStatus(migration.name);
    if (migrationStatus) {
      console.log(`*Skip* Migration already executed: ${migration.name} at ${migrationStatus.timestamp}`);
      continue;
    }
    console.log(`Executing migration: ${migration.name}`);
    await migration.up();
    await registerSuccessfulMigration(migration.name);
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

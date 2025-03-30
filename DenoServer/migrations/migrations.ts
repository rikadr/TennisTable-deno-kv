import { kv } from "../db.ts";

type Migration = {
  name: string;
  description?: string;
  up: () => Promise<void> | void;
};

// DO NOT MODIFY EXISTING MIGRATIONS
// ADD NEW MIGRATIONS TO THE END OF THE ARRAY
// READ MORE LIMITATIONS IN README.md

export const migrations: Migration[] = [
  {
    name: "delete old data",
    up: async () => {
      await deleteKVDBByPrefix("client-db-cache");
      await deleteKVDBByPrefix("game");
      await deleteKVDBByPrefix("player");
      await deleteKVDBByPrefix("tournament");
    },
  },
];

async function deleteKVDBByPrefix(prefix: string) {
  const res = kv.list({ prefix: [prefix] });

  for await (const profile of res) {
    await kv.delete(profile.key);
  }
}

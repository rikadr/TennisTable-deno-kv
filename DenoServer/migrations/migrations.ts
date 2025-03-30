import { kv } from "../db.ts";
import { uploadProfilePicture } from "../player/player.ts";

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
    name: "migrate-skimore-profile-pictures",
    up: async () => {
      const idss = ["JI2IoMDt6V", "PC6lk9OwY0"];
      for (const id of idss) {
        const res = await getProfilePictureOld(id);
        if (res) {
          await uploadProfilePicture(id, res);
          await kv.delete(["profile-picture-id", id]);
        }
      }
    },
  },
];

async function getProfilePictureOld(name: string): Promise<string | null> {
  if (!name) {
    throw new Error("name is required");
  }

  const res = await kv.get(["profile-picture-id", name]);

  if (res.value) {
    return res.value as string;
  }
  return null;
}

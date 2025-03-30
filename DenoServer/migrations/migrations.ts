import { deleteAllProfilePicturesOld } from "../player/player.ts";

type Migration = {
  name: string;
  description?: string;
  up: () => Promise<void> | void;
};

// DO NOT MODIFY EXISTING MIGRATIONS
// ADD NEW MIGRATIONS TO THE END OF THE ARRAY

export const migrations: Migration[] = [
  {
    name: "delete-old-profile-pictures",
    up: async () => {
      // Move profile pictures to new ids
      await deleteAllProfilePicturesOld();
    },
  },
];

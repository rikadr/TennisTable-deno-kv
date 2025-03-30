type Migration = {
  name: string;
  description?: string;
  up: () => Promise<void> | void;
};

// DO NOT MODIFY EXISTING MIGRATIONS
// ADD NEW MIGRATIONS TO THE END OF THE ARRAY

export const migrations: Migration[] = [
  // {
  //   name: "move-profile-pictures",
  //   up: async () => {
  //     const { players } = await getClientDbData();
  //     // Move profile pictures to new ids
  //     for (const player of players) {
  //       const profilePicture = await getProfilePictureOld(player.name);
  //       await uploadProfilePictureNew(playerId, profilePicture);
  //     }
  //     // Delete old profile pictures
  //     await deleteAllProfilePicturesOld();
  //   },
  // },
];

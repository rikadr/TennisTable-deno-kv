type Migration = {
  name: string;
  description?: string;
  up: () => Promise<void> | void;
};

// const optioPlayers = {
//   Rasmus: "fwSr2gbKZ9",
//   Simone: "KvYCQupTl9",
//   Alexander: "zAZF4oc08J",
//   Fooa: "2XQllk6sPY",
//   Peder: "OTGhYtvi0M",
//   Erling: "ZYZhPub2Eo",
//   Oskar: "mBwrdSejAz",
//   "Fredrik H": "GLjRK9Ri3j",
//   Rikard: "ch3ZaIB2qF",
//   Ole: "0BFRJ8XiDS",
//   Marius: "nnUvT8lPTH",
//   Gina: "UCEYqaBBcK",
//   Gustas: "8whk3RdC5f",
//   Daniele: "BnKaNft4TF",
//   "Ole Anders": "Jf0jHQZ0Z7",
//   Kevin: "g5siQrzbun",
//   "James 007": "Yb1ITjXe9t",
//   "Chakib Youcefi": "fQZwfnr6IL",
//   Tor: "LYp7GYa12X",
//   "Alejandro 🌮": "seVb5J8bSZ",
//   Markus: "3im4v9uUzl",
//   Yngve: "Yz7pwV6aCB",
// } as const;

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

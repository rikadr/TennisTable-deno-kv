import { getProfilePictureOld, uploadProfilePictureNew } from "../player/player.ts";

type Migration = {
  name: string;
  description?: string;
  up: () => Promise<void> | void;
};

const optioPlayers = {
  Rasmus: ["fwSr2gbKZ9", "lAtdvBUe8Y"],
  Simone: ["KvYCQupTl9", "mEJcTzNybG"],
  Alexander: ["zAZF4oc08J", "KcM8yViOwS"],
  Fooa: ["2XQllk6sPY", "xaaOr5yWAD"],
  Peder: ["OTGhYtvi0M", "MPtLdpGqDw"],
  Erling: ["ZYZhPub2Eo", "D5JU2DcUE2"],
  Oskar: ["mBwrdSejAz", "p1mHpOcZt2"],
  "Fredrik H": ["GLjRK9Ri3j", "2k15Sa0evK"],
  Rikard: ["ch3ZaIB2qF", "aOGwT2cdh0"],
  Ole: ["0BFRJ8XiDS", "RGfBMEC93A"],
  Marius: ["nnUvT8lPTH", "VRCuBMP7Em"],
  Gina: ["UCEYqaBBcK", ""],
  Gustas: ["8whk3RdC5f", "YLd7DZk8eT"],
  Daniele: ["BnKaNft4TF", "ezlZCyTkga"],
  "Ole Anders": ["Jf0jHQZ0Z7", "iUaAuJ2XYx"],
  Kevin: ["g5siQrzbun", ""],
  "James 007": ["Yb1ITjXe9t", ""],
  "Chakib Youcefi": ["fQZwfnr6IL", "33eLeAnxPO"],
  Tor: ["LYp7GYa12X", "AzUh1JtuKN"],
  "Alejandro 🌮": ["seVb5J8bSZ", "mmTlqJaGee"],
  Markus: ["3im4v9uUzl", "a41DI04Ekx"],
  Yngve: ["Yz7pwV6aCB", "3KuNQvTv5S"],
  Anders: ["O6Y4yMY0eY", "FEps0SBzYQ"],
  Axel: ["onn7WJqr9x", "O63bdj7tFh"],
  Christoffer: ["5r1IH1RR3D", "YShTcevRLI"],
  Daniel: ["o8GLyAvjYV", "a0QormMLn8"],
  Sveinung: ["xz8yoKjeSp", "kDpS29kXMn"],
  Bendik: ["XVUtdsdCFj", "yIXVjfEOlU"],
} as const;

// DO NOT MODIFY EXISTING MIGRATIONS
// ADD NEW MIGRATIONS TO THE END OF THE ARRAY

export const migrations: Migration[] = [
  {
    name: "profile-pictures-to-new-ids",
    up: async () => {
      // Move profile pictures to new ids
      for (const player in optioPlayers) {
        const [newId, oldId] = optioPlayers[player as keyof typeof optioPlayers];
        if (!newId || !oldId) {
          console.log(`Skipping ${player} because newId or oldId is missing`);
          continue;
        }
        const profilePicture = await getProfilePictureOld(oldId);
        if (!profilePicture) {
          console.log(`Skipping ${player} because profile picture is missing`);
          continue;
        }

        await uploadProfilePictureNew(newId, profilePicture);
      }
    },
  },
];

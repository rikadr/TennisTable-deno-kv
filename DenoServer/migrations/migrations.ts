type Migration = {
  name: string;
  description?: string;
  up: () => Promise<void> | void;
};

// DO NOT MODIFY EXISTING MIGRATIONS
// ADD NEW MIGRATIONS TO THE END OF THE ARRAY
// READ MORE LIMITATIONS IN README.md

export const migrations: Migration[] = [
  // {
  //   name: "example-migration",
  //   up: async () => {
  //     console.log("Running example migration");
  //   },
  // },
];

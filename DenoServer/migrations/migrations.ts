type Migration = {
  name: string;
  description?: string;
  up: () => Promise<void> | void;
};

// DO NOT MODIFY EXISTING MIGRATIONS
// ADD NEW MIGRATIONS TO THE END OF THE ARRAY

export const migrations: Migration[] = [
  {
    name: "Init migration test",
    up: () => {
      console.log("Hello from first init of migrations 🏓");
    },
  },
];

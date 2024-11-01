/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    fontFamily: {
      display: ["Oooh Baby", "cursive"],
    },
    extend: {
      colors: {
        // Halloween theme
        // primary: {
        //   text: "#FFFFFF",
        //   background: "#1B0E01",
        // },
        // secondary: {
        //   text: "#000000",
        //   background: "#d97706",
        // },
        // Default theme
        primary: {
          text: "#FFFFFF",
          background: "#1e293b",
        },
        secondary: {
          text: "#FFFFFF",
          background: "#6b7280",
        },
      },
    },
  },
  plugins: [],
};

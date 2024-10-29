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
        primary: {
          text: "#FFFFFF",
          background: "#000000",
        },
        secondary: {
          text: "#000000",
          background: "#d97706",
        },
      },
    },
  },
  plugins: [],
};

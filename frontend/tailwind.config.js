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
          background: "#333333",
        },
        secondary: {
          text: "#333333",
          background: "#AAAFB5",
        },
      },
    },
  },
  plugins: [],
};

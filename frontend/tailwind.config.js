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
          background: "#1e293b",
        },
        secondary: {
          text: "#FFFFFF",
          background: "#64748b",
        },
      },
    },
  },
  plugins: [],
};

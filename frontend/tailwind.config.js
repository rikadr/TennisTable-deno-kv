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
      animation: {
        "ping-once": "ping-once 1000ms ease-in-out 1000ms forwards",
        wiggle: "wiggle 1s ease-in-out 500ms forwards",
      },
      keyframes: {
        "ping-once": {
          "0%": { transform: "scale(1)", opacity: "1" },
          "15%": { transform: "scale(0.7)", opacity: "1" },
          "100%": { transform: "scale(3)", opacity: "0" },
        },
        wiggle: {
          "0%": { transform: "rotate(0deg)" },
          "10%": { transform: "rotate(-3deg)" },
          "20%": { transform: "rotate(6deg)" },
          "30%": { transform: "rotate(-8deg)" },
          "40%": { transform: "rotate(8deg)" },
          "50%": { transform: "rotate(-8deg)" },
          "60%": { transform: "rotate(6deg)" },
          "70%": { transform: "rotate(-4deg)" },
          "80%": { transform: "rotate(2deg)" },
          "90%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(0deg)" },
        },
      },
    },
  },
  plugins: [],
};

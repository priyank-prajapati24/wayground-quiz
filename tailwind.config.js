/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        wayground: {
          bg: "#12071f",
          card: "#1e0e34",
          accent: "#8854d0",
          pink: "#e056fd",
          green: "#88d500",
          purple: "#9b51e0",
          orange: "#ff7675",
          teal: "#00cec9",
          darkCard: "#19092b",
          border: "#321654",
        }
      },
      fontFamily: {
        sans: ['"Quicksand"', '"Fredoka"', 'sans-serif'],
      }
    },
  },
  plugins: [],
}

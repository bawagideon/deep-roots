/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0E1411",
        surface: "#151D18",
        "surface-2": "#1D2822",
        line: "#2A372F",
        text: "#EAF1EC",
        muted: "#9AAAA0",
        amber: {
          DEFAULT: "#FFC857",
          500: "#FFC857",
          600: "#E5B040",
          glow: "rgba(255, 200, 87, 0.15)",
        },
        "root-bg": "#231A00",
        lens: {
          language: "#7FB8FF",
          culture: "#FF9B7A",
          mind: "#D4A5FF",
          money: "#9BE564",
          tech: "#5FE0E8",
          origins: "#FF86B8",
        },
      },
      borderRadius: {
        card: "20px",
        btn: "16px",
        sheet: "28px",
      },
      fontFamily: {
        display: ["var(--font-bricolage)", "system-ui", "sans-serif"],
        sans: ["var(--font-instrument)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#fff8f6",
        surface: "#ffffff",
        border: "#c9bce7",
        ink: "#342d46",
        muted: "#6f6780",
        accent: "#6c55d9",
        "accent-green": "#3d9a78",
        "accent-orange": "#d58b22",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
export default config;

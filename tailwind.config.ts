import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#07080b",
        fire: { DEFAULT: "#ff6a1a", soft: "#ffa03d", deep: "#c24a08" },
        ice: { DEFAULT: "#2f7bff", soft: "#38e1ff", deep: "#1d4fd7" }
      },
      fontFamily: {
        sans: ['"Inter"', "-apple-system", "BlinkMacSystemFont", '"Segoe UI"', "Roboto", "sans-serif"]
      },
      boxShadow: {
        fire: "0 6px 24px rgba(255,106,26,0.35)",
        ice: "0 6px 24px rgba(47,123,255,0.35)",
        glass: "0 10px 34px rgba(0,0,0,0.38)"
      }
    }
  },
  plugins: [require("tailwindcss-animate")]
};
export default config;

import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";
const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        factory: { yellow: "#FFC400", dark: "#111111", steel: "#2A2E35", success: "#16a34a", danger: "#dc2626" }
      }
    }
  },
  plugins: [animate]
};
export default config;

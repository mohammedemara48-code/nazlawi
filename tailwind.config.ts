import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: { extend: { fontFamily: { sans: ["var(--font-sans)", "sans-serif"], serif: ["var(--font-serif)", "serif"] }, colors: { brand: { DEFAULT: "#D4704A", dark: "#B85A37", cream: "#FBF3EA" } } } },
  plugins: [],
} satisfies Config;

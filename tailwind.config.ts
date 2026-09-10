import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17232d",
        paper: "#f6f2ea",
        mist: "#e7eee9",
        apricot: "#d8794d",
        moss: "#5b806c",
        slate: "#647482",
      },
      boxShadow: {
        paper: "0 18px 50px rgba(36, 52, 61, 0.09)",
      },
    },
  },
  plugins: [],
};

export default config;

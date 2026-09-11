import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#f6fbfc",
        paper: "#071824",
        mist: "#173a43",
        apricot: "#f49ab4",
        moss: "#c1e6d2",
        slate: "#cbdde4",
      },
      boxShadow: {
        paper: "0 18px 50px rgba(0, 8, 16, 0.28)",
      },
    },
  },
  plugins: [],
};

export default config;

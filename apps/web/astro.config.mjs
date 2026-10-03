// @ts-check
import { defineConfig, fontProviders } from "astro/config";

export default defineConfig({
  site: process.env.SITE_URL ?? "https://si-dan.com",
  output: "static",
  trailingSlash: "never",
  build: { format: "file" },
  prefetch: { prefetchAll: false, defaultStrategy: "hover" },
  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: "Nunito",
      cssVariable: "--font-body",
      weights: ["400 800"],
      subsets: ["latin"],
      fallbacks: ["ui-rounded", "system-ui", "sans-serif"],
    },
    {
      provider: fontProviders.fontsource(),
      name: "Pixelify Sans",
      cssVariable: "--font-pixel",
      weights: ["500 700"],
      subsets: ["latin"],
      fallbacks: ["ui-monospace", "monospace"],
    },
  ],
});

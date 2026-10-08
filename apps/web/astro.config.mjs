// @ts-check
import { defineConfig, fontProviders } from "astro/config";

export default defineConfig({
  site: process.env.SITE_URL ?? "https://si-dan.com",
  output: "static",
  trailingSlash: "never",
  build: { format: "file" },
  // Career Hall became part of the Dev Center (public/_redirects does the same with a real 301).
  redirects: { "/career": "/dev" },
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
    {
      // The arcade's Game Boy-style Mancala screen.
      provider: fontProviders.fontsource(),
      name: "Press Start 2P",
      cssVariable: "--font-retro",
      weights: ["400"],
      subsets: ["latin"],
      fallbacks: ["ui-monospace", "monospace"],
    },
    {
      // Code in the twin's chat: an old terminal look.
      provider: fontProviders.fontsource(),
      name: "VT323",
      cssVariable: "--font-terminal",
      weights: ["400"],
      subsets: ["latin"],
      fallbacks: ["ui-monospace", "monospace"],
    },
  ],
});

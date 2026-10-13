/**
 * The site's pixel fonts as base64 woff2, for embedding in the README's SVGs. The latin subsets
 * from Fontsource are small (8–18 KB each), so each SVG carries them whole. All three are OFL.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import type { FontData } from "./svg.ts";

const require = createRequire(import.meta.url);

const file = (pkg: string, name: string) => readFileSync(require.resolve(`${pkg}/files/${name}`)).toString("base64");

export function loadFonts(): FontData {
  return {
    retro: {
      family: "Press Start 2P",
      faces: [{ weight: 400, base64: file("@fontsource/press-start-2p", "press-start-2p-latin-400-normal.woff2") }],
    },
    term: {
      family: "VT323",
      faces: [{ weight: 400, base64: file("@fontsource/vt323", "vt323-latin-400-normal.woff2") }],
    },
    pixel: {
      family: "Pixelify Sans",
      faces: [
        { weight: 400, base64: file("@fontsource/pixelify-sans", "pixelify-sans-latin-400-normal.woff2") },
        { weight: 600, base64: file("@fontsource/pixelify-sans", "pixelify-sans-latin-600-normal.woff2") },
      ],
    },
  };
}

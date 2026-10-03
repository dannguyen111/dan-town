import type { ImageMetadata } from "astro";

/**
 * The profile refers to images as "/images/<file>". Resolve those to bundled assets so Astro
 * can resize them and convert them to modern formats at build time.
 */
const assets = import.meta.glob<{ default: ImageMetadata }>("../assets/images/*", { eager: true });

export function resolveImage(path: string | undefined): ImageMetadata | undefined {
  if (!path) return undefined;
  const file = path.split("/").pop();
  return Object.entries(assets).find(([key]) => key.endsWith(`/${file}`))?.[1].default;
}

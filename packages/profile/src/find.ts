/**
 * Where the canonical profile is: $PROFILE_PATH → ../dan-profile/profile.yaml → profile/profile.example.yaml.
 * Shared by the profile and README CLIs.
 */
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ProfileError } from "./compile.ts";

/** The dan-town repo root. */
export const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

export function resolveProfilePath(): string {
  const candidates = [
    process.env.PROFILE_PATH,
    join(root, "../dan-profile/profile.yaml"),
    join(root, "profile/profile.example.yaml"),
  ].filter((p): p is string => Boolean(p));
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new ProfileError(`No profile found. Tried:\n${candidates.join("\n")}`);
  if (found.endsWith("profile.example.yaml")) console.warn("⚠  Using profile/profile.example.yaml (set PROFILE_PATH for the real profile)");
  return found;
}

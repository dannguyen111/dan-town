// Builds the Rust Mancala engine to WASM and copies it into the site's public folder.
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = join(root, "engine/mancala/Cargo.toml");
execFileSync("cargo", ["build", "--release", "--target", "wasm32-unknown-unknown", "--manifest-path", manifest], {
  stdio: "inherit",
});
const src = join(root, "engine/mancala/target/wasm32-unknown-unknown/release/mancala_engine.wasm");
const outDir = join(root, "apps/web/public/wasm");
mkdirSync(outDir, { recursive: true });
copyFileSync(src, join(outDir, "mancala.wasm"));
console.log(`mancala.wasm → apps/web/public/wasm (${(statSync(src).size / 1024).toFixed(1)} KB)`);

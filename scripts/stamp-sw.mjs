/**
 * Stamps a unique build-time cache name into public/sw.js.
 * Run as a prebuild step: "node scripts/stamp-sw.mjs && ..."
 *
 * Replaces the CACHE_NAME constant with a timestamp-based version so that
 * each deploy produces a distinct cache name, triggering the service worker
 * update flow (install → activate → clear old caches → claim clients).
 */

import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const swPath = resolve(__dirname, "..", "public", "sw.js");

const cacheName = `localseat-${Date.now()}`;
let src = readFileSync(swPath, "utf8");
src = src.replace(/const CACHE_NAME = "localseat-[^"]*"/, `const CACHE_NAME = "${cacheName}"`);
writeFileSync(swPath, src, "utf8");
console.log(`[stamp-sw] CACHE_NAME → ${cacheName}`);

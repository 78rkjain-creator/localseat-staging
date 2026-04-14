import sharp from "sharp";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const svg = readFileSync(resolve(root, "public/icons/icon.svg"));

const sizes = [192, 512];

for (const size of sizes) {
  const out = resolve(root, `public/icons/icon-${size}.png`);
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(out);
  console.log(`✓ ${out}`);
}

console.log("Icons generated.");

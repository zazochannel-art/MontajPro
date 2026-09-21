/**
 * Iconițele PWA, din aceeași formă ca marca din aplicație.
 *
 * Forma vine din `src/lib/brand.ts`, citit ca text: scriptul rulează cu Node
 * simplu, fără pasul de TypeScript, dar nu are voie să aibă o a doua copie a
 * desenului — o marcă schimbată într-un loc și nu în celălalt e exact felul de
 * greșeală pe care n-o vede nimeni până nu e pe telefoanele oamenilor.
 *
 *   node scripts/make-icons.mjs
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const source = await readFile("src/lib/brand.ts", "utf8");

/** Scoate o constantă șir din modulul mărcii. */
function constant(name) {
  const match = source.match(new RegExp(`${name} =\\s*\\n?\\s*"([^"]+)"`));
  if (!match) throw new Error(`nu găsesc ${name} în src/lib/brand.ts`);
  return match[1];
}
function number(name) {
  const match = source.match(new RegExp(`${name} = (\\d+(?:\\.\\d+)?)`));
  if (!match) throw new Error(`nu găsesc ${name} în src/lib/brand.ts`);
  return Number(match[1]);
}

const WOOD_PATH = constant("BRAND_WOOD_PATH");
const CONCRETE_PATH = constant("BRAND_CONCRETE_PATH");
const STAIRS_PATH = constant("BRAND_STAIRS_PATH");
const STAIRS_WIDTH = number("BRAND_STAIRS_WIDTH");
const WOOD = constant("BRAND_WOOD");
const CONCRETE = constant("BRAND_CONCRETE");
const W = number("BRAND_WIDTH");
const H = number("BRAND_HEIGHT");

const BG = "#09090B";

/** Marca, centrată pe un pătrat de `size`, lată cât `scale` din el. */
function svg(size, scale, background) {
  const markWidth = size * scale;
  const markHeight = (markWidth * H) / W;
  const dx = (size - markWidth) / 2;
  const dy = (size - markHeight) / 2;
  const k = markWidth / W;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${background ? `<rect width="${size}" height="${size}" fill="${background}"/>` : ""}
  <g transform="translate(${dx.toFixed(2)} ${dy.toFixed(2)}) scale(${k.toFixed(4)})">
    <path d="${STAIRS_PATH}" stroke="${CONCRETE}" stroke-width="${STAIRS_WIDTH}" fill="none" stroke-linejoin="miter" stroke-linecap="butt"/>
    <path d="${WOOD_PATH}" fill="${WOOD}"/>
    <path d="${CONCRETE_PATH}" fill="${CONCRETE}"/>
  </g>
</svg>`;
}

async function png(path, size, scale, background) {
  await writeFile(path, await sharp(Buffer.from(svg(size, scale, background))).png().toBuffer());
  console.log(`${path} — ${size}×${size}`);
}

await mkdir("public/icons", { recursive: true });

await png("public/icons/icon-192.png", 192, 0.82, BG);
await png("public/icons/icon-512.png", 512, 0.82, BG);
await png("public/icons/apple-touch-icon.png", 180, 0.78, BG);
await png("public/icons/favicon-32.png", 32, 0.92, BG);

// Cea „maskable" e tăiată de sistem într-un cerc: marca stă în zona sigură,
// adică în cele 80% din mijloc, altfel Android îi taie piciorul drept.
await png("public/icons/icon-maskable-512.png", 512, 0.58, BG);

// Marca singură, fără fundal — pentru documente și pentru pagina publică.
const bare = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <path d="${STAIRS_PATH}" stroke="${CONCRETE}" stroke-width="${STAIRS_WIDTH}" fill="none" stroke-linejoin="miter" stroke-linecap="butt"/>
  <path d="${WOOD_PATH}" fill="${WOOD}"/>
  <path d="${CONCRETE_PATH}" fill="${CONCRETE}"/>
</svg>`;
await writeFile("public/icons/mark.svg", bare);
console.log("public/icons/mark.svg");

/**
 * Iconițele PWA, desenate din aceeași formă ca marca din aplicație.
 *
 * Nu sunt o poză a logoului tipărit: la 32 de pixeli textura de lemn nu
 * înseamnă nimic, dar forma „M"-ului cu trepte rămâne recunoscibilă.
 *
 *   node scripts/make-icons.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";

const BG = "#09090B";
const WOOD = "#b5723e";
const CONCRETE = "#e8e6e0";

/** Marca, pe un pătrat de `size`, cu marca ocupând `scale` din el. */
function svg(size, scale, background) {
  const inner = Math.round(size * scale);
  const offset = Math.round((size - inner) / 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${background ? `<rect width="${size}" height="${size}" fill="${background}"/>` : ""}
  <g transform="translate(${offset} ${offset}) scale(${inner / 100})">
    <path d="M 12 90 L 12 14 L 50 60" stroke="${WOOD}" stroke-width="15" stroke-linejoin="miter" fill="none"/>
    <path d="M 50 60 L 88 14 L 88 90" stroke="${CONCRETE}" stroke-width="15" stroke-linejoin="miter" fill="none"/>
    <path d="M 48 70 L 40 70 L 40 77 L 32 77 L 32 84 L 24 84 L 24 90 L 48 90 Z" fill="${CONCRETE}"/>
  </g>
</svg>`;
}

async function png(path, size, scale, background) {
  const buffer = await sharp(Buffer.from(svg(size, scale, background))).png().toBuffer();
  await writeFile(path, buffer);
  console.log(`${path} — ${size}×${size}`);
}

await mkdir("public/icons", { recursive: true });

// Iconițele obișnuite: marca umple pătratul, cu o margine de respirație.
await png("public/icons/icon-192.png", 192, 0.72, BG);
await png("public/icons/icon-512.png", 512, 0.72, BG);
await png("public/icons/apple-touch-icon.png", 180, 0.68, BG);
await png("public/icons/favicon-32.png", 32, 0.86, BG);

// Cea „maskable" e tăiată de sistem într-un cerc: marca stă în zona sigură,
// adică în cele 80% din mijloc, altfel Android îi taie piciorul drept.
await png("public/icons/icon-maskable-512.png", 512, 0.52, BG);

// Marca singură, fără fundal — pentru pagina publică și pentru documente.
await writeFile("public/icons/mark.svg", svg(100, 1, null));
console.log("public/icons/mark.svg");

// Genera los íconos PWA (8 PNG + favicon) de FinTrack: glyph de billetera blanco
// sobre un degradado 135° azul marino → dorado apagado (la paleta de marca,
// Paso 56/57). Volver a correr si cambia la paleta:
//   node scripts/generate-pwa-icons.mjs
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = resolve(HERE, '../public/icons');
const PUBLIC_DIR = resolve(HERE, '../public');

const NAVY = '#243B53';
const GOLD = '#B08D57';
const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

// SVG cuadrado, parametrizado por lado. El glyph ocupa ~54% (safe zone maskable).
function iconSvg(size) {
  const r = Math.round(size * 0.22); // esquinas redondeadas
  const g = size * 0.23; // margen del glyph
  const gw = size - g * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${NAVY}"/>
      <stop offset="0.62" stop-color="${NAVY}"/>
      <stop offset="1" stop-color="${GOLD}"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${r}" fill="url(#bg)"/>
  <g transform="translate(${g} ${g}) scale(${gw / 24})" fill="#fff">
    <rect x="6.5" y="2.5" width="10" height="6.5" rx="1" opacity="0.5"/>
    <path fill-rule="evenodd" clip-rule="evenodd"
          d="M3 8.5A2.5 2.5 0 0 1 5.5 6h13A2.5 2.5 0 0 1 21 8.5v9A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5v-9Zm14 3a1.75 1.75 0 1 0 0 3.5 1.75 1.75 0 0 0 0-3.5Z"/>
  </g>
</svg>`;
}

await mkdir(ICONS_DIR, { recursive: true });

for (const size of SIZES) {
  const buf = Buffer.from(iconSvg(size));
  await sharp(buf).png().toFile(resolve(ICONS_DIR, `icon-${size}x${size}.png`));
  console.log(`icon-${size}x${size}.png`);
}

// favicon.ico (PNG dentro de .ico; los navegadores modernos lo aceptan)
await sharp(Buffer.from(iconSvg(48)))
  .png()
  .toFile(resolve(PUBLIC_DIR, 'favicon.ico'));
console.log('favicon.ico');

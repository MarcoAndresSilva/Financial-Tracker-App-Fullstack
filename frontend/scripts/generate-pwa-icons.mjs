// Genera los íconos PWA (8 PNG + favicon) de FinTrack: el mark de marca (línea
// de tendencia) en blanco sobre un degradado 135° azul marino → dorado apagado
// (la paleta de marca, Paso 56/57/58). Volver a correr si cambia la paleta:
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
  <g transform="translate(${g} ${g}) scale(${gw / 24})"
     fill="none" stroke="#fff" stroke-width="2.4"
     stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 20.5h18" opacity="0.35"/>
    <path d="M3.5 16.5 9 11l3.5 3.5L21 6"/>
    <path d="M15.5 6H21v5.5"/>
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

// Genera los íconos de la PWA (Android/iOS) y el favicon a partir del logo.
// Uso: node scripts/generate-icons.js
const sharp = require('sharp');
const pngToIco = require('png-to-ico');
const fs = require('fs');
const path = require('path');

const LOGO = path.join(__dirname, '../public/branding/logo-milan.png');
const ICONS_DIR = path.join(__dirname, '../public/icons');
const PUBLIC_DIR = path.join(__dirname, '../public');

const TAMANIOS_MANIFEST = [72, 96, 128, 144, 152, 192, 384, 512];

async function cuadradoBlanco(tamanio) {
  return sharp(LOGO)
    .resize(tamanio, tamanio, { fit: 'contain', background: '#ffffff' })
    .flatten({ background: '#ffffff' })
    .png()
    .toBuffer();
}

async function main() {
  fs.mkdirSync(ICONS_DIR, { recursive: true });

  // Íconos del manifest (Android / Chrome instalable)
  for (const tamanio of TAMANIOS_MANIFEST) {
    const buffer = await cuadradoBlanco(tamanio);
    fs.writeFileSync(path.join(ICONS_DIR, `icon-${tamanio}x${tamanio}.png`), buffer);
    console.log(`icon-${tamanio}x${tamanio}.png`);
  }

  // apple-touch-icon: iOS no lee el manifest para "Agregar a inicio", necesita este link propio.
  const appleIcon = await cuadradoBlanco(180);
  fs.writeFileSync(path.join(ICONS_DIR, 'apple-touch-icon.png'), appleIcon);
  console.log('apple-touch-icon.png');

  // Favicon de pestaña del navegador
  const favicon32 = await cuadradoBlanco(32);
  const favicon16 = await cuadradoBlanco(16);
  const icoBuffer = await pngToIco([favicon16, favicon32]);
  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.ico'), icoBuffer);
  console.log('favicon.ico');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

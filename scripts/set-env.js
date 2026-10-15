/**
 * Genera src/environments/environment.generated.ts (ignorado por git) con la apiKey de Firebase.
 *
 * Fuentes, en orden de prioridad:
 *   1. Variable de entorno del proceso NG_APP_FIREBASE_API_KEY (CI / deploy)
 *   2. Archivo .env en la raíz del proyecto
 *
 * Si no encuentra la key, genera el archivo vacío y avisa — no falla, para no romper `npm install`.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const KEY_NAME = 'NG_APP_FIREBASE_API_KEY';
const OUTPUT = path.join(ROOT, 'src', 'environments', 'environment.generated.ts');

function leerDotenv(archivo) {
  if (!fs.existsSync(archivo)) return {};
  const valores = {};
  for (const linea of fs.readFileSync(archivo, 'utf8').split(/\r?\n/)) {
    const m = linea.match(/^\s*([\w.]+)\s*=\s*(.*?)\s*$/);
    if (!m || linea.trim().startsWith('#')) continue;
    valores[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return valores;
}

function leerKeyGenerada() {
  if (!fs.existsSync(OUTPUT)) return '';
  const m = fs.readFileSync(OUTPUT, 'utf8').match(/firebaseApiKey = "([^"]+)"/);
  return m ? m[1] : '';
}

// Si no hay fuente nueva, conserva la key del archivo ya generado en vez de pisarla con vacío.
const apiKey =
  process.env[KEY_NAME] || leerDotenv(path.join(ROOT, '.env'))[KEY_NAME] || leerKeyGenerada();

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(
  OUTPUT,
  `// GENERADO por scripts/set-env.js — no editar ni commitear.\nexport const firebaseApiKey = ${JSON.stringify(apiKey)};\n`,
);

if (apiKey) {
  console.log(`[set-env] ${KEY_NAME} cargada -> ${path.relative(ROOT, OUTPUT)}`);
} else {
  console.warn(
    `[set-env] AVISO: ${KEY_NAME} no está definida. Crea un archivo .env con ${KEY_NAME}=<tu apiKey> y corre "npm run env".`,
  );
}

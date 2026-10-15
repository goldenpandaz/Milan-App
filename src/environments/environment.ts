import { firebaseApiKey } from './environment.generated';

/**
 * SECURITY: Environment configuration
 * - apiKey: generada por scripts/set-env.js desde .env o variable de entorno (ver `npm run env`)
 * - publicConfig: Safe to hardcode (no sensitive data)
 */
export const environment = {
  production: false,
  firebase: {
    // DO NOT commit real keys to source code
    apiKey: firebaseApiKey,
    databaseURL: 'https://milan-app-f4beb-default-rtdb.firebaseio.com',
    projectId: 'milan-app-f4beb',
  },
};

/**
 * SECURITY: Environment configuration
 * - apiKey: Provided by backend proxy or build-time environment variable
 * - publicConfig: Safe to hardcode (no sensitive data)
 */
export const environment = {
  production: false,
  firebase: {
    // API key MUST come from build-time environment variable or backend proxy
    // DO NOT commit real keys to source code
    apiKey: process.env['NG_APP_FIREBASE_API_KEY'] || '',
    databaseURL: 'https://milan-app-f4beb-default-rtdb.firebaseio.com',
    projectId: 'milan-app-f4beb',
  },
};

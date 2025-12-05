const path = require('path');
const dotenv = require('dotenv');
const { pathToFileURL } = require('url');

let lookupModulePromise = null;
let envLoaded = false;

const resolveLookupModule = () => {
  if (!lookupModulePromise) {
    const modulePath = path.resolve(
      __dirname,
      '../7ZAP_SCRAPER/dist/lookup.js'
    );
    lookupModulePromise = import(pathToFileURL(modulePath).href);
  }
  return lookupModulePromise;
};

const ensureZapEnv = () => {
  if (!envLoaded) {
    const envPath = path.resolve(__dirname, '../7ZAP_SCRAPER/.env');
    dotenv.config({ path: envPath, override: false });
    envLoaded = true;
  }

  if (!process.env.HEADLESS) {
    process.env.HEADLESS = 'true';
  }
  process.env.KEEP_BROWSER_OPEN = 'false';
  if (!process.env.DEBUG) {
    process.env.DEBUG = 'false';
  }
};

async function runPartsLookup({ vin, prestationKey }) {
  if (!vin || !prestationKey) {
    throw new Error('vin et prestationKey sont requis');
  }

  ensureZapEnv();
  const { lookupVin } = await resolveLookupModule();

  const result = await lookupVin({
    vin,
    prestation: prestationKey,
    keepBrowserOpen: false,
    screenshots: false,
  });

  if (!result) {
    throw new Error("Aucun résultat n'a été retourné par le scraper 7ZAP.");
  }

  return result;
}

module.exports = { runPartsLookup };


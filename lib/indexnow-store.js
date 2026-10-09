import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SETTINGS_FILE = path.join(__dirname, '..', 'data', 'indexnow.json');

const DEFAULT_SETTINGS = {
  key: process.env.INDEXNOW_KEY || 'streamhubindexnow2026auto789',
  bing: {
    enabled: true
  },
  yandex: {
    enabled: true
  },
  indexnowOrg: {
    enabled: true
  },
  autoSubmitOnNewVideo: true,
  lastSubmission: null
};

let settingsCache = null;

export function getIndexNowSettings() {
  if (settingsCache) return settingsCache;

  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, 'utf8');
      settingsCache = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
      return settingsCache;
    }
  } catch (err) {
    console.warn('[IndexNowStore] Could not read indexnow.json:', err.message);
  }

  settingsCache = { ...DEFAULT_SETTINGS };
  return settingsCache;
}

export function saveIndexNowSettings(newSettings) {
  const current = getIndexNowSettings();
  const merged = {
    ...current,
    ...newSettings,
    key: (newSettings.key && newSettings.key.trim()) || current.key,
    bing: { ...current.bing, ...newSettings.bing },
    yandex: { ...current.yandex, ...newSettings.yandex },
    indexnowOrg: { ...current.indexnowOrg, ...newSettings.indexnowOrg }
  };

  settingsCache = merged;

  try {
    const dir = path.dirname(SETTINGS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(merged, null, 2), 'utf8');
    return { success: true, settings: merged };
  } catch (err) {
    console.warn('[IndexNowStore] Could not persist indexnow.json:', err.message);
    return { success: true, settings: merged, persisted: false };
  }
}

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ADS_FILE = path.join(__dirname, '..', 'data', 'ads.json');

const DEFAULT_ADS = {
  header: {
    enabled: true,
    type: 'banner',
    link: 'https://link-iklan-anda.com',
    image: '',
    customHtml: ''
  },
  underPlayer: {
    enabled: true,
    type: 'banner',
    link: 'https://link-iklan-anda.com',
    image: '',
    customHtml: ''
  },
  footer: {
    enabled: true,
    type: 'banner',
    link: 'https://link-iklan-anda.com',
    image: '',
    customHtml: ''
  },
  floating: {
    enabled: true,
    text: 'Pasang Link Promosi / Iklan Melayang Anda di Sini! Klik Untuk Membuka',
    link: 'https://link-iklan-anda.com'
  },
  popunder: {
    enabled: false,
    link1: '',
    link2: '',
    link3: '',
    link: '',
    mode: 'random'
  },
  histats: {
    enabled: true,
    code: ''
  }
};

let adsCache = null;

export function getAdsConfig() {
  if (adsCache) return adsCache;

  try {
    if (fs.existsSync(ADS_FILE)) {
      const raw = fs.readFileSync(ADS_FILE, 'utf8');
      adsCache = { ...DEFAULT_ADS, ...JSON.parse(raw) };
      return adsCache;
    }
  } catch (err) {
    console.warn('[AdsStore] Could not read ads.json:', err.message);
  }

  adsCache = { ...DEFAULT_ADS };
  return adsCache;
}

export function saveAdsConfig(newConfig) {
  const current = getAdsConfig();
  const merged = {
    ...current,
    ...newConfig
  };

  adsCache = merged;

  try {
    const dir = path.dirname(ADS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(ADS_FILE, JSON.stringify(merged, null, 2), 'utf8');
    return { success: true, config: merged };
  } catch (err) {
    console.warn('[AdsStore] Could not persist ads.json (read-only filesystem?):', err.message);
    return { success: true, config: merged, warning: 'Saved in memory only' };
  }
}

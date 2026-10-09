import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, '..', 'data', 'videos.json');

const deadHosts = [
  'playmogo.com' // 403 Forbidden dead embed
];

const videos = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const initialCount = videos.length;

// Filter out dead videos
const cleaned = videos.filter(v => {
  if (!v.iframe_url || !v.iframe_url.trim()) return false;
  try {
    const url = new URL(v.iframe_url);
    if (deadHosts.includes(url.hostname)) {
      console.log(`Menghapus video #${v.id} (${v.title}) - Host mati: ${url.hostname}`);
      return false;
    }
  } catch {
    return false;
  }
  return true;
});

// Re-index IDs consecutively
cleaned.forEach((v, idx) => {
  v.id = idx + 1;
});

fs.writeFileSync(DATA_FILE, JSON.stringify(cleaned), 'utf8');
console.log(`Pembersihan selesai! Jumlah awal: ${initialCount}, Jumlah sekarang: ${cleaned.length} (Dihapus: ${initialCount - cleaned.length})`);

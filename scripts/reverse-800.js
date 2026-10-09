import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CSV_FILE = 'C:\\Users\\Ghufron\\Downloads\\scrapperweb\\2026-10-09_11-06-02-output.csv';
const JSON_FILE = path.join(__dirname, '..', 'data', 'videos.json');

function cleanField(str) {
  if (!str) return '';
  let s = str.trim();
  if (s.startsWith('"') && s.endsWith('"')) {
    s = s.slice(1, -1);
  }
  return s.replace(/""/g, '"').trim();
}

function slugify(text, id) {
  const clean = (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return clean ? `${clean}-${id}` : `video-${id}`;
}

const content = fs.readFileSync(CSV_FILE, 'utf8');
const lines = content.split(/\r?\n/).filter(Boolean);

// First line is header
const rows = lines.slice(1);
console.log('Total data rows in CSV:', rows.length);

// Reverse first 800 (from no 800 to no 1)
const rowsFirst800 = rows.slice(0, 800).reverse();
const rowsRemaining = rows.slice(800);
const allRows = [...rowsFirst800, ...rowsRemaining];

console.log('Total combined rows:', allRows.length);

const list = [];
for (let i = 0; i < allRows.length; i++) {
  const line = allRows[i].trim();
  if (!line) continue;
  const parts = line.split('|');
  if (parts.length >= 4) {
    const id = i + 1;
    const title = cleanField(parts[0]);
    const imageUrl = cleanField(parts[1]);
    const videoUrl = cleanField(parts[2]);
    const iframeUrl = cleanField(parts.slice(3).join('|'));

    let slug = '';
    const match = videoUrl.match(/\/watch\/([^\/]+)/);
    if (match) slug = match[1];
    else slug = slugify(title, id);

    list.push({
      id,
      title,
      slug,
      image_url: imageUrl,
      video_url: videoUrl,
      iframe_url: iframeUrl
    });
  }
}

console.log('Built items count:', list.length);
console.log('Video #1 (sebelumnya #800):', list[0].id, list[0].title);
console.log('Video #800 (sebelumnya #1):', list[799].id, list[799].title);
console.log('Video #801:', list[800].id, list[800].title);
console.log('Video #19200:', list[list.length - 1].id, list[list.length - 1].title);

fs.writeFileSync(JSON_FILE, JSON.stringify(list), 'utf8');
console.log('data/videos.json updated successfully.');

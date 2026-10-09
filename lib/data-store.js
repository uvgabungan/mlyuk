import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_FILE = path.join(__dirname, '..', 'data', 'videos.json');
const CSV_FILE = 'C:\\Users\\Ghufron\\Downloads\\scrapperweb\\2026-10-09_11-06-02-output.csv';

let videosList = [];
let idMap = new Map();
let slugMap = new Map();
let isInitialized = false;

/**
 * Clean quoted or raw CSV field
 */
function cleanField(str) {
  if (!str) return '';
  let s = str.trim();
  if (s.startsWith('"') && s.endsWith('"')) {
    s = s.slice(1, -1);
  }
  return s.replace(/""/g, '"').trim();
}

/**
 * Generate clean URL slug from title
 */
function slugify(text, id) {
  const clean = (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return clean ? `${clean}-${id}` : `video-${id}`;
}

/**
 * Initialize data from videos.json or CSV fallback
 */
export function initDataStore() {
  if (isInitialized) return videosList.length;

  try {
    if (fs.existsSync(DATA_FILE)) {
      console.log(`[DataStore] Loading videos from JSON: ${DATA_FILE}...`);
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      videosList = JSON.parse(raw);
    } else if (fs.existsSync(CSV_FILE)) {
      console.log(`[DataStore] JSON not found, parsing CSV: ${CSV_FILE}...`);
      const content = fs.readFileSync(CSV_FILE, 'utf8');
      const lines = content.split(/\r?\n/);
      let count = 0;
      let isFirst = true;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        if (isFirst) {
          isFirst = false;
          if (line.toLowerCase().includes('title')) continue;
        }

        const parts = line.split('|');
        if (parts.length >= 4) {
          count++;
          const title = cleanField(parts[0]);
          const imageUrl = cleanField(parts[1]);
          const videoUrl = cleanField(parts[2]);
          const iframeUrl = cleanField(parts.slice(3).join('|'));

          let slug = '';
          const match = videoUrl.match(/\/watch\/([^\/]+)/);
          if (match) slug = match[1];
          else slug = slugify(title, count);

          videosList.push({
            id: count,
            title,
            slug,
            image_url: imageUrl,
            video_url: videoUrl,
            iframe_url: iframeUrl
          });
        }
      }

      // Save generated JSON
      try {
        const dir = path.dirname(DATA_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(DATA_FILE, JSON.stringify(videosList), 'utf8');
      } catch (err) {
        console.warn('[DataStore] Could not cache videos.json:', err.message);
      }
    }
  } catch (err) {
    console.error('[DataStore] Failed to initialize data store:', err);
    videosList = [];
  }

  // Build Map indexes
  idMap.clear();
  slugMap.clear();
  for (let i = 0; i < videosList.length; i++) {
    const item = videosList[i];
    idMap.set(item.id, item);
    if (item.slug) {
      slugMap.set(item.slug, item);
    }
  }

  isInitialized = true;
  console.log(`[DataStore] Loaded ${videosList.length} videos successfully.`);
  return videosList.length;
}

// Auto init on import
initDataStore();

/**
 * Get paginated videos with optional search query & sort
 */
export function getVideos({ page = 1, limit = 24, query = '', sort = 'latest' } = {}) {
  initDataStore();
  const pageNum = Math.max(1, parseInt(page) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(limit) || 24));

  let filtered = videosList;

  if (query && query.trim()) {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    filtered = videosList.filter(item => {
      const titleLower = item.title.toLowerCase();
      return terms.every(term => titleLower.includes(term));
    });
  }

  // Sort
  if (sort === 'oldest') {
    filtered = [...filtered].sort((a, b) => a.id - b.id);
  } else if (sort === 'title_asc') {
    filtered = [...filtered].sort((a, b) => a.title.localeCompare(b.title));
  } else if (sort === 'title_desc') {
    filtered = [...filtered].sort((a, b) => b.title.localeCompare(a.title));
  } else if (sort === 'random') {
    // Return a random shuffle sample
    filtered = [...filtered].sort(() => 0.5 - Math.random());
  } else {
    // Default: latest (highest id first)
    if (query) {
      // If filtered, sort by id descending
      filtered = [...filtered].sort((a, b) => b.id - a.id);
    } else {
      // If full array, it is ordered 1..N or N..1
      // We slice backwards or reverse
      // In videosList, items are ordered id 1..19200
      // Latest means 19200 down to 1
      const total = videosList.length;
      const offset = (pageNum - 1) * pageSize;
      const startIndex = Math.max(0, total - offset - pageSize);
      const endIndex = total - offset;
      
      const items = videosList.slice(startIndex, endIndex).reverse();
      const totalPages = Math.ceil(total / pageSize);
      return {
        items,
        pagination: {
          page: pageNum,
          limit: pageSize,
          total,
          totalPages,
          hasNext: pageNum < totalPages,
          hasPrev: pageNum > 1
        }
      };
    }
  }

  const total = filtered.length;
  const totalPages = Math.ceil(total / pageSize);
  const offset = (pageNum - 1) * pageSize;
  const items = filtered.slice(offset, offset + pageSize);

  return {
    items,
    pagination: {
      page: pageNum,
      limit: pageSize,
      total,
      totalPages,
      hasNext: pageNum < totalPages,
      hasPrev: pageNum > 1
    }
  };
}

/**
 * Get video details by ID or Slug
 */
export function getVideoByIdOrSlug(idOrSlug) {
  initDataStore();
  if (!idOrSlug) return null;

  // Try numeric ID
  const numericId = Number(idOrSlug);
  if (!isNaN(numericId) && idMap.has(numericId)) {
    return idMap.get(numericId);
  }

  // Try slug
  const str = String(idOrSlug).toLowerCase().trim();
  if (slugMap.has(str)) {
    return slugMap.get(str);
  }

  // Fallback: check if ends with -id
  const match = str.match(/-(\d+)$/);
  if (match) {
    const idFromEnd = Number(match[1]);
    if (idMap.has(idFromEnd)) return idMap.get(idFromEnd);
  }

  return null;
}

/**
 * Get related videos based on title keywords
 */
export function getRelatedVideos(idOrSlug, limit = 10) {
  initDataStore();
  const current = getVideoByIdOrSlug(idOrSlug);
  if (!current) return [];

  const stopWords = new Set(['bokep', 'video', 'full', 'terbaru', 'viral', 'banget', 'sama', 'yang', 'dari', 'lagi', 'bisa', 'main', 'pakai']);
  const words = current.title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 4 && !stopWords.has(w));

  const results = [];
  const currentId = current.id;

  if (words.length > 0) {
    const searchWords = words.slice(0, 3);
    for (let i = videosList.length - 1; i >= 0; i--) {
      const candidate = videosList[i];
      if (candidate.id === currentId) continue;
      const titleLower = candidate.title.toLowerCase();
      if (searchWords.some(w => titleLower.includes(w))) {
        results.push(candidate);
        if (results.length >= limit) break;
      }
    }
  }

  // Fallback to recent videos if needed
  if (results.length < limit) {
    const needed = limit - results.length;
    const existingIds = new Set([currentId, ...results.map(r => r.id)]);
    for (let i = videosList.length - 1; i >= 0 && results.length < limit; i--) {
      const candidate = videosList[i];
      if (!existingIds.has(candidate.id)) {
        results.push(candidate);
      }
    }
  }

  return results;
}

/**
 * Get random video
 */
export function getRandomVideo() {
  initDataStore();
  if (videosList.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * videosList.length);
  return videosList[randomIndex];
}

/**
 * Get stats
 */
export function getStats() {
  initDataStore();
  return {
    totalVideos: videosList.length,
    totalSitemaps: Math.ceil(videosList.length / 5000),
    initialized: isInitialized
  };
}

/**
 * Get all videos list (read-only reference)
 */
export function getAllVideos() {
  initDataStore();
  return videosList;
}

/**
 * Persist in-memory store to data/videos.json
 */
export function persistDataStore() {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(videosList), 'utf8');
    return true;
  } catch (err) {
    console.warn('[DataStore] Could not persist to videos.json (read-only environment?):', err.message);
    return false;
  }
}

/**
 * Add a single video
 */
export function addVideo({ title, image_url = '', iframe_url = '', video_url = '', slug = '' }) {
  initDataStore();
  if (!title || !title.trim()) {
    throw new Error('Judul video wajib diisi.');
  }

  // Calculate highest ID
  let maxId = 0;
  for (let i = 0; i < videosList.length; i++) {
    if (videosList[i].id > maxId) maxId = videosList[i].id;
  }
  const newId = maxId + 1;

  const generatedSlug = slug && slug.trim()
    ? slug.trim()
    : slugify(title.trim(), newId);

  const newVideo = {
    id: newId,
    title: title.trim(),
    slug: generatedSlug,
    image_url: image_url.trim(),
    video_url: video_url.trim() || `https://streamhub.local/watch/${generatedSlug}`,
    iframe_url: iframe_url.trim()
  };

  videosList.push(newVideo);
  idMap.set(newVideo.id, newVideo);
  slugMap.set(newVideo.slug, newVideo);

  persistDataStore();
  return newVideo;
}

/**
 * Delete a video by ID or Slug
 */
export function deleteVideo(idOrSlug) {
  initDataStore();
  const existing = getVideoByIdOrSlug(idOrSlug);
  if (!existing) return false;

  const targetId = existing.id;
  const targetSlug = existing.slug;

  const index = videosList.findIndex(v => v.id === targetId);
  if (index !== -1) {
    videosList.splice(index, 1);
  }

  idMap.delete(targetId);
  if (targetSlug) slugMap.delete(targetSlug);

  persistDataStore();
  return true;
}

/**
 * Bulk import from CSV string or lines
 */
export function bulkImportVideos(csvContent) {
  initDataStore();
  if (!csvContent) return 0;

  const lines = csvContent.split(/\r?\n/);
  let importedCount = 0;

  let maxId = 0;
  for (let i = 0; i < videosList.length; i++) {
    if (videosList[i].id > maxId) maxId = videosList[i].id;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.toLowerCase().startsWith('"title"') || line.toLowerCase().startsWith('title|')) continue;

    const parts = line.split('|');
    if (parts.length >= 4) {
      maxId++;
      const title = cleanField(parts[0]);
      const imageUrl = cleanField(parts[1]);
      const videoUrl = cleanField(parts[2]);
      const iframeUrl = cleanField(parts.slice(3).join('|'));

      let slug = '';
      const match = videoUrl.match(/\/watch\/([^\/]+)/);
      if (match) slug = match[1];
      else slug = slugify(title, maxId);

      const item = {
        id: maxId,
        title,
        slug,
        image_url: imageUrl,
        video_url: videoUrl,
        iframe_url: iframeUrl
      };

      videosList.push(item);
      idMap.set(item.id, item);
      if (item.slug) slugMap.set(item.slug, item);
      importedCount++;
    }
  }

  if (importedCount > 0) {
    persistDataStore();
  }

  return importedCount;
}


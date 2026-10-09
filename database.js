import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import readline from 'node:readline';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, 'videos.db');
const DEFAULT_CSV_PATH = 'C:\\Users\\Ghufron\\Downloads\\scrapperweb\\2026-10-09_11-06-02-output.csv';

let dbInstance = null;

export function getDatabase() {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(DB_PATH);
    initTables(dbInstance);
  }
  return dbInstance;
}

function initTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS videos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      image_url TEXT,
      video_url TEXT,
      iframe_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_videos_title ON videos(title);
    CREATE INDEX IF NOT EXISTS idx_videos_id ON videos(id);
  `);
}

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
 * Import videos from CSV if table is empty
 */
export async function seedDatabaseIfEmpty(csvPath = DEFAULT_CSV_PATH) {
  const db = getDatabase();
  
  const countRow = db.prepare('SELECT COUNT(*) as count FROM videos').get();
  if (countRow && countRow.count > 0) {
    console.log(`[Database] Already initialized with ${countRow.count} videos.`);
    return countRow.count;
  }

  if (!fs.existsSync(csvPath)) {
    console.warn(`[Database] CSV file not found at: ${csvPath}`);
    return 0;
  }

  console.log(`[Database] Importing CSV data from: ${csvPath}...`);
  const startTime = Date.now();

  const fileStream = fs.createReadStream(csvPath, { encoding: 'utf8' });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const insertStmt = db.prepare(`
    INSERT INTO videos (title, image_url, video_url, iframe_url)
    VALUES (?, ?, ?, ?)
  `);

  db.exec('BEGIN TRANSACTION');

  let inserted = 0;
  let isFirstLine = true;

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (isFirstLine) {
      isFirstLine = false;
      // Skip header if it contains Title
      if (trimmed.toLowerCase().includes('title')) {
        continue;
      }
    }

    // Split by pipe '|'
    const parts = trimmed.split('|');
    if (parts.length >= 4) {
      const title = cleanField(parts[0]);
      const imageUrl = cleanField(parts[1]);
      const videoUrl = cleanField(parts[2]);
      // If there are more parts due to pipe inside iframe or URL, rejoin the rest
      const iframeUrl = cleanField(parts.slice(3).join('|'));

      if (title) {
        insertStmt.run(title, imageUrl, videoUrl, iframeUrl);
        inserted++;
      }
    }
  }

  db.exec('COMMIT');
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`[Database] Successfully imported ${inserted} videos in ${elapsed}s!`);
  return inserted;
}

/**
 * Get paginated videos with optional search query & sort
 */
export function getVideos({ page = 1, limit = 24, query = '', sort = 'latest' } = {}) {
  const db = getDatabase();
  const pageNum = Math.max(1, parseInt(page) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(limit) || 24));
  const offset = (pageNum - 1) * pageSize;

  let whereClause = '';
  const params = [];

  if (query && query.trim()) {
    const words = query.trim().split(/\s+/).filter(Boolean);
    const conditions = words.map(() => 'title LIKE ?');
    whereClause = 'WHERE ' + conditions.join(' AND ');
    words.forEach(w => params.push(`%${w}%`));
  }

  let orderBy = 'ORDER BY id DESC';
  if (sort === 'oldest') {
    orderBy = 'ORDER BY id ASC';
  } else if (sort === 'title_asc') {
    orderBy = 'ORDER BY title ASC';
  } else if (sort === 'title_desc') {
    orderBy = 'ORDER BY title DESC';
  } else if (sort === 'random') {
    orderBy = 'ORDER BY RANDOM()';
  }

  const countSql = `SELECT COUNT(*) as total FROM videos ${whereClause}`;
  const totalRow = db.prepare(countSql).get(...params);
  const total = totalRow ? totalRow.total : 0;
  const totalPages = Math.ceil(total / pageSize);

  const dataSql = `
    SELECT id, title, image_url, video_url, iframe_url
    FROM videos
    ${whereClause}
    ${orderBy}
    LIMIT ? OFFSET ?
  `;

  const items = db.prepare(dataSql).all(...params, pageSize, offset);

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
 * Get video details by ID
 */
export function getVideoById(id) {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM videos WHERE id = ?');
  return stmt.get(Number(id));
}

/**
 * Get related videos based on title keywords
 */
export function getRelatedVideos(id, limit = 10) {
  const db = getDatabase();
  const current = getVideoById(id);
  if (!current) return [];

  // Extract meaningful words from title (length >= 4, ignoring common stop words)
  const stopWords = new Set(['bokep', 'video', 'full', 'terbaru', 'viral', 'banget', 'sama', 'yang', 'dari', 'lagi', 'bisa', 'main', 'pakai']);
  const words = current.title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 4 && !stopWords.has(w));

  let results = [];
  if (words.length > 0) {
    // Search with first 2-3 most distinctive words
    const searchWord = words.slice(0, 3);
    const conditions = searchWord.map(() => 'title LIKE ?').join(' OR ');
    const params = searchWord.map(w => `%${w}%`);
    params.push(Number(id), Number(limit));

    const sql = `
      SELECT id, title, image_url, video_url, iframe_url
      FROM videos
      WHERE (${conditions}) AND id != ?
      ORDER BY id DESC
      LIMIT ?
    `;
    try {
      results = db.prepare(sql).all(...params);
    } catch {
      results = [];
    }
  }

  // Fallback if no matching keyword videos found: get recent videos
  if (results.length < limit) {
    const needed = limit - results.length;
    const existingIds = [Number(id), ...results.map(r => r.id)];
    const placeholders = existingIds.map(() => '?').join(',');
    const fallbackSql = `
      SELECT id, title, image_url, video_url, iframe_url
      FROM videos
      WHERE id NOT IN (${placeholders})
      ORDER BY id DESC
      LIMIT ?
    `;
    const more = db.prepare(fallbackSql).all(...existingIds, needed);
    results = results.concat(more);
  }

  return results;
}

/**
 * Get random video (for "Surprise Me / Random Play")
 */
export function getRandomVideo() {
  const db = getDatabase();
  return db.prepare('SELECT * FROM videos ORDER BY RANDOM() LIMIT 1').get();
}

/**
 * Get system stats
 */
export function getStats() {
  const db = getDatabase();
  const countRow = db.prepare('SELECT COUNT(*) as total FROM videos').get();
  return {
    totalVideos: countRow ? countRow.total : 0
  };
}

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getVideos,
  getVideoByIdOrSlug,
  getRelatedVideos,
  getRandomVideo,
  getStats,
  getAllVideos,
  addVideo,
  deleteVideo,
  bulkImportVideos
} from '../lib/data-store.js';
import {
  INDEXNOW_KEY,
  generateRobotsTxt,
  generateSitemapIndex,
  generatePagesSitemap,
  generateVideoSitemapChunk,
  generateAllSitemap,
  generateVideoJsonLd,
  submitToIndexNow,
  pingSearchEngines
} from '../lib/seo.js';
import { getAdsConfig, saveAdsConfig } from '../lib/ads-store.js';
import { getIndexNowSettings, saveIndexNowSettings } from '../lib/indexnow-store.js';
import {
  validateLogin,
  createSessionToken,
  getSessionFromRequest
} from '../lib/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(data));
}

function sendXml(res, xml) {
  res.writeHead(200, {
    'Content-Type': 'application/xml; charset=utf-8',
    'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(xml);
}

function sendText(res, text) {
  res.writeHead(200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(text);
}

function getBaseUrl(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
  const proto = req.headers['x-forwarded-proto'] || (host.includes('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

async function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch {}
  }
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

/**
 * Render Watch Page with Full SEO & VideoObject JSON-LD
 */
function renderWatchPage(res, video, req) {
  const baseUrl = getBaseUrl(req);
  const watchHtmlPath = path.join(PUBLIC_DIR, 'watch.html');
  let html = fs.existsSync(watchHtmlPath)
    ? fs.readFileSync(watchHtmlPath, 'utf8')
    : '<html><head><title>Watch</title></head><body><h1>Watch</h1></body></html>';

  if (!video) {
    // 404
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html.replace('<title>MLyuk</title>', '<title>Video Tidak Ditemukan - MLyuk</title>'));
    return;
  }

  const title = `${video.title} - Nonton Streaming HD | MLyuk`;
  const description = `Nonton streaming online ${video.title} kualitas HD tanpa buffering. Tonton gratis di MLyuk sekarang!`;
  const canonicalUrl = `${baseUrl}/watch/${video.slug || video.id}`;
  const jsonLd = generateVideoJsonLd(video, baseUrl);

  // Replace or inject SEO tags into HTML head
  const seoHead = `
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <meta name="robots" content="index, follow, max-image-preview:large, max-video-preview:-1" />
  <link rel="canonical" href="${canonicalUrl}" />
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="video.other" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:title" content="${video.title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${video.image_url}" />
  <meta property="og:site_name" content="MLyuk" />
  <meta property="og:video" content="${video.iframe_url || canonicalUrl}" />
  <meta property="og:video:type" content="text/html" />
  <meta property="og:video:width" content="1280" />
  <meta property="og:video:height" content="720" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="player" />
  <meta name="twitter:url" content="${canonicalUrl}" />
  <meta name="twitter:title" content="${video.title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${video.image_url}" />
  <meta name="twitter:player" content="${video.iframe_url || canonicalUrl}" />
  <meta name="twitter:player:width" content="1280" />
  <meta name="twitter:player:height" content="720" />

  <!-- Search Engine Verification -->
  <meta name="google-site-verification" content="${process.env.GOOGLE_SITE_VERIFICATION || ''}" />
  <meta name="yandex-verification" content="${process.env.YANDEX_VERIFICATION || ''}" />
  <meta name="msvalidate.01" content="${process.env.BING_SITE_VERIFICATION || ''}" />

  <!-- Schema.org VideoObject JSON-LD for Google Rich Results -->
  <script type="application/ld+json">
  ${jsonLd}
  </script>

  <!-- Server Preloaded Video State -->
  <script>
    window.__INITIAL_VIDEO__ = ${JSON.stringify(video)};
  </script>
  `;

  // Inject into head
  if (html.includes('<title>')) {
    html = html.replace(/<title>[\s\S]*?<\/title>/i, seoHead);
  } else {
    html = html.replace('</head>', `${seoHead}\n</head>`);
  }

  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'
  });
  res.end(html);
}

// Optional image proxy to bypass referrer or ISP blocks
async function handleImageProxy(req, res, targetUrl) {
  if (!targetUrl || !targetUrl.startsWith('http')) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Invalid URL parameter');
    return;
  }

  try {
    const upstreamRes = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      }
    });

    if (!upstreamRes.ok) {
      res.writeHead(upstreamRes.status, { 'Content-Type': 'text/plain' });
      res.end('Failed to fetch image upstream');
      return;
    }

    const contentType = upstreamRes.headers.get('content-type') || 'image/jpeg';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=604800, immutable'
    });

    const arrayBuffer = await upstreamRes.arrayBuffer();
    res.end(Buffer.from(arrayBuffer));
  } catch (err) {
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('Error fetching remote image: ' + err.message);
  }
}

/**
 * Main Serverless & HTTP Handler
 */
export default async function handler(req, res) {
  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = reqUrl.pathname;
  const baseUrl = getBaseUrl(req);
  const host = new URL(baseUrl).host;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 1. Robots.txt
  if (pathname === '/robots.txt') {
    sendText(res, generateRobotsTxt(baseUrl));
    return;
  }

  // 2. IndexNow Verification File (e.g. /streamhubindexnow2026auto789.txt or /indexnow-key.txt)
  if (pathname === `/${INDEXNOW_KEY}.txt` || pathname === '/indexnow-key.txt') {
    sendText(res, INDEXNOW_KEY);
    return;
  }
  // Any custom *.txt key request
  if (pathname.endsWith('.txt') && pathname.length > 5 && !pathname.includes('robots')) {
    const requestedKey = pathname.replace(/^\//, '').replace(/\.txt$/, '');
    sendText(res, requestedKey);
    return;
  }

  // 3. Sitemaps
  if (pathname === '/sitemap.xml' || pathname === '/sitemap_index.xml') {
    sendXml(res, generateSitemapIndex(baseUrl));
    return;
  }

  if (pathname === '/sitemap/pages.xml') {
    sendXml(res, generatePagesSitemap(baseUrl));
    return;
  }

  const chunkMatch = pathname.match(/^\/sitemap\/videos-(\d+)\.xml$/);
  if (chunkMatch) {
    const chunkIndex = parseInt(chunkMatch[1]) || 1;
    sendXml(res, generateVideoSitemapChunk(chunkIndex, baseUrl));
    return;
  }

  if (pathname === '/sitemap-all.xml') {
    sendXml(res, generateAllSitemap(baseUrl));
    return;
  }

  // 4. API Routes
  if (pathname === '/api/videos') {
    if (req.method === 'POST') {
      try {
        const body = await parseBody(req);
        const newVideo = addVideo({
          title: body.title,
          image_url: body.image_url,
          iframe_url: body.iframe_url,
          video_url: body.video_url,
          slug: body.slug
        });

        let indexNowResult = null;
        if (body.submit_indexnow) {
          const watchUrl = `${baseUrl}/watch/${newVideo.slug || newVideo.id}`;
          try {
            indexNowResult = await submitToIndexNow({ host, urls: [watchUrl] });
          } catch (e) {
            indexNowResult = { error: e.message };
          }
        }

        sendJson(res, 201, {
          success: true,
          message: 'Video berhasil ditambahkan!',
          video: newVideo,
          indexNow: indexNowResult
        });
      } catch (err) {
        sendJson(res, 400, { success: false, error: err.message });
      }
      return;
    }

    const page = parseInt(reqUrl.searchParams.get('page')) || 1;
    const limit = parseInt(reqUrl.searchParams.get('limit')) || 24;
    const query = reqUrl.searchParams.get('q') || reqUrl.searchParams.get('search') || '';
    const sort = reqUrl.searchParams.get('sort') || 'latest';

    const result = getVideos({ page, limit, query, sort });
    sendJson(res, 200, result);
    return;
  }

  if (pathname === '/api/videos/import' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const csvData = body.csv || '';
      const importedCount = bulkImportVideos(csvData);
      sendJson(res, 200, {
        success: true,
        message: `Berhasil mengimpor ${importedCount} video baru!`,
        importedCount
      });
    } catch (err) {
      sendJson(res, 500, { success: false, error: err.message });
    }
    return;
  }

  if (pathname.startsWith('/api/videos/')) {
    const idOrSlug = pathname.replace('/api/videos/', '');

    if (req.method === 'DELETE') {
      const success = deleteVideo(idOrSlug);
      if (success) {
        sendJson(res, 200, { success: true, message: `Video #${idOrSlug} berhasil dihapus!` });
      } else {
        sendJson(res, 404, { success: false, error: 'Video tidak ditemukan.' });
      }
      return;
    }

    const video = getVideoByIdOrSlug(idOrSlug);
    if (!video) {
      sendJson(res, 404, { error: 'Video not found' });
    } else {
      sendJson(res, 200, video);
    }
    return;
  }

  if (pathname.startsWith('/api/related/')) {
    const idOrSlug = pathname.replace('/api/related/', '');
    const limit = parseInt(reqUrl.searchParams.get('limit')) || 8;
    const related = getRelatedVideos(idOrSlug, limit);
    sendJson(res, 200, related);
    return;
  }

  if (pathname === '/api/random') {
    const random = getRandomVideo();
    sendJson(res, 200, random);
    return;
  }

  if (pathname === '/api/stats') {
    const stats = getStats();
    sendJson(res, 200, stats);
    return;
  }

  // Ads API (Get & Update Ads Configuration)
  if (pathname === '/api/ads') {
    if (req.method === 'POST') {
      try {
        const body = await parseBody(req);
        const result = saveAdsConfig(body);
        sendJson(res, 200, {
          success: true,
          message: 'Pengaturan iklan berhasil disimpan!',
          config: result.config
        });
      } catch (err) {
        sendJson(res, 500, { success: false, error: err.message });
      }
      return;
    } else {
      const config = getAdsConfig();
      sendJson(res, 200, config);
      return;
    }
  }

  // 4b. Vercel 1-Click Deploy Webhook Trigger API
  if (pathname === '/api/admin/deploy' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const hookUrl = (body.hookUrl || process.env.VERCEL_DEPLOY_HOOK_URL || '').trim();

      if (!hookUrl || !hookUrl.startsWith('http')) {
        sendJson(res, 400, {
          success: false,
          error: 'URL Vercel Deploy Hook belum diatur. Silakan atur URL Deploy Hook di panel admin.'
        });
        return;
      }

      console.log('[Deploy] Triggering Vercel Deploy Hook...');
      const hookRes = await fetch(hookUrl, { method: 'POST' });
      const hookData = await hookRes.json().catch(() => ({}));

      if (!hookRes.ok) {
        sendJson(res, hookRes.status, {
          success: false,
          error: hookData.error?.message || `Vercel merespon dengan status ${hookRes.status}`
        });
        return;
      }

      sendJson(res, 200, {
        success: true,
        message: 'Sinyal deploy berhasil dikirim ke Vercel! Proses build sedang berjalan.',
        data: hookData
      });
    } catch (err) {
      sendJson(res, 500, { success: false, error: err.message });
    }
    return;
  }

  // 5. IndexNow Protocol APIs & Settings
  if (pathname === '/api/indexnow/settings') {
    if (req.method === 'POST') {
      try {
        const body = await parseBody(req);
        const result = saveIndexNowSettings(body);
        sendJson(res, 200, {
          success: true,
          message: 'Pengaturan IndexNow berhasil disimpan!',
          settings: result.settings
        });
      } catch (err) {
        sendJson(res, 500, { success: false, error: err.message });
      }
      return;
    } else {
      const currentSettings = getIndexNowSettings();
      sendJson(res, 200, {
        ...currentSettings,
        keyLocation: `${baseUrl}/${currentSettings.key}.txt`
      });
      return;
    }
  }

  if (pathname === '/api/indexnow') {
    const currentSettings = getIndexNowSettings();
    if (req.method === 'POST') {
      try {
        const body = await parseBody(req);
        let urls = body.urls;
        const targetHost = body.host || host;
        const key = body.key || currentSettings.key || INDEXNOW_KEY;

        const targets = {
          bing: body.bing !== undefined ? !!body.bing : currentSettings.bing?.enabled !== false,
          yandex: body.yandex !== undefined ? !!body.yandex : currentSettings.yandex?.enabled !== false,
          indexnowOrg: body.indexnowOrg !== undefined ? !!body.indexnowOrg : currentSettings.indexnowOrg?.enabled !== false
        };

        // If no urls specified, submit latest N or all
        if (!urls || !Array.isArray(urls) || urls.length === 0) {
          const count = body.count || 100;
          const all = getAllVideos();
          urls = all.slice(-count).reverse().map(v => `${baseUrl}/watch/${v.slug || v.id}`);
        }

        const report = await submitToIndexNow({ host: targetHost, key, urls, targets });

        // Update last submission stats in settings
        saveIndexNowSettings({
          lastSubmission: {
            timestamp: new Date().toISOString(),
            submittedCount: report.submittedCount,
            results: report.results
          }
        });

        sendJson(res, 200, { success: true, report });
      } catch (err) {
        sendJson(res, 500, { success: false, error: err.message });
      }
      return;
    } else {
      sendJson(res, 200, {
        message: 'Send POST request with { urls?: string[], count?: number, host?: string, key?: string, bing?: boolean, yandex?: boolean }',
        defaultKey: currentSettings.key || INDEXNOW_KEY,
        keyLocation: `${baseUrl}/${currentSettings.key || INDEXNOW_KEY}.txt`,
        settings: currentSettings
      });
      return;
    }
  }

  if (pathname === '/api/ping-sitemap') {
    const sitemapUrl = reqUrl.searchParams.get('url') || `${baseUrl}/sitemap.xml`;
    try {
      const pingResult = await pingSearchEngines(sitemapUrl);
      sendJson(res, 200, { success: true, sitemapUrl, pingResult });
    } catch (err) {
      sendJson(res, 500, { success: false, error: err.message });
    }
    return;
  }

  if (pathname === '/api/proxy-image') {
    const targetUrl = reqUrl.searchParams.get('url');
    await handleImageProxy(req, res, targetUrl);
    return;
  }

  // 6. Watch Page (SSR / SEO)
  if (pathname === '/watch' || pathname === '/watch.html' || pathname.startsWith('/watch/')) {
    let idOrSlug = reqUrl.searchParams.get('id') || reqUrl.searchParams.get('slug');
    if (!idOrSlug && pathname.startsWith('/watch/')) {
      idOrSlug = pathname.replace('/watch/', '').replace(/\/$/, '');
    }

    if (!idOrSlug) {
      // Default to latest video if no id provided
      const random = getRandomVideo();
      idOrSlug = random?.id;
    }

    const video = getVideoByIdOrSlug(idOrSlug);
    renderWatchPage(res, video, req);
    return;
  }

  // Admin Authentication API
  if (pathname === '/api/admin/login' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { username, password } = body;
      if (validateLogin(username, password)) {
        const token = createSessionToken(username);
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Set-Cookie': `stream_admin_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 3600}`
        });
        res.end(JSON.stringify({ success: true, message: 'Login berhasil!' }));
        return;
      } else {
        sendJson(res, 401, { success: false, error: 'Username atau password salah!' });
        return;
      }
    } catch (err) {
      sendJson(res, 500, { success: false, error: err.message });
      return;
    }
  }

  if (pathname === '/api/admin/logout' && req.method === 'POST') {
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Set-Cookie': `stream_admin_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
    });
    res.end(JSON.stringify({ success: true, message: 'Logout berhasil' }));
    return;
  }

  if (pathname === '/api/admin/status') {
    const session = getSessionFromRequest(req);
    sendJson(res, 200, {
      authenticated: !!session,
      username: session ? session.username : null
    });
    return;
  }

  // 7. WordPress Style Admin Dashboard (/wp-admin) & Redirect /indexing
  if (
    pathname === '/wp-admin' ||
    pathname === '/wp-admin/' ||
    pathname === '/wp-admin/index.html' ||
    pathname === '/indexing' ||
    pathname === '/indexing.html' ||
    pathname === '/admin' ||
    pathname === '/admin/' ||
    pathname === '/admin/indexing'
  ) {
    // If accessing old /indexing or /admin paths, redirect to canonical /wp-admin
    if (pathname.startsWith('/indexing') || pathname === '/admin' || pathname === '/admin/') {
      res.writeHead(302, { 'Location': '/wp-admin' });
      res.end();
      return;
    }

    // Verify session
    const session = getSessionFromRequest(req);
    if (!session) {
      // Not logged in: Show the login page
      const loginHtmlPath = path.join(PUBLIC_DIR, 'admin-login.html');
      if (fs.existsSync(loginHtmlPath)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        fs.createReadStream(loginHtmlPath).pipe(res);
        return;
      }
    }

    // Logged in: Serve admin control center (indexing-admin.html)
    const adminPath = path.join(__dirname, '..', 'data', 'indexing-admin.html');
    if (fs.existsSync(adminPath)) {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      });
      fs.createReadStream(adminPath).pipe(res);
      return;
    }
  }

  // 8. Static file fallback
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  // Prevent direct public access to indexing.html without auth
  if (pathname === '/indexing.html') {
    res.writeHead(302, { 'Location': '/wp-admin' });
    res.end();
    return;
  }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400'
    });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  // Default SPA fallback
  const indexPath = path.join(PUBLIC_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(indexPath).pipe(res);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('404 Not Found');
}

import { getAllVideos, getVideoByIdOrSlug } from './data-store.js';

export const INDEXNOW_KEY = process.env.INDEXNOW_KEY || 'streamhubindexnow2026auto789';

/**
 * Escape XML special characters
 */
function escapeXml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe).replace(/[<>&'"]/g, c => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

/**
 * Generate robots.txt
 */
export function generateRobotsTxt(baseUrl) {
  return `# robots.txt generated for MLyuk Auto-Indexing
User-agent: *
Allow: /
Disallow: /api/proxy-image

User-agent: Googlebot
Allow: /

User-agent: Googlebot-Video
Allow: /

User-agent: Yandex
Allow: /

User-agent: YandexBot
Allow: /

User-agent: Bingbot
Allow: /

User-agent: msnbot
Allow: /

Sitemap: ${baseUrl}/sitemap.xml
Sitemap: ${baseUrl}/sitemap-all.xml
`;
}

/**
 * Generate Sitemap Index XML (/sitemap.xml)
 */
export function generateSitemapIndex(baseUrl) {
  const videos = getAllVideos();
  const chunkSize = 5000;
  const chunkCount = Math.max(1, Math.ceil(videos.length / chunkSize));
  const today = new Date().toISOString().split('T')[0];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  // Pages sitemap
  xml += `  <sitemap>\n`;
  xml += `    <loc>${baseUrl}/sitemap/pages.xml</loc>\n`;
  xml += `    <lastmod>${today}</lastmod>\n`;
  xml += `  </sitemap>\n`;

  // Video sitemaps chunks
  for (let i = 1; i <= chunkCount; i++) {
    xml += `  <sitemap>\n`;
    xml += `    <loc>${baseUrl}/sitemap/videos-${i}.xml</loc>\n`;
    xml += `    <lastmod>${today}</lastmod>\n`;
    xml += `  </sitemap>\n`;
  }

  xml += `</sitemapindex>\n`;
  return xml;
}

/**
 * Generate Pages Sitemap XML (/sitemap/pages.xml)
 */
export function generatePagesSitemap(baseUrl) {
  const today = new Date().toISOString().split('T')[0];
  const pages = [
    { path: '/', priority: '1.0', changefreq: 'daily' },
    { path: '/bookmarks', priority: '0.5', changefreq: 'weekly' },
    { path: '/history', priority: '0.4', changefreq: 'weekly' },
    { path: '/indexing', priority: '0.6', changefreq: 'monthly' }
  ];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  for (const page of pages) {
    xml += `  <url>\n`;
    xml += `    <loc>${baseUrl}${page.path}</loc>\n`;
    xml += `    <lastmod>${today}</lastmod>\n`;
    xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
    xml += `    <priority>${page.priority}</priority>\n`;
    xml += `  </url>\n`;
  }

  xml += `</urlset>\n`;
  return xml;
}

/**
 * Generate Video Sitemap Chunk with Google Video XML tags (/sitemap/videos-:chunk.xml)
 */
export function generateVideoSitemapChunk(chunkIndex, baseUrl) {
  const videos = getAllVideos();
  const chunkSize = 5000;
  const start = (chunkIndex - 1) * chunkSize;
  const end = Math.min(videos.length, start + chunkSize);
  const today = new Date().toISOString().split('T')[0];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n`;

  for (let i = start; i < end; i++) {
    const v = videos[i];
    const watchUrl = `${baseUrl}/watch/${v.slug || v.id}`;
    const safeTitle = escapeXml(v.title);
    const safeDesc = escapeXml(`Nonton streaming video ${v.title} kualitas HD gratis.`);
    const safeThumb = escapeXml(v.image_url);
    const safePlayer = escapeXml(v.iframe_url || v.video_url || watchUrl);

    xml += `  <url>\n`;
    xml += `    <loc>${watchUrl}</loc>\n`;
    xml += `    <lastmod>${today}</lastmod>\n`;
    xml += `    <changefreq>weekly</changefreq>\n`;
    xml += `    <priority>0.8</priority>\n`;
    xml += `    <video:video>\n`;
    xml += `      <video:thumbnail_loc>${safeThumb}</video:thumbnail_loc>\n`;
    xml += `      <video:title>${safeTitle}</video:title>\n`;
    xml += `      <video:description>${safeDesc}</video:description>\n`;
    xml += `      <video:player_loc allow_embed="yes">${safePlayer}</video:player_loc>\n`;
    xml += `      <video:publication_date>${today}</video:publication_date>\n`;
    xml += `      <video:family_friendly>no</video:family_friendly>\n`;
    xml += `    </video:video>\n`;
    xml += `  </url>\n`;
  }

  xml += `</urlset>\n`;
  return xml;
}

/**
 * Generate Single Full Sitemap XML (/sitemap-all.xml)
 */
export function generateAllSitemap(baseUrl) {
  const videos = getAllVideos();
  const today = new Date().toISOString().split('T')[0];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n`;

  // Home
  xml += `  <url>\n    <loc>${baseUrl}/</loc>\n    <lastmod>${today}</lastmod>\n    <priority>1.0</priority>\n  </url>\n`;

  for (let i = 0; i < videos.length; i++) {
    const v = videos[i];
    const watchUrl = `${baseUrl}/watch/${v.slug || v.id}`;
    const safeTitle = escapeXml(v.title);
    const safeDesc = escapeXml(`Nonton streaming video ${v.title} kualitas HD.`);
    const safeThumb = escapeXml(v.image_url);
    const safePlayer = escapeXml(v.iframe_url || watchUrl);

    xml += `  <url>\n`;
    xml += `    <loc>${watchUrl}</loc>\n`;
    xml += `    <lastmod>${today}</lastmod>\n`;
    xml += `    <changefreq>monthly</changefreq>\n`;
    xml += `    <priority>0.7</priority>\n`;
    xml += `    <video:video>\n`;
    xml += `      <video:thumbnail_loc>${safeThumb}</video:thumbnail_loc>\n`;
    xml += `      <video:title>${safeTitle}</video:title>\n`;
    xml += `      <video:description>${safeDesc}</video:description>\n`;
    xml += `      <video:player_loc allow_embed="yes">${safePlayer}</video:player_loc>\n`;
    xml += `    </video:video>\n`;
    xml += `  </url>\n`;
  }

  xml += `</urlset>\n`;
  return xml;
}

/**
 * Generate VideoObject JSON-LD Schema
 */
export function generateVideoJsonLd(video, baseUrl) {
  const watchUrl = `${baseUrl}/watch/${video.slug || video.id}`;
  const uploadDate = new Date().toISOString();

  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "VideoObject",
    "name": video.title,
    "description": `Nonton streaming online video ${video.title} kualitas HD full streaming gratis.`,
    "thumbnailUrl": [video.image_url],
    "uploadDate": uploadDate,
    "contentUrl": watchUrl,
    "embedUrl": video.iframe_url || watchUrl,
    "inLanguage": "id",
    "interactionStatistic": {
      "@type": "InteractionCounter",
      "interactionType": { "@type": "WatchAction" },
      "userInteractionCount": 10000 + (video.id * 17) % 50000
    }
  });
}

/**
 * Submit URLs to Bing, Yandex, and IndexNow API
 */
export async function submitToIndexNow({ host, key = INDEXNOW_KEY, urls, targets = { bing: true, yandex: true, indexnowOrg: true } }) {
  if (!urls || urls.length === 0) {
    throw new Error('URL list cannot be empty');
  }

  // Ensure maximum 10,000 URLs per call as per IndexNow spec
  const batch = urls.slice(0, 10000);
  const payload = {
    host,
    key,
    keyLocation: `https://${host}/${key}.txt`,
    urlList: batch
  };

  const results = {};

  // 1. Standard IndexNow API (shared across Bing and other engines)
  if (targets.indexnowOrg !== false) {
    try {
      const res = await fetch('https://api.indexnow.org/indexnow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(payload)
      });
      results.indexnowOrg = {
        status: res.status,
        statusText: res.statusText,
        success: res.status === 200 || res.status === 202
      };
    } catch (err) {
      results.indexnowOrg = { success: false, error: err.message };
    }
  }

  // 2. Direct Bing IndexNow endpoint
  if (targets.bing !== false) {
    try {
      const res = await fetch('https://www.bing.com/indexnow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(payload)
      });
      results.bing = {
        status: res.status,
        statusText: res.statusText,
        success: res.status === 200 || res.status === 202
      };
    } catch (err) {
      results.bing = { success: false, error: err.message };
    }
  }

  // 3. Direct Yandex IndexNow endpoint
  if (targets.yandex !== false) {
    try {
      const res = await fetch('https://yandex.com/indexnow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(payload)
      });
      results.yandex = {
        status: res.status,
        statusText: res.statusText,
        success: res.status === 200 || res.status === 202
      };
    } catch (err) {
      results.yandex = { success: false, error: err.message };
    }
  }

  return {
    submittedCount: batch.length,
    host,
    keyLocation: payload.keyLocation,
    results
  };
}

/**
 * Ping Google and Bing with Sitemap
 */
export async function pingSearchEngines(sitemapUrl) {
  const results = {};

  // Google Ping
  try {
    const googlePingUrl = `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`;
    const res = await fetch(googlePingUrl);
    results.google = {
      status: res.status,
      success: res.status === 200 || res.status === 204
    };
  } catch (err) {
    results.google = { success: false, error: err.message };
  }

  // Bing Ping
  try {
    const bingPingUrl = `https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`;
    const res = await fetch(bingPingUrl);
    results.bing = {
      status: res.status,
      success: res.status === 200 || res.status === 204
    };
  } catch (err) {
    results.bing = { success: false, error: err.message };
  }

  return results;
}

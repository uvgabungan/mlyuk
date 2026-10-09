import http from 'node:http';
import handler from './api/index.js';
import { getStats } from './lib/data-store.js';

const PORT = process.env.PORT || 3000;

// Only start http listener when running directly in local Node environment (not in Vercel serverless)
if (!process.env.VERCEL) {
  const server = http.createServer(handler);
  server.listen(PORT, () => {
    const stats = getStats();
    console.log(`\n======================================================`);
    console.log(`🚀 StreamHub Streaming Server is RUNNING!`);
    console.log(`📡 URL: http://localhost:${PORT}`);
    console.log(`📊 Total Videos: ${stats.totalVideos.toLocaleString()} loaded`);
    console.log(`🗺️ Sitemap Index: http://localhost:${PORT}/sitemap.xml`);
    console.log(`🤖 Robots.txt: http://localhost:${PORT}/robots.txt`);
    console.log(`⚡ Auto Indexing Admin: http://localhost:${PORT}/indexing`);
    console.log(`======================================================\n`);
  });
}

// Export default handler for Vercel Serverless Function
export default handler;

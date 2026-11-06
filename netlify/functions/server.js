import serverless from 'serverless-http';
import http from 'node:http';
import apiHandler from '../../api/index.js';

const app = http.createServer(apiHandler);

export const handler = serverless(app, {
  binary: ['image/*', 'video/*', 'application/octet-stream', 'font/*'],
  request: (request, event) => {
    if (event.rawUrl) {
      try {
        const parsed = new URL(event.rawUrl);
        request.url = parsed.pathname + parsed.search;
        return;
      } catch {}
    }
    if (event.path && event.path !== '/.netlify/functions/server') {
      const qs = event.rawQuery || (event.queryStringParameters ? '?' + new URLSearchParams(event.queryStringParameters).toString() : '');
      request.url = event.path + (qs.startsWith('?') ? qs : (qs ? '?' + qs : ''));
    }
  }
});

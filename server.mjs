// Local TOPS map server.
// Serves the mirrored frontend from ./ and proxies anything missing
// (map tiles, GeoJSON, icons, ...) through to the live TOPS map.
// This makes the browser treat tiles + GeoJSON as same-origin (no CORS issues),
// and gives us an editable local frontend to layer a heatmap on top of.

import { createServer } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { stat, readFile } from 'node:fs/promises';
import { join, normalize, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const UPSTREAM = 'map.tops.vintagestory.at';
const PORT = process.env.PORT ? Number(process.env.PORT) : 4242;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.geojson': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
};

function proxyToUpstream(reqPath, res) {
  const up = httpsRequest(
    { host: UPSTREAM, path: reqPath, method: 'GET', headers: { 'user-agent': 'tops-map-local-proxy' } },
    (upRes) => {
      res.writeHead(upRes.statusCode || 502, {
        'content-type': upRes.headers['content-type'] || 'application/octet-stream',
        'cache-control': 'public, max-age=3600',
      });
      upRes.pipe(res);
    },
  );
  up.on('error', (e) => {
    res.writeHead(502, { 'content-type': 'text/plain' });
    res.end('Upstream error: ' + e.message);
  });
  up.end();
}

const server = createServer(async (req, res) => {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';

  // Resolve to a local file under ROOT, blocking path traversal.
  const localPath = normalize(join(ROOT, urlPath));
  if (!localPath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  try {
    const s = await stat(localPath);
    if (s.isFile()) {
      const body = await readFile(localPath);
      res.writeHead(200, { 'content-type': TYPES[extname(localPath)] || 'application/octet-stream' });
      res.end(body);
      return;
    }
  } catch {
    // not present locally -> fall through to upstream
  }

  proxyToUpstream(req.url || urlPath, res);
});

server.listen(PORT, () => {
  console.log(`TOPS map (local) -> http://localhost:${PORT}/`);
  console.log(`Serving frontend from ${ROOT}, proxying misses to https://${UPSTREAM}`);
});

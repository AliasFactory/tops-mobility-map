// Sync the local mirror with the live TOPS map (map.tops.vintagestory.at).
//
// The site is "base + overlay":
//   base    = files served verbatim by upstream (automap.js, css, libs, data, ...)
//   overlay = OUR additions (heatmap.js, router.*, server.mjs, pre/, mobility.geojson)
//
// This script refreshes every BASE file in place and re-derives index.html by
// re-applying our overlay patch on top of the *current* upstream index.html, so
// we track upstream changes without hand-merging. Overlay files are never touched.
//
//   node sync.mjs            refresh base code + data, rebuild index.html
//   node sync.mjs --check    dry run: report what WOULD change, write nothing
//   node sync.mjs --data     only refresh data/geojson (+ copy TL data to pre/)
//   node sync.mjs --code     only refresh base code + index.html (skip data)
//   node sync.mjs --build    after syncing, rebuild mobility.geojson (pre/preprocess.mjs)
//
// Zero deps. Downloads are compared byte-for-byte; unchanged files are left alone.

import { request } from 'node:https';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const UPSTREAM = 'map.tops.vintagestory.at';

const args = new Set(process.argv.slice(2));
const CHECK = args.has('--check') || args.has('-n');
const ONLY_DATA = args.has('--data');
const ONLY_CODE = args.has('--code');
const BUILD = args.has('--build');
const doCode = !ONLY_DATA;
const doData = !ONLY_CODE;

// ---- base frontend files, mirrored verbatim from upstream --------------------
const BASE = [
  'lib/ol.css', 'lib/ol-ext.min.css', 'lib/ol.js', 'lib/ol-ext.min.js',
  'css/solid.min.css', 'css/fontawesome.min.css', 'css/classicblue.css', 'css/default.css',
  'worldExtent.js', 'settings.js', 'version.js', 'route.js', 'traders.js', 'automap.js',
  'contribute-fragment.html',
  'webfonts/fa-solid-900.woff2', 'webfonts/fa-solid-900.ttf',
  'assets/favicon.svg', 'assets/sky.png', 'assets/icons/temporal_gear.png',
  'assets/icons/waypoints/home.svg', 'assets/icons/waypoints/spiral.svg',
  'assets/icons/waypoints/star1.svg', 'assets/icons/waypoints/trader.svg',
  'css/charcoalgray.css',
];

// ---- upstream data we vendor for offline / Pages use -------------------------
const DATA = [
  'data/geojson/translocators.geojson',
  'data/geojson/landmarks.geojson',
  'data/geojson/traders.geojson',
];

// Overlay files that live *only* here — never fetched, never overwritten.
// (Listed for documentation; they simply aren't in BASE/DATA.)
// heatmap.js router.html router.js server.mjs sync.mjs mobility.geojson
// README.md .nojekyll .gitignore pre/*

// ---- the overlay "patch" applied to upstream index.html ---------------------
// Idempotent: re-running produces the same result. This IS our index.html diff.
function applyOverlay(html) {
  let h = html;
  // 1. de-absolutise the one root-absolute asset ref so the site works from a
  //    GitHub Pages project subpath (e.g. /lib/ol.css -> lib/ol.css).
  h = h.replace(/((?:src|href)=")\/((?:lib|css|assets|webfonts|data)\/)/g, '$1$2');
  // 2. add our custom Route Finder tab (router.html) after the Contribution link.
  if (!h.includes('router.html')) {
    h = h.replace(
      /(<li><a href="#contribute"[^>]*>[^<]*<\/a><\/li>)/,
      '$1\n        <li><a href="router.html" class="selected">Route Finder</a></li>',
    );
  }
  // 3. load our heatmap overlay last, after automap.js defines the `map` global.
  if (!h.includes('heatmap.js')) {
    h = h.replace('</body>', '<script src="heatmap.js"></script>\n</body>');
  }
  return h;
}

// ---- http ------------------------------------------------------------------
function get(path) {
  return new Promise((resolve, reject) => {
    const req = request(
      { host: UPSTREAM, path: '/' + path, method: 'GET', headers: { 'user-agent': 'tops-map-sync' } },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          const err = new Error(`HTTP ${res.statusCode} for ${path}`);
          err.status = res.statusCode;
          return reject(err);
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      },
    );
    req.on('error', reject);
    req.end();
  });
}

async function readLocal(rel) {
  try {
    return await readFile(join(ROOT, rel));
  } catch {
    return null;
  }
}

// download `rel` from upstream and write it locally if the bytes differ.
// `transform` (optional) maps the upstream Buffer to what we store locally.
async function syncFile(rel, transform) {
  let fetched;
  try {
    fetched = await get(rel);
  } catch (e) {
    // 204/404 = upstream doesn't publish this path (e.g. a fallback icon it
    // serves empty). Not an error; the live site behaves the same.
    if (e.status === 204 || e.status === 404) {
      console.log(`  skip  ${rel}  (upstream ${e.status}, not published)`);
      return { rel, status: 'skip', text: null };
    }
    console.log(`  FAIL  ${rel}  (${e.message})`);
    return { rel, status: 'fail', text: null };
  }
  const out = transform ? Buffer.from(transform(fetched.toString('utf8')), 'utf8') : fetched;
  const cur = await readLocal(rel);
  const isNew = cur === null;
  // return upstream text (for non-lib code/css) so the caller can scan it for
  // further local asset references it should also mirror.
  const text = /\.(js|css|html)$/.test(rel) && !rel.startsWith('lib/') ? fetched.toString('utf8') : null;
  if (cur && cur.equals(out)) {
    console.log(`  same  ${rel}`);
    return { rel, status: 'same', text };
  }
  const tag = isNew ? 'NEW  ' : 'UPDATE';
  const delta = isNew ? `${out.length}B` : `${cur.length}B -> ${out.length}B`;
  console.log(`  ${tag} ${rel}  (${delta})${CHECK ? '  [check]' : ''}`);
  if (!CHECK) {
    await mkdir(join(ROOT, dirname(rel)), { recursive: true });
    await writeFile(join(ROOT, rel), out);
  }
  return { rel, status: isNew ? 'new' : 'update', text };
}

// pull local asset/code references (assets/, css/, webfonts/, lib/) out of a
// synced JS/CSS file so newly-added upstream icons, themes, fonts get mirrored
// too. Data geojsons stay a curated list (DATA) to avoid chasing optional/404s.
function scanRefs(text) {
  const out = new Set();
  const re = /(?:assets|css|webfonts|lib)\/[\w./-]+\.(?:png|svg|jpe?g|gif|webp|woff2?|ttf|otf|css|js)/g;
  for (const m of text.matchAll(re)) out.add(m[0]);
  return out;
}

// pull local <script src>/<link href> paths out of upstream index.html so a
// newly-added upstream file gets mirrored even if it's not in BASE yet.
function discover(html) {
  const found = new Set();
  for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    let p = m[1];
    if (/^(https?:)?\/\//.test(p) || p.startsWith('#') || p.startsWith('data:')) continue;
    p = p.replace(/^\//, '').split(/[?#]/)[0];
    if (p && !p.endsWith('index.html')) found.add(p);
  }
  return found;
}

// ---- run -------------------------------------------------------------------
async function main() {
  console.log(`Syncing local mirror <- https://${UPSTREAM}${CHECK ? '  (dry run)' : ''}\n`);
  let changed = 0;
  let tlChanged = false;

  if (doCode) {
    console.log('base code:');
    // discover any newly-added upstream scripts/links, union with BASE
    let idxHtml = null;
    try {
      idxHtml = (await get('index.html')).toString('utf8');
    } catch (e) {
      console.log(`  FAIL  index.html (${e.message})`);
    }
    // worklist that grows as we discover references inside synced files, so a
    // new upstream script / icon / theme gets mirrored without touching BASE.
    const queue = [...BASE];
    if (idxHtml) for (const p of discover(idxHtml)) if (!queue.includes(p)) queue.push(p);
    const seen = new Set();
    for (let i = 0; i < queue.length; i++) {
      const rel = queue[i];
      if (seen.has(rel)) continue;
      seen.add(rel);
      const r = await syncFile(rel);
      if (r.status === 'update' || r.status === 'new') changed++;
      if (r.text) for (const p of scanRefs(r.text)) if (!seen.has(p) && !queue.includes(p)) queue.push(p);
    }
    // index.html = upstream + our overlay patch
    if (idxHtml !== null) {
      const r = await syncFile('index.html', applyOverlay);
      if (r.status === 'update' || r.status === 'new') changed++;
    }
    console.log('');
  }

  if (doData) {
    console.log('data:');
    for (const rel of DATA) {
      const r = await syncFile(rel);
      if (r.status === 'update' || r.status === 'new') {
        changed++;
        if (rel.endsWith('translocators.geojson')) tlChanged = true;
      }
    }
    // keep the preprocessing input in step with the vendored TL data
    if (tlChanged && !CHECK) {
      await copyFile(join(ROOT, 'data/geojson/translocators.geojson'), join(ROOT, 'pre/translocators.geojson'));
      console.log('  copied translocators.geojson -> pre/translocators.geojson');
    }
    console.log('');
  }

  console.log(CHECK ? `${changed} file(s) would change.` : `${changed} file(s) changed.`);

  if (tlChanged) {
    console.log('\nTranslocator data changed -> mobility.geojson is stale.');
    if (BUILD && !CHECK) {
      console.log('Rebuilding mobility.geojson (pre/preprocess.mjs)...\n');
      const res = spawnSync(process.execPath, ['preprocess.mjs'], {
        cwd: join(ROOT, 'pre'),
        stdio: 'inherit',
        env: { ...process.env, MAX_WALK: process.env.MAX_WALK || '500', SAMPLES: process.env.SAMPLES || '0' },
      });
      if (res.status !== 0) console.log('\npreprocess.mjs exited non-zero.');
    } else {
      console.log('Rebuild it with:  cd pre && MAX_WALK=500 SAMPLES=0 node preprocess.mjs');
      console.log('             (or:  node sync.mjs --build  to sync + rebuild in one step)');
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

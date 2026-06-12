/* Broader network profile -> writes pre/network-profile.json for reference. */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const HERE = fileURLToPath(new URL('.', import.meta.url));

const tlGeo = JSON.parse(await readFile(HERE + 'translocators.geojson', 'utf8'));
const mob = JSON.parse(await readFile(HERE + '../mobility.geojson', 'utf8'));

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const q = (arr, p) => arr[Math.min(arr.length - 1, Math.floor(p * (arr.length - 1)))];
const stats = (arr) => {
  const s = [...arr].sort((a, b) => a - b);
  const sum = s.reduce((x, y) => x + y, 0);
  return { n: s.length, min: s[0], p50: q(s, 0.5), p90: q(s, 0.9), p99: q(s, 0.99), max: s[s.length - 1], mean: +(sum / s.length).toFixed(1) };
};

const tls = tlGeo.features.filter((f) => f.geometry?.type === 'LineString' && f.geometry.coordinates.length >= 2);

// jump lengths + tags + labels
const lens = [], tags = {}, depth1 = [], depth2 = [];
let labeled = 0;
for (const f of tls) {
  const cs = f.geometry.coordinates;
  lens.push(dist(cs[0], cs[cs.length - 1]));
  const p = f.properties || {};
  const tag = p.tag || '(none)';
  tags[tag] = (tags[tag] || 0) + 1;
  if (p.label && p.label.length) labeled++;
  if (typeof p.depth1 === 'number') depth1.push(p.depth1);
  if (typeof p.depth2 === 'number') depth2.push(p.depth2);
}

// per-node metrics from mobility.geojson
const F = mob.features;
const m = F.map((f) => f.properties.m);
const local = F.map((f) => f.properties.local);
const reach = F.map((f) => f.properties.reach);
const deg = F.map((f) => f.properties.deg);
const xs = F.map((f) => f.geometry.coordinates[0]);
const ys = F.map((f) => f.geometry.coordinates[1]);

// hub concentration: share of total m held by top 1% / 5% / 10% of nodes
const mSorted = [...m].sort((a, b) => b - a);
const totalM = mSorted.reduce((a, b) => a + b, 0);
const topShare = (frac) => {
  const k = Math.max(1, Math.floor(F.length * frac));
  return +(100 * mSorted.slice(0, k).reduce((a, b) => a + b, 0) / totalM).toFixed(1);
};

// top 10 hubs (m) and top 10 local-access spots, in display coords (x, z=-y)
const top = (key, n = 10) =>
  [...F].sort((a, b) => b.properties[key] - a.properties[key]).slice(0, n).map((f) => ({
    x: f.geometry.coordinates[0], z: -f.geometry.coordinates[1],
    m: f.properties.m, local: f.properties.local, reach: f.properties.reach, deg: f.properties.deg,
  }));

const profile = {
  source: 'TOPS translocators.geojson + mobility.geojson',
  generatedAtNote: 'timestamps unavailable in sandbox; regenerate to refresh',
  graph: mob.meta,
  translocators: {
    count: tls.length,
    jumpLengthBlocks: stats(lens),
    labeledNamed: labeled,
    tagBreakdown: tags,
    depth1: depth1.length ? stats(depth1) : null,
    depth2: depth2.length ? stats(depth2) : null,
  },
  nodes: {
    count: F.length,
    leafNodes_m0: m.filter((v) => v === 0).length,
    mobility_m: stats(m),
    localAccess: stats(local),
    reach: stats(reach),
    walkDegree: stats(deg),
    hubConcentration_mShare: { top1pct: topShare(0.01), top5pct: topShare(0.05), top10pct: topShare(0.1) },
  },
  spatial: {
    xRange: [Math.min(...xs), Math.max(...xs)],
    yRange_map: [Math.min(...ys), Math.max(...ys)],
    zRange_display: [Math.min(...ys.map((v) => -v)), Math.max(...ys.map((v) => -v))],
  },
  topHubsByTraffic: top('m'),
  topAreasByLocalAccess: top('local'),
};

await writeFile(HERE + 'network-profile.json', JSON.stringify(profile, null, 2));
console.log(JSON.stringify(profile, null, 2));

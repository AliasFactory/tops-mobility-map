/* ###########################################################################
 * Translocator mobility preprocessor.
 *
 * Input : translocators.geojson   (LineString per TL, endpoints = nodes)
 * Output: ../mobility.geojson      (Point per station, with mobility scores)
 *
 * Graph model (per design):
 *   - nodes  = distinct TL endpoints (rounded to block coords)
 *   - jump   edges = the translocator itself, endpoint A <-> B, cost JUMP_COST
 *            (near-instant travel; bidirectional)
 *   - walk   edges = between any two nodes within MAX_WALK blocks,
 *            cost = ground distance (rounded). MAX_WALK bounds the graph
 *            density => the compute/GPU limiter.
 *
 * Scores written per node:
 *   m      traffic mobility = betweenness (share of all-pairs shortest-path
 *          flow through the node), reachability-scaled. Sampled+scaled Brandes.
 *   reach  reachable node count = (connected-component size - 1). Exact.
 *   deg    local degree = # walk neighbours within MAX_WALK (local TL density)
 *   local  local access = sum of nearby nodes' m, linearly decayed over
 *          LOCAL_RADIUS. "How good is the TL access around here."
 *
 * Config via env vars (all optional):
 *   MAX_WALK      (default 300)   max blocks walked between two TLs
 *   LOCAL_RADIUS  (default =MAX_WALK) radius for the `local` aggregate
 *   JUMP_COST     (default 1)     cost of one translocator jump
 *   SAMPLES       (default 1200)  betweenness source samples (0 or >=N = exact)
 * ######################################################################### */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const num = (v, d) => (v === undefined || v === '' ? d : Number(v));
const MAX_WALK = num(process.env.MAX_WALK, 300);
const LOCAL_RADIUS = num(process.env.LOCAL_RADIUS, MAX_WALK);
const JUMP_COST = num(process.env.JUMP_COST, 1);
const SAMPLES = num(process.env.SAMPLES, 1200);
// TL-jump depth caps to precompute traffic mobility at (plus an always-included
// uncapped "full" level). Slider in the UI sweeps these. e.g. "1,2,3,4,6,8".
const DEPTHS = (process.env.DEPTHS || '1,2,3,4,5,6,8,10')
  .split(',')
  .map((s) => Number(s.trim()))
  .filter((n) => n > 0);

const t0 = Date.now();
const log = (...a) => console.log(`[+${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);

/* ---------- load + build nodes ---------- */
const geo = JSON.parse(await readFile(HERE + 'translocators.geojson', 'utf8'));
const tls = geo.features.filter(
  (f) => f.geometry && f.geometry.type === 'LineString' && f.geometry.coordinates.length >= 2,
);
log(`translocators: ${tls.length}`);

const nodeIndex = new Map(); // "x,y" -> id
const xs = [];
const ys = [];
function nodeId(c) {
  const x = Math.round(c[0]);
  const y = Math.round(c[1]);
  const k = x + ',' + y;
  let id = nodeIndex.get(k);
  if (id === undefined) {
    id = xs.length;
    nodeIndex.set(k, id);
    xs.push(x);
    ys.push(y);
  }
  return id;
}

// adjacency: adj[u] = [{v, w}, ...]
const adj = [];
const ensure = (u) => {
  while (adj.length <= u) adj.push([]);
};
function link(u, v, w, jump) {
  ensure(u);
  ensure(v);
  adj[u].push({ v, w, jump });
  adj[v].push({ v: u, w, jump });
}

// jump edges (the translocators themselves)
for (const f of tls) {
  const cs = f.geometry.coordinates;
  const a = nodeId(cs[0]);
  const b = nodeId(cs[cs.length - 1]);
  if (a !== b) link(a, b, JUMP_COST, true);
}
const N = xs.length;
ensure(N - 1);
log(`distinct nodes: ${N}`);

/* ---------- spatial grid for walk edges ---------- */
const CELL = Math.max(1, MAX_WALK);
const cellKey = (cx, cy) => cx + ':' + cy;
const grid = new Map();
for (let i = 0; i < N; i++) {
  const cx = Math.floor(xs[i] / CELL);
  const cy = Math.floor(ys[i] / CELL);
  const k = cellKey(cx, cy);
  let arr = grid.get(k);
  if (!arr) grid.set(k, (arr = []));
  arr.push(i);
}
const W2 = MAX_WALK * MAX_WALK;
let walkEdges = 0;
const degCount = new Int32Array(N); // # walk neighbours
for (let i = 0; i < N; i++) {
  const cx = Math.floor(xs[i] / CELL);
  const cy = Math.floor(ys[i] / CELL);
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const arr = grid.get(cellKey(cx + dx, cy + dy));
      if (!arr) continue;
      for (const j of arr) {
        if (j <= i) continue; // each pair once
        const ddx = xs[i] - xs[j];
        const ddy = ys[i] - ys[j];
        const d2 = ddx * ddx + ddy * ddy;
        if (d2 <= W2) {
          const w = Math.max(1, Math.round(Math.sqrt(d2)));
          link(i, j, w, false); // walk edge
          walkEdges++;
          degCount[i]++;
          degCount[j]++;
        }
      }
    }
  }
}
log(`walk edges (<=${MAX_WALK} blocks): ${walkEdges}`);

/* ---------- connected components (reach) ---------- */
const parent = new Int32Array(N).map((_, i) => i);
function find(a) {
  while (parent[a] !== a) {
    parent[a] = parent[parent[a]];
    a = parent[a];
  }
  return a;
}
function union(a, b) {
  const ra = find(a);
  const rb = find(b);
  if (ra !== rb) parent[ra] = rb;
}
for (let u = 0; u < N; u++) for (const e of adj[u]) union(u, e.v);
const compSize = new Int32Array(N);
for (let i = 0; i < N; i++) compSize[find(i)]++;
const reach = new Int32Array(N);
let biggest = 0;
for (let i = 0; i < N; i++) {
  reach[i] = compSize[find(i)] - 1;
  if (compSize[find(i)] > biggest) biggest = compSize[find(i)];
}
log(`largest component: ${biggest} nodes (${((100 * biggest) / N).toFixed(1)}% of network)`);

/* ---------- betweenness (Brandes, weighted, sampled) ---------- */
// binary min-heap keyed by distance
class Heap {
  constructor() {
    this.d = []; // dist
    this.n = []; // node
  }
  get size() {
    return this.n.length;
  }
  push(node, dist) {
    const d = this.d;
    const n = this.n;
    let i = n.length;
    n.push(node);
    d.push(dist);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (d[p] <= d[i]) break;
      [d[p], d[i]] = [d[i], d[p]];
      [n[p], n[i]] = [n[i], n[p]];
      i = p;
    }
  }
  pop() {
    const d = this.d;
    const n = this.n;
    const top = n[0];
    const last = n.length - 1;
    n[0] = n[last];
    d[0] = d[last];
    n.pop();
    d.pop();
    let i = 0;
    const len = n.length;
    while (true) {
      let s = i;
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      if (l < len && d[l] < d[s]) s = l;
      if (r < len && d[r] < d[s]) s = r;
      if (s === i) break;
      [d[s], d[i]] = [d[i], d[s]];
      [n[s], n[i]] = [n[i], n[s]];
      i = s;
    }
    return top;
  }
}

const dist = new Float64Array(N);
const sigma = new Float64Array(N);
const delta = new Float64Array(N);
const jumpsArr = new Int32Array(N); // # TL jumps on the (min-jump) shortest path
const visitedOrder = new Int32Array(N);
const preds = Array.from({ length: N }, () => []);

// choose sources
let sources;
const exact = SAMPLES <= 0 || SAMPLES >= N;
if (exact) {
  sources = Array.from({ length: N }, (_, i) => i);
} else {
  // deterministic spread sampling (no Math.random): every step-th node
  const step = N / SAMPLES;
  sources = [];
  for (let k = 0; k < SAMPLES; k++) sources.push(Math.floor(k * step));
}

// Weighted Brandes betweenness with a cap on TL jumps per route (maxJumps<=0 =
// uncapped). Approximate under the cap: a single (node->jumps) state via
// min-jump tie-breaking, which is plenty for a heatmap. Bidirectional graph.
function betweenness(maxJumps) {
  const bc = new Float64Array(N);
  const settled = new Uint8Array(N);
  for (const s of sources) {
    for (let i = 0; i < N; i++) {
      dist[i] = Infinity;
      sigma[i] = 0;
      delta[i] = 0;
      jumpsArr[i] = 0;
      settled[i] = 0;
      if (preds[i].length) preds[i].length = 0;
    }
    dist[s] = 0;
    sigma[s] = 1;
    const heap = new Heap();
    heap.push(s, 0);
    let order = 0;
    while (heap.size) {
      const u = heap.pop();
      if (settled[u]) continue;
      settled[u] = 1;
      visitedOrder[order++] = u;
      const du = dist[u];
      const ju = jumpsArr[u];
      for (const e of adj[u]) {
        const v = e.v;
        const nj = ju + (e.jump ? 1 : 0);
        if (maxJumps > 0 && nj > maxJumps) continue; // route exceeds depth cap
        const nd = du + e.w;
        if (nd < dist[v]) {
          dist[v] = nd;
          sigma[v] = sigma[u];
          jumpsArr[v] = nj;
          preds[v].length = 0;
          preds[v].push(u);
          heap.push(v, nd);
        } else if (nd === dist[v]) {
          sigma[v] += sigma[u];
          if (nj < jumpsArr[v]) jumpsArr[v] = nj; // prefer fewer jumps on ties
          preds[v].push(u);
        }
      }
    }
    for (let idx = order - 1; idx >= 0; idx--) {
      const w = visitedOrder[idx];
      const coeff = (1 + delta[w]) / sigma[w];
      for (const v of preds[w]) delta[v] += sigma[v] * coeff;
      if (w !== s) bc[w] += delta[w];
    }
  }
  if (!exact) {
    const scale = N / sources.length;
    for (let i = 0; i < N; i++) bc[i] *= scale;
  }
  return bc;
}

log(`betweenness: ${exact ? 'EXACT' : 'sampled'} over ${sources.length} sources; depths ${DEPTHS.join(',')},full`);
const bcByDepth = []; // aligned with DEPTHS
for (const d of DEPTHS) {
  bcByDepth.push(betweenness(d));
  log(`  depth ${d} done`);
}
const bc = betweenness(0); // full / uncapped
bcByDepth.push(bc);
const DEPTH_LABELS = DEPTHS.map(String).concat(['full']);
log(`betweenness done (${DEPTH_LABELS.length} depth levels)`);

/* ---------- local access (decayed sum of nearby m) ---------- */
const LR = LOCAL_RADIUS;
const LCELL = Math.max(1, LR);
const lgrid = new Map();
for (let i = 0; i < N; i++) {
  const cx = Math.floor(xs[i] / LCELL);
  const cy = Math.floor(ys[i] / LCELL);
  const k = cellKey(cx, cy);
  let arr = lgrid.get(k);
  if (!arr) lgrid.set(k, (arr = []));
  arr.push(i);
}
const local = new Float64Array(N);
const LR2 = LR * LR;
for (let i = 0; i < N; i++) {
  const cx = Math.floor(xs[i] / LCELL);
  const cy = Math.floor(ys[i] / LCELL);
  let acc = 0;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const arr = lgrid.get(cellKey(cx + dx, cy + dy));
      if (!arr) continue;
      for (const j of arr) {
        const ddx = xs[i] - xs[j];
        const ddy = ys[i] - ys[j];
        const d2 = ddx * ddx + ddy * ddy;
        if (d2 <= LR2) {
          const decay = 1 - Math.sqrt(d2) / LR; // 1 at self, 0 at radius
          acc += bc[j] * decay;
        }
      }
    }
  }
  local[i] = acc;
}
log(`local access done`);

/* ---------- write GeoJSON ---------- */
let maxM = 0;
let maxLocal = 0;
for (let i = 0; i < N; i++) {
  if (bc[i] > maxM) maxM = bc[i];
  if (local[i] > maxLocal) maxLocal = local[i];
}
const features = new Array(N);
for (let i = 0; i < N; i++) {
  features[i] = {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [xs[i], ys[i]] },
    properties: {
      m: Math.round(bc[i] * 100) / 100, // = full depth (back-compat)
      md: bcByDepth.map((arr) => Math.round(arr[i] * 100) / 100), // traffic mobility per depth level
      reach: reach[i],
      deg: degCount[i],
      local: Math.round(local[i] * 100) / 100,
    },
  };
}
const out = {
  type: 'FeatureCollection',
  meta: {
    nodes: N,
    translocators: tls.length,
    walkEdges,
    maxWalk: MAX_WALK,
    localRadius: LOCAL_RADIUS,
    jumpCost: JUMP_COST,
    samples: exact ? N : sources.length,
    largestComponent: biggest,
    depths: DEPTH_LABELS, // labels aligned with each feature's `md` array
    maxM,
    maxLocal,
  },
  features,
};
await writeFile(HERE + '../mobility.geojson', JSON.stringify(out));
log(`wrote mobility.geojson  (${N} nodes)  maxM=${maxM.toFixed(1)} maxLocal=${maxLocal.toFixed(1)}`);

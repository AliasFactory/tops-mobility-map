/* All-pairs analysis: count routes and measure max TL-jumps used per route.
 * Same graph model as preprocess.mjs. Run: MAX_WALK=500 node analyze.mjs */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const HERE = fileURLToPath(new URL('.', import.meta.url));
const MAX_WALK = Number(process.env.MAX_WALK || 500);
const JUMP_COST = Number(process.env.JUMP_COST || 1);

const geo = JSON.parse(await readFile(HERE + 'translocators.geojson', 'utf8'));
const tls = geo.features.filter((f) => f.geometry?.type === 'LineString' && f.geometry.coordinates.length >= 2);

const idx = new Map();
const xs = [], ys = [];
const nid = (c) => {
  const x = Math.round(c[0]), y = Math.round(c[1]), k = x + ',' + y;
  let id = idx.get(k);
  if (id === undefined) { id = xs.length; idx.set(k, id); xs.push(x); ys.push(y); }
  return id;
};
const adj = [];
const link = (u, v, w, jump) => { (adj[u] ??= []).push({ v, w, jump }); (adj[v] ??= []).push({ v: u, w, jump }); };
for (const f of tls) { const cs = f.geometry.coordinates; const a = nid(cs[0]), b = nid(cs[cs.length - 1]); if (a !== b) link(a, b, JUMP_COST, 1); }
const N = xs.length;
for (let i = 0; i < N; i++) adj[i] ??= [];

const CELL = MAX_WALK, grid = new Map();
for (let i = 0; i < N; i++) { const k = Math.floor(xs[i] / CELL) + ':' + Math.floor(ys[i] / CELL); (grid.get(k) ?? grid.set(k, []).get(k)).push(i); }
const W2 = MAX_WALK * MAX_WALK; let walkEdges = 0;
for (let i = 0; i < N; i++) {
  const cx = Math.floor(xs[i] / CELL), cy = Math.floor(ys[i] / CELL);
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    const arr = grid.get((cx + dx) + ':' + (cy + dy)); if (!arr) continue;
    for (const j of arr) { if (j <= i) continue; const a = xs[i] - xs[j], b = ys[i] - ys[j], d2 = a * a + b * b; if (d2 <= W2) { link(i, j, Math.max(1, Math.round(Math.sqrt(d2))), 0); walkEdges++; } }
  }
}
console.log(`nodes=${N} walkEdges=${walkEdges} maxWalk=${MAX_WALK}`);

// binary heap
class Heap { constructor() { this.d = []; this.n = []; } get size() { return this.n.length; }
  push(node, dist) { const d = this.d, n = this.n; let i = n.length; n.push(node); d.push(dist); while (i > 0) { const p = (i - 1) >> 1; if (d[p] <= d[i]) break;[d[p], d[i]] = [d[i], d[p]];[n[p], n[i]] = [n[i], n[p]]; i = p; } }
  pop() { const d = this.d, n = this.n, top = n[0], last = n.length - 1; n[0] = n[last]; d[0] = d[last]; n.pop(); d.pop(); let i = 0; const len = n.length; while (1) { let s = i; const l = 2 * i + 1, r = 2 * i + 2; if (l < len && d[l] < d[s]) s = l; if (r < len && d[r] < d[s]) s = r; if (s === i) break;[d[s], d[i]] = [d[i], d[s]];[n[s], n[i]] = [n[i], n[s]]; i = s; } return top; } }

const dist = new Float64Array(N), jumps = new Int32Array(N), settled = new Uint8Array(N);
let routes = 0;           // ordered reachable pairs (s != t)
let maxJumps = 0, maxPair = null;
const hist = new Map();   // jump-count -> how many routes
const t0 = Date.now();
for (let s = 0; s < N; s++) {
  for (let i = 0; i < N; i++) { dist[i] = Infinity; jumps[i] = 0; settled[i] = 0; }
  dist[s] = 0; const h = new Heap(); h.push(s, 0);
  while (h.size) {
    const u = h.pop(); if (settled[u]) continue; settled[u] = 1;
    if (u !== s) { routes++; const j = jumps[u]; hist.set(j, (hist.get(j) || 0) + 1); if (j > maxJumps) { maxJumps = j; maxPair = [s, u]; } }
    const du = dist[u];
    for (const e of adj[u]) {
      const nd = du + e.w;
      if (nd < dist[e.v]) { dist[e.v] = nd; jumps[e.v] = jumps[u] + e.jump; h.push(e.v, nd); }
      else if (nd === dist[e.v] && jumps[u] + e.jump < jumps[e.v]) { jumps[e.v] = jumps[u] + e.jump; } // tie: prefer fewer jumps
    }
  }
  if ((s & 1023) === 0 && s) process.stdout.write(`\r  ${s}/${N}`);
}
console.log(`\rdone in ${((Date.now() - t0) / 1000).toFixed(1)}s` + ' '.repeat(10));
console.log(`routes (ordered reachable pairs): ${routes.toLocaleString()}`);
console.log(`routes (unordered): ${Math.round(routes / 2).toLocaleString()}`);
console.log(`MAX translocator jumps used on any shortest route: ${maxJumps}` + (maxPair ? `  (e.g. (${xs[maxPair[0]]},${ys[maxPair[0]]}) -> (${xs[maxPair[1]]},${ys[maxPair[1]]}))` : ''));
const keys = [...hist.keys()].sort((a, b) => a - b);
let cum = 0; const tot = routes;
console.log('jumps : routes (share, cumulative)');
for (const k of keys) { const c = hist.get(k); cum += c; console.log(`  ${String(k).padStart(2)} : ${c.toLocaleString().padStart(12)}  (${(100 * c / tot).toFixed(1)}%, ${(100 * cum / tot).toFixed(1)}%)`); }

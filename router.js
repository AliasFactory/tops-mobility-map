/* Directional translocator route finder.
 * Finds the best TL-jump sequences for travelling south or north.
 * Coordinate convention: OL/GeoJSON [x, y] where game_Z = -y (south = decreasing y). */

(async function () {
  /* ── map setup ──────────────────────────────────────────────────────────── */
  const tileLayer = new ol.layer.Tile({
    source: new ol.source.XYZ({
      url: 'https://map.tops.vintagestory.at/data/world/{z}/{x}_{y}.png',
      tileGrid: vsWorldGrid,
      crossOrigin: null,
    }),
    zIndex: 0,
  });

  const routeSource = new ol.source.Vector();
  const routeLayer = new ol.layer.Vector({
    source: routeSource,
    zIndex: 10,
    style: styleForFeature,
  });

  const startSource = new ol.source.Vector();
  const startLayer = new ol.layer.Vector({ source: startSource, zIndex: 20 });

  const view = new ol.View({
    center: [0, 0],
    zoom: 3,
    resolutions: [256, 128, 64, 32, 16, 8, 4, 2, 1, 0.5, 0.25, 0.125],
  });

  const map = new ol.Map({
    target: 'map',
    layers: [tileLayer, routeLayer, startLayer],
    view,
    controls: [],
  });

  /* coord display */
  const coordsEl = document.getElementById('coords');
  map.on('pointermove', e => {
    const [x, y] = e.coordinate;
    coordsEl.textContent = `X ${Math.round(x)}  Z ${Math.round(-y)}`;
  });

  /* click to set start */
  map.on('click', e => {
    const [x, y] = e.coordinate;
    document.getElementById('rx').value = Math.round(x);
    document.getElementById('rz').value = Math.round(-y);
    placeStartMarker(x, y);
  });

  function placeStartMarker(olx, oly) {
    startSource.clear();
    startSource.addFeature(new ol.Feature({
      geometry: new ol.geom.Point([olx, oly]),
      role: 'start',
    }));
  }

  /* ── styles ─────────────────────────────────────────────────────────────── */
  function styleForFeature(f) {
    const role = f.get('role');
    if (role === 'start') {
      return new ol.style.Style({
        image: new ol.style.Circle({
          radius: 7, fill: new ol.style.Fill({ color: '#fff' }),
          stroke: new ol.style.Stroke({ color: '#333', width: 2 }),
        }),
      });
    }
    if (role === 'line') {
      return new ol.style.Style({
        stroke: new ol.style.Stroke({ color: '#5af', width: 2.5 }),
      });
    }
    if (role === 'hop') {
      return new ol.style.Style({
        image: new ol.style.Circle({
          radius: 5, fill: new ol.style.Fill({ color: '#fa0' }),
          stroke: new ol.style.Stroke({ color: '#000', width: 1 }),
        }),
      });
    }
    if (role === 'end') {
      return new ol.style.Style({
        image: new ol.style.Circle({
          radius: 7, fill: new ol.style.Fill({ color: '#5f5' }),
          stroke: new ol.style.Stroke({ color: '#000', width: 2 }),
        }),
      });
    }
    return null;
  }

  /* ── graph loading ──────────────────────────────────────────────────────── */
  let graph = null;

  async function loadGraph() {
    const geo = await fetch('data/geojson/translocators.geojson').then(r => r.json());
    const nodeIndex = new Map();
    const xs = [], ys = [], nodeLabel = [];

    function nodeId(c) {
      const x = Math.round(c[0]), y = Math.round(c[1]);
      const k = x + ',' + y;
      let id = nodeIndex.get(k);
      if (id === undefined) {
        id = xs.length;
        nodeIndex.set(k, id);
        xs.push(x); ys.push(y); nodeLabel.push('');
      }
      return id;
    }

    const jumpAdj = [];
    function ensureAdj(u) { while (jumpAdj.length <= u) jumpAdj.push([]); }

    for (const f of geo.features) {
      if (f.geometry?.type !== 'LineString') continue;
      const cs = f.geometry.coordinates;
      if (cs.length < 2) continue;
      const label = f.properties?.label?.trim() || '';
      const a = nodeId(cs[0]);
      const b = nodeId(cs[cs.length - 1]);
      if (a === b) continue;
      ensureAdj(a); ensureAdj(b);
      jumpAdj[a].push({ v: b, label });
      jumpAdj[b].push({ v: a, label });
      if (label) { nodeLabel[a] = nodeLabel[a] || label; nodeLabel[b] = nodeLabel[b] || label; }
    }

    const N = xs.length;
    while (jumpAdj.length < N) jumpAdj.push([]);
    return { xs, ys, nodeLabel, jumpAdj, N };
  }

  /* ── DP route finder ────────────────────────────────────────────────────── */
  function findRoutes(g, playerGameX, playerGameZ, dir, walkRadius, maxJumps) {
    const { xs, ys, jumpAdj, N } = g;
    const px = playerGameX;
    const py = -playerGameZ; // OL y
    const WR2 = walkRadius * walkRadius;
    const INF = -1e18;

    // dp[v] = best directional progress at v using ≤j jumps
    // prev[v] = node we jumped FROM to reach v (-1 = inherited / starting node)
    let dpPrev = new Float64Array(N).fill(INF);
    let prevPrev = new Int32Array(N).fill(-1);

    // Layer 0: walk from player to nearby TL nodes
    let starts = 0;
    for (let v = 0; v < N; v++) {
      const dx = xs[v] - px, dy = ys[v] - py;
      if (dx * dx + dy * dy <= WR2) {
        // southward progress of walking to this node (dir=1 south, dir=-1 north)
        dpPrev[v] = dir * (py - ys[v]);
        starts++;
      }
    }
    if (starts === 0) return null;

    const allDp   = [dpPrev.slice()];
    const allPrev = [prevPrev.slice()]; // layer 0: all -1 (start nodes)

    for (let j = 0; j < maxJumps; j++) {
      const dpNext   = dpPrev.slice();          // inherit (no jump this round)
      const prevNext = new Int32Array(N).fill(-1); // -1 = inherited

      for (let u = 0; u < N; u++) {
        if (dpPrev[u] === INF) continue;
        for (const { v } of jumpAdj[u]) {
          const newVal = dpPrev[u] + dir * (ys[u] - ys[v]);
          if (newVal > dpNext[v]) {
            dpNext[v] = newVal;
            prevNext[v] = u;
          }
        }
      }

      allDp.push(dpNext);
      allPrev.push(prevNext);
      dpPrev = dpNext;
    }

    /* extract Pareto-optimal routes (each jump count that beats all prior) */
    const routes = [];
    let bestSoFar = INF;

    for (let j = 0; j <= maxJumps; j++) {
      const dp = allDp[j];
      let bestV = -1, bestVal = INF;
      for (let v = 0; v < N; v++) {
        if (dp[v] > bestVal) { bestVal = dp[v]; bestV = v; }
      }
      if (bestV < 0 || bestVal <= bestSoFar) continue;
      bestSoFar = bestVal;

      // reconstruct path
      const hops = [];
      let v = bestV, jj = j;
      while (jj > 0) {
        const p = allPrev[jj][v];
        if (p >= 0) { hops.unshift([p, v]); v = p; }
        jj--;
      }

      routes.push({ jumps: hops.length, dist: Math.round(bestVal), startNode: v, endNode: bestV, hops });
    }

    return routes;
  }

  /* ── display ────────────────────────────────────────────────────────────── */
  function gameCoord(olx, oly) {
    return `(${Math.round(olx)}, ${Math.round(-oly)})`;
  }

  function nodeName(g, id) {
    const label = g.nodeLabel[id];
    if (label) return label;
    return gameCoord(g.xs[id], g.ys[id]);
  }

  function walkDist(g, px, py, nodeId) {
    const dx = g.xs[nodeId] - px;
    const dy = g.ys[nodeId] - (-py); // py here is game Z, convert to OL y
    return Math.round(Math.sqrt(dx * dx + dy * dy));
  }

  let activeRouteIdx = -1;
  let lastRoutes = [];

  function renderRoutes(routes, g, playerGameX, playerGameZ, dir) {
    lastRoutes = routes || [];
    activeRouteIdx = -1;
    const el = document.getElementById('results');
    if (!routes || routes.length === 0) {
      el.innerHTML = `<div class="no-results">No routes found. Try increasing the walk radius.</div>`;
      return;
    }

    const dirLabel = dir === 1 ? 'south' : 'north';
    el.innerHTML = '';
    routes.forEach((r, i) => {
      const card = document.createElement('div');
      card.className = 'route-card';

      const dist = walkDist(g, playerGameX, playerGameZ, r.startNode);
      const steps = [];

      if (dist > 5) steps.push(`Walk <span>${dist}m</span> to ${nodeName(g, r.startNode)}`);
      else steps.push(`Start at ${nodeName(g, r.startNode)}`);

      r.hops.forEach(([from, to]) => {
        steps.push(`<span class="arrow">→</span> ${nodeName(g, to)}`);
      });

      const jumpWord = r.jumps === 1 ? 'jump' : 'jumps';
      card.innerHTML = `
        <div class="rc-head">
          <span class="rc-jumps">${r.jumps} ${jumpWord}</span>
          <span class="rc-dist">+${r.dist.toLocaleString()} blocks ${dirLabel}</span>
        </div>
        <div class="rc-steps">${steps.join(' ')}</div>
      `;
      card.addEventListener('click', () => highlightRoute(i, g, playerGameX, playerGameZ));
      el.appendChild(card);
    });

    // auto-highlight the best route
    highlightRoute(routes.length - 1, g, playerGameX, playerGameZ);
  }

  function highlightRoute(idx, g, px, pz) {
    activeRouteIdx = idx;
    document.querySelectorAll('.route-card').forEach((c, i) => {
      c.classList.toggle('active', i === idx);
    });

    routeSource.clear();
    const r = lastRoutes[idx];
    if (!r) return;

    const py = -pz; // OL y from game Z

    // draw line through: player → startNode → hops
    const coords = [[px, py], [g.xs[r.startNode], g.ys[r.startNode]]];
    r.hops.forEach(([, to]) => coords.push([g.xs[to], g.ys[to]]));

    routeSource.addFeature(Object.assign(new ol.Feature(new ol.geom.LineString(coords)), { role: 'line' }));
    routeSource.getFeatures()[0].set('role', 'line');

    // TL nodes as dots (except start player marker)
    coords.slice(1, -1).forEach(c => {
      const f = new ol.Feature(new ol.geom.Point(c));
      f.set('role', 'hop');
      routeSource.addFeature(f);
    });
    // end node
    const ef = new ol.Feature(new ol.geom.Point(coords[coords.length - 1]));
    ef.set('role', 'end');
    routeSource.addFeature(ef);

    // fit view to route
    const extent = routeSource.getExtent();
    view.fit(extent, { padding: [60, 60, 60, 60], maxZoom: 7, duration: 400 });
  }

  /* ── wiring ─────────────────────────────────────────────────────────────── */
  const statusEl = document.getElementById('status-line');
  const btn = document.getElementById('find-btn');

  try {
    graph = await loadGraph();
    statusEl.textContent = `${graph.N} TL nodes loaded. Enter coordinates and click Find Routes.`;
    btn.disabled = false;
    btn.textContent = 'Find Routes';
  } catch (e) {
    statusEl.textContent = 'Failed to load translocator data: ' + e.message;
  }

  btn.addEventListener('click', () => {
    if (!graph) return;
    const px  = parseInt(document.getElementById('rx').value, 10)    || 0;
    const pz  = parseInt(document.getElementById('rz').value, 10)    || 0;
    const dir = parseInt(document.getElementById('rdir').value, 10);
    const walkR = parseInt(document.getElementById('rwalk').value, 10) || 500;
    const maxJ  = parseInt(document.getElementById('rmax').value, 10)  || 15;

    placeStartMarker(px, -pz);
    routeSource.clear();
    statusEl.textContent = 'Computing…';

    setTimeout(() => {
      const routes = findRoutes(graph, px, pz, dir, walkR, maxJ);
      statusEl.textContent = routes
        ? `${routes.length} Pareto-optimal routes found.`
        : `No TL nodes within ${walkR} blocks. Try increasing walk radius.`;
      renderRoutes(routes, graph, px, pz, dir);
    }, 10);
  });

  // also trigger on Enter
  document.querySelectorAll('#rx, #rz, #rdir, #rwalk, #rmax').forEach(el => {
    el.addEventListener('keydown', e => { if (e.key === 'Enter' && !btn.disabled) btn.click(); });
  });
})();

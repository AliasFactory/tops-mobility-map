# TOPS map (local) + Translocator Mobility heatmap

A local copy of the TOPS Vintage Story web map (map.tops.vintagestory.at) with a
custom **translocator mobility** heatmap overlay.

## Run

```bash
node server.mjs            # serves http://localhost:4242/  (PORT=4242 by default)
```

`server.mjs` serves the static frontend from this directory and **proxies any
missing path** through to the live TOPS map (a fallback; the GeoJSON and icons
are now vendored locally). Map tiles always stream directly from TOPS.

## Deploy to GitHub Pages

The site is static — no proxy needed. GeoJSON and icons are vendored in the repo;
map **tiles** are hotlinked from TOPS (plain images, so no CORS required).

```bash
git init && git add -A && git commit -m "TOPS mobility map"
git branch -M main
git remote add origin git@github.com:<you>/<repo>.git
git push -u origin main
# then: GitHub repo → Settings → Pages → Source: deploy from branch → main / (root)
```

`.nojekyll` is included so Jekyll doesn't touch the files. The site works from a
project subpath (`<you>.github.io/<repo>/`) because all paths are relative.

**Caveat:** this hotlinks the TOPS tile server's bandwidth. Fine for a personal
demo; if it gets real traffic, host the tiles yourself or ask the TOPS admins.
The `pre/` preprocessing stays offline — only the resulting `mobility.geojson`
is committed.

## Heatmap

`heatmap.js` adds an `ol.layer.Heatmap` overlay driven by `mobility.geojson`,
plus a control panel (top-right). Metrics:

- **Traffic mobility** (`m` / `md[]`) — all-pairs shortest-path flow through each
  node (betweenness, reachability-scaled). Sharp transit hubs. The **TL depth**
  slider sweeps precomputed depth-capped versions (`md[]`): low = only shallow
  few-jump routes (local hubs), `full` = uncapped (global hubs).
- **Local access** (`local`) — decayed sum of nearby translocators' mobility.
  Smooth "best-connected areas" surface.
- **Reachability** (`reach`) — connected-component size − 1.
- **Endpoint density** — flat 1 per node.

Render-time reweights (no recompute): **boost near x=0 / y=0**, **dim away from a
z line**, **contrast**, and the **TL depth** selector.

## Recompute the data

```bash
cd pre
# tunables (env vars):
#   MAX_WALK     max blocks walked between two TLs (graph density / compute limiter)
#   LOCAL_RADIUS radius for the `local` aggregate (default = MAX_WALK)
#   JUMP_COST    cost of one translocator jump (default 1)
#   SAMPLES      betweenness source samples; 0 or >=N = exact (default 1200)
#   DEPTHS       TL-jump depth caps for the slider (default "1,2,3,4,5,6,8,10";
#                an uncapped "full" level is always appended)
MAX_WALK=500 SAMPLES=0 node preprocess.mjs   # writes ../mobility.geojson (~3 min exact)
```

To refresh the source translocator data from TOPS:

```bash
curl -s http://localhost:4242/data/geojson/translocators.geojson -o pre/translocators.geojson
```

## Graph model

- nodes = distinct TL endpoints (rounded to block coords)
- jump edges = the translocator itself (A↔B, bidirectional, cost `JUMP_COST`)
- walk edges = between nodes within `MAX_WALK` blocks, cost = ground distance

At `MAX_WALK=300` the largest connected component is ~69% of nodes; raising
`MAX_WALK` connects more islands (and increases compute).

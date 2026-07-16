/* ###########################################################################
 * Translocator MOBILITY heatmap overlay.
 *
 * Loads precomputed scores from /mobility.geojson (built by pre/preprocess.mjs)
 * and renders one of several metrics, with render-time reweighting (no
 * recompute needed):
 *
 *   metric:
 *     m       traffic mobility  (all-pairs shortest-path flow / betweenness)
 *     local   local access      (decayed sum of nearby TLs' mobility)
 *     reach   reachable nodes   (connected-component size - 1)
 *     density flat 1 per node   (raw endpoint density)
 *
 *   axis boost: multiply weight near a world axis (x=0 OR y=0) by
 *     1 + strength * exp(-distToNearestAxis / width)
 *
 * Relies on globals from automap.js: `map`, `ol`.
 * ######################################################################### */
(function () {
  const state = {
    metric: 'm',
    gamma: 0.5, // visual compression of skewed scores (w = norm^gamma)
    axisOn: false,
    axisStrength: 1.5,
    axisWidth: 25000, // blocks; boost band half-width around an axis
    zOn: false,
    zTarget: 11000, // world z line to keep bright (display coord = -mapY)
    zDim: 0.7, // how much to dim everything away from the band (0..1)
    zWidth: 25000,
    depthIdx: 0, // index into the md[] depth levels; set to "full" on load
    radius: 9,
    blur: 22,
  };

  // Local access is an AREA metric: its heat should cover the real-world
  // accessibility catchment (in blocks), so it scales with zoom instead of
  // being a fixed-pixel TL-aimed dot. Set from mobility.geojson meta on load.
  let localWorldRadius = 500; // blocks (= preprocess LOCAL_RADIUS)
  const AREA_METRICS = new Set(['local']);

  let depthLabels = ['full']; // from meta.depths; aligned with each node's md[]
  let feats = []; // ol.Feature[] with raw props copied to feature

  const heatLayer = new ol.layer.Heatmap({
    name: 'TL Mobility',
    source: new ol.source.Vector(),
    blur: state.blur,
    radius: state.radius,
    opacity: 0.85,
    zIndex: 50,
    weight: (f) => f.get('w'),
  });
  map.addLayer(heatLayer);

  /* ---------------- adjustable z guide lines ---------------- */
  // Two horizontal dotted lines at chosen world-z values. A line at z=Z sits at
  // map-y = -Z (display z = -mapY) and spans the whole world in x.
  const SPAN = 2_000_000; // x half-width; far wider than the map, so it never ends on-screen
  const LINE_DEFS = [
    { z: 10000, color: '#ffd23f' },
    { z: 12000, color: '#3fd2ff' },
  ];
  const zLineFeats = LINE_DEFS.map(
    (d) => new ol.Feature({ geometry: new ol.geom.LineString([[-SPAN, -d.z], [SPAN, -d.z]]), col: d.color, z: d.z }),
  );
  const zLinesLayer = new ol.layer.Vector({
    name: 'Z guides',
    source: new ol.source.Vector({ features: zLineFeats }),
    zIndex: 60,
    style: (f) => [
      new ol.style.Style({
        stroke: new ol.style.Stroke({ color: 'rgba(0,0,0,0.6)', width: 3, lineDash: [2, 9] }),
      }),
      new ol.style.Style({
        stroke: new ol.style.Stroke({ color: f.get('col'), width: 1.5, lineDash: [2, 9] }),
        text: new ol.style.Text({
          text: 'z=' + f.get('z'),
          font: 'bold 12px sans-serif',
          fill: new ol.style.Fill({ color: f.get('col') }),
          stroke: new ol.style.Stroke({ color: 'rgba(0,0,0,0.7)', width: 3 }),
          placement: 'line',
          textBaseline: 'bottom',
          offsetY: -2,
        }),
      }),
    ],
  });
  map.addLayer(zLinesLayer);

  function setZLine(i, z) {
    zLineFeats[i].setGeometry(new ol.geom.LineString([[-SPAN, -z], [SPAN, -z]]));
    zLineFeats[i].set('z', z);
  }

  function axisBoost(x, y) {
    if (!state.axisOn) return 1;
    const d = Math.min(Math.abs(x), Math.abs(y)); // dist to nearest world axis
    return 1 + state.axisStrength * Math.exp(-d / state.axisWidth);
  }

  function zFocus(y) {
    if (!state.zOn) return 1;
    const z = -y; // display/world z = -mapY (matches the map's coord readout)
    const near = Math.exp(-Math.abs(z - state.zTarget) / state.zWidth); // 1 at line -> 0 far (long tail reaches edges)
    return Math.max(0, 1 - state.zDim * (1 - near)); // full near the band; >1 crushes the rest to 0
  }

  // recompute per-feature weight for current metric + boost, normalize, render
  function render() {
    // Normalize against the UN-boosted max so the boost isn't cancelled by
    // re-normalization (the brightest hubs already sit near the axes). Boosted
    // points then push past the reference and clamp into saturation, so the
    // strength slider keeps adding potency across its whole range.
    let baseMax = 0;
    const vals = new Float64Array(feats.length);
    for (let i = 0; i < feats.length; i++) {
      const f = feats[i];
      let base;
      if (state.metric === 'density') base = 1;
      else if (state.metric === 'm') base = f.get('md')[state.depthIdx]; // traffic mobility at chosen TL depth
      else base = f.get(state.metric);
      if (base > baseMax) baseMax = base;
      vals[i] = base * axisBoost(f.get('x'), f.get('y')) * zFocus(f.get('y'));
    }
    for (let i = 0; i < feats.length; i++) {
      const norm = baseMax > 0 ? vals[i] / baseMax : 0;
      feats[i].set('w', Math.min(1, Math.pow(norm, state.gamma)));
    }
    if (AREA_METRICS.has(state.metric)) {
      // RADIUS = real-world catchment: blocks / (map-units-per-pixel) = pixels,
      // scaled by the radius slider (default 9 => 1x the true ground area).
      // So it tracks zoom AND responds to the slider. Blur stays slider-driven.
      const res = map.getView().getResolution() || 1;
      const px = (localWorldRadius / res) * (state.radius / 9);
      heatLayer.setRadius(Math.max(4, Math.min(255, px)));
    } else {
      heatLayer.setRadius(state.radius);
    }
    heatLayer.setBlur(state.blur);
    heatLayer.getSource().changed();
  }

  // area metrics cover a fixed ground area, so re-size on zoom
  map.getView().on('change:resolution', () => {
    if (AREA_METRICS.has(state.metric)) render();
  });

  fetch('mobility.geojson')
    .then((r) => r.json())
    .then((geo) => {
      feats = geo.features.map((gf) => {
        const [x, y] = gf.geometry.coordinates;
        const f = new ol.Feature(new ol.geom.Point([x, y]));
        f.set('x', x);
        f.set('y', y);
        f.set('m', gf.properties.m);
        f.set('md', gf.properties.md || [gf.properties.m]); // per-depth traffic mobility
        f.set('local', gf.properties.local);
        f.set('reach', gf.properties.reach);
        f.set('w', 0);
        return f;
      });
      if (geo.meta && geo.meta.localRadius) localWorldRadius = geo.meta.localRadius;
      if (geo.meta && geo.meta.depths) depthLabels = geo.meta.depths;
      // set up the depth slider now that we know the levels; default to "full"
      state.depthIdx = depthLabels.length - 1;
      const ds = $('#hm-depth');
      ds.max = String(depthLabels.length - 1);
      ds.value = String(state.depthIdx);
      $('#hm-depthv').textContent = depthLabels[state.depthIdx];
      heatLayer.getSource().addFeatures(feats);
      render();
      console.log('[mobility] loaded', feats.length, 'nodes; depths=', depthLabels);
    })
    .catch((e) => console.error('[mobility] load failed', e));

  /* ---------------- control panel ---------------- */
  const panel = document.createElement('div');
  // These top/right values are only fallbacks; placePanel() below measures the
  // real chrome and repositions. See the note there.
  panel.style.cssText =
    'position:fixed;top:52px;right:8px;z-index:1000;width:210px;padding:10px 12px;' +
    'max-height:calc(100vh - 60px);overflow-y:auto;' +
    'font:12px/1.5 sans-serif;background:rgba(20,32,46,.92);color:#dfe9f3;' +
    'border:1px solid #2d5b87;border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,.4)';
  panel.innerHTML = `
    <div id="hm-head" style="display:flex;align-items:center;justify-content:space-between;
      cursor:pointer;user-select:none;font-weight:bold;margin-bottom:6px">
      <span>TL Mobility heatmap</span><span id="hm-caret">▾</span>
    </div>
    <div id="hm-body">
    <label style="display:block;position:relative">Metric
      <span id="hm-info" style="display:inline-block;width:14px;height:14px;line-height:14px;
        text-align:center;border-radius:50%;background:#2d5b87;color:#fff;font-style:italic;
        font-size:11px;cursor:help;user-select:none">i</span>
      <div id="hm-tip" style="display:none;position:absolute;right:0;top:20px;z-index:1001;
        width:250px;padding:9px 11px;background:#0f1822;border:1px solid #2d5b87;border-radius:5px;
        box-shadow:0 2px 8px rgba(0,0,0,.5);font-style:normal;font-weight:normal">
        <b>Traffic mobility</b> — models everyone travelling between every pair of places by the
        shortest translocator route, then colours each hub by how many of those trips pass
        <i>through</i> it. Bright = the chokepoint interchanges the whole network funnels through;
        stranded TL islands stay dark.<br><br>
        <b>Local access</b> — for each spot, adds up the mobility of the translocators you could
        walk to nearby (closer ones count more). Answers "if I settled here, how good is the TL
        access around me?" A smooth map of the best-connected neighbourhoods, not just single hubs.<br><br>
        <b>Reachability</b> — how many other places you can get to from here through the network
        (the size of its connected cluster). Bright on the main backbone everyone shares; dark in
        small isolated pockets that only link to a few destinations.<br><br>
        <b>Endpoint density</b> — ignores the network entirely and just counts how tightly
        translocator ends are packed. A plain "where are the TLs" baseline to compare the
        mobility metrics against.
      </div>
      <select id="hm-metric" style="width:100%">
        <option value="m">Traffic mobility</option>
        <option value="local">Local access</option>
        <option value="reach">Reachability</option>
        <option value="density">Endpoint density</option>
      </select>
    </label>
    <label style="display:block;margin-top:4px">TL depth <span id="hm-depthv">full</span>
      <input type="range" id="hm-depth" min="0" max="8" step="1" value="8" style="width:100%">
    </label>
    <label style="display:block;margin-top:6px">
      <input type="checkbox" id="hm-axis"> boost near x=0 / y=0
    </label>
    <label style="display:block">strength <span id="hm-strv">1.5</span>
      <input type="range" id="hm-str" min="0" max="4" step="0.1" value="1.5" style="width:100%">
    </label>
    <label style="display:block">width <span id="hm-widv">25000</span>
      <input type="range" id="hm-wid" min="2000" max="80000" step="1000" value="25000" style="width:100%">
    </label>
    <label style="display:block;margin-top:6px">
      <input type="checkbox" id="hm-zon"> dim away from z=
      <input type="number" id="hm-ztarget" value="11000" step="1000" style="width:70px">
    </label>
    <label style="display:block">dim amount <span id="hm-zstrv">0.7</span>
      <input type="range" id="hm-zstr" min="0" max="10" step="0.1" value="0.7" style="width:100%">
    </label>
    <label style="display:block">z width <span id="hm-zwidv">25000</span>
      <input type="range" id="hm-zwid" min="1000" max="80000" step="1000" value="25000" style="width:100%">
    </label>
    <label style="display:block;margin-top:4px">radius <span id="hm-radv">9</span>
      <input type="range" id="hm-rad" min="2" max="30" step="1" value="9" style="width:100%">
    </label>
    <label style="display:block">blur <span id="hm-blurv">22</span>
      <input type="range" id="hm-blur" min="2" max="50" step="1" value="22" style="width:100%">
    </label>
    <label style="display:block">contrast <span id="hm-conv">0.5</span>
      <input type="range" id="hm-con" min="0.2" max="3" step="0.1" value="0.5" style="width:100%">
    </label>
    <label style="display:flex;align-items:center;gap:6px;margin-top:6px">
      <input type="checkbox" id="hm-zlines" checked>
      <span style="color:#ffd23f">z line 1</span>
      <input type="number" id="hm-zl1" value="10000" step="500" style="width:74px">
    </label>
    <label style="display:flex;align-items:center;gap:6px">
      <span style="color:#3fd2ff;margin-left:20px">z line 2</span>
      <input type="number" id="hm-zl2" value="12000" step="500" style="width:74px">
    </label>
    <label style="display:block;margin-top:4px">
      <input type="checkbox" id="hm-on" checked> show overlay
    </label>
    </div>`;
  document.body.appendChild(panel);

  // Keep the panel clear of the map's own chrome instead of guessing offsets:
  // sit below the centered title bar (which can wrap to two rows) and to the
  // left of the top-right #tools box. Measured from the live layout so it stays
  // correct across zoom, resize and upstream chrome changes -- and it has to
  // live here rather than in css/default.css, which sync.mjs overwrites.
  function placePanel() {
    const GAP = 8;
    let top = GAP;
    const bar = document.getElementById('titleBar');
    if (bar) {
      const r = bar.getBoundingClientRect();
      if (r.width && r.height) top = r.bottom + GAP;
    }
    let right = GAP;
    for (const el of [document.getElementById('tools'), document.querySelector('.ol-zoom')]) {
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.width && r.height) right = Math.max(right, window.innerWidth - r.left + GAP);
    }
    panel.style.top = top + 'px';
    panel.style.right = right + 'px';
    panel.style.maxHeight = 'calc(100vh - ' + (top + GAP) + 'px)';
  }
  placePanel();
  window.addEventListener('resize', placePanel);
  window.addEventListener('load', placePanel); // re-measure once chrome has settled

  const $ = (id) => panel.querySelector(id);

  // collapse/expand the panel body (click the header). Starts expanded.
  $('#hm-head').onclick = () => {
    const body = $('#hm-body');
    const open = body.style.display !== 'none';
    body.style.display = open ? 'none' : '';
    $('#hm-caret').textContent = open ? '▸' : '▾';
  };

  // grey out + disable controls that have no effect under the current toggles
  function setCtl(id, on, dimLabel) {
    const inp = $(id);
    if (!inp) return;
    inp.disabled = !on;
    const t = dimLabel ? inp.closest('label') : inp;
    t.style.opacity = on ? '' : '0.4';
  }
  function updateEnabled() {
    const ov = $('#hm-on').checked; // overlay visible
    const a = ov && state.axisOn; // axis boost active
    const z = ov && state.zOn; // z dim active
    const zl = $('#hm-zlines').checked; // guide lines visible
    // heatmap controls die when the overlay is hidden
    setCtl('#hm-metric', ov, false);
    setCtl('#hm-depth', ov && state.metric === 'm', true); // depth only drives Traffic mobility
    setCtl('#hm-rad', ov, true);
    setCtl('#hm-blur', ov, true);
    setCtl('#hm-con', ov, true);
    // axis-boost sub-controls
    setCtl('#hm-str', a, true);
    setCtl('#hm-wid', a, true);
    // z-dim sub-controls
    setCtl('#hm-ztarget', z, false);
    setCtl('#hm-zstr', z, true);
    setCtl('#hm-zwid', z, true);
    // z guide-line positions (independent of the overlay)
    setCtl('#hm-zl1', zl, false);
    setCtl('#hm-zl2', zl, true);
  }

  const tip = $('#hm-tip');
  const info = $('#hm-info');
  const showTip = (on) => {
    tip.style.display = on ? 'block' : 'none';
  };
  info.onmouseenter = () => showTip(true);
  info.onmouseleave = () => showTip(false);
  info.onclick = () => showTip(tip.style.display === 'none');
  $('#hm-metric').onchange = (e) => {
    state.metric = e.target.value;
    updateEnabled();
    render();
  };
  $('#hm-depth').oninput = (e) => {
    state.depthIdx = Number(e.target.value);
    $('#hm-depthv').textContent = depthLabels[state.depthIdx] ?? state.depthIdx;
    if (state.metric === 'm') render();
  };
  $('#hm-axis').onchange = (e) => {
    state.axisOn = e.target.checked;
    updateEnabled();
    render();
  };
  $('#hm-str').oninput = (e) => {
    state.axisStrength = Number(e.target.value);
    $('#hm-strv').textContent = e.target.value;
    if (state.axisOn) render();
  };
  $('#hm-wid').oninput = (e) => {
    state.axisWidth = Number(e.target.value);
    $('#hm-widv').textContent = e.target.value;
    if (state.axisOn) render();
  };
  $('#hm-zon').onchange = (e) => {
    state.zOn = e.target.checked;
    updateEnabled();
    render();
  };
  $('#hm-ztarget').oninput = (e) => {
    state.zTarget = Number(e.target.value);
    if (state.zOn) render();
  };
  $('#hm-zstr').oninput = (e) => {
    state.zDim = Number(e.target.value);
    $('#hm-zstrv').textContent = e.target.value;
    if (state.zOn) render();
  };
  $('#hm-zwid').oninput = (e) => {
    state.zWidth = Number(e.target.value);
    $('#hm-zwidv').textContent = e.target.value;
    if (state.zOn) render();
  };
  $('#hm-rad').oninput = (e) => {
    state.radius = Number(e.target.value);
    $('#hm-radv').textContent = e.target.value;
    render();
  };
  $('#hm-blur').oninput = (e) => {
    state.blur = Number(e.target.value);
    $('#hm-blurv').textContent = e.target.value;
    render();
  };
  $('#hm-con').oninput = (e) => {
    state.gamma = Number(e.target.value);
    $('#hm-conv').textContent = e.target.value;
    render();
  };
  $('#hm-on').onchange = (e) => {
    heatLayer.setVisible(e.target.checked);
    updateEnabled();
  };
  $('#hm-zl1').oninput = (e) => setZLine(0, Number(e.target.value));
  $('#hm-zl2').oninput = (e) => setZLine(1, Number(e.target.value));
  $('#hm-zlines').onchange = (e) => {
    zLinesLayer.setVisible(e.target.checked);
    updateEnabled();
  };
  updateEnabled(); // initial state
})();

# Third-party notices

This site is a mirror of the TOPS Vintage Story web map with an analysis
overlay added. Most of what it serves was written by other people. Their
licences require their copyright notices to travel with any redistribution,
including a static deploy like this one, so they are reproduced in full below.

Our own code is MIT — see `LICENSE`.

| Component | Files | Licence |
|---|---|---|
| WebCartographer v0.11.3 | `automap.js`, `route.js`, `traders.js`, `settings.js`, `version.js`, `worldExtent.js`, `index.html`, `contribute-fragment.html`, `css/`, `assets/` | MIT |
| OpenLayers 10.6.0 | `lib/ol.js`, `lib/ol.css` | BSD-2-Clause |
| ol-ext 4.0.32 | `lib/ol-ext.min.js`, `lib/ol-ext.min.css` | CeCILL-B (BSD-compatible) |
| Font Awesome Free 6.7.2 | `css/fontawesome.min.css`, `css/solid.min.css`, `webfonts/` | Icons CC BY 4.0, Fonts SIL OFL 1.1, Code MIT |
| Twemoji | `assets/favicon.svg` | CC BY 4.0 |
| TOPS map data & tiles | `data/geojson/`, hotlinked `data/world/` tiles | **No stated licence — see below** |

## Map data and terrain tiles

`data/geojson/` (translocators, landmarks, traders) is mirrored from
map.tops.vintagestory.at, and the terrain tiles are hotlinked directly from
that server at render time — they are not vendored here.

This data is surveyed and contributed by players of the TOPS server. It
carries no stated licence. WebCartographer being MIT covers the *software*
that draws the map, not the dataset, so nothing in this repository grants any
rights over it. It is mirrored here on the understanding that it is published
publicly by TOPS for the community; if the TOPS admins would prefer it not be
mirrored, or would prefer the tiles not be hotlinked, that request takes
precedence over anything written here.

`mobility.geojson` is derived from that data (see `pre/preprocess.mjs`). The
analysis and code are ours; the underlying survey data is not.

---

## WebCartographer

by Th3Dilli, Zadak and Drakker — https://gitlab.com/th3dilli_vintagestory/WebCartographer

```
MIT License

Copyright (c) 2023 Th3Dilli

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## OpenLayers

https://openlayers.org/

```
BSD 2-Clause License

Copyright 2005-present, OpenLayers Contributors. All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice,
   this list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

## ol-ext

by Jean-Marc Viglino — https://github.com/Viglino/ol-ext

Released under the CeCILL-B Free Software License, a French BSD-compatible
open source licence. Full text: https://www.cecill.info/licences/Licence_CeCILL-B_V1-en.txt

```
Copyright (c) Jean-Marc Viglino, released under CeCILL-B licence
(French BSD compatible).
```

## Font Awesome Free 6.7.2

https://fontawesome.com — Copyright 2024 Fonticons, Inc.

Licence: https://fontawesome.com/license/free

- Icons: **CC BY 4.0** — https://creativecommons.org/licenses/by/4.0/
- Fonts: **SIL OFL 1.1** — https://scripts.sil.org/OFL
- Code: **MIT**

Font Awesome is attributed here as CC BY 4.0 requires; the original licence
headers are also retained inside the vendored CSS files.

## Twemoji

Used for `assets/favicon.svg`.

Copyright Twitter, Inc and other contributors. Graphics licensed under
**CC BY 4.0** — https://creativecommons.org/licenses/by/4.0/

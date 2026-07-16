// Get the data we need for the URL copy/paste handling
let title = document.title = settings.title;
let adr = document.location.href.replace(/\?.*/, "");

const args = new URLSearchParams(document.location.href.replace(/.*\?/, ''));

let serverWebsite = document.getElementById("serverWebsite");
let serverWebsite2 = document.getElementById("serverWebsite2");
serverWebsite.innerHTML = settings.title;
serverWebsite.href = settings.siteUrl;
serverWebsite2.innerHTML = settings.titleBarCommunity;
serverWebsite2.href = settings.siteUrl;
let lastUpdated = document.getElementById("lastUpdated");
lastUpdated.innerText = settings.updateText + settings.lastUpdated;

// Webmap build version, shown in the Credits foldout. This tracks the frontend
// (this fork), independently of the data's "last updated" timestamp above.
// version.js is overwritten by the build (Cake Package task) with the current
// git commit date and hash; the constants below are the fallback when no
// version.js is present.
const WEBMAP_VERSION = (typeof webmapVersionInfo !== "undefined" && webmapVersionInfo.version) || "0.0.1";
const WEBMAP_VERSION_DATE = (typeof webmapVersionInfo !== "undefined" && webmapVersionInfo.date) || "2026-06-03";
const WEBMAP_VERSION_COMMIT = (typeof webmapVersionInfo !== "undefined" && webmapVersionInfo.commit) || "";
let webmapVersion = document.getElementById("webmapVersion");
if (webmapVersion) {
    let vText = "Webmap v" + WEBMAP_VERSION + " (" + WEBMAP_VERSION_DATE + ")";
    if (WEBMAP_VERSION_COMMIT) {
        vText += " · " + WEBMAP_VERSION_COMMIT;
    }
    webmapVersion.innerText = vText;
}
let titleName = document.getElementById("titleName");
titleName.innerText = settings.titleBarName;

let cx = 0;
let cy = 0;
let zm = 6;
let dataFolder = 'data';
let visiableIcon = '<i class="fa-solid fa-eye"></i>';
let invisiableIcon = '<i class="fa-solid fa-eye-slash"></i>';

if (args.has('x')) {
    cx = args.get('x')
}
if (args.has('y')) {
    cy = -args.get('y')
}
if (args.has('zoom')) {
    zm = args.get('zoom')
}

if (localStorage.labelSize === undefined) {
    localStorage.labelSize = 10;
}
if (localStorage.theme === undefined) {
    localStorage.theme = 'css/classicblue.css'
}

function applyStyle() {
    for (let ss = 0; ss < document.styleSheets.length; ss++) {
        if (document.styleSheets[ss].title == 'color') {
            if (!localStorage.theme.startsWith("css")) {
                localStorage.theme = "css/" + localStorage.theme
            }
            document.styleSheets[ss].ownerNode.href = localStorage.theme;
            break;
        }
    }
}

applyStyle();

// Find the inspector
let inspector = document.getElementById('status');

// Path for all the icons, layers with multiple icons use a dict
let icons = {
    'Traders': 'assets/icons/waypoints/trader.svg',
    'Translocators': 'assets/icons/waypoints/spiral.svg',
    'Landmarks': {
        'Base': 'assets/icons/waypoints/home.svg',
        'Misc': 'assets/icons/waypoints/star1.svg',
        'Server': 'assets/icons/temporal_gear.png'
    },
    'Explored Chunks': 'assets/icons/default/square.png'
}

// Icons color references table by icon type
let colorsRef = {
    'Traders': {
        'Artisan trader': [0, 240, 240],
        'Building materials trader': [255, 0, 0],
        'Clothing trader': [0, 128, 0],
        'Commodities trader': [128, 128, 128],
        'Agriculture trader': [200, 192, 128],
        'Furniture trader': [255, 128, 0],
        'Luxuries trader': [0, 0, 255],
        'Survival goods trader': [255, 255, 0],
        'Treasure hunter trader': [160, 0, 160],
        'unknown': [48, 48, 48]
    },
    'Translocators': {
        'Translocator': [192, 0, 192],
        'Named Translocator': [71, 45, 255],
        'Elk Translocator': [110, 180, 70],
        'Spawn Translocator': [0, 192, 192],
        'Teleporter': [229, 57, 53]
    },
    'Landmarks': {
        'Server': undefined, // This one uses a PNG, we don't want to color it
        'Base': [192, 192, 192],
        'Misc': [224, 224, 224]
    }
}
let showSubLayerItems = {
    "Traders": {
        "Artisan trader": true,
        "Building materials trader": true,
        "Clothing trader": true,
        "Commodities trader": true,
        "Agriculture trader": true,
        "Furniture trader": true,
        "Luxuries trader": true,
        "Survival goods trader": true,
        "Treasure hunter trader": true,
        "unknown": true,
    },
    "Translocators": {
        "Translocator": true,
        "Named Translocator": true,
        "Elk Translocator": true,
        "Spawn Translocator": true,
        "Teleporter": true,
    },
    "Landmarks": {
        "Server": true,
        "Base": true,
        "Misc": true,
    },
};

// Feature availability derived from settings.js. Default to enabled when a flag
// is absent so older settings.js files (which persist across updates) keep every
// feature working. When disabled, the matching tool and any translocator-based
// options inside other tools are hidden entirely rather than shown broken.
const tradersExported = typeof settings === 'undefined' || settings.tradersExported !== false;
const translocatorsExported = typeof settings === 'undefined' || settings.translocatorsExported !== false;
const chunksExported = typeof settings === 'undefined' || settings.chunksExported === true;

let toolsRef = {
    'zoomIn': {
        'id': 'zoomIn',
        'icon': '+',
        'title': 'Zoom in',
        'callback': function (e) {
            view.animate({zoom: view.getConstrainedZoom(view.getZoom() + 1), duration: 100});
        }
    },
    'zoomOut': {
        'id': 'zoomOut',
        'icon': '−',
        'title': 'Zoom out',
        'callback': function (e) {
            view.animate({zoom: view.getConstrainedZoom(view.getZoom() - 1), duration: 100});
        }
    },
    'origin': {
        'id': 'origin',
        'icon': '🧭',
        'title': 'Move and zoom to the server spawn (H)',
        'callback': function (e) {
            goToCoords('0,0');
        }
    },
    'goToCoords': {
        'id': 'goToCoords',
        'icon': '🔍',
        'title': 'Move and zoom to coordinates (G)',
        'callback': function (e) {
            poper.createPopup('gps');
        }
    },
    'goToLandmark': {
        'id': 'goToLandmarks',
        'icon': '🏛',
        'title': 'Move and zoom to selected landmark (L)',
        'callback': function (e) {
            poper.createPopup('landmarks');
        }
    },
    'route': {
        'id': 'route',
        'icon': '🛣',
        'title': 'Translocator route planner: place 2 points to find the shortest path (R)',
        'callback': function (e) {
            toggleRouteMode();
        }
    },
    'findTrader': {
        'id': 'findTrader',
        'icon': '🛒',
        'title': 'Nearest trader finder: click a point to find the closest trader of each type (T)',
        'callback': function (e) {
            toggleTraderMode();
        }
    },
    'tlProximity': {
        'id': 'tlProximity',
        'icon': '🌀',
        'title': 'Translocator proximity filter: only show translocators near the cursor for better performance. Click the map to pin/unpin the area (P)',
        'callback': function (e) {
            toggleTlProximityMode();
        }
    },
    'settings': {
        'id': 'settings',
        'icon': '🔧',
        'title': 'Customize the Web Map',
        'callback': function (e) {
            poper.createPopup('settings');
        }
    }
}

let popupsRef = {
    'gps': {
        'title': 'Move to coordinates',
        'css': ['c', 'gps'],
        'elements': {
            'description': {
                'type': 'p',
                'content': "Enter the coordinates you want to reach in either of these two formats:"
            },
            'description2': {
                'type': 'p',
                'content': "X,Z in game coordinates: 2050,6900"
            },
            'description3': {
                'type': 'p',
                'content': "Campaign cartographer: X = -1170, Y = 113, Z = -3800"
            },
            'input': {
                'type': 'input',
                'input-type': 'text',
                'id': 'input_data',
                'name': 'input_data',
                'label': 'Coordinates:',
                'focus': true,
                'onkeypress': "if (event.keyCode == 13) { if (goToCoords(document.getElementById('input_data').value.trim())) { poper.destroyPopup('gps'); } }"
            }
        },
        'controls': {
            'Ok': {
                'title': 'Go to coordinates',
                'default': true,
                'callback': function (e) {
                    if (goToCoords(document.getElementById('input_data').value.trim())) {
                        poper.destroyPopup('gps');
                    }
                }
            },
            'Cancel': {
                'title': 'Cancel',
                'callback': function (e) {
                    poper.destroyPopup('gps');
                }
            }
        }
    },
    'landmarks': {
        'title': 'Go to landmark',
        'css': ['c', 'gps'],
        'elements': {
            'description': {
                'type': 'p',
                'content': "Type to filter, then pick a landmark from the list."
            },
            'input': {
                'type': 'select',
                'id': 'select_data',
                'name': 'select_data',
                'label': 'Landmarks from the "Landmarks" layer:',
                'focus': true,
                'searchable': true,
                'source': 'Landmarks',
                'onkeypress': "if (event.keyCode == 13) { if (goToCoords(document.getElementById('select_data').value.trim())) { poper.destroyPopup('landmarks'); } }"
            }
        },
        'controls': {
            'Ok': {
                'title': 'Go to landmark',
                'default': true,
                'callback': function (e) {
                    if (goToCoords(document.getElementById('select_data').value.trim())) {
                        poper.destroyPopup('landmarks');
                    }
                }
            },
            'Cancel': {
                'title': 'Cancel',
                'callback': function (e) {
                    poper.destroyPopup('landmarks');
                }
            }
        }
    },
    'translocator': {
        'title': 'Translocators pair information',
        'css': ['c', 'gps'],
        'elements': 'params',
        'controls': {
            'Close': {
                'title': 'Close',
                'callback': function (e) {
                    poper.destroyPopup('translocator');
                }
            }
        }
    },
    'trader': {
        'title': 'Trader information',
        'css': ['c', 'gps'],
        'elements': 'params',
        'controls': {
            'Close': {
                'title': 'Close',
                'callback': function (e) {
                    poper.destroyPopup('trader');
                }
            }
        }
    },
    'contribute': {
        'title': 'Web Map Contribution Guide',
        'css': ['c', 'guide'],
        'elements': {
            'description': {
                'type': 'extSource',
                'content': 'contribute-fragment.html'
            }
        },
        'controls': {
            'Close': {
                'title': 'Close',
                'callback': function (e) {
                    poper.destroyPopup('contribute');
                }
            }
        }
    },
    'settings': {
        'title': 'Map Settings',
        'css': ['c', 'gps'],
        'elements': {
            'description': {
                'type': 'p',
                'content': "Customize the Web Map to your liking."
            },
            'input1': {
                'type': 'select',
                'id': 'theme_data',
                'name': 'theme_data',
                'label': 'Legend and Tools Style:',
                'focus': true,
                'source': [{op: 'Classic Blue', val: 'css/classicblue.css'},
                    {op: 'Charcoal Gray', val: 'css/charcoalgray.css'}]
            },
            'input2': {
                'type': 'input',
                'input-type': 'number',
                'min': 8,
                'max': 144,
                'default': function () {
                    return localStorage.labelSize
                },
                'id': 'label_size_data',
                'name': 'label_size_data',
                'label': 'Label Size (px):',
                'focus': false,
            }
        },
        'controls': {
            'Ok': {
                'title': 'Apply changes',
                'default': true,
                'callback': function (e) {
                    localStorage.labelSize = document.getElementById('label_size_data').value;
                    localStorage.theme = document.getElementById('theme_data').value;
                    applyStyle();
                    vsLandmarks.getSource().refresh();
                    poper.destroyPopup('settings');
                }
            },
            'Cancel': {
                'title': 'Cancel',
                'callback': function (e) {
                    poper.destroyPopup('settings');
                }
            }
        }
    }
}

/* ######################### Popups Manager ######################### */
class PopupManager {
    constructor() {
        this.popups = {}
    }

    createPopup(which, show = true, params = false) {
        if (!(which in this.popups) && which in popupsRef) {
            let focus = false;
            let popupBlock = document.createElement('DIV');
            popupBlock.id = 'popup_' + which;
            popupBlock.className = 'popup ' + popupsRef[which]['css'].join(' ');
            let title = document.createElement('div');
            title.className = 'title';
            let txt = document.createTextNode(popupsRef[which]['title']);
            title.append(txt);
            this.popups[which] = popupBlock;
            popupBlock.append(title);
            let ref = popupsRef[which]['elements'];
            if (popupsRef[which]['elements'] == 'params') {
                ref = params['elements']
            }
            for (let el in ref) {
                let e = ref[el];
                switch (e['type']) {
                    // Paragraph //
                    case 'p': {

                        let paragraph = document.createElement('P');
                        paragraph.innerHTML = e['content'];
                        popupBlock.append(paragraph);
                        break;
                    }
                    // Input box //
                    case 'input': {
                        if (e['label']) {
                            let label = document.createElement('LABEL');
                            label.for = e['name'];
                            label.innerText = e['label'];
                            popupBlock.append(label);
                        }
                        let input = document.createElement('INPUT');
                        input.type = e['input-type'];
                        if (input.type == 'number') {
                            input.min = e['min'];
                            input.max = e['max'];
                            if (typeof e['default'] === 'function') {
                                input.value = e['default']();
                            } else {
                                input.value = e['default'];
                            }
                        }
                        input.name = e['name'];
                        input.id = e['id'];
                        if (e['onkeypress']) {
                            input.setAttribute('onkeypress', e['onkeypress']);
                        }
                        popupBlock.append(input);
                        if (e['focus']) {
                            focus = e['id'];
                        }
                        break;
                    }
                    // Select box //
                    case 'select': {
                        if (e['label']) {
                            let label = document.createElement('LABEL');
                            label.for = e['name'];
                            label.innerText = e['label'];
                            popupBlock.append(label);
                        }
                        let input = document.createElement('SELECT');
                        input.name = e['name'];
                        input.id = e['id'];
                        let index = 0;
                        if (typeof (e['source']) === 'object') {
                            for (let option in e['source']) {
                                let op = document.createElement('OPTION');
                                op.value = e['source'][option]['val'];
                                op.innerHTML = e['source'][option]['op'];
                                input.append(op);
                                if (e['source'][option]['val'] == localStorage.theme) {
                                    input.selectedIndex = option;
                                }
                            }
                        }
                        // TODO : move that to the declaration side
                        else if (e['source'] === 'Landmarks') {
                            map.getLayers().forEach((layer) => {
                                if (layer.get('name') == e['source']) {
                                    layer.getSource().forEachFeature((feature) => {
                                        let op = document.createElement('OPTION');
                                        let coords = feature.getGeometry().getCoordinates();
                                        coords[1] *= -1;
                                        op.value = coords.toString();
                                        op.innerHTML = feature.get('label');
                                        input.append(op);
                                    });
                                    let options = Array.from(input.options);
                                    options.sort((a, b) => a.text.localeCompare(b.text));
                                    input.innerHTML = "";
                                    options.forEach(option => input.appendChild(option));
                                }
                            });
                            Array.from(input.children).sort((a, b) => a.textContent.toUpperCase() >= b.textContent.toUpperCase()).forEach((option) => input.appendChild(option));
                            input.selectedIndex = 0;
                        } else {
                            console.log('Error: parameter must be a dict with {op, val}.');
                        }
                        if (e['onkeypress']) {
                            input.setAttribute('onkeypress', e['onkeypress']);
                        }
                        if (e['searchable']) {
                            // Turn the dropdown into a filterable listbox: a text
                            // box narrows the visible options live while the
                            // <select> still holds the real value, so the Ok /
                            // Enter handlers keep working unchanged.
                            let search = document.createElement('INPUT');
                            search.type = 'text';
                            search.id = e['id'] + '_search';
                            search.placeholder = 'Type to filter\u2026';
                            search.autocomplete = 'off';
                            search.style.marginBottom = '4px';
                            input.size = Math.min(8, Math.max(2, input.options.length));
                            let filterOptions = function () {
                                let q = search.value.trim().toLowerCase();
                                let firstVisible = null;
                                for (let op of Array.from(input.options)) {
                                    let match = op.text.toLowerCase().indexOf(q) !== -1;
                                    op.hidden = !match;
                                    op.disabled = !match;
                                    if (match && !firstVisible) firstVisible = op;
                                }
                                // Keep a valid selection so Ok / Enter navigate to a
                                // visible result instead of a filtered-out one.
                                let cur = input.selectedOptions[0];
                                if (firstVisible) {
                                    if (!cur || cur.hidden) firstVisible.selected = true;
                                } else {
                                    input.selectedIndex = -1;
                                }
                            };
                            search.addEventListener('input', filterOptions);
                            // Arrow-down jumps from the filter box into the list.
                            search.addEventListener('keydown', function (ev) {
                                if (ev.key === 'ArrowDown') {
                                    ev.preventDefault();
                                    input.focus();
                                }
                            });
                            if (e['onkeypress']) {
                                search.setAttribute('onkeypress', e['onkeypress']);
                            }
                            popupBlock.append(search);
                        }
                        popupBlock.append(input);
                        if (e['focus']) {
                            focus = e['searchable'] ? (e['id'] + '_search') : e['id'];
                        }
                        break;
                    }
                    // Web Object
                    case 'extSource': {
                        async function getFragment(u) {
                            return await (await fetch(u)).text();
                        }

                        async function getFragmentWrapper(div, content) {
                            div.innerHTML = await getFragment(content);
                        }

                        let div = document.createElement('DIV');
                        div.innerHTML = '<p>Loading... ⌛</p>';
                        div.innerHTML = getFragmentWrapper(div, e['content']);
                        popupBlock.append(div);
                        break;
                    }
                }
            }
            let controls = document.createElement('DIV');
            controls.className = 'controls';
            for (let el in popupsRef[which]['controls']) {
                let e = popupsRef[which]['controls'][el];
                let button = document.createElement('button');
                button.innerHTML = e['title'];
                button.className = 'c';
                if (e['default']) {
                    button.classList.add('default');
                }
                button.title = e['title'];
                button.id = 'popup_' + which + '_' + e['title'];
                button.onclick = e['callback'];
                controls.append(button);
            }
            popupBlock.append(controls);
            if (show) {
                this.showPopup(which, focus)
            }
        } else {
            console.log(`Can't create popup '${which}' because it already exists or its definition doesn't exist.`)
        }
    }

    showPopup(which, focus = false) {
        this.popups[which].classList.add('vis');
        let popupBG = document.createElement('DIV');
        popupBG.id = 'popupBG';
        document.body.appendChild(popupBG);
        document.body.appendChild(this.popups[which]);
        if (focus) {
            document.getElementById(focus).focus();
        }
    }

    destroyPopup(which) {
        this.popups[which].remove();
        delete this.popups[which];
        document.getElementById('popupBG').remove();
    }
}

/* ######################### Tools ######################### */
class Tools {
    constructor() {
        this.tools = {}
    }

    addTools() {
        let toolsBlock = document.getElementById('tools');
        let btHide = document.createElement('button');
        for (let el in toolsRef) {
            let e = toolsRef[el];
            // Hide tools whose underlying data was not exported.
            if (e['id'] === 'findTrader' && !tradersExported) continue;
            if (e['id'] === 'tlProximity' && !translocatorsExported) continue;
            if (e['id'] === 'route' && !translocatorsExported) continue;
            let button = document.createElement('button');
            button.innerHTML = e['icon'];
            button.title = e['title'];
            button.id = e['id'];
            button.onclick = e['callback'];
            toolsBlock.append(button)
        }
    }

    enableTool(which) {
        console.log('not yet');
    }

    disableTool(which) {
        console.log('not yet dis');
    }
}

class Credits {
    constructor(elementId) {
        this.el = document.getElementById(elementId);
        this.text = this.el.querySelector(".left");
        this.toggler = this.el.querySelector(".right");
        this.togglerArrow = this.el.querySelector(".arrow");
        this.toggler.addEventListener("click", (e) => {
            this.toggle();
        });
        this.text.style.display = "none";
        this.togglerArrow.textContent = "▶";
        this.state = "hidden";
    }

    toggle() {
        if (this.state == "visible") {
            this.text.style.display = "none";
            this.state = "hidden";
            this.togglerArrow.textContent = "▶";
        } else {
            this.text.style.display = "block";
            this.state = "visible";
            this.togglerArrow.textContent = "◀";
        }
    }
}

/* ######################### View movement function ######################### */
function goToCoords(where) {
    where = where.replace(/[\s\u00A0\t]/g, '');
    if (where.match(/,/g) && where.match(/,/g).length > 0) {
        where = where.replace(/[^\d,-]/g, '');
        let xy = where.split(/,/);
        xy[1] = -xy[1];
        if (xy.length == 2) {
            view.animate({'center': [xy[0], xy[1]], 'duration': 200});
        } else {
            view.animate({'center': [xy[0], xy[2]], 'duration': 200});
        }
        return true
    } else if (where.match(/=/g) && where.match(/=/g).length == 3) {
        where = where.replace(/[^\d=-]/g, '').replace(/=/, '');
        let xyz = where.split(/=/);
        xyz[2] = -xyz[2];
        view.animate({'center': [xyz[0], xyz[2]], 'duration': 200});
        return true
    }
    return false
}

/* ######################### LayerSwitcher ######################### */
class LayerSwitcher {
    constructor(elementId) {
        this.el = document.getElementById(elementId);
        this.layers = {}
    }

    toggleVis(layerName) {
        map.getLayers().forEach(function (layer) {
            if (layer.get('name') == layerName) {
                if (layer.get('visible')) {
                    layer.setVisible(false);
                    document.getElementById('layerSwitcherBtHide' + layer.get('name')).innerHTML = invisiableIcon;
                    switcher.toggleLegendVis(layer.get('name'), true);
                } else {
                    layer.setVisible(true);
                    document.getElementById('layerSwitcherBtHide' + layer.get('name')).innerHTML = visiableIcon;
                }
            }
        })
    }

    toggleLegendVis(legendName, hideOnly) {
        let legend = document.getElementById('legend' + legendName);
        if (legend.showLegend == true) {
            legend.showLegend = false;
            legend.style.display = 'none';
            document.getElementById('layerSwitcherBtLegend' + legendName).innerHTML = '▽';
        } else if (!hideOnly) {
            legend.showLegend = true;
            legend.style.display = '';
            document.getElementById('layerSwitcherBtLegend' + legendName).innerHTML = '△';
        }
    }

    buildLegend(layer) {
        let layerBlock = document.createElement('DIV');
        layerBlock.id = 'ls' + layer.get('name');
        layerBlock.className = 'layerBlock';
        this.el.append(layerBlock);
        let title = document.createElement('div');
        title.className = 'layerSwitcherTitle';
        let txt = document.createTextNode(layer.get('name'));
        title.append(txt);
        let btHide = document.createElement('button');
        btHide.layerSwitch = layer.get('name');
        btHide.innerHTML = visiableIcon;
        btHide.className = 'c';
        btHide.title = 'Toggle the visibility for the ' + layer.get('name') + ' layer.';
        btHide.id = 'layerSwitcherBtHide' + layer.get('name');
        btHide.onclick = function (e) {
            switcher.toggleVis(layer.get('name'));
        }
        let btLegend = document.createElement('button');
        btLegend.legendSwitch = layer.get('name');
        btLegend.innerHTML = '△';
        btLegend.className = 'c';
        btLegend.title = 'Toggle the legend visibility for the ' + layer.get('name') + ' layer.';
        btLegend.id = 'layerSwitcherBtLegend' + layer.get('name');
        btLegend.onclick = function (e) {
            switcher.toggleLegendVis(layer.get('name'), false);
        }
        title.append(btLegend);
        title.append(btHide);
        layerBlock.append(title);
        let itemsList = document.createElement('ul');
        itemsList.showLegend = true;
        itemsList.id = 'legend' + layer.get('name');
        if (layer instanceof ol.layer.Tile) {
            // Warning: hard coded stuff, if we want legends on other raster layers, this needs to change
            for (let i in genChunksPalette) {
                let curId = 'icon' + layer.get('name').replace(/ /, '') + i.replace(/\./, 'd');
                let row = document.createElement('li');
                let symbol = document.createElement('object');
                symbol.data = icons[layer.get('name')]
                symbol.style = 'width: 5mm; height: auto; vertical-align: middle; margin-right: 4pt; margin-bottom: 4pt;';
                symbol.type = 'image/svg+xml';
                symbol.id = curId;
                symbol.layer = layer.get('name');
                symbol.versionString = i;
                symbol.addEventListener('load', function (e) {
                    e.target.contentDocument.getElementById('icon').setAttribute('style', e.target.contentDocument.getElementById('icon').getAttribute('style').replace(/#ffffff/, 'rgb(' +
                            genChunksPalette[e.target.versionString][0] +
                            ',' +
                            genChunksPalette[e.target.versionString][1] +
                            ',' +
                            genChunksPalette[e.target.versionString][2] + ')'
                        )
                    );
                });
                row.append(symbol);
                row.append(document.createTextNode(i));
                itemsList.append(row);
            }
        } else {
            for (let i in colorsRef[layer.get('name')]) {
                let curId = 'icon' + layer.get('name') + i.replace(/ /, '');
                let row = document.createElement('li');
                let symbol = document.createElement('object');
                let btHide = document.createElement('button');
                btHide.layerSwitch = "Item: " + i;
                btHide.innerHTML = visiableIcon;
                btHide.className = 'c';
                btHide.title = 'Toggle the visibility for the ' + "Item: " + i + ' layer.';
                btHide.id = 'layerSwitcherBtHideI' + i;
                btHide.onclick = function (e) {
                    //switcher.toggleVis("Item: "+i); 
                    let isOn = showSubLayerItems[layer.get('name')][i];
                    showSubLayerItems[layer.get('name')][i] = !isOn;
                    let icon = isOn ? invisiableIcon : visiableIcon;
                    document.getElementById('layerSwitcherBtHideI' + i).innerHTML = icon;
                    vsTranslocators.changed();
                    vsTraders.changed();
                    vsLandmarks.changed();
                }

                if (typeof (icons[layer.get('name')]) == "object") {
                    symbol.data = icons[layer.get('name')][i]
                    if (symbol.data.endsWith('png')) {
                        symbol.style = 'vertical-align: middle; margin-right: 4pt; margin-bottom: 4pt;';
                        symbol.type = 'image/png';
                    } else {
                        symbol.style = 'width: 5mm; height: auto; vertical-align: middle; margin-right: 4pt; margin-bottom: 4pt;';
                        symbol.type = 'image/svg+xml';
                    }
                } else {
                    symbol.data = icons[layer.get('name')]
                    symbol.style = 'width: 5mm; height: auto; vertical-align: middle; margin-right: 4pt; margin-bottom: 4pt;';
                    symbol.type = 'image/svg+xml';
                }
                symbol.id = curId;
                symbol.layer = layer.get('name');
                symbol.traderType = i;
                if (symbol.data.endsWith('svg')) {
                    symbol.addEventListener('load', function (e) {
                        e.target.contentDocument.getElementById('icon').setAttribute('style', e.target.contentDocument.getElementById('icon').getAttribute('style').replace(/#ffffff/, 'rgb(' +
                                colorsRef[e.target.layer][e.target.traderType][0] +
                                ',' +
                                colorsRef[e.target.layer][e.target.traderType][1] +
                                ',' +
                                colorsRef[e.target.layer][e.target.traderType][2] + ')'
                            )
                        );
                    });
                }
                row.append(symbol);
                row.append(document.createTextNode(i));
                row.append(btHide);
                itemsList.append(row);
                //svg.contentDocument.getElementById('icon').setAttribute('fill', i[1]);
            }
        }
        this.el.append(itemsList);
        this.layers[layer.get('name')] = layerBlock
    }
}

let switcher = new LayerSwitcher('layerSwitcher')

/* ######################### Highlight styles ######################### */
let highlightStyleTranslocator = [
    new ol.style.Style({
        stroke: new ol.style.Stroke({
            color: '#ddaaff',
            width: 3,
        }),
    }),
    new ol.style.Style({
        image: new ol.style.Icon({
            color: [255, 192, 255],
            opacity: 1,
            src: icons['Translocators']
        }),
        geometry: function (feature) {
            let coordinates = feature.getGeometry().getCoordinates();
            return new ol.geom.MultiPoint(coordinates);
        }
    })
];

let highlightStyleTrader = function (feature) {
    return new ol.style.Style({
        image: new ol.style.Icon({
            color: colorsRef['Traders'][feature.get('wares')].map((val, i) => Math.min(Math.max(val * 1.5, 64), 255)),
            src: icons['Traders'],
        })
    })
}

/* ######################### Default layer styles ######################### */
let vsLandmarks = new ol.layer.Vector({
    name: 'Landmarks',
    minZoom: 2,
    source: new ol.source.Vector({
        url: dataFolder + '/geojson/landmarks.geojson',
        format: new ol.format.GeoJSON(),
    }),
    style: function (feature) {
        if (feature.get('type') == 'Misc' && map.getView().getZoom() < 9) {
            return new ol.style.Style({
                image: new ol.style.Icon({
                    opacity: 0,
                    src: icons['Landmarks'][feature.get('type')]
                })
            })
        } // TODO : find a way to return nothing instead of an invisible icon, it would probably be more efficient 
        else {
            let isOn = showSubLayerItems['Landmarks'][feature.get('type')];
            let image = null, text = null;
            if (isOn) {
                image = new ol.style.Icon({
                    color: colorsRef['Landmarks'][feature.get('type')],
                    opacity: isOn,
                    src: icons['Landmarks'][feature.get('type')],
                });
                text = new ol.style.Text({
                    font: 'bold ' + String(localStorage.labelSize) + 'px "arial narrow", "sans serif"',
                    text: feature.get('label'),
                    textAlign: 'left',
                    textBaseline: 'bottom',
                    offsetX: 10,
                    fill: new ol.style.Fill({color: [0, 0, 0]}),
                    stroke: new ol.style.Stroke({color: [255, 255, 255], width: 3}),
                });
            }
            return new ol.style.Style({
                zIndex: ((feature.get('type') == "Server") ? 1000 : undefined),
                image, text
            })
        }
    }
});

let vsTraders = new ol.layer.Vector({
    name: 'Traders',
    minZoom: 3,
    source: new ol.source.Vector({
        url: dataFolder + '/geojson/traders.geojson',
        format: new ol.format.GeoJSON(),
    }),
    style: function (feature) {
        let isOn = showSubLayerItems['Traders'][feature.get('wares')];
        return new ol.style.Style({
            image: new ol.style.Icon({
                color: colorsRef['Traders'][feature.get('wares')],
                opacity: isOn,
                src: icons['Traders'],
            }),
        })
    }
});

/* ######################### Translocator proximity filter ######################### */
// When enabled, only translocators whose endpoints fall within tlProximityRadius
// (in blocks) of the cursor are drawn. Rendering every translocator at once is
// expensive on dense maps, so culling to the area around the cursor keeps panning
// and zooming responsive.

// The radius is restricted to powers of two. These exponents bound the slider:
// 2^6 = 64 blocks up to 2^16 = 65536 blocks.
const TL_PROXIMITY_MIN_EXP = 6;
const TL_PROXIMITY_MAX_EXP = 16;
const TL_PROXIMITY_DEFAULT_EXP = 11; // 2^11 = 2048 blocks

// Round an arbitrary radius down to the nearest valid power-of-two exponent.
function tlRadiusToExp(radius) {
    let exp = Math.round(Math.log2(radius));
    return Math.min(TL_PROXIMITY_MAX_EXP, Math.max(TL_PROXIMITY_MIN_EXP, exp));
}

if (localStorage.tlProximityRadius === undefined) {
    localStorage.tlProximityRadius = Math.pow(2, TL_PROXIMITY_DEFAULT_EXP);
}
let tlProximityMode = false;
let tlProximityRadius = Math.pow(2, tlRadiusToExp(Number(localStorage.tlProximityRadius)));
let tlCursorCoord = undefined;
let tlProximityRafPending = false;
// While pinned, the proximity area stops following the cursor and stays where
// it was last clicked. Clicking the map again unpins it and resumes tracking.
let tlProximityPinned = false;

// A translucent circle drawn around the cursor to visualise the active range.
let vsTlProximityRange = new ol.layer.Vector({
    name: 'TlProximityRange',
    source: new ol.source.Vector(),
    zIndex: 9997,
    style: function (feature) {
        // A small dot marks the anchor point while the area is pinned.
        if (feature.get('tlPinCenter')) {
            return new ol.style.Style({
                image: new ol.style.Circle({
                    radius: 4,
                    fill: new ol.style.Fill({color: 'rgba(221, 170, 255, 0.95)'}),
                    stroke: new ol.style.Stroke({color: 'rgba(120, 0, 160, 0.95)', width: 1}),
                }),
            });
        }
        // The pinned circle is drawn more prominently than the tracking one.
        if (tlProximityPinned) {
            return new ol.style.Style({
                stroke: new ol.style.Stroke({color: 'rgba(221, 170, 255, 1)', width: 3}),
                fill: new ol.style.Fill({color: 'rgba(192, 0, 192, 0.12)'}),
            });
        }
        return new ol.style.Style({
            stroke: new ol.style.Stroke({color: 'rgba(221, 170, 255, 0.9)', width: 2}),
            fill: new ol.style.Fill({color: 'rgba(192, 0, 192, 0.08)'}),
        });
    }
});

// Reposition the range circle on the cursor (or clear it when there is none).
function updateTlProximityRange() {
    let src = vsTlProximityRange.getSource();
    src.clear();
    if (tlProximityMode && tlCursorCoord) {
        src.addFeature(new ol.Feature(new ol.geom.Circle(tlCursorCoord, tlProximityRadius)));
        // Mark the fixed anchor so it is obvious the area is pinned.
        if (tlProximityPinned) {
            let center = new ol.Feature(new ol.geom.Point(tlCursorCoord));
            center.set('tlPinCenter', true);
            src.addFeature(center);
        }
    }
}

// Pin or unpin the proximity area at `coord`. Pinning freezes the circle in
// place (it no longer tracks the cursor); unpinning lets it follow again.
function toggleTlProximityPin(coord) {
    tlProximityPinned = !tlProximityPinned;
    tlCursorCoord = coord;
    updateTlProximityRange();
    vsTranslocators.changed();
}

// True when the feature has at least one endpoint within the proximity radius of
// the cursor. Uses squared distances to avoid a sqrt per endpoint.
function tlNearCursor(feature) {
    if (!tlCursorCoord) {
        return false;
    }
    let coords = feature.getGeometry().flatCoordinates;
    let r2 = tlProximityRadius * tlProximityRadius;
    for (let i = 0; i + 1 < coords.length; i += 2) {
        let dx = coords[i] - tlCursorCoord[0];
        let dy = coords[i + 1] - tlCursorCoord[1];
        if (dx * dx + dy * dy <= r2) {
            return true;
        }
    }
    return false;
}

// Resolve the legend category (and thus color) of a translocator feature.
// Elk-traversable (<AM:TLE>) takes precedence so they stand out, then the
// tag-based specials, then labeled (named) translocators, otherwise it's a
// plain Translocator. Named translocators route identically to plain ones;
// the distinction is purely visual.
function tlTypeName(feature) {
    if (feature.get('elkTrav')) return 'Elk Translocator';
    let tag = feature.get('tag');
    if (tag == 'SPAWN') return 'Spawn Translocator';
    if (tag == 'TP') return 'Teleporter';
    let label = feature.get('label');
    if (label != undefined && label.length > 0) return 'Named Translocator';
    return 'Translocator';
}

function tlColorFor(feature) {
    return colorsRef['Translocators'][tlTypeName(feature)];
}

let vsTranslocators = new ol.layer.Vector({
    name: 'Translocators',
    minZoom: 2,
    source: new ol.source.Vector({
        url: dataFolder + '/geojson/translocators.geojson',
        format: new ol.format.GeoJSON(),
    }),
    style: function (feature) {
        // Proximity culling: skip translocators far from the cursor entirely.
        if (tlProximityMode && !tlNearCursor(feature)) {
            return null;
        }
        let type = tlTypeName(feature);
        let tlCol = colorsRef['Translocators'][type];
        let isOn = showSubLayerItems['Translocators'][type];
        let opacity = isOn ? 1 : 0;
        return [
            new ol.style.Style({
                stroke: new ol.style.Stroke({
                    color: tlCol.concat(opacity),
                    width: 2,
                })
            }),
            new ol.style.Style({
                image: new ol.style.Icon({
                    color: tlCol,
                    opacity: opacity,
                    src: icons['Translocators']
                }),
                geometry: function (feature) {
                    let coordinates = feature.getGeometry().getCoordinates();
                    return new ol.geom.MultiPoint(coordinates);
                }
            })
        ];
    }
});

let vsWorld = new ol.layer.Tile({
    name: 'World',
    source: new ol.source.XYZ({
        interpolate: false,
        wrapx: false,
        tileGrid: vsWorldGrid, // defined in worldExtent.js
        url: dataFolder + '/world/{z}/{x}_{y}.png',
    })
})

// chunk version layer
const vsGenChunks = new ol.layer.Vector({
    className: 'vsGenChunks',
    name: 'Explored Chunks',
    source: new ol.source.Vector({
        url: dataFolder + "/geojson/chunk.geojson",
        format: new ol.format.GeoJSON(),
    }),
    opacity: 0.5,
    style: function (feature) {
        return new ol.style.Style({
            fill: new ol.style.Fill({color: feature.get("color")}),
            stroke: new ol.style.Stroke({color: "#000000", width: 1}),
        })
    }
});

/* ######################### Translocator route planner ######################### */
// Translocator jumps aren't instant: there's an activation/teleport delay. We
// model it as a one-time cost paid when ENTERING a translocator (not when
// exiting), expressed in walking-blocks so it lives in the same units as the
// rest of the route. Running ~1 second covers ~8 blocks (ignoring elevation),
// so: 25 s normal hop, 40 s if the entrance is deep (Y below 64).
const RUN_BLOCKS_PER_SEC = 8;
const TL_HOP_SECONDS = 25;
const TL_HOP_DEEP_SECONDS = 40;
const TL_DEEP_Y = 64; // entrances below this Y count as "deep"

// Block-cost of entering a translocator whose entrance sits at world height `y`.
function tlHopCost(y) {
    let secs = (typeof y === 'number' && y < TL_DEEP_Y) ? TL_HOP_DEEP_SECONDS : TL_HOP_SECONDS;
    return secs * RUN_BLOCKS_PER_SEC;
}

// Maximum height (px) of the route steps list before it starts scrolling.
const ROUTE_STEPS_MAX_HEIGHT = 320;

let routeMode = false;
let routeStart = undefined;
let routeEnd = undefined;
let routeStepsCollapsed = false;
let routeStepsWide = false;
let routeStepsText = '';

// "Riding an elk" mode, shared by the route planner and the nearest-traders
// finder. When on, only Elk traversable translocators (<AM:TLE>) may be used
// for routing. Elk speed is assumed constant, so it scales every leg uniformly
// and never changes which path is shortest -- hence no extra distance math.
let useElk = false;

// Index of the route segment currently highlighted (e.g. by hovering its step
// in the route steps list). -1 means nothing is highlighted.
let highlightedSeg = -1;

let vsRoute = new ol.layer.Vector({
    name: 'Route',
    source: new ol.source.Vector(),
    zIndex: 9999,
    style: function (feature) {
        if (feature.get('marker') === 'start' || feature.get('marker') === 'end') {
            let isStart = feature.get('marker') === 'start';
            return new ol.style.Style({
                image: new ol.style.Circle({
                    radius: 7,
                    fill: new ol.style.Fill({color: isStart ? '#2ecc40' : '#ff4136'}),
                    stroke: new ol.style.Stroke({color: '#ffffff', width: 2}),
                }),
                text: new ol.style.Text({
                    font: 'bold 12px "arial narrow", "sans serif"',
                    text: isStart ? 'Start' : 'Destination',
                    offsetY: -14,
                    fill: new ol.style.Fill({color: [0, 0, 0]}),
                    stroke: new ol.style.Stroke({color: [255, 255, 255], width: 3}),
                }),
            });
        }
        let hl = feature.get('segIdx') !== undefined && feature.get('segIdx') === highlightedSeg;
        if (feature.get('segType') === 'tl') {
            // The route runs on top of the translocator lines, which share the
            // same per-type color. Draw the jump in its type color over a white
            // casing so it stays tied to the type yet stands out against its own
            // line. Hovering thickens the casing for extra emphasis.
            let col = feature.get('tlColor') || [0, 229, 255];
            return [
                new ol.style.Style({stroke: new ol.style.Stroke({color: '#ffffff', width: hl ? 9 : 7})}),
                new ol.style.Style({stroke: new ol.style.Stroke({color: col, width: 5})}),
            ];
        }
        // walking segment
        let base = new ol.style.Style({
            stroke: new ol.style.Stroke({color: '#ffd000', width: 4, lineDash: [10, 8]}),
        });
        if (!hl) return base;
        return [
            new ol.style.Style({stroke: new ol.style.Stroke({color: '#ffffff', width: 8})}),
            base,
        ];
    }
});

// Highlight (or clear, with seg = -1) a single route segment on the map.
function setRouteHighlight(seg) {
    if (highlightedSeg === seg) return;
    highlightedSeg = seg;
    vsRoute.changed();
}

// Build a graph of all translocator endpoints from the loaded layer.
// When elkOnly is true, only Elk-traversable translocators (<AM:TLE>) are
// included, so routing reflects what an elk can actually use.
//
// Returns {pts, pairs, jumpCost, meta} where meta[k] describes the k-th
// translocator (segment) - its display color and the depths (Y) of each end -
// and jumpCost[i] is the block-cost of entering endpoint i (depth-aware).
function buildTlGraph(elkOnly) {
    let segments = [];
    let meta = [];
    let feats = vsTranslocators.getSource().getFeatures();
    for (let f of feats) {
        if (elkOnly && !f.get('elkTrav')) continue;
        let g = f.getGeometry();
        if (!g) continue;
        let c = g.getCoordinates(); // LineString: [[x0,y0],[x1,y1]]
        if (!c || c.length < 2) continue;
        segments.push(c);
        meta.push({
            color: tlColorFor(f),
            depth1: f.get('depth1'), // world Y of endpoint c[0]
            depth2: f.get('depth2'), // world Y of endpoint c[1]
        });
    }
    let graph = RoutePlanner.buildGraphFromSegments(segments);
    // Per-endpoint entry penalty. Endpoint 2k is c[0] (depth1), 2k+1 is c[1].
    let jumpCost = [];
    for (let i = 0; i < graph.pts.length; i++) {
        let m = meta[Math.floor(i / 2)];
        let entranceY = (i % 2 === 0) ? m.depth1 : m.depth2;
        jumpCost[i] = tlHopCost(entranceY);
    }
    return {pts: graph.pts, pairs: graph.pairs, jumpCost: jumpCost, meta: meta};
}

// Make sure the (default-hidden) Translocators layer source has actually
// fetched its features before we run routing math against it. A url-based
// vector source only loads when its layer first renders, so while the layer is
// hidden by default the data would otherwise never arrive and routing would
// silently fail until the layer was shown.
function ensureTranslocatorsLoaded(cb) {
    // No translocator data to load - let callers fall back to straight-line.
    if (!translocatorsExported) {
        cb();
        return;
    }
    let src = vsTranslocators.getSource();
    if (src.getFeatures().length > 0) {
        cb();
        return;
    }
    let done = false;
    let finish = function () {
        if (done) return;
        done = true;
        cb();
    };
    src.once('featuresloadend', finish);
    src.once('featuresloaderror', finish);
    // Trigger the source's own url-loader (strategy 'all' loads everything and
    // records the extent as loaded, so the layer won't double-load later).
    src.loadFeatures(
        [-Infinity, -Infinity, Infinity, Infinity],
        map.getView().getResolution(),
        map.getView().getProjection()
    );
}

// Dijkstra over {translocator endpoints + start + end}.
// Walking between any two nodes costs Euclidean distance; a translocator
// jump between paired endpoints costs the depth-aware entry penalty.
function computeRoute(start, end) {
    let {pts, pairs, jumpCost, meta} = buildTlGraph(useElk);
    let result = RoutePlanner.computeRouteCore(pts, pairs, start, end, jumpCost);
    if (result) result.meta = meta;
    return result;
}

function drawRoute(result) {
    let src = vsRoute.getSource();
    // Remove only the line segments, keep markers
    src.getFeatures().forEach(function (f) {
        if (f.get('segType')) src.removeFeature(f);
    });
    for (let i = 1; i < result.path.length; i++) {
        let a = result.allPts[result.path[i - 1]];
        let b = result.allPts[result.path[i]];
        let line = new ol.Feature(new ol.geom.LineString([[a.x, a.y], [b.x, b.y]]));
        line.set('segType', result.types[i - 1]);
        line.set('segIdx', i);
        if (result.types[i - 1] === 'tl' && result.meta) {
            // Color the jump by the translocator's own type (entry endpoint < n).
            let m = result.meta[Math.floor(result.path[i - 1] / 2)];
            if (m) line.set('tlColor', m.color);
        }
        src.addFeature(line);
    }
}

function setRouteMarker(which, coord) {
    let src = vsRoute.getSource();
    src.getFeatures().forEach(function (f) {
        if (f.get('marker') === which) src.removeFeature(f);
    });
    let m = new ol.Feature(new ol.geom.Point(coord));
    m.set('marker', which);
    src.addFeature(m);
}

function clearRoute() {
    vsRoute.getSource().clear();
    routeStart = undefined;
    routeEnd = undefined;
    updateRouteInfo();
    updateRouteSteps(null);
}

function handleRouteClick(coord) {
    if (routeStart === undefined || routeEnd !== undefined) {
        // Start a fresh route
        clearRoute();
        routeStart = coord;
        setRouteMarker('start', coord);
        updateRouteInfo('Start placed. Click to place the Destination.');
    } else {
        routeEnd = coord;
        setRouteMarker('end', coord);
        let start = routeStart, end = routeEnd;
        updateRouteInfo('Computing route\u2026');
        // Translocators are hidden by default, so their source may not be loaded
        // yet; wait for it before routing (runs synchronously once loaded).
        ensureTranslocatorsLoaded(function () {
            // Abort if the route was cleared or restarted while data loaded.
            if (routeStart !== start || routeEnd !== end) return;
            let result = computeRoute(start, end);
            if (result === null) {
                updateRouteInfo('No route could be computed.');
                return;
            }
            drawRoute(result);
            updateRouteSteps(result);
            let straight = Math.hypot(start[0] - end[0], start[1] - end[1]);
            updateRouteInfo(
                'Walking: ' + Math.round(result.walkDist) + ' blocks &middot; ' +
                'Jumps: ' + result.jumps + ' &middot; ' +
                'Direct: ' + Math.round(straight) + ' blocks' +
                '<br><span style="opacity:.8">Click to plan a new route.</span>'
            );
        });
    }
}

// Format a map coordinate as in-game "X, Z" (in-game Z = -mapY).
function fmtGameCoord(p) {
    return RoutePlanner.fmtGameCoord(p);
}

// Anchor the route panel directly under the legend and size it to the
// remaining viewport height so its body can scroll.
function positionRouteSteps(panel) {
    let layers = document.getElementById('layers');
    if (!layers) return;
    let r = layers.getBoundingClientRect();
    panel.style.left = r.left + 'px';
    panel.style.top = (r.bottom + 6) + 'px';
    panel.style.width = (r.width * ((routeStepsWide && !routeStepsCollapsed) ? 2 : 1)) + 'px';
    panel.style.boxSizing = 'border-box';
    let body = document.getElementById('routeStepsBody');
    if (body) {
        // Cap at a fixed height, but never exceed the space left above the
        // bottom of the viewport (so the body scrolls instead of overflowing).
        let avail = window.innerHeight - r.bottom - 28;
        body.style.maxHeight = Math.max(60, Math.min(ROUTE_STEPS_MAX_HEIGHT, avail)) + 'px';
    }
}

function toggleRouteStepsCollapsed() {
    routeStepsCollapsed = !routeStepsCollapsed;
    let body = document.getElementById('routeStepsBody');
    let bt = document.getElementById('routeStepsCollapseBt');
    let wideBt = document.getElementById('routeStepsWideBt');
    if (body) body.style.display = routeStepsCollapsed ? 'none' : 'block';
    if (bt) bt.innerHTML = routeStepsCollapsed ? '\u25B3' : '\u25BD';
    if (wideBt) wideBt.style.display = routeStepsCollapsed ? 'none' : '';
    let panel = document.getElementById('routeSteps');
    if (panel) positionRouteSteps(panel);
}

function toggleRouteStepsWide() {
    routeStepsWide = !routeStepsWide;
    let bt = document.getElementById('routeStepsWideBt');
    if (bt) {
        bt.innerHTML = routeStepsWide ? 'Compact' : 'Wide';
        bt.title = routeStepsWide ? 'Switch to compact width' : 'Switch to double width';
    }
    let panel = document.getElementById('routeSteps');
    if (panel && panel.style.display !== 'none') positionRouteSteps(panel);
}

function copyRouteSteps() {
    if (!routeStepsText) return;
    let bt = document.getElementById('routeStepsCopyBt');
    let done = function () {
        if (!bt) return;
        let prev = bt.innerHTML;
        bt.innerHTML = 'Copied';
        setTimeout(function () { bt.innerHTML = prev; }, 1200);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(routeStepsText).then(done, function () { });
    } else {
        let ta = document.createElement('textarea');
        ta.value = routeStepsText;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); done(); } catch (e) { }
        document.body.removeChild(ta);
    }
}

// Render a step-by-step textual description of the computed route.
function updateRouteSteps(result) {
    let panel = document.getElementById('routeSteps');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'routeSteps';
        panel.className = 'c';
        panel.style.position = 'absolute';
        panel.style.zIndex = '1000';
        panel.style.padding = '4pt 6pt';

        let header = document.createElement('div');
        header.className = 'layerSwitcherTitle';
        header.style.fontWeight = 'bold';
        header.style.display = 'flex';
        header.style.alignItems = 'center';
        header.style.gap = '4pt';
        header.style.paddingBottom = '2pt';
        header.style.borderBottom = '1px solid var(--layerSwitcherTitleSeparator)';

        let titleSpan = document.createElement('span');
        titleSpan.appendChild(document.createTextNode('Route'));
        titleSpan.style.flex = '1 1 auto';
        titleSpan.style.whiteSpace = 'nowrap';

        let copyBt = document.createElement('button');
        copyBt.id = 'routeStepsCopyBt';
        copyBt.className = 'panelBtn';
        copyBt.innerHTML = 'Copy';
        copyBt.title = 'Copy route as text';
        copyBt.style.cursor = 'pointer';
        copyBt.onclick = copyRouteSteps;

        // The Elk-only filter is a translocator option; hide it when no
        // translocator data was exported.
        let elkBt = null;
        if (translocatorsExported) {
            elkBt = document.createElement('button');
            elkBt.id = 'routeUseElkBt';
            elkBt.className = 'panelBtn';
            elkBt.style.cursor = 'pointer';
            elkBt.onclick = toggleUseElk;
        }

        let bt = document.createElement('button');
        bt.id = 'routeStepsCollapseBt';
        bt.className = 'panelBtn';
        bt.innerHTML = routeStepsCollapsed ? '\u25B3' : '\u25BD';
        bt.title = 'Collapse / expand';
        bt.style.cursor = 'pointer';
        bt.onclick = toggleRouteStepsCollapsed;

        let wideBt = document.createElement('button');
        wideBt.id = 'routeStepsWideBt';
        wideBt.className = 'panelBtn';
        wideBt.innerHTML = routeStepsWide ? 'Compact' : 'Wide';
        wideBt.title = routeStepsWide ? 'Switch to compact width' : 'Switch to double width';
        wideBt.style.cursor = 'pointer';
        wideBt.style.marginLeft = 'auto';
        wideBt.style.display = routeStepsCollapsed ? 'none' : '';
        wideBt.onclick = toggleRouteStepsWide;

        header.appendChild(titleSpan);
        header.appendChild(wideBt);
        if (elkBt) header.appendChild(elkBt);
        header.appendChild(copyBt);
        header.appendChild(bt);
        panel.appendChild(header);

        let body = document.createElement('div');
        body.id = 'routeStepsBody';
        body.style.overflowY = 'auto';
        body.style.marginTop = '4pt';
        panel.appendChild(body);

        document.body.appendChild(panel);
        syncElkButton('routeUseElkBt');
    }
    let body = document.getElementById('routeStepsBody');
    if (!result) {
        routeStepsText = '';
        panel.style.display = 'none';
        if (body) body.innerHTML = '';
        return;
    }
    let n = result.allPts.length - 2;
    let S = n, E = n + 1;
    let text = '';
    body.innerHTML = '';
    setRouteHighlight(-1);
    // Coordinates shown in parentheses for readability, matching the trader list.
    let coord = function (p) { return '(' + fmtGameCoord(p) + ')'; };

    let startRow = document.createElement('div');
    startRow.innerHTML = '\uD83C\uDFC1 Start: ' + coord(result.allPts[result.path[0]]);
    body.appendChild(startRow);
    text += 'Start: ' + coord(result.allPts[result.path[0]]) + '\n';

    for (let i = 1; i < result.path.length; i++) {
        let from = result.allPts[result.path[i - 1]];
        let to = result.allPts[result.path[i]];
        let toIdx = result.path[i];
        let dest;
        if (toIdx === E) {
            dest = 'Destination';
        } else if (toIdx === S) {
            dest = 'Start';
        } else {
            dest = 'Translocator';
        }
        let row = document.createElement('div');
        if (result.types[i - 1] === 'tl') {
            row.innerHTML = '\uD83C\uDF00 Take Translocator &rarr; ' + dest + ' ' + coord(to);
            text += 'Take Translocator -> ' + dest + ' ' + coord(to) + '\n';
        } else {
            let d = Math.round(Math.hypot(from.x - to.x, from.y - to.y));
            row.innerHTML = '\uD83D\uDEB6 Walk ' + d + ' Blocks &rarr; ' + dest + ' ' + coord(to);
            text += 'Walk ' + d + ' Blocks -> ' + dest + ' ' + coord(to) + '\n';
        }
        // Highlight the matching path segment on the map while this step is hovered.
        row.style.cursor = 'default';
        row.style.borderRadius = '3px';
        row.onmouseenter = (function (seg, el) {
            return function () { el.style.background = 'rgba(255,255,255,0.18)'; setRouteHighlight(seg); };
        })(i, row);
        row.onmouseleave = (function (el) {
            return function () { el.style.background = ''; setRouteHighlight(-1); };
        })(row);
        body.appendChild(row);
    }
    routeStepsText = text;
    body.style.display = routeStepsCollapsed ? 'none' : 'block';
    let bt = document.getElementById('routeStepsCollapseBt');
    if (bt) bt.innerHTML = routeStepsCollapsed ? '\u25B3' : '\u25BD';
    let wideBt = document.getElementById('routeStepsWideBt');
    if (wideBt) wideBt.style.display = routeStepsCollapsed ? 'none' : '';
    panel.style.display = 'block';
    positionRouteSteps(panel);
}

// Re-anchor every panel that docks under the legend. The legend's height changes
// when it is folded in/out or layers are toggled, so all docked panels must
// follow it, not just react to window resizes.
function repositionLegendPanels() {
    let routeSteps = document.getElementById('routeSteps');
    if (routeSteps && routeSteps.style.display !== 'none') positionRouteSteps(routeSteps);
    let traderList = document.getElementById('traderList');
    if (traderList && traderList.style.display !== 'none') positionTraderList(traderList);
    let tlPanel = document.getElementById('tlProximityPanel');
    if (tlPanel && tlPanel.style.display !== 'none') positionTlProximityPanel(tlPanel);
}

window.addEventListener('resize', repositionLegendPanels);

// The legend can be folded in or out, which changes its height. Observe it so the
// docked panels stay anchored just below it.
(function () {
    let layers = document.getElementById('layers');
    if (layers && typeof ResizeObserver !== 'undefined') {
        new ResizeObserver(repositionLegendPanels).observe(layers);
    }
})();

function updateRouteInfo(msg) {
    let box = document.getElementById('routeInfo');
    if (!box) {
        box = document.createElement('div');
        box.id = 'routeInfo';
        box.className = 'c';
        box.style.position = 'absolute';
        box.style.bottom = '8px';
        box.style.left = '50%';
        box.style.transform = 'translateX(-50%)';
        box.style.padding = '6px 12px';
        box.style.zIndex = '1000';
        box.style.textAlign = 'center';
        box.style.maxWidth = '90%';
        document.body.appendChild(box);
    }
    if (!routeMode) {
        box.style.display = 'none';
        return;
    }
    box.style.display = 'block';
    box.innerHTML = msg || 'Route mode: click on the map to place the Start.';
}

function toggleRouteMode() {
    routeMode = !routeMode;
    let btn = document.getElementById('route');
    if (routeMode) {
        // Route and trader-finder modes are mutually exclusive.
        if (traderMode) toggleTraderMode();
        if (btn) btn.classList.add('selected');
        document.getElementById('map').style.cursor = 'crosshair';
        updateRouteInfo();
    } else {
        if (btn) btn.classList.remove('selected');
        document.getElementById('map').style.cursor = '';
        clearRoute();
        let box = document.getElementById('routeInfo');
        if (box) box.style.display = 'none';
        let steps = document.getElementById('routeSteps');
        if (steps) steps.style.display = 'none';
    }
}

/* ######################### Translocator proximity filter ######################### */
// Anchor the proximity panel directly under the legend, matching the route /
// trader panels.
function positionTlProximityPanel(panel) {
    let layers = document.getElementById('layers');
    if (!layers) return;
    let r = layers.getBoundingClientRect();
    panel.style.left = r.left + 'px';
    panel.style.top = (r.bottom + 6) + 'px';
    panel.style.width = r.width + 'px';
    panel.style.boxSizing = 'border-box';
}

// Lazily build the radius slider the first time the filter is enabled.
function ensureTlProximityPanel() {
    let panel = document.getElementById('tlProximityPanel');
    if (panel) {
        return panel;
    }
    panel = document.createElement('div');
    panel.id = 'tlProximityPanel';
    panel.className = 'c';
    panel.style.position = 'absolute';
    panel.style.zIndex = '1000';
    panel.style.padding = '4pt 6pt';
    panel.style.display = 'none';

    let header = document.createElement('div');
    header.className = 'layerSwitcherTitle';
    header.style.fontWeight = 'bold';
    header.style.paddingBottom = '2pt';
    header.style.borderBottom = '1px solid var(--layerSwitcherTitleSeparator)';
    header.appendChild(document.createTextNode('Translocator range'));
    panel.appendChild(header);

    let value = document.createElement('div');
    value.id = 'tlProximityValue';
    value.style.marginTop = '4pt';
    value.style.textAlign = 'center';
    value.innerText = tlProximityRadius + ' blocks';

    // The slider operates on the power-of-two exponent so every step doubles or
    // halves the radius.
    let slider = document.createElement('input');
    slider.type = 'range';
    slider.id = 'tlProximityRange';
    slider.min = TL_PROXIMITY_MIN_EXP;
    slider.max = TL_PROXIMITY_MAX_EXP;
    slider.step = 1;
    slider.value = tlRadiusToExp(tlProximityRadius);
    slider.oninput = function () {
        tlProximityRadius = Math.pow(2, Number(slider.value));
        localStorage.tlProximityRadius = tlProximityRadius;
        value.innerText = tlProximityRadius + ' blocks';
        updateTlProximityRange();
        vsTranslocators.changed();
    };

    panel.appendChild(value);
    panel.appendChild(slider);
    document.body.append(panel);
    return panel;
}

function toggleTlProximityMode() {
    tlProximityMode = !tlProximityMode;
    let btn = document.getElementById('tlProximity');
    let panel = ensureTlProximityPanel();
    if (tlProximityMode) {
        if (btn) btn.classList.add('selected');
        // The filter is useless if the Translocators layer is hidden, so make
        // sure it is visible when the tool is selected.
        if (!vsTranslocators.get('visible')) {
            switcher.toggleVis(vsTranslocators.get('name'));
        }
        panel.style.display = 'block';
        positionTlProximityPanel(panel);
        vsTranslocators.setMinZoom(1);
    } else {
        if (btn) btn.classList.remove('selected');
        panel.style.display = 'none';
        // Reset so the filter starts in tracking mode next time it is enabled.
        tlProximityPinned = false;
        vsTranslocators.setMinZoom(2);
    }
    updateTlProximityRange();
    vsTranslocators.changed();
}

/* ######################### Nearest trader finder ######################### */
// Maximum height (px) of the trader list before it starts scrolling.
const TRADER_LIST_MAX_HEIGHT = 320;

let traderMode = false;
let traderOrigin = undefined;
let traderListCollapsed = false;
let traderListWide = false;
// Use translocator-aware distances by default, but only when that data exists.
let traderUseTL = translocatorsExported;
let traderListText = '';
// Web Worker that runs the nearest-trader search off the main thread, plus a
// monotonic request id so stale results (origin moved, mode toggled) are
// dropped. Created lazily on first use; falls back to a synchronous search if
// Workers are unavailable.
let traderWorker = null;
let traderWorkerBroken = false;
let traderSearchReqId = 0;
let vsTraderFind = new ol.layer.Vector({
    name: 'TraderFind',
    source: new ol.source.Vector(),
    zIndex: 9998,
    style: function (feature) {
        if (feature.get('marker') === 'origin') {
            return new ol.style.Style({
                image: new ol.style.Circle({
                    radius: 7,
                    fill: new ol.style.Fill({color: '#2ecc40'}),
                    stroke: new ol.style.Stroke({color: '#ffffff', width: 2}),
                }),
                text: new ol.style.Text({
                    font: 'bold 12px "arial narrow", "sans serif"',
                    text: 'Start',
                    offsetY: -14,
                    fill: new ol.style.Fill({color: [0, 0, 0]}),
                    stroke: new ol.style.Stroke({color: [255, 255, 255], width: 3}),
                }),
            });
        }
        if (feature.get('marker') === 'trader') {
            let col = colorsRef['Traders'][feature.get('wares')] || [128, 128, 128];
            return new ol.style.Style({
                image: new ol.style.Icon({
                    color: col.map(function (val) { return Math.min(Math.max(val * 1.5, 64), 255); }),
                    src: icons['Traders'],
                }),
            });
        }
        // Straight-line link (used when translocators are disabled).
        if (feature.get('segType') === 'traderLink') {
            return new ol.style.Style({
                stroke: new ol.style.Stroke({color: '#ff8c00', width: 3, lineDash: [8, 6]}),
            });
        }
        // Translocator jump segment of an actual route.
        if (feature.get('segType') === 'traderTl') {
            return new ol.style.Style({
                stroke: new ol.style.Stroke({color: '#00e5ff', width: 4}),
            });
        }
        // Walking segment of an actual route.
        if (feature.get('segType') === 'traderWalk') {
            return new ol.style.Style({
                stroke: new ol.style.Stroke({color: '#ff8c00', width: 3, lineDash: [8, 6]}),
            });
        }
        // Highlight glow drawn underneath a hovered trader's route.
        if (feature.get('segType') === 'traderHi') {
            return new ol.style.Style({
                stroke: new ol.style.Stroke({color: 'rgba(255, 255, 0, 0.55)', width: 9}),
            });
        }
        return null;
    }
});

// Make sure the (default-hidden) Traders layer source has actually fetched
// its features before we run proximity math against it.
function ensureTradersLoaded(cb) {
    let src = vsTraders.getSource();
    if (src.getFeatures().length > 0) {
        cb();
        return;
    }
    let done = false;
    let finish = function () {
        if (done) return;
        done = true;
        cb();
    };
    src.once('featuresloadend', finish);
    src.once('featuresloaderror', finish);
    // Trigger the source's own url-loader (strategy 'all' loads everything and
    // records the extent as loaded, so the layer won't double-load later).
    src.loadFeatures(
        [-Infinity, -Infinity, Infinity, Infinity],
        map.getView().getResolution(),
        map.getView().getProjection()
    );
}

// Collect all loaded trader markers as plain {x, y, wares, name} records.
function buildTraderList() {
    let traders = [];
    let feats = vsTraders.getSource().getFeatures();
    for (let f of feats) {
        let g = f.getGeometry();
        if (!g) continue;
        let c = g.getCoordinates();
        if (!c) continue;
        traders.push({x: c[0], y: c[1], wares: f.get('wares'), name: f.get('name')});
    }
    return traders;
}

function setTraderOrigin(coord) {
    let src = vsTraderFind.getSource();
    src.getFeatures().forEach(function (f) {
        if (f.get('marker') === 'origin') src.removeFeature(f);
    });
    let m = new ol.Feature(new ol.geom.Point(coord));
    m.set('marker', 'origin');
    src.addFeature(m);
}

// Draw the route legs from `origin` to a single trader `r` into `src`.
// In TL mode this is the actual shortest walk + translocator-jump path;
// otherwise it is a single straight link.
function drawTraderRouteSegs(src, origin, r) {
    if (traderUseTL) {
        let route = computeRoute(origin, [r.x, r.y]);
        if (route) {
            for (let i = 1; i < route.path.length; i++) {
                let a = route.allPts[route.path[i - 1]];
                let b = route.allPts[route.path[i]];
                let seg = new ol.Feature(new ol.geom.LineString([[a.x, a.y], [b.x, b.y]]));
                seg.set('segType', route.types[i - 1] === 'tl' ? 'traderTl' : 'traderWalk');
                src.addFeature(seg);
            }
            return;
        }
    }
    // Straight link (TL off, or no route found).
    let line = new ol.Feature(new ol.geom.LineString([[origin[0], origin[1]], [r.x, r.y]]));
    line.set('segType', 'traderLink');
    src.addFeature(line);
}

// Render one route per nearest trader on the map.
function drawTraderLinks(origin, results) {
    let src = vsTraderFind.getSource();
    // Remove everything except the origin marker.
    src.getFeatures().forEach(function (f) {
        if (f.get('marker') !== 'origin') src.removeFeature(f);
    });
    for (let r of results) {
        drawTraderRouteSegs(src, origin, r);
        let tm = new ol.Feature(new ol.geom.Point([r.x, r.y]));
        tm.set('marker', 'trader');
        tm.set('wares', r.wares);
        src.addFeature(tm);
    }
}

// Draw a glowing highlight along the route from the origin to trader `r`,
// emphasising it when its list row is hovered. Only meaningful in TL mode,
// where a real multi-leg route exists.
function highlightTraderRoute(r) {
    if (!traderUseTL || traderOrigin === undefined) return;
    clearTraderHighlight();
    let src = vsTraderFind.getSource();
    let route = computeRoute([traderOrigin[0], traderOrigin[1]], [r.x, r.y]);
    if (!route) return;
    for (let i = 1; i < route.path.length; i++) {
        let a = route.allPts[route.path[i - 1]];
        let b = route.allPts[route.path[i]];
        let seg = new ol.Feature(new ol.geom.LineString([[a.x, a.y], [b.x, b.y]]));
        seg.set('segType', 'traderHi');
        src.addFeature(seg);
    }
}

// Remove any hover highlight glow features.
function clearTraderHighlight() {
    let src = vsTraderFind.getSource();
    src.getFeatures().forEach(function (f) {
        if (f.get('segType') === 'traderHi') src.removeFeature(f);
    });
}

// Open the full route planner for the trip from `origin` to trader `r`:
// switch into route mode, drop point A at the origin and point B at the
// trader, then compute and render the route (with its turn-by-turn steps).
function planRouteToTrader(origin, r) {
    let start = [origin[0], origin[1]];
    let end = [r.x, r.y];
    // Entering route mode turns off (and clears) trader mode, so capture the
    // coordinates first.
    if (!routeMode) toggleRouteMode();
    clearRoute();
    routeStart = start;
    setRouteMarker('start', start);
    routeEnd = end;
    setRouteMarker('end', end);
    let result = computeRoute(start, end);
    if (result === null) {
        updateRouteInfo('No route could be computed.');
        return;
    }
    drawRoute(result);
    updateRouteSteps(result);
    let straight = Math.hypot(start[0] - end[0], start[1] - end[1]);
    updateRouteInfo(
        'Walking: ' + Math.round(result.walkDist) + ' blocks &middot; ' +
        'Jumps: ' + result.jumps + ' &middot; ' +
        'Direct: ' + Math.round(straight) + ' blocks' +
        '<br><span style="opacity:.8">Click to plan a new route.</span>'
    );
    goToCoords(r.x + ',' + (-r.y));
}


function clearTraderFind() {
    vsTraderFind.getSource().clear();
    traderOrigin = undefined;
    updateTraderList(null);
}

function handleTraderClick(coord) {
    clearTraderFind();
    traderOrigin = coord;
    setTraderOrigin(coord);
    runTraderSearch(coord);
}

// Lazily create the search worker. Returns null (and latches "broken") if the
// environment can't construct one, so callers fall back to a synchronous run.
function getTraderWorker() {
    if (traderWorkerBroken) return null;
    if (traderWorker) return traderWorker;
    try {
        traderWorker = new Worker('traderWorker.js');
    } catch (e) {
        traderWorkerBroken = true;
        traderWorker = null;
    }
    return traderWorker;
}

// Run a nearest-trader search, preferring the off-thread worker and invoking
// cb(results) when done. Stale responses are filtered by reqId; if the worker
// is unavailable or errors, the identical search runs synchronously instead.
function dispatchTraderSearch(payload, reqId, cb) {
    let runSync = function () {
        cb(TraderFinder.searchNearestTraders(payload, RoutePlanner));
    };
    let worker = getTraderWorker();
    if (!worker) { runSync(); return; }

    let onMessage, onError;
    let cleanup = function () {
        worker.removeEventListener('message', onMessage);
        worker.removeEventListener('error', onError);
    };
    onMessage = function (e) {
        let data = e.data || {};
        if (data.reqId !== reqId) return; // response for a different search
        cleanup();
        if (data.error) { runSync(); return; }
        cb(data.results);
    };
    onError = function () {
        cleanup();
        // The worker is unusable (e.g. blocked origin); stop using it entirely.
        traderWorkerBroken = true;
        traderWorker = null;
        runSync();
    };
    worker.addEventListener('message', onMessage);
    worker.addEventListener('error', onError);
    payload.reqId = reqId;
    worker.postMessage(payload);
}

// Draw and list the results of a nearest-trader search from `coord`.
function renderTraderResults(coord, results) {
    if (!results || !results.length) {
        updateTraderList(null);
        updateTraderInfo('No traders found yet. They may not be discovered on this map.');
        return;
    }
    drawTraderLinks(coord, results);
    updateTraderList(results);
    updateTraderInfo(
        'Nearest of ' + results.length + ' trader type(s), ' +
        (traderUseTL ? (useElk ? 'via Elk translocators' : 'via translocators') : 'straight-line') + '. ' +
        '<br><span style="opacity:.8">Click a list entry to plan a route there, or click the map for a new point.</span>'
    );
}

// Compute and render the nearest trader of each type from `coord`, honouring
// the current "use translocators" toggle. Safe to re-run (e.g. when the toggle
// flips) as long as `traderOrigin` still matches.
function runTraderSearch(coord) {
    updateTraderInfo('Searching for the nearest traders\u2026');
    ensureTradersLoaded(function () {
        // The user may have left trader mode or clicked again meanwhile.
        if (!traderMode || traderOrigin !== coord) return;
        let proceed = function () {
            // Re-check: loading the translocator network is async too.
            if (!traderMode || traderOrigin !== coord) return;
            let payload = {useTL: traderUseTL, traders: buildTraderList(), coord: coord};
            if (traderUseTL) {
                // The graph must be built on the main thread (it reads the
                // OpenLayers feature source); the heavy search over it then runs
                // in the worker. Pass only plain, structured-cloneable data.
                let {pts, pairs, jumpCost} = buildTlGraph(useElk);
                payload.pts = pts;
                payload.pairs = pairs;
                payload.jumpCost = jumpCost;
            }
            let reqId = ++traderSearchReqId;
            dispatchTraderSearch(payload, reqId, function (results) {
                // Drop stale results: a newer search started or the context
                // changed while the worker was busy.
                if (reqId !== traderSearchReqId || !traderMode || traderOrigin !== coord) return;
                renderTraderResults(coord, results);
            });
        };
        // The TL-aware search walks the translocator network, whose layer is
        // hidden by default - make sure its source is loaded first.
        if (traderUseTL) {
            ensureTranslocatorsLoaded(proceed);
        } else {
            proceed();
        }
    });
}

// Anchor the trader-list panel directly under the legend and size it to the
// remaining viewport height so its body can scroll.
function positionTraderList(panel) {
    let layers = document.getElementById('layers');
    if (!layers) return;
    let r = layers.getBoundingClientRect();
    panel.style.left = r.left + 'px';
    panel.style.top = (r.bottom + 6) + 'px';
    panel.style.width = (r.width * ((traderListWide && !traderListCollapsed) ? 2 : 1)) + 'px';
    panel.style.boxSizing = 'border-box';
    let body = document.getElementById('traderListBody');
    if (body) {
        let avail = window.innerHeight - r.bottom - 28;
        body.style.maxHeight = Math.max(60, Math.min(TRADER_LIST_MAX_HEIGHT, avail)) + 'px';
    }
}

function toggleTraderListCollapsed() {
    traderListCollapsed = !traderListCollapsed;
    let body = document.getElementById('traderListBody');
    let bt = document.getElementById('traderListCollapseBt');
    let toolbar = document.getElementById('traderListToolbar');
    if (body) body.style.display = traderListCollapsed ? 'none' : 'block';
    if (bt) bt.innerHTML = traderListCollapsed ? '\u25B3' : '\u25BD';
    if (toolbar) toolbar.style.display = traderListCollapsed ? 'none' : 'flex';
    let panel = document.getElementById('traderList');
    if (panel) positionTraderList(panel);
}

function toggleTraderListWide() {
    traderListWide = !traderListWide;
    let bt = document.getElementById('traderListWideBt');
    if (bt) {
        bt.innerHTML = traderListWide ? 'Compact' : 'Wide';
        bt.title = traderListWide ? 'Switch to compact width' : 'Switch to double width';
    }
    let panel = document.getElementById('traderList');
    if (panel && panel.style.display !== 'none') positionTraderList(panel);
}

// Toggle whether trader proximity is measured straight-line or via the
// translocator network, then recompute the current search if one is active.
function toggleTraderUseTL() {
    traderUseTL = !traderUseTL;
    let bt = document.getElementById('traderUseTLBt');
    if (bt) {
        bt.innerHTML = traderUseTL ? 'TL: on' : 'TL: off';
        bt.title = traderUseTL
            ? 'Distances use translocators \u2014 click to switch to straight-line'
            : 'Distances are straight-line \u2014 click to use translocators';
        bt.classList.toggle('selected', traderUseTL);
    }
    if (traderOrigin !== undefined) runTraderSearch(traderOrigin);
}

// Keep an "Elk" toggle button (in any panel) in sync with the shared useElk
// state. Safe to call when the button is absent.
function syncElkButton(id) {
    let bt = document.getElementById(id);
    if (!bt) return;
    bt.innerHTML = useElk ? 'Elk: on' : 'Elk: off';
    bt.title = useElk
        ? 'Routing uses only Elk traversable translocators \u2014 click to use all translocators'
        : 'Routing uses all translocators \u2014 click to use only Elk traversable ones';
    bt.classList.toggle('selected', useElk);
}

// Recompute and redraw the current route in place (e.g. after the elk toggle
// flips) without disturbing the placed A/B markers.
function replanRoute() {
    if (routeStart === undefined || routeEnd === undefined) return;
    let result = computeRoute(routeStart, routeEnd);
    if (result === null) {
        updateRouteInfo('No route could be computed.');
        return;
    }
    drawRoute(result);
    updateRouteSteps(result);
    let straight = Math.hypot(routeStart[0] - routeEnd[0], routeStart[1] - routeEnd[1]);
    updateRouteInfo(
        'Walking: ' + Math.round(result.walkDist) + ' blocks &middot; ' +
        'Jumps: ' + result.jumps + ' &middot; ' +
        'Direct: ' + Math.round(straight) + ' blocks' +
        '<br><span style="opacity:.8">Click to plan a new route.</span>'
    );
}

// Flip the shared "riding an elk" mode and refresh whichever tool is active.
function toggleUseElk() {
    useElk = !useElk;
    syncElkButton('traderUseElkBt');
    syncElkButton('routeUseElkBt');
    if (traderMode && traderOrigin !== undefined) runTraderSearch(traderOrigin);
    if (routeMode) replanRoute();
}

function copyTraderList() {
    if (!traderListText) return;
    let bt = document.getElementById('traderListCopyBt');
    let done = function () {
        if (!bt) return;
        let prev = bt.innerHTML;
        bt.innerHTML = 'Copied';
        setTimeout(function () { bt.innerHTML = prev; }, 1200);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(traderListText).then(done, function () { });
    } else {
        let ta = document.createElement('textarea');
        ta.value = traderListText;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); done(); } catch (e) { }
        document.body.removeChild(ta);
    }
}

// Render the list of nearest traders, one clickable row per wares type.
function updateTraderList(results) {
    let panel = document.getElementById('traderList');
    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'traderList';
        panel.className = 'c';
        panel.style.position = 'absolute';
        panel.style.zIndex = '1000';
        panel.style.padding = '4pt 6pt';

        let header = document.createElement('div');
        header.className = 'layerSwitcherTitle';
        header.style.fontWeight = 'bold';
        header.style.display = 'flex';
        header.style.alignItems = 'center';
        header.style.gap = '4pt';
        header.style.paddingBottom = '2pt';
        header.style.borderBottom = '1px solid var(--layerSwitcherTitleSeparator)';

        let titleSpan = document.createElement('span');
        titleSpan.appendChild(document.createTextNode('Nearest traders'));
        titleSpan.style.flex = '1 1 auto';
        titleSpan.style.whiteSpace = 'nowrap';

        let copyBt = document.createElement('button');
        copyBt.id = 'traderListCopyBt';
        copyBt.className = 'panelBtn';
        copyBt.innerHTML = 'Copy';
        copyBt.title = 'Copy trader list as text';
        copyBt.style.cursor = 'pointer';
        copyBt.style.marginLeft = 'auto';
        copyBt.onclick = copyTraderList;

        let bt = document.createElement('button');
        bt.id = 'traderListCollapseBt';
        bt.className = 'panelBtn';
        bt.innerHTML = traderListCollapsed ? '\u25B3' : '\u25BD';
        bt.title = 'Collapse / expand';
        bt.style.cursor = 'pointer';
        bt.onclick = toggleTraderListCollapsed;

        // Action buttons live on their own row below the title so they wrap
        // cleanly in compact mode instead of crowding the heading.
        let toolbar = document.createElement('div');
        toolbar.id = 'traderListToolbar';
        toolbar.style.display = traderListCollapsed ? 'none' : 'flex';
        toolbar.style.flexWrap = 'wrap';
        toolbar.style.gap = '4pt';
        toolbar.style.marginTop = '4pt';
        toolbar.style.paddingBottom = '4pt';
        toolbar.style.borderBottom = '1px solid var(--layerSwitcherTitleSeparator)';

        let wideBt = document.createElement('button');
        wideBt.id = 'traderListWideBt';
        wideBt.className = 'panelBtn';
        wideBt.innerHTML = traderListWide ? 'Compact' : 'Wide';
        wideBt.title = traderListWide ? 'Switch to compact width' : 'Switch to double width';
        wideBt.style.cursor = 'pointer';
        wideBt.onclick = toggleTraderListWide;

        // Translocator options only make sense when translocator data exists.
        let tlBt = null;
        let elkBt = null;
        if (translocatorsExported) {
            tlBt = document.createElement('button');
            tlBt.id = 'traderUseTLBt';
            tlBt.className = 'panelBtn';
            tlBt.innerHTML = traderUseTL ? 'TL: on' : 'TL: off';
            tlBt.title = traderUseTL
                ? 'Distances use translocators \u2014 click to switch to straight-line'
                : 'Distances are straight-line \u2014 click to use translocators';
            tlBt.style.cursor = 'pointer';
            if (traderUseTL) tlBt.classList.add('selected');
            tlBt.onclick = toggleTraderUseTL;

            elkBt = document.createElement('button');
            elkBt.id = 'traderUseElkBt';
            elkBt.className = 'panelBtn';
            elkBt.style.cursor = 'pointer';
            elkBt.onclick = toggleUseElk;
        }

        header.appendChild(titleSpan);
        header.appendChild(copyBt);
        header.appendChild(bt);
        if (tlBt) toolbar.appendChild(tlBt);
        if (elkBt) toolbar.appendChild(elkBt);
        toolbar.appendChild(wideBt);
        panel.appendChild(header);
        panel.appendChild(toolbar);

        let body = document.createElement('div');
        body.id = 'traderListBody';
        body.style.overflowY = 'auto';
        body.style.marginTop = '4pt';
        panel.appendChild(body);

        document.body.appendChild(panel);
        syncElkButton('traderUseElkBt');
    }
    let body = document.getElementById('traderListBody');
    if (!results) {
        traderListText = '';
        panel.style.display = 'none';
        if (body) body.innerHTML = '';
        return;
    }
    body.innerHTML = '';
    let text = 'Nearest traders from ' + fmtGameCoord({x: traderOrigin[0], y: traderOrigin[1]}) + ':\n';
    for (let r of results) {
        let dist = Math.round(r.dist);
        let coordStr = fmtGameCoord({x: r.x, y: r.y});
        let col = colorsRef['Traders'][r.wares] || [128, 128, 128];

        let row = document.createElement('div');
        row.className = 'traderRow';
        row.style.cursor = 'pointer';
        row.style.padding = '2px 4px';

        let sw = document.createElement('span');
        sw.style.display = 'inline-block';
        sw.style.width = '10px';
        sw.style.height = '10px';
        sw.style.marginRight = '5px';
        sw.style.border = '1px solid #000';
        sw.style.verticalAlign = 'middle';
        sw.style.background = '#' + col.map(function (i) { return i.toString(16).padStart(2, '0'); }).join('');

        let labelText = (r.wares || 'Trader') + ' \u2014 ' + dist + ' blocks (' + coordStr + ')';
        row.appendChild(sw);
        row.appendChild(document.createTextNode(labelText));
        row.title = 'Trader: ' + (r.name || '?') +
            (traderUseTL ? ' \u2014 click to plan a route here' : ' \u2014 click to go here');
        row.onclick = (function (rr) {
            return function () {
                if (traderUseTL) {
                    planRouteToTrader([traderOrigin[0], traderOrigin[1]], rr);
                } else {
                    goToCoords(rr.x + ',' + (-rr.y));
                }
            };
        })(r);
        // Highlight this trader's route on the map while the row is hovered.
        row.onmouseenter = (function (rr) {
            return function () { highlightTraderRoute(rr); };
        })(r);
        row.onmouseleave = clearTraderHighlight;
        body.appendChild(row);

        text += (r.wares || 'Trader') + ': ' + dist + ' blocks (' + coordStr + ')' +
            (r.name ? ' - ' + r.name : '') + '\n';
    }
    traderListText = text;
    body.style.display = traderListCollapsed ? 'none' : 'block';
    let bt = document.getElementById('traderListCollapseBt');
    if (bt) bt.innerHTML = traderListCollapsed ? '\u25B3' : '\u25BD';
    let toolbar = document.getElementById('traderListToolbar');
    if (toolbar) toolbar.style.display = traderListCollapsed ? 'none' : 'flex';
    panel.style.display = 'block';
    positionTraderList(panel);
}

function updateTraderInfo(msg) {
    let box = document.getElementById('traderInfo');
    if (!box) {
        box = document.createElement('div');
        box.id = 'traderInfo';
        box.className = 'c';
        box.style.position = 'absolute';
        box.style.bottom = '8px';
        box.style.left = '50%';
        box.style.transform = 'translateX(-50%)';
        box.style.padding = '6px 12px';
        box.style.zIndex = '1000';
        box.style.textAlign = 'center';
        box.style.maxWidth = '90%';
        document.body.appendChild(box);
    }
    if (!traderMode) {
        box.style.display = 'none';
        return;
    }
    box.style.display = 'block';
    box.innerHTML = msg || 'Trader finder: click on the map to find the closest trader of each type.';
}

function toggleTraderMode() {
    traderMode = !traderMode;
    let btn = document.getElementById('findTrader');
    if (traderMode) {
        // Route and trader-finder modes are mutually exclusive.
        if (routeMode) toggleRouteMode();
        if (btn) btn.classList.add('selected');
        document.getElementById('map').style.cursor = 'crosshair';
        ensureTradersLoaded(function () { });
        updateTraderInfo();
    } else {
        if (btn) btn.classList.remove('selected');
        document.getElementById('map').style.cursor = '';
        clearTraderFind();
        let box = document.getElementById('traderInfo');
        if (box) box.style.display = 'none';
        let list = document.getElementById('traderList');
        if (list) list.style.display = 'none';
    }
}

/* ######################### Controllers ######################### */
let mousePos = new ol.control.MousePosition({
    coordinateFormat: function (coordinate) {
        return ol.coordinate.toStringXY([coordinate[0], -coordinate[1]], 0);
    },
    className: 'coords',
    target: document.getElementById('mousePos'),
    undefinedHTML: document.getElementById('mousePos').innerHTML
});

/* ######################### Map definition and functions ######################### */
let view = new ol.View({
    center: [0, 0],
    constrainResolution: true,
    zoom: zm,
    resolutions: [256, 128, 64, 32, 16, 8, 4, 2, 1, 0.5, 0.25, 0.125],
});

let map = new ol.Map({
    target: 'map',
    controls: [mousePos],
    layers: [
        vsWorld,
        vsGenChunks,
        vsTraders,
        vsTranslocators,
        vsLandmarks,
        vsRoute,
        vsTraderFind,
        vsTlProximityRange
    ],
    view: view
});

map.on("moveend", function () {
    newHref = adr + "?x=" + Math.round(map.getView().getCenter()[0]) + "&y=" + Math.round(map.getView().getCenter()[1]) + "&zoom=" + map.getView().getZoom();
    window.history.pushState("pos", title, newHref);
});


let selectedTL = undefined;
let selectedTrader = undefined;

// Feed the inspector
// The inspector itself should be a class/object with helper functions, would be much cleaner.
let desc = ''
map.on('pointermove', function (e) {
    // Keep the proximity filter following the cursor. Re-rendering is throttled to
    // one redraw per animation frame so fast mouse movement stays smooth.
    // While pinned the area is frozen, so skip cursor tracking.
    if (tlProximityMode && !tlProximityPinned) {
        tlCursorCoord = e.coordinate;
        updateTlProximityRange();
        if (!tlProximityRafPending) {
            tlProximityRafPending = true;
            requestAnimationFrame(function () {
                tlProximityRafPending = false;
                vsTranslocators.changed();
            });
        }
    }
    if (selectedTL != undefined) {
        selectedTL.setStyle(undefined);
        selectedTL = undefined;
    }
    if (selectedTrader != undefined) {
        selectedTrader.setStyle(undefined);
        selectedTrader = undefined;
    }
    descTL = ''
    descTrader = ''
    map.forEachFeatureAtPixel(e.pixel, function (f, l) {
        if (l.get('name') == 'Traders') {
            selectedTrader = f;
            descTrader = 'Trader name: ' + f.get('name') + '<br>Wares: ' + f.get('wares');
            f.setStyle(highlightStyleTrader);
            return true
        } else if (l.get('name') == 'Translocators') {
            selectedTL = f;
            descTL = f.get('label')
            if (descTL) {
                descTL = 'Translocator: ' + descTL;
            }
            f.setStyle(highlightStyleTranslocator);
            return true
        } else if (l.get('name') == 'Landmarks') {
            descTL = f.get('label');
            return true
        } else if (l.get('name') == 'Explored Chunks') {
            descTL = f.get('version');
            return true
        }
    });
    if (descTL || descTrader) {
        desc = ''
        if (descTL) {
            desc = descTL;
        }
        if (descTrader && descTL) {
            desc += '<br>';
        }
        if (descTrader) {
            desc += descTrader;
        }
        inspector.innerHTML = desc;
        inspector.style.display = 'block';
    } else {
        inspector.style.display = 'none';
    }
});

// Handle map clicks to display popups and other extended functionalities
map.on('singleclick', function (e) {
    if (routeMode) {
        handleRouteClick(e.coordinate);
        return;
    }
    if (traderMode) {
        handleTraderClick(e.coordinate);
        return;
    }
    // While the proximity filter is active, a click pins/unpins its area.
    if (tlProximityMode) {
        toggleTlProximityPin(e.coordinate);
        return;
    }
    map.forEachFeatureAtPixel(e.pixel, function (f, l) {
        if (l.get('name') == 'Translocators') {
            let coords = f.getGeometry().flatCoordinates;
            let dst1 = Math.abs(coords[0] - e.coordinate[0] + coords[1] - e.coordinate[1]);
            let dst2 = Math.abs(coords[2] - e.coordinate[0] + coords[3] - e.coordinate[1]);
            let coordsString = '';
            let coordsDst1 = ((coords[0])) + ' 110 ' + (-coords[1]);
            let coordsDst2 = ((coords[2])) + ' 110 ' + (-coords[3]);
            if (dst1 < dst2) {
                coordsString += coordsDst1;
                coordsString2 = coordsDst2;
            } else {
                coordsString += coordsDst2;
                coordsString2 = coordsDst1;
            }
            // Was the user holding shift?
            if (e.originalEvent.shiftKey) {
                // Zoom to the other end
                goToCoords(coordsString2.replace(/ 110 /, ','));
            } else {
                // Display popup
                let elements = {
                    'description1': {
                        'type': 'p',
                        'content': 'To add this translocator pair to your in game map, copy paste these two lines into the game chat. The translocator that is the closest to where you clicked on the line is first in the list.'
                    },
                    'description2': {
                        'type': 'p',
                        'content': `/waypoint addati spiral ${coordsString} false purple TL to ${coordsString2.replace(' 110 ', ', ')}`
                    },
                    'description3': {
                        'type': 'p',
                        'content': `/waypoint addati spiral ${coordsString2} false purple TL to ${coordsString.replace(' 110 ', ', ')}`
                    }
                }
                if (f.get('elkTrav')) {
                    elements['elk'] = {
                        'type': 'p',
                        'content': '\u{1F98C} This translocator is tagged Elk traversable (<AM:TLE>).'
                    };
                }
                poper.createPopup('translocator', show = true, params = {'elements': elements});
            }
            return true
        } else if (l.get('name') == 'Traders') {
            let coords = f.getGeometry().flatCoordinates;
            let color = '#' + colorsRef['Traders'][f.get('wares')].map(i => i.toString(16).padStart(2, "0")).join("");
            let elements = {
                'description1': {
                    'type': 'p',
                    'content': 'To add this trader to your in game map, copy paste these the lines below into the game chat.'
                },
                'description2': {
                    'type': 'p',
                    'content': `/waypoint addati trader ${(coords[0])} 110 ${-coords[1]} false ${color.toUpperCase()} ${f.get('name')} the ${f.get('wares').toLowerCase()} trader`
                }
            }
            poper.createPopup('trader', show = true, params = {'elements': elements});
            return true
        }
    });
});

/* ######################### Build the legend (must come after the map definition)  ######################### */
if (translocatorsExported) switcher.buildLegend(vsTranslocators);
if (tradersExported) switcher.buildLegend(vsTraders);
switcher.buildLegend(vsLandmarks);
if(chunksExported) switcher.buildLegend(vsGenChunks);

/* ######################### Start the popups and tools managers ######################### */
let poper = new PopupManager();
let tools = new Tools();
tools.addTools();
let credits = new Credits("contributors");
document.getElementById("contribute").addEventListener("click", (e) => {
    poper.createPopup('contribute');
});

/* ######################### Key bindings ######################### */
window.onkeyup = function (kp) {
    let actions = {
        /*  G  */ 71: function () {
            poper.createPopup('gps');
        },
        /*  H  */ 72: function () {
            goToCoords('0,0');
        },
        /*  L  */ 76: function () {
            poper.createPopup('landmarks');
        },
        /*  R  */ 82: function () {
            toggleRouteMode();
        },
        /*  T  */ 84: function () {
            if (tradersExported) toggleTraderMode();
        },
        /*  P  */ 80: function () {
            if (translocatorsExported) toggleTlProximityMode();
        },
        /* ESC */ 27: function () {
            poper.destroyPopup(Object.keys(poper.popups).pop());
        }
    }
    // Act on keypress if no popups are open
    if (Object.keys(poper.popups).length == 0 && kp.keyCode in actions) {
        actions[kp.keyCode]();
    }
    // Exception to allow closing popups with ESC
    else if (Object.keys(poper.popups).length > 0 && kp.keyCode in actions && kp.keyCode == 27) {
        actions[kp.keyCode]();
    }
}

// Collapse the Translocators legend by default while leaving the layer visible.
if (translocatorsExported) switcher.toggleVis(vsTranslocators.get('name'));
if (tradersExported) switcher.toggleVis(vsTraders.get('name'))
if (chunksExported) switcher.toggleVis(vsGenChunks.get('name'));
switcher.toggleLegendVis(vsLandmarks.get('name'))
goToCoords(cx + ',' + cy);
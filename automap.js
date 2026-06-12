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
        "Spawn Translocator": true,
        "Teleporter": true,
    },
    "Landmarks": {
        "Server": true,
        "Base": true,
        "Misc": true,
    },
};

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
                'content': "Select a landmark from the list."
            },
            'input': {
                'type': 'select',
                'id': 'select_data',
                'name': 'select_data',
                'label': 'Landmarks from the "Landmarks" layer:',
                'focus': true,
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
                        popupBlock.append(input);
                        if (e['focus']) {
                            focus = e['id'];
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

let vsTranslocators = new ol.layer.Vector({
    name: 'Translocators',
    minZoom: 2,
    source: new ol.source.Vector({
        url: dataFolder + '/geojson/translocators.geojson',
        format: new ol.format.GeoJSON(),
    }),
    style: function (feature) {
        let opacity = 1;
        let isOn = showSubLayerItems['Translocators']['Translocator'];
        let tlCol = colorsRef['Translocators']['Translocator'];
        if (feature.get('tag') == 'SPAWN') {
            tlCol = colorsRef['Translocators']['Spawn Translocator'];
            isOn = showSubLayerItems['Translocators']['Spawn Translocator']
        } else if (feature.get('tag') == 'TP') {
            tlCol = colorsRef['Translocators']['Teleporter'];
            isOn = showSubLayerItems['Translocators']['Teleporter']
        } else if (feature.get('label') != undefined && feature.get('label').length > 0) {
            tlCol = colorsRef['Translocators']['Named Translocator'];
            isOn = showSubLayerItems['Translocators']['Named Translocator']
        }
        if (!isOn) {
            opacity = 0;
        }
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
        // tiles are plain images -> can be hotlinked cross-origin (no CORS needed),
        // so they stream straight from TOPS on GitHub Pages without a proxy.
        url: 'https://map.tops.vintagestory.at/data/world/{z}/{x}_{y}.png',
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
        vsLandmarks
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
switcher.buildLegend(vsTranslocators);
switcher.buildLegend(vsTraders);
switcher.buildLegend(vsLandmarks);
switcher.buildLegend(vsGenChunks);

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

switcher.toggleVis(vsTraders.get('name'))
switcher.toggleVis(vsTranslocators.get('name'))
switcher.toggleVis(vsGenChunks.get('name'));
switcher.toggleLegendVis(vsLandmarks.get('name'))
goToCoords(cx + ',' + cy);
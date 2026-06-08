// ========== MAP LAYER SETUP ==========
// Functions that register the MapLibre layers for the territory map. Each takes
// the map instance and adds layers. No React, no closures over component state.
// This is the place to evolve the visual language of the map, including the
// future 3D extruded-hexagon skyline.

// Capture-count tier color ramp, returned fresh per call so each layer gets its
// own expression array. Green -> blue -> honey -> pink as captures climb.
const tierColorMatch = () => ['match', ['coalesce', ['get', 'captureCount'], 0],
    1, '#39ff14', 2, '#39ff14', 3, '#39ff14',
    4, '#00ccff', 5, '#00ccff', 6, '#00ccff',
    7, '#f5a623', 8, '#f5a623', 9, '#f5a623',
    '#ff00aa',
];

// Territory fills, glows, and outlines, tiered by capture count. Mine and others
// are styled separately so ownership reads at a glance.
export function addTerritoryLayers(map) {
    // Tier fills:
    // T1: captures 1-3 -> neon green
    // T2: captures 4-6 -> neon blue
    // T3: captures 7-9 -> neon gold
    // T4: captures 10+ -> neon pink
    map.addLayer({
        id: 'hex-fill',
        type: 'fill',
        source: 'territories',
        paint: {
            'fill-color': tierColorMatch(),
            'fill-opacity': 0.25,
        },
    });

    // Others: boosted fill to compensate for no hull glow
    map.addLayer({
        id: 'hex-fill-others',
        type: 'fill',
        source: 'territories',
        filter: ['!=', ['get', 'isMine'], true],
        paint: {
            'fill-color': tierColorMatch(),
            'fill-opacity': 0.2,
        },
    });

    // Others: ambient wide outer glow (simulates hull vibrancy per-hex)
    map.addLayer({
        id: 'hex-glow-others-ambient',
        type: 'line',
        source: 'territories',
        filter: ['!=', ['get', 'isMine'], true],
        paint: {
            'line-color': tierColorMatch(),
            'line-width': 18,
            'line-opacity': 0,
            'line-blur': 12,
        },
    });

    // Others: tier border + white core + per-tier glow
    map.addLayer({
        id: 'hex-outline-others',
        type: 'line',
        source: 'territories',
        filter: ['!=', ['get', 'isMine'], true],
        paint: {
            'line-color': tierColorMatch(),
            'line-width': 5,
            'line-opacity': 1,
            'line-blur': 0,
        },
    });
    map.addLayer({
        id: 'hex-outline-others-core',
        type: 'line',
        source: 'territories',
        filter: ['!=', ['get', 'isMine'], true],
        paint: { 'line-color': '#ffffff', 'line-width': 3, 'line-opacity': 1, 'line-blur': 0 },
    });
    map.addLayer({ id: 'hex-glow-others-t1', type: 'line', source: 'territories',
        filter: ['all', ['!=', ['get', 'isMine'], true], ['>=', ['coalesce', ['get', 'captureCount'], 0], 1], ['<=', ['coalesce', ['get', 'captureCount'], 0], 3]],
        paint: { 'line-color': '#39ff14', 'line-width': 8, 'line-opacity': 0.5, 'line-blur': 6 },
    });
    map.addLayer({ id: 'hex-glow-others-t2', type: 'line', source: 'territories',
        filter: ['all', ['!=', ['get', 'isMine'], true], ['>=', ['coalesce', ['get', 'captureCount'], 0], 4], ['<=', ['coalesce', ['get', 'captureCount'], 0], 6]],
        paint: { 'line-color': '#00ccff', 'line-width': 10, 'line-opacity': 0.5, 'line-blur': 7 },
    });
    map.addLayer({ id: 'hex-glow-others-t3', type: 'line', source: 'territories',
        filter: ['all', ['!=', ['get', 'isMine'], true], ['>=', ['coalesce', ['get', 'captureCount'], 0], 7], ['<=', ['coalesce', ['get', 'captureCount'], 0], 9]],
        paint: { 'line-color': '#f5a623', 'line-width': 10, 'line-opacity': 0.5, 'line-blur': 7 },
    });
    map.addLayer({ id: 'hex-glow-others-t4', type: 'line', source: 'territories',
        filter: ['all', ['!=', ['get', 'isMine'], true], ['>=', ['coalesce', ['get', 'captureCount'], 0], 10]],
        paint: { 'line-color': '#ff00aa', 'line-width': 12, 'line-opacity': 0.5, 'line-blur': 8 },
    });

    // Glow layers: mine only, one per tier
    map.addLayer({ id: 'hex-glow-t1', type: 'line', source: 'territories',
        filter: ['all', ['==', ['get', 'isMine'], true], ['>=', ['coalesce', ['get', 'captureCount'], 0], 1], ['<=', ['coalesce', ['get', 'captureCount'], 0], 3]],
        paint: { 'line-color': '#39ff14', 'line-width': 8, 'line-opacity': 0, 'line-blur': 6 },
    });
    map.addLayer({ id: 'hex-glow-t2', type: 'line', source: 'territories',
        filter: ['all', ['==', ['get', 'isMine'], true], ['>=', ['coalesce', ['get', 'captureCount'], 0], 4], ['<=', ['coalesce', ['get', 'captureCount'], 0], 6]],
        paint: { 'line-color': '#00ccff', 'line-width': 10, 'line-opacity': 0, 'line-blur': 7 },
    });
    map.addLayer({ id: 'hex-glow-t3', type: 'line', source: 'territories',
        filter: ['all', ['==', ['get', 'isMine'], true], ['>=', ['coalesce', ['get', 'captureCount'], 0], 7], ['<=', ['coalesce', ['get', 'captureCount'], 0], 9]],
        paint: { 'line-color': '#f5a623', 'line-width': 10, 'line-opacity': 0, 'line-blur': 7 },
    });

    // Mine: tier-colored outer border + white core
    map.addLayer({
        id: 'hex-outline-top',
        type: 'line',
        source: 'territories',
        filter: ['==', ['get', 'isMine'], true],
        paint: {
            'line-color': tierColorMatch(),
            'line-width': 5,
            'line-opacity': 1,
            'line-blur': 0,
        },
    });

    // White inner core
    map.addLayer({
        id: 'hex-outline-core',
        type: 'line',
        source: 'territories',
        filter: ['==', ['get', 'isMine'], true],
        paint: { 'line-color': '#ffffff', 'line-width': 1.5, 'line-opacity': 1, 'line-blur': 0 },
    });
}

// Territory hull: the glowing merged outer boundary of all my captured hexes.
export function addHullLayers(map, hullColor) {
    // Layer 1: wide soft halo far from the edge
    map.addLayer({
        id: 'hull-outer-glow',
        type: 'line',
        source: 'territory-hull',
        paint: {
            'line-color': hullColor,
            'line-width': 18,
            'line-opacity': 0.2,
            'line-blur': 12,
        },
    });

    // Layer 2: tighter inner glow, brighter
    map.addLayer({
        id: 'hull-inner-glow',
        type: 'line',
        source: 'territory-hull',
        paint: {
            'line-color': hullColor,
            'line-width': 6,
            'line-opacity': 0.55,
            'line-blur': 3,
        },
    });

    // Layer 3: crisp bright edge on top
    map.addLayer({
        id: 'hull-edge',
        type: 'line',
        source: 'territory-hull',
        paint: {
            'line-color': '#ffffff',
            'line-width': 2,
            'line-opacity': 0.95,
        },
    });
}

// Nearby uncaptured hex grid: the animated rainbow halo of claimable tiles.
// beforeId places these beneath the territory fill so captured hexes sit on top.
export function addHexGridLayers(map, beforeId) {
    // Rainbow fill tint, data-driven per hex
    map.addLayer({
        id: 'hex-grid-fill',
        type: 'fill',
        source: 'hex-grid',
        paint: { 'fill-color': ['get', 'rainbowColor'], 'fill-opacity': 0.08 },
    }, beforeId);

    // Wide blurred glow, data-driven color
    map.addLayer({
        id: 'hex-grid-glow',
        type: 'line',
        source: 'hex-grid',
        paint: {
            'line-color': ['get', 'rainbowGlow'],
            'line-width': 5,
            'line-opacity': 0.25,
            'line-blur': 4,
        },
    }, beforeId);

    // Outer corona burst: very wide, heavy blur
    map.addLayer({
        id: 'hex-grid-corona',
        type: 'line',
        source: 'hex-grid',
        paint: {
            'line-color': ['get', 'rainbowColor'],
            'line-width': 28,
            'line-opacity': 0.0,
            'line-blur': 12,
        },
    }, beforeId);

    // Mid rays: medium width
    map.addLayer({
        id: 'hex-grid-rays',
        type: 'line',
        source: 'hex-grid',
        paint: {
            'line-color': ['get', 'rainbowGlow'],
            'line-width': 10,
            'line-opacity': 0.0,
            'line-blur': 5,
        },
    }, beforeId);

    // Sharp outline, data-driven color
    map.addLayer({
        id: 'hex-grid-outline',
        type: 'line',
        source: 'hex-grid',
        paint: {
            'line-color': ['get', 'rainbowColor'],
            'line-width': 1.5,
            'line-opacity': 0.75,
        },
    }, beforeId);
}

// ========== CUSTOM DARK MAP STYLE ==========
// Fetches the OpenFreeMap dark style JSON and customizes every layer
// for a "dark mode Google Maps" feel: water is blue, parks are green,
// roads are clearly visible with hierarchy, buildings have outlines,
// and labels are crisp and readable.
//
// WHY FETCH + MODIFY INSTEAD OF USING THE URL DIRECTLY:
// OpenFreeMap's dark style treats everything as nearly the same shade
// of dark gray. Water, parks, buildings, roads all blend together.
// By fetching the JSON and modifying paint properties before passing
// it to MapLibre, we get frame-1 correct colors with no visible flash.
//
// USED BY: Map.jsx (territory map) and LogActivity.jsx (tracking map)

const STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';

// ========== COLOR PALETTE ==========
// Premium dark theme — every feature type has its own distinct color
// so users can instantly identify what they're looking at.
const COLORS = {
    // Base surfaces
    background: '#0f172a',          // slate-900 — dark but not black
    landuse: '#131c2e',             // slightly lighter than background
    residential: '#141e30',         // residential areas, subtle lift

    // Water — unmistakably blue
    waterFill: '#172554',           // blue-950 — dark navy
    waterway: '#1e3a5f',            // brighter blue for rivers/streams
    waterLabel: '#60a5fa',          // blue-400 — crisp on dark blue

    // Vegetation — clearly green
    park: '#0d3320',                // dark emerald
    forest: '#0a2e1a',             // darker green for forests
    grass: '#0f3d26',              // slightly brighter for grass/fields

    // Buildings — visible structure
    buildingFill: '#1a2744',        // dark blue-gray, distinct from background
    buildingOutline: '#374151',     // gray-700 — clear outlines

    // Roads — clear hierarchy from minor to highway
    roadMinor: '#334155',           // slate-700 — residential streets
    roadTertiary: '#475569',        // slate-600 — tertiary roads
    roadSecondary: '#64748b',       // slate-500 — secondary roads
    roadPrimary: '#94a3b8',         // slate-400 — primary roads
    roadHighway: '#cbd5e1',         // slate-300 — highways, brightest
    roadRail: '#475569',            // slate-600 for rail lines

    // Boundaries
    boundary: '#475569',            // slate-600

    // Labels — readable at a glance
    labelCity: '#f1f5f9',           // slate-100 — city/town names
    labelPlace: '#cbd5e1',          // slate-300 — neighborhoods, suburbs
    labelRoad: '#94a3b8',           // slate-400 — street names
    labelPoi: '#64748b',            // slate-500 — points of interest
    labelHalo: '#0f172a',           // matches background for clean halos
};

// ========== LAYER CUSTOMIZATION ==========
// Walks through every layer in the style and overrides paint properties
// based on the layer's source-layer (from OpenMapTiles schema) and type.
// Only modifies color-related properties — preserves line widths, zoom
// expressions for sizing, text placement, etc.
function customizeLayer(layer) {
    if (!layer.paint) layer.paint = {};
    const sl = layer['source-layer'];
    const type = layer.type;
    const id = (layer.id || '').toLowerCase();

    // ---- Background ----
    if (type === 'background') {
        layer.paint['background-color'] = COLORS.background;
        return;
    }

    // ---- Water (fills) ----
    if (sl === 'water' && type === 'fill') {
        layer.paint['fill-color'] = COLORS.waterFill;
        layer.paint['fill-opacity'] = 1;
        return;
    }

    // ---- Waterways (rivers, streams, canals) ----
    if (sl === 'waterway' && type === 'line') {
        layer.paint['line-color'] = COLORS.waterway;
        layer.paint['line-opacity'] = 1;
        return;
    }

    // ---- Land cover (forests, grass, ice) ----
    if (sl === 'landcover' && type === 'fill') {
        // Use layer ID to differentiate vegetation types
        if (id.includes('wood') || id.includes('forest')) {
            layer.paint['fill-color'] = COLORS.forest;
        } else if (id.includes('grass') || id.includes('meadow')) {
            layer.paint['fill-color'] = COLORS.grass;
        } else {
            layer.paint['fill-color'] = COLORS.forest;
        }
        layer.paint['fill-opacity'] = 0.6;
        return;
    }

    // ---- Land use (residential, commercial, etc.) ----
    if (sl === 'landuse' && type === 'fill') {
        if (id.includes('residential')) {
            layer.paint['fill-color'] = COLORS.residential;
        } else {
            layer.paint['fill-color'] = COLORS.landuse;
        }
        return;
    }

    // ---- Parks ----
    if (sl === 'park' && type === 'fill') {
        layer.paint['fill-color'] = COLORS.park;
        layer.paint['fill-opacity'] = 0.7;
        return;
    }

    // ---- Buildings ----
    if (sl === 'building' && type === 'fill') {
        layer.paint['fill-color'] = COLORS.buildingFill;
        layer.paint['fill-outline-color'] = COLORS.buildingOutline;
        return;
    }

    // ---- Roads / Transportation ----
    if (sl === 'transportation' && type === 'line') {
        // Determine road class from the layer's filter expression.
        // OpenMapTiles filters use class names like 'motorway', 'primary', etc.
        const filterStr = JSON.stringify(layer.filter || []);

        if (filterStr.includes('motorway') || filterStr.includes('trunk')) {
            layer.paint['line-color'] = COLORS.roadHighway;
        } else if (filterStr.includes('primary')) {
            layer.paint['line-color'] = COLORS.roadPrimary;
        } else if (filterStr.includes('secondary')) {
            layer.paint['line-color'] = COLORS.roadSecondary;
        } else if (filterStr.includes('tertiary')) {
            layer.paint['line-color'] = COLORS.roadTertiary;
        } else if (filterStr.includes('rail')) {
            layer.paint['line-color'] = COLORS.roadRail;
        } else {
            // Minor roads, service roads, paths, etc.
            layer.paint['line-color'] = COLORS.roadMinor;
        }
        return;
    }

    // ---- Road / Transportation name labels ----
    if (sl === 'transportation_name' && type === 'symbol') {
        layer.paint['text-color'] = COLORS.labelRoad;
        layer.paint['text-halo-color'] = COLORS.labelHalo;
        layer.paint['text-halo-width'] = 1.5;
        return;
    }

    // ---- Place labels (cities, towns, neighborhoods) ----
    if (sl === 'place' && type === 'symbol') {
        // Bigger places get brighter labels
        const filterStr = JSON.stringify(layer.filter || []);
        if (filterStr.includes('city') || filterStr.includes('town')) {
            layer.paint['text-color'] = COLORS.labelCity;
        } else {
            layer.paint['text-color'] = COLORS.labelPlace;
        }
        layer.paint['text-halo-color'] = COLORS.labelHalo;
        layer.paint['text-halo-width'] = 1.5;
        return;
    }

    // ---- Water name labels ----
    if (sl === 'water_name' && type === 'symbol') {
        layer.paint['text-color'] = COLORS.waterLabel;
        layer.paint['text-halo-color'] = COLORS.waterFill;
        layer.paint['text-halo-width'] = 1;
        return;
    }

    // ---- Boundaries (country, state, admin) ----
    if (sl === 'boundary' && type === 'line') {
        layer.paint['line-color'] = COLORS.boundary;
        layer.paint['line-opacity'] = 0.5;
        return;
    }

    // ---- POI labels ----
    if (sl === 'poi' && type === 'symbol') {
        layer.paint['text-color'] = COLORS.labelPoi;
        layer.paint['text-halo-color'] = COLORS.labelHalo;
        layer.paint['text-halo-width'] = 1;
        return;
    }
}

// ========== INJECT BUILDING OUTLINE LAYER ==========
// Adds a dedicated line layer for building outlines. This is more
// reliable than fill-outline-color which can be inconsistent with
// vector tile sources at fractional zoom levels.
function injectBuildingOutlines(style) {
    // Find the last building layer and insert our outline after it
    let insertIndex = style.layers.length;
    for (let i = style.layers.length - 1; i >= 0; i--) {
        if (style.layers[i]['source-layer'] === 'building') {
            insertIndex = i + 1;
            break;
        }
    }

    style.layers.splice(insertIndex, 0, {
        id: 'building-outlines-custom',
        source: 'openmaptiles',
        'source-layer': 'building',
        type: 'line',
        paint: {
            'line-color': COLORS.buildingOutline,
            'line-width': 0.6,
            'line-opacity': 0.7,
        },
    });
}

// ========== MAIN EXPORT ==========
// Fetches the OpenFreeMap dark style, customizes all layers, and returns
// the modified style JSON ready to pass to new maplibregl.Map({ style }).
//
// Falls back to the raw URL if the fetch fails — you'll get the default
// unmodified dark style, which is ugly but functional.
export async function getCustomDarkStyle() {
    try {
        const res = await fetch(STYLE_URL);
        if (!res.ok) throw new Error(`Style fetch failed: ${res.status}`);

        const style = await res.json();

        // Customize every layer's colors
        for (const layer of style.layers) {
            customizeLayer(layer);
        }

        // Add dedicated building outline layer
        injectBuildingOutlines(style);

        return style;
    } catch (err) {
        console.warn('Failed to customize map style, falling back to default:', err.message);
        return STYLE_URL;
    }
}

// Export the raw URL as fallback for error handling
export const MAP_STYLE_FALLBACK = STYLE_URL;

// Liberty style used as-is — correct parks, water, roads out of the box.
// A CSS filter in Map.jsx darkens the canvas to give it a game-map feel
// without us having to fight the layer schema.
export const LIBERTY_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

// Liberty style with individual building footprints hidden.
// Residential area fills (landuse) remain visible so neighbourhoods
// are still distinguishable — just no individual building outlines.
export async function getLibertyNoBuildingsStyle() {
    try {
        const res = await fetch(LIBERTY_STYLE_URL);
        if (!res.ok) throw new Error(`Style fetch failed: ${res.status}`);
        const style = await res.json();

        style.layers = style.layers.map(layer => {
            const sl = layer['source-layer'];
            const type = layer.type;

            // Background and land → white
            if (type === 'background') {
                return { ...layer, paint: { ...layer.paint, 'background-color': '#ffffff' } };
            }
            if ((sl === 'landuse' || sl === 'landcover') && type === 'fill') {
                const id = (layer.id || '').toLowerCase();
                const f = JSON.stringify(layer.filter || []);
                const isGreen =
                    id.includes('grass') || id.includes('park')   || id.includes('wood')   ||
                    id.includes('forest')|| id.includes('meadow') || id.includes('garden') ||
                    id.includes('golf')  || id.includes('pitch')  ||
                    f.includes('grass')  || f.includes('park')    || f.includes('wood')    ||
                    f.includes('forest') || f.includes('meadow')  || f.includes('garden')  ||
                    f.includes('golf')   || f.includes('pitch');
                if (!isGreen) {
                    return { ...layer, paint: { ...layer.paint, 'fill-color': '#ffffff' } };
                }
            }

            // Strip fill-pattern textures (grass sprites, etc.) from all fill layers
            if (type === 'fill' && layer.paint?.['fill-pattern']) {
                const paint = { ...layer.paint };
                delete paint['fill-pattern'];
                // A pattern-only fill has no color of its own, so removing the
                // texture would leave it MapLibre's default black. Give those a
                // neutral light fill (piers, plazas, etc.) so they blend into the
                // light map instead of rendering as black blobs.
                if (!paint['fill-color']) {
                    paint['fill-color'] = '#e2e8ee';
                }
                return { ...layer, paint };
            }

            // Hide everything except roads, paths, boundaries, and labels
            const hide = ['building', 'poi', 'aeroway', 'housenumber', 'landcover', 'landuse'];
            if (hide.includes(sl) && type === 'symbol') {
                return { ...layer, layout: { ...layer.layout, visibility: 'none' } };
            }
            if (['building', 'poi', 'aeroway', 'housenumber'].includes(sl)) {
                return { ...layer, layout: { ...layer.layout, visibility: 'none' } };
            }
            // Hide POI/transit icons
            if (type === 'symbol' && sl !== 'transportation_name' && sl !== 'place') {
                return { ...layer, layout: { ...layer.layout, visibility: 'none' } };
            }
            // Place labels — remove zoom constraints so state names persist at all zoom levels.
            // MapLibre's collision detection naturally surfaces the most important labels
            // (countries > states > cities) when space is tight.
            if (type === 'symbol' && sl === 'place') {
                const updated = { ...layer, minzoom: 0 };
                delete updated.maxzoom;
                return updated;
            }
            // Boundary lines — remove minzoom so they show at all zoom levels
            if (sl === 'boundary' && type === 'line') {
                const updated = {
                    ...layer,
                    minzoom: 0,
                    layout: { ...layer.layout, visibility: 'visible' },
                    paint: {
                        ...layer.paint,
                        'line-color': '#9090c0',
                        'line-width': 1.5,
                        'line-opacity': 0.8,
                    },
                };
                delete updated.maxzoom;
                return updated;
            }

            // Roads → light grey hierarchy
            if (sl === 'transportation' && type === 'line') {
                const f = JSON.stringify(layer.filter || []);
                let color;
                if (f.includes('motorway') || f.includes('trunk')) {
                    color = '#b0bcc8';
                } else if (f.includes('primary')) {
                    color = '#c4cdd6';
                } else if (f.includes('secondary') || f.includes('tertiary')) {
                    color = '#d4dbe2';
                } else {
                    color = '#e2e8ee';
                }
                return { ...layer, paint: { ...layer.paint, 'line-color': color } };
            }

            // Road name labels → smaller, subtle, out of the way
            if (sl === 'transportation_name' && type === 'symbol') {
                return {
                    ...layer,
                    paint: {
                        ...layer.paint,
                        'text-color': '#111111',
                        'text-halo-color': '#ffffff',
                        'text-halo-width': 1,
                        'text-opacity': 1,
                    },
                    layout: {
                        ...layer.layout,
                        'text-size': 13,
                        'text-font': ['Noto Sans Regular'],
                    },
                };
            }

            // Water → deep dark blue
            if (sl === 'water' && type === 'fill') {
                return { ...layer, paint: { ...layer.paint, 'fill-color': '#00b4d8', 'fill-opacity': 1 } };
            }
            if (sl === 'waterway' && type === 'line') {
                return { ...layer, paint: { ...layer.paint, 'line-color': '#48cae4' } };
            }

            // Grass / parks / forests → vivid grass green
            if ((sl === 'landcover' || sl === 'landuse' || sl === 'park') && type === 'fill') {
                const id = (layer.id || '').toLowerCase();
                const f = JSON.stringify(layer.filter || []);
                const isGreen =
                    id.includes('grass')  || id.includes('park')   ||
                    id.includes('meadow') || id.includes('garden')  ||
                    id.includes('golf')   || id.includes('pitch')   ||
                    id.includes('wood')   || id.includes('forest')  ||
                    f.includes('grass')   || f.includes('park')     ||
                    f.includes('meadow')  || f.includes('garden')   ||
                    f.includes('golf')    || f.includes('pitch')    ||
                    f.includes('wood')    || f.includes('forest');
                if (isGreen) {
                    return { ...layer, paint: { ...layer.paint, 'fill-color': '#4ade80', 'fill-opacity': 0.6 } };
                }
            }

            return layer;
        });

        // Force globe projection: the style JSON may set mercator, which would
        // otherwise override the constructor setting.
        style.projection = { type: 'globe' };

        // Atmosphere glow around the globe edge (MapLibre v5 uses style property, not setFog)
        style.atmosphere = {
            'color': 'rgba(100, 180, 255, 0.8)',
            'high-color': 'rgba(20, 60, 200, 1.0)',
            'horizon-blend': 0.05,
            'space-color': 'rgba(5, 5, 20, 1.0)',
            'star-intensity': 0.6,
        };

        return style;
    } catch (err) {
        console.warn('Failed to load style, falling back:', err.message);
        return LIBERTY_STYLE_URL;
    }
}

// ========== CUSTOM LIGHT MAP STYLE ==========
// Mirrors the light Google Maps style used in the mobile app.
// Fetches OpenFreeMap's Liberty style (clean vector tiles, no API key)
// and paints every layer to match: white roads, light-blue water,
// soft-green parks, light-gray buildings, dark-gray labels.

const LIGHT_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

const LIGHT_COLORS = {
    background:   '#f5f5f5',
    landuse:      '#efefef',
    residential:  '#f0f0f0',

    waterFill:    '#c9e8f5',
    waterway:     '#a8d8ea',
    waterLabel:   '#3b82f6',

    park:         '#e0f2e9',
    forest:       '#d4edda',
    grass:        '#e8f5e9',

    buildingFill:    '#e8e8e8',
    buildingOutline: '#cccccc',

    roadMinor:    '#ffffff',
    roadTertiary: '#f0f0f0',
    roadSecondary:'#e8e8e8',
    roadPrimary:  '#dadada',
    roadHighway:  '#d0d0d0',
    roadRail:     '#c8c8c8',

    boundary:     '#bbbbbb',

    labelCity:    '#212121',
    labelPlace:   '#424242',
    labelRoad:    '#757575',
    labelPoi:     '#9e9e9e',
    labelHalo:    '#ffffff',
};

function customizeLightLayer(layer) {
    if (!layer.paint) layer.paint = {};
    const sl = layer['source-layer'];
    const type = layer.type;
    const id = (layer.id || '').toLowerCase();

    if (type === 'background') {
        layer.paint['background-color'] = LIGHT_COLORS.background;
        return;
    }
    if (sl === 'water' && type === 'fill') {
        layer.paint['fill-color'] = LIGHT_COLORS.waterFill;
        layer.paint['fill-opacity'] = 1;
        return;
    }
    if (sl === 'waterway' && type === 'line') {
        layer.paint['line-color'] = LIGHT_COLORS.waterway;
        layer.paint['line-opacity'] = 1;
        return;
    }
    if (sl === 'landcover' && type === 'fill') {
        if (id.includes('wood') || id.includes('forest')) {
            layer.paint['fill-color'] = LIGHT_COLORS.forest;
        } else if (id.includes('grass') || id.includes('meadow')) {
            layer.paint['fill-color'] = LIGHT_COLORS.grass;
        } else {
            layer.paint['fill-color'] = LIGHT_COLORS.forest;
        }
        layer.paint['fill-opacity'] = 0.7;
        return;
    }
    if (sl === 'landuse' && type === 'fill') {
        layer.paint['fill-color'] = id.includes('residential')
            ? LIGHT_COLORS.residential
            : LIGHT_COLORS.landuse;
        return;
    }
    if (sl === 'park' && type === 'fill') {
        layer.paint['fill-color'] = LIGHT_COLORS.park;
        layer.paint['fill-opacity'] = 0.8;
        return;
    }
    if (sl === 'building' && type === 'fill') {
        layer.paint['fill-color'] = LIGHT_COLORS.buildingFill;
        layer.paint['fill-outline-color'] = LIGHT_COLORS.buildingOutline;
        return;
    }
    if (sl === 'transportation' && type === 'line') {
        const filterStr = JSON.stringify(layer.filter || []);
        if (filterStr.includes('motorway') || filterStr.includes('trunk')) {
            layer.paint['line-color'] = LIGHT_COLORS.roadHighway;
        } else if (filterStr.includes('primary')) {
            layer.paint['line-color'] = LIGHT_COLORS.roadPrimary;
        } else if (filterStr.includes('secondary')) {
            layer.paint['line-color'] = LIGHT_COLORS.roadSecondary;
        } else if (filterStr.includes('tertiary')) {
            layer.paint['line-color'] = LIGHT_COLORS.roadTertiary;
        } else if (filterStr.includes('rail')) {
            layer.paint['line-color'] = LIGHT_COLORS.roadRail;
        } else {
            layer.paint['line-color'] = LIGHT_COLORS.roadMinor;
        }
        return;
    }
    if (sl === 'transportation_name' && type === 'symbol') {
        layer.paint['text-color'] = LIGHT_COLORS.labelRoad;
        layer.paint['text-halo-color'] = LIGHT_COLORS.labelHalo;
        layer.paint['text-halo-width'] = 1.5;
        return;
    }
    if (sl === 'place' && type === 'symbol') {
        const filterStr = JSON.stringify(layer.filter || []);
        layer.paint['text-color'] = (filterStr.includes('city') || filterStr.includes('town'))
            ? LIGHT_COLORS.labelCity
            : LIGHT_COLORS.labelPlace;
        layer.paint['text-halo-color'] = LIGHT_COLORS.labelHalo;
        layer.paint['text-halo-width'] = 1.5;
        return;
    }
    if (sl === 'water_name' && type === 'symbol') {
        layer.paint['text-color'] = LIGHT_COLORS.waterLabel;
        layer.paint['text-halo-color'] = LIGHT_COLORS.waterFill;
        layer.paint['text-halo-width'] = 1;
        return;
    }
    if (sl === 'boundary' && type === 'line') {
        layer.paint['line-color'] = LIGHT_COLORS.boundary;
        layer.paint['line-opacity'] = 0.5;
        return;
    }
    if (sl === 'poi' && type === 'symbol') {
        layer.paint['text-color'] = LIGHT_COLORS.labelPoi;
        layer.paint['text-halo-color'] = LIGHT_COLORS.labelHalo;
        layer.paint['text-halo-width'] = 1;
        return;
    }
}

function injectLightBuildingOutlines(style) {
    let insertIndex = style.layers.length;
    for (let i = style.layers.length - 1; i >= 0; i--) {
        if (style.layers[i]['source-layer'] === 'building') {
            insertIndex = i + 1;
            break;
        }
    }
    style.layers.splice(insertIndex, 0, {
        id: 'building-outlines-light-custom',
        source: 'openmaptiles',
        'source-layer': 'building',
        type: 'line',
        paint: {
            'line-color': LIGHT_COLORS.buildingOutline,
            'line-width': 0.6,
            'line-opacity': 0.6,
        },
    });
}

export async function getCustomLightStyle() {
    try {
        const res = await fetch(LIGHT_STYLE_URL);
        if (!res.ok) throw new Error(`Style fetch failed: ${res.status}`);
        const style = await res.json();
        for (const layer of style.layers) {
            customizeLightLayer(layer);
        }
        injectLightBuildingOutlines(style);
        return style;
    } catch (err) {
        console.warn('Failed to customize light map style, falling back to default:', err.message);
        return LIGHT_STYLE_URL;
    }
}
// ========== MAP STYLES ==========
// Builds the MapLibre style objects used across the app. Both are based on
// OpenFreeMap's Liberty style, fetched and lightly modified before the map
// renders so colors are correct on the first frame with no flash.
//
// USED BY: Map.jsx (getLibertyNoBuildingsStyle),
//          LogActivity.jsx and Profile.jsx (getCustomLightStyle).

// Liberty style used as-is: correct parks, water, and roads out of the box.
// A CSS filter in Map.jsx darkens the canvas for a game-map feel without
// fighting the layer schema.
const LIBERTY_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

// Liberty style with individual building footprints hidden.
// Residential area fills (landuse) remain visible so neighbourhoods
// are still distinguishable, just no individual building outlines.
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
            // Place labels: remove zoom constraints so state names persist at all zoom levels.
            // MapLibre's collision detection naturally surfaces the most important labels
            // (countries > states > cities) when space is tight.
            if (type === 'symbol' && sl === 'place') {
                const updated = { ...layer, minzoom: 0 };
                delete updated.maxzoom;
                return updated;
            }
            // Boundary lines: remove minzoom so they show at all zoom levels
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
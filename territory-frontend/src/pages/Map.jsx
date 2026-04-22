// ========== MAP PAGE ==========
// Full-screen territory map showing every captured hex tile in the world.
// Built on MapLibre GL JS + OpenFreeMap vector tiles (free, no API key).
//
// CUSTOM DARK STYLE:
// Instead of using OpenFreeMap's dark style as-is (where everything blends
// into the same dark gray), we fetch the style JSON and customize every
// layer: water is blue, parks are green, roads have clear hierarchy,
// buildings have visible outlines, labels are crisp. See utils/mapStyle.js.
//
// Your tiles render in emerald green, everyone else's in neon purple/pink.
// Tap any tile to see who owns it and when they captured it.
// Centers on your GPS location on load so you immediately see your neighborhood.

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getTerritories } from '../services/api';
import HexBackground from '../components/HexBackground';
import Navbar from '../components/Navbar';
import { latLngToCell, gridDisk, cellToBoundary, cellsToMultiPolygon, cellToLatLng } from 'h3-js';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getLibertyNoBuildingsStyle } from '../utils/mapStyle';

// ========== CONSTANTS ==========
// Colors chosen for outdoor visibility and instant ownership recognition.
// Emerald = yours, neon purple = theirs. No ambiguity.
const COLOR_MINE = '#10b981';
const COLOR_THEIRS = '#e879f9';
const DEFAULT_ZOOM = 15;
const FALLBACK_LAT = 27.9506;
const FALLBACK_LNG = -82.4572;
const H3_RESOLUTION = 10;
const HEX_GRID_RING_SIZE = 5;

// Deterministic color from ownerId — same player always gets the same color
const playerColor = (ownerId) => {
    const hash = ownerId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const hue = (hash * 137) % 360; // golden angle keeps colors visually distinct
    return `hsl(${hue}, 100%, 62%)`;
};

// Returns a Promise that resolves to an HTMLImageElement of a colored shield
const makeShieldImage = (color) => new Promise((resolve) => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
        <path d="M32,4 L56,12 L56,34 Q56,54 32,62 Q8,54 8,34 L8,12 Z"
            fill="#111111" stroke="${color}" stroke-width="3.5"/>
        <path d="M32,11 L50,17 L50,34 Q50,49 32,56 Q14,49 14,34 L14,17 Z"
            fill="none" stroke="${color}" stroke-width="1.5" stroke-opacity="0.5"/>
    </svg>`;
    const img = new Image(64, 64);
    img.onload = () => resolve(img);
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
});

function hslToHex(h, s, l) {
    s /= 100; l /= 100;
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    const hex = x => Math.round(x * 255).toString(16).padStart(2, '0');
    return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`;
}

export default function Map() {
    const { user } = useAuth();
    const navigate = useNavigate();

    // ========== STATE ==========
    const [territories, setTerritories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [locationError, setLocationError] = useState(null);
    const [tileCount, setTileCount] = useState({ mine: 0, total: 0 });
    const [userLocation, setUserLocation] = useState(null);
    // Tracks when MapLibre's style has fully loaded — you CANNOT add
    // sources or layers until this is true. Attempting to do so throws.
    const [mapLoaded, setMapLoaded] = useState(false);
    const [mapZoom, setMapZoom] = useState(15);
    const [selectedPlayer, setSelectedPlayer] = useState(null);

    // ========== REFS ==========
    // Map ref lives outside React state because MapLibre manages its own
    // DOM and WebGL context — putting it in state would cause issues.
    const mapRef = useRef(null);
    const mapContainerRef = useRef(null);
    const starCanvasRef = useRef(null);
    const locationMarkerRef = useRef(null);
    const shimmerRef = useRef(null);
    const hexGridFeaturesRef = useRef([]);
    const hexGridLngRangeRef = useRef({ minLng: 0, maxLng: 1 });
    const hasZoomedToTerritoryRef = useRef(false);
    const spinFrameRef = useRef(null);
    const territoriesRef = useRef([]);

    // ========== STARFIELD ==========
    useEffect(() => {
        const canvas = starCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const W = canvas.width = canvas.offsetWidth;
        const H = canvas.height = canvas.offsetHeight;

        const stars = Array.from({ length: 220 }, () => ({
            x: Math.random() * W,
            y: Math.random() * H,
            r: Math.random() * 1.4 + 0.2,
            opacity: Math.random() * 0.7 + 0.2,
            twinkleSpeed: Math.random() * 0.02 + 0.005,
            phase: Math.random() * Math.PI * 2,
        }));

        let frame;
        let t = 0;
        const draw = () => {
            ctx.clearRect(0, 0, W, H);
            t += 1;
            stars.forEach(s => {
                const alpha = s.opacity * (0.6 + 0.4 * Math.sin(t * s.twinkleSpeed + s.phase));
                ctx.beginPath();
                ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
                ctx.fill();
            });
            frame = requestAnimationFrame(draw);
        };
        draw();
        return () => cancelAnimationFrame(frame);
    }, []);

    // ========== GLOBE AUTO-SPIN ==========
    // After 5s idle at globe zoom: eases back to US, then spins left-to-right.
    // Poles stay fixed — only center longitude shifts each frame.
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !mapLoaded) return;

        // States: 'idle' → 'resetting' (easeTo US) → 'spinning' → back to 'idle' on interact
        let state = 'idle';
        let lastInteraction = Date.now();

        const onInteract = () => {
            if (state === 'resetting') return; // ignore programmatic movement
            lastInteraction = Date.now();
            state = 'idle';
        };

        map.on('mousedown', onInteract);
        map.on('touchstart', onInteract);
        map.on('wheel', onInteract);
        map.on('dragstart', onInteract);

        map.easeTo({ bearing: 0, pitch: 0, duration: 600 });

        const spin = () => {
            const idle = Date.now() - lastInteraction > 5000;
            const atGlobeZoom = map.getZoom() < 4;

            if (state === 'idle' && idle && atGlobeZoom) {
                state = 'resetting';
                map.easeTo({
                    center: [-98, 39], // geographic center of the US
                    zoom: 2.5,
                    bearing: 0,
                    pitch: 0,
                    duration: 2000,
                });
                map.once('moveend', () => {
                    if (state === 'resetting') state = 'spinning';
                });
            } else if (state === 'spinning' && atGlobeZoom) {
                const { lng, lat } = map.getCenter();
                map.setCenter([(lng + 0.08 + 180) % 360 - 180, lat]);
            }

            spinFrameRef.current = requestAnimationFrame(spin);
        };
        spin();

        return () => {
            cancelAnimationFrame(spinFrameRef.current);
            map.off('mousedown', onInteract);
            map.off('touchstart', onInteract);
            map.off('wheel', onInteract);
            map.off('dragstart', onInteract);
        };
    }, [mapLoaded]);

    // ========== INITIALIZE MAP ==========
    // Async init: fetches the style JSON, customizes colors for visibility,
    // then creates the MapLibre instance. Building outlines are baked into
    // the customized style — no need to add them manually after load.
    useEffect(() => {
        if (mapRef.current) return;

        let cancelled = false;

        async function initMap() {
            // Fetch and customize the dark style for our premium look.
            // Falls back to raw URL if fetch fails (ugly but functional).
            const style = await getLibertyNoBuildingsStyle();
            if (cancelled) return;

            const map = new maplibregl.Map({
                container: mapContainerRef.current,
                style,
                center: [FALLBACK_LNG, FALLBACK_LAT],  // MapLibre uses [lng, lat]
                zoom: DEFAULT_ZOOM,
                attributionControl: false, // rendered manually below the map card
                renderWorldCopies: false,
                projection: { type: 'globe' },
                minZoom: 2,
            });

            // Zoom +/- buttons (no compass — not useful for a 2D territory map)
            map.addControl(
                new maplibregl.NavigationControl({ showCompass: false }),
                'top-left'
            );

            // ---- Style loaded — safe to add sources/layers now ----

            map.on('load', () => {
                map.setProjection({ type: 'globe' });
                setMapLoaded(true);
            });

            map.on('zoom', () => setMapZoom(map.getZoom()));

            // ---- GPS location ----
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    map.flyTo({ center: [longitude, latitude], zoom: DEFAULT_ZOOM });
                    setUserLocation({ latitude, longitude });

                    // Blue dot marker for current location
                    const el = document.createElement('div');
                    el.className = 'location-dot';
                    locationMarkerRef.current = new maplibregl.Marker({ element: el })
                        .setLngLat([longitude, latitude])
                        .addTo(map);
                },
                (err) => {
                    console.warn('GPS unavailable:', err.message);
                    if (err.code === 1) {
                        setLocationError('Location access denied — enable location permissions for this site in your browser settings, then refresh.');
                    } else if (err.code === 3) {
                        setLocationError('Location timed out — tap "My Location" to try again.');
                    } else {
                        setLocationError('Could not get your location — tap "My Location" to try again.');
                    }
                },
                { enableHighAccuracy: true, timeout: 30000 }
            );

            mapRef.current = map;
        }

        initMap();

        return () => {
            cancelled = true;
            if (shimmerRef.current) cancelAnimationFrame(shimmerRef.current);
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, []);

    // ========== LOAD TERRITORIES ==========
    useEffect(() => {
        const loadTerritories = async () => {
            try {
                const res = await getTerritories();
                setTerritories(res.data.territories || []);
            } catch (err) {
                console.error('Failed to load territories:', err);
            } finally {
                setLoading(false);
            }
        };
        loadTerritories();
    }, []);

    // ========== DRAW HEX TILES ==========
    // Runs whenever territories load, user changes, or map finishes loading.
    // Converts territory data into GeoJSON and renders via MapLibre layers.
    //
    // WHY GEOJSON SOURCE INSTEAD OF INDIVIDUAL POLYGONS:
    // Leaflet created one L.polygon per hex — 1,000 hexes = 1,000 DOM elements.
    // MapLibre takes a single GeoJSON FeatureCollection and renders ALL hexes
    // in one GPU draw call. This scales to tens of thousands of hexes without
    // any performance degradation.
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !mapLoaded || !user) return;

        // ID normalization — profile returns 'id', AuthContext may store '_id'
        const currentUserId = (user?.id ?? user?._id)?.toString();
        let mineCount = 0;
        let myMaxCaptureCount = 1;

        // ---- Build GeoJSON from territory data ----
        const features = [];
        const myHexIds = [];

        territories.forEach((territory, index) => {
            const isMine = territory.owner?.id?.toString() === currentUserId;
            if (isMine) { mineCount++; myHexIds.push(territory.hexagonId); }
            if (isMine && (territory.captureCount ?? 1) > myMaxCaptureCount) myMaxCaptureCount = territory.captureCount ?? 1;

            let boundary;
            try {
                boundary = cellToBoundary(territory.hexagonId);
            } catch (err) {
                // Skip malformed H3 indices rather than crashing the whole map
                console.warn('Invalid H3 index:', territory.hexagonId);
                return;
            }

            // CRITICAL: h3-js cellToBoundary returns [[lat, lng], ...]
            // but GeoJSON spec requires [lng, lat]. Flipping these is the
            // single most common mapping bug — hexes render in the ocean.
            const coordinates = boundary.map(([lat, lng]) => [lng, lat]);
            // GeoJSON polygon rings MUST be closed (first point = last point)
            coordinates.push(coordinates[0]);

            const capturedDate = territory.capturedAt
                ? new Date(territory.capturedAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                })
                : 'Unknown';

            features.push({
                type: 'Feature',
                geometry: {
                    type: 'Polygon',
                    coordinates: [coordinates],
                },
                properties: {
                    isMine,
                    owner: territory.owner?.username ?? 'Unknown',
                    ownerId: territory.owner?.id,
                    activityType: territory.activityType,
                    capturedAt: capturedDate,
                    captureCount: territory.captureCount ?? 1,
                },
            });
        });

        const geojson = { type: 'FeatureCollection', features };

        // Keep ref current so MapLibre click handlers can read latest territories
        territoriesRef.current = territories;

        // ---- Build point source for shield icons (exact H3 cell centers) ----
        const shieldFeatures = territories
            .filter(t => t.owner?.id?.toString() !== currentUserId)
            .reduce((acc, t) => {
                try {
                    const [lat, lng] = cellToLatLng(t.hexagonId);
                    acc.push({
                        type: 'Feature',
                        geometry: { type: 'Point', coordinates: [lng, lat] },
                        properties: {
                            captureCount: t.captureCount ?? 1,
                            ownerId: t.owner?.id?.toString() ?? '',
                            ownerUsername: t.owner?.username ?? 'Unknown',
                        },
                    });
                } catch { /* skip invalid hex */ }
                return acc;
            }, []);
        const shieldGeojson = { type: 'FeatureCollection', features: shieldFeatures };

        // ---- Update existing source or create fresh ----
        // If territories reload (e.g. after logging a new activity),
        // we just swap the GeoJSON data — no need to recreate layers.
        if (map.getSource('territories')) {
            map.getSource('territories').setData(geojson);
            map.getSource('shield-points')?.setData(shieldGeojson);
        } else {
            map.addSource('territories', { type: 'geojson', data: geojson });
            map.addSource('shield-points', { type: 'geojson', data: shieldGeojson });

            // ---- Tier fills ----
            // T1: captures 1-3 → neon green
            // T2: captures 4-6 → neon blue
            // T3: captures 7-9 → neon gold
            // T4: captures 10+  → neon pink
            map.addLayer({
                id: 'hex-fill',
                type: 'fill',
                source: 'territories',
                paint: {
                    'fill-color': ['match', ['get', 'captureCount'],
                        1, '#39ff14', 2, '#39ff14', 3, '#39ff14',
                        4, '#00ccff', 5, '#00ccff', 6, '#00ccff',
                        7, '#f5a623', 8, '#f5a623', 9, '#f5a623',
                        '#ff00aa',
                    ],
                    'fill-opacity': 0.25,
                },
            });

            // ---- Others: boosted fill to compensate for no hull glow ----
            map.addLayer({
                id: 'hex-fill-others',
                type: 'fill',
                source: 'territories',
                filter: ['!=', ['get', 'isMine'], true],
                paint: {
                    'fill-color': ['match', ['get', 'captureCount'],
                        1, '#39ff14', 2, '#39ff14', 3, '#39ff14',
                        4, '#00ccff', 5, '#00ccff', 6, '#00ccff',
                        7, '#f5a623', 8, '#f5a623', 9, '#f5a623',
                        '#ff00aa',
                    ],
                    'fill-opacity': 0.2,
                },
            });

            // ---- Others: ambient wide outer glow (simulates hull vibrancy per-hex) ----
            map.addLayer({
                id: 'hex-glow-others-ambient',
                type: 'line',
                source: 'territories',
                filter: ['!=', ['get', 'isMine'], true],
                paint: {
                    'line-color': ['match', ['get', 'captureCount'],
                        1, '#39ff14', 2, '#39ff14', 3, '#39ff14',
                        4, '#00ccff', 5, '#00ccff', 6, '#00ccff',
                        7, '#f5a623', 8, '#f5a623', 9, '#f5a623',
                        '#ff00aa',
                    ],
                    'line-width': 18,
                    'line-opacity': 0,
                    'line-blur': 12,
                },
            });

            // ---- Others: tier border + white core + per-tier glow ----
            map.addLayer({
                id: 'hex-outline-others',
                type: 'line',
                source: 'territories',
                filter: ['!=', ['get', 'isMine'], true],
                paint: {
                    'line-color': ['match', ['get', 'captureCount'],
                        1, '#39ff14', 2, '#39ff14', 3, '#39ff14',
                        4, '#00ccff', 5, '#00ccff', 6, '#00ccff',
                        7, '#f5a623', 8, '#f5a623', 9, '#f5a623',
                        '#ff00aa',
                    ],
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
                filter: ['all', ['!=', ['get', 'isMine'], true], ['>=', ['get', 'captureCount'], 1], ['<=', ['get', 'captureCount'], 3]],
                paint: { 'line-color': '#39ff14', 'line-width': 8, 'line-opacity': 0.5, 'line-blur': 6 },
            });
            map.addLayer({ id: 'hex-glow-others-t2', type: 'line', source: 'territories',
                filter: ['all', ['!=', ['get', 'isMine'], true], ['>=', ['get', 'captureCount'], 4], ['<=', ['get', 'captureCount'], 6]],
                paint: { 'line-color': '#00ccff', 'line-width': 10, 'line-opacity': 0.5, 'line-blur': 7 },
            });
            map.addLayer({ id: 'hex-glow-others-t3', type: 'line', source: 'territories',
                filter: ['all', ['!=', ['get', 'isMine'], true], ['>=', ['get', 'captureCount'], 7], ['<=', ['get', 'captureCount'], 9]],
                paint: { 'line-color': '#f5a623', 'line-width': 10, 'line-opacity': 0.5, 'line-blur': 7 },
            });
            map.addLayer({ id: 'hex-glow-others-t4', type: 'line', source: 'territories',
                filter: ['all', ['!=', ['get', 'isMine'], true], ['>=', ['get', 'captureCount'], 10]],
                paint: { 'line-color': '#ff00aa', 'line-width': 12, 'line-opacity': 0.5, 'line-blur': 8 },
            });

            // ---- Glow layers — mine only, one per tier ----
            // T1: green breathe
            map.addLayer({ id: 'hex-glow-t1', type: 'line', source: 'territories',
                filter: ['all', ['==', ['get', 'isMine'], true], ['>=', ['get', 'captureCount'], 1], ['<=', ['get', 'captureCount'], 3]],
                paint: { 'line-color': '#39ff14', 'line-width': 8, 'line-opacity': 0, 'line-blur': 6 },
            });
            // T2: blue shimmer
            map.addLayer({ id: 'hex-glow-t2', type: 'line', source: 'territories',
                filter: ['all', ['==', ['get', 'isMine'], true], ['>=', ['get', 'captureCount'], 4], ['<=', ['get', 'captureCount'], 6]],
                paint: { 'line-color': '#00ccff', 'line-width': 10, 'line-opacity': 0, 'line-blur': 7 },
            });
            // T3: honey sparkle
            map.addLayer({ id: 'hex-glow-t3', type: 'line', source: 'territories',
                filter: ['all', ['==', ['get', 'isMine'], true], ['>=', ['get', 'captureCount'], 7], ['<=', ['get', 'captureCount'], 9]],
                paint: { 'line-color': '#f5a623', 'line-width': 10, 'line-opacity': 0, 'line-blur': 7 },
            });

            // ---- Mine: tier-colored outer border + white core ----
            map.addLayer({
                id: 'hex-outline-top',
                type: 'line',
                source: 'territories',
                filter: ['==', ['get', 'isMine'], true],
                paint: {
                    'line-color': ['match', ['get', 'captureCount'],
                        1, '#39ff14', 2, '#39ff14', 3, '#39ff14',
                        4, '#00ccff', 5, '#00ccff', 6, '#00ccff',
                        7, '#f5a623', 8, '#f5a623', 9, '#f5a623',
                        '#ff00aa',
                    ],
                    'line-width': 5,
                    'line-opacity': 1,
                    'line-blur': 0,
                },
            });

            // ---- White inner core ----
            map.addLayer({
                id: 'hex-outline-core',
                type: 'line',
                source: 'territories',
                filter: ['==', ['get', 'isMine'], true],
                paint: { 'line-color': '#ffffff', 'line-width': 1.5, 'line-opacity': 1, 'line-blur': 0 },
            });

            // ---- Others: per-player colored shield icons ----
            // Load a uniquely colored shield for each player, then add the layer
            // with a data-driven icon-image so each hex shows its owner's color.
            const uniqueOwnerIds = [...new Set(
                territories
                    .filter(t => t.owner?.id?.toString() !== currentUserId)
                    .map(t => t.owner?.id?.toString())
                    .filter(Boolean)
            )];

            Promise.all(
                uniqueOwnerIds.map(async (ownerId) => {
                    const key = `shield-${ownerId}`;
                    if (!map.hasImage(key)) {
                        const img = await makeShieldImage(playerColor(ownerId));
                        if (!map.hasImage(key)) map.addImage(key, img);
                    }
                })
            ).then(() => {
                if (map.getLayer('hex-others-icon')) return;
                map.addLayer({
                    id: 'hex-others-icon',
                    type: 'symbol',
                    source: 'shield-points',
                    layout: {
                        'icon-image': ['concat', 'shield-', ['get', 'ownerId']],
                        'icon-size': 0.22,
                        'icon-allow-overlap': true,
                        'icon-ignore-placement': true,
                        'icon-anchor': 'center',
                    },
                    paint: { 'icon-opacity': 0.92 },
                });
            });

            // ---- Click → popup showing owner info ----
            map.on('click', 'hex-fill', (e) => {
                if (!e.features?.length) return;

                const props = e.features[0].properties;
                // MapLibre may serialize booleans as strings when reading
                // back from queried features — handle both forms safely
                const isMine = props.isMine === true || props.isMine === 'true';
                const color = isMine ? COLOR_MINE : COLOR_THEIRS;
                const activityLabel = props.activityType === 'WALK' ? '🚶 Walk' : '🏃 Run';

                const html = `
                    <div class="hex-popup-inner">
                        <div style="font-size: 15px; font-weight: 800; color: ${color}; margin-bottom: 4px;">
                            ${props.owner}
                        </div>
                        <div style="font-size: 12px; color: #9ca3af; margin-bottom: 2px;">
                            ${activityLabel}
                        </div>
                        <div style="font-size: 12px; color: #6b7280;">
                            Captured ${props.capturedAt}
                        </div>
                    </div>
                `;

                new maplibregl.Popup({
                    closeButton: false,
                    maxWidth: '220px',
                })
                    .setLngLat(e.lngLat)
                    .setHTML(html)
                    .addTo(map);
            });

            // Pointer cursor on hex hover so users know tiles are tappable
            map.on('mouseenter', 'hex-fill', () => {
                map.getCanvas().style.cursor = 'pointer';
            });
            map.on('mouseleave', 'hex-fill', () => {
                map.getCanvas().style.cursor = '';
            });

            // ---- Shield click → player profile card ----
            map.on('click', 'hex-others-icon', (e) => {
                if (!e.features?.length) return;
                const { ownerId, ownerUsername } = e.features[0].properties;
                const all = territoriesRef.current;

                const playerTiles = all.filter(t => t.owner?.id?.toString() === ownerId);
                if (!playerTiles.length) return;

                const maxCapture = Math.max(...playerTiles.map(t => t.captureCount ?? 1));
                const runCount = playerTiles.filter(t => t.activityType === 'RUN').length;
                const tierInfo =
                    maxCapture >= 10 ? { name: 'Tier 4 · 10+',  color: '#ff00aa' } :
                    maxCapture >= 7  ? { name: 'Tier 3 · 7–9',  color: '#f5a623' } :
                    maxCapture >= 4  ? { name: 'Tier 2 · 4–6',  color: '#00ccff' } :
                                       { name: 'Tier 1 · 1–3',  color: '#39ff14' };

                setSelectedPlayer({
                    username: ownerUsername,
                    totalTiles: playerTiles.length,
                    tier: tierInfo,
                    preferredActivity: runCount > playerTiles.length / 2 ? 'RUN' : 'WALK',
                    maxCapture,
                });

                // Fly to show all of this player's territory
                const coords = playerTiles.reduce((acc, t) => {
                    try { const [lat, lng] = cellToLatLng(t.hexagonId); acc.push([lng, lat]); } catch {}
                    return acc;
                }, []);
                if (coords.length) {
                    const lngs = coords.map(c => c[0]);
                    const lats = coords.map(c => c[1]);
                    map.fitBounds(
                        [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
                        { padding: 140, maxZoom: 14, duration: 1800 }
                    );
                }
            });

            map.on('mouseenter', 'hex-others-icon', () => { map.getCanvas().style.cursor = 'pointer'; });
            map.on('mouseleave', 'hex-others-icon', () => { map.getCanvas().style.cursor = ''; });
        }

        setTileCount({ mine: mineCount, total: territories.length });

        // ---- Hull color matches player's highest tier ----
        const getTierColor = (count) => {
            if (count >= 10) return '#ff00aa';  // T4 pink
            if (count >= 7)  return '#f5a623';  // T3 honey
            if (count >= 4)  return '#00ccff';  // T2 blue
            return '#39ff14';                   // T1 green
        };
        const hullColor = getTierColor(myMaxCaptureCount);
        if (map.getLayer('hull-outer-glow')) map.setPaintProperty('hull-outer-glow', 'line-color', hullColor);
        if (map.getLayer('hull-inner-glow')) map.setPaintProperty('hull-inner-glow', 'line-color', hullColor);

        // ---- Territory hull — glowing outer boundary of all your captured hexes ----
        if (myHexIds.length > 0) {
            try {
                const clusters = cellsToMultiPolygon(myHexIds);
                const hullCoords = clusters.map(polygon =>
                    polygon.map(ring => {
                        const coords = ring.map(([lat, lng]) => [lng, lat]);
                        // Ensure ring is closed
                        if (coords[0][0] !== coords[coords.length - 1][0] ||
                            coords[0][1] !== coords[coords.length - 1][1]) {
                            coords.push(coords[0]);
                        }
                        return coords;
                    })
                );

                const hullGeoJSON = {
                    type: 'Feature',
                    geometry: { type: 'MultiPolygon', coordinates: hullCoords },
                    properties: {},
                };

                if (map.getSource('territory-hull')) {
                    map.getSource('territory-hull').setData(hullGeoJSON);
                } else {
                    map.addSource('territory-hull', { type: 'geojson', data: hullGeoJSON });

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
            } catch (err) {
                console.warn('Territory hull failed:', err);
            }
        }

        // ---- First load: fly to show full territory on the globe ----
        if (!hasZoomedToTerritoryRef.current && features.length > 0) {
            const myFeatures = features.filter(f => f.properties.isMine);
            const allCoords = (myFeatures.length > 0 ? myFeatures : features)
                .flatMap(f => f.geometry.coordinates[0]);
            const lngs = allCoords.map(([lng]) => lng);
            const lats = allCoords.map(([, lat]) => lat);
            map.fitBounds(
                [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
                { padding: 120, maxZoom: 14, duration: 2000 }
            );
            hasZoomedToTerritoryRef.current = true;
        }

    }, [territories, user, mapLoaded]);

    // ========== DRAW NEARBY HEX GRID ==========
    // Shows a faint grid of uncaptured hexagons around the user's current
    // position so they can see what territory is available to claim.
    // Redraws whenever the user's location changes (e.g. after "My Location").
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !mapLoaded || !userLocation) return;

        const { latitude, longitude } = userLocation;
        const currentH3 = latLngToCell(latitude, longitude, H3_RESOLUTION);
        const gridHexes = gridDisk(currentH3, HEX_GRID_RING_SIZE);

        const features = [];
        let minLng = Infinity, maxLng = -Infinity;

        for (const h3Index of gridHexes) {
            let boundary;
            try { boundary = cellToBoundary(h3Index); } catch { continue; }
            const coords = boundary.map(([lat, lng]) => [lng, lat]);
            coords.push(coords[0]);
            const lngCenter = coords.reduce((sum, [lng]) => sum + lng, 0) / (coords.length - 1);
            if (lngCenter < minLng) minLng = lngCenter;
            if (lngCenter > maxLng) maxLng = lngCenter;
            features.push({
                type: 'Feature',
                geometry: { type: 'Polygon', coordinates: [coords] },
                properties: { lngCenter, rainbowColor: '#a855f7', rainbowGlow: '#ec4899' },
            });
        }

        hexGridFeaturesRef.current = features;
        hexGridLngRangeRef.current = { minLng, maxLng };

        const geojson = { type: 'FeatureCollection', features };

        if (map.getSource('hex-grid')) {
            map.getSource('hex-grid').setData(geojson);
        } else {
            map.addSource('hex-grid', { type: 'geojson', data: geojson });
            const beforeId = map.getLayer('hex-fill') ? 'hex-fill' : undefined;

            // Rainbow fill tint — data-driven per hex
            map.addLayer({
                id: 'hex-grid-fill',
                type: 'fill',
                source: 'hex-grid',
                paint: { 'fill-color': ['get', 'rainbowColor'], 'fill-opacity': 0.08 },
            }, beforeId);

            // Wide blurred glow — data-driven color
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

            // Outer corona burst — very wide, heavy blur, spiky flashes
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

            // Mid rays — medium width, faster flicker
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

            // Sharp outline — data-driven color
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

        // Breathing shimmer — one RAF loop animates grid hexes + territory hull together
        if (shimmerRef.current) cancelAnimationFrame(shimmerRef.current);
        const animate = () => {
            if (!mapRef.current) return;
            const t = Date.now() / 1000;

            // Rainbow wave — each hex colored by longitude position + time offset
            const features = hexGridFeaturesRef.current;
            const { minLng, maxLng } = hexGridLngRangeRef.current;
            const lngSpan = maxLng - minLng || 0.001;
            if (features.length > 0 && map.getSource('hex-grid')) {
                const updated = features.map(f => {
                    const norm = (f.properties.lngCenter - minLng) / lngSpan;
                    // Smootherstep easing — edges linger, middle rushes to catch up
                    const eased = norm * norm * norm * (norm * (norm * 6 - 15) + 10);
                    const hue = (eased * 320 + t * 70) % 360;
                    const glowHue = (hue + 20) % 360;
                    const pulse = 0.55 + 0.35 * Math.sin(t * 1.2 + norm * 4);
                    return {
                        ...f,
                        properties: {
                            ...f.properties,
                            rainbowColor: hslToHex(hue, 100, 58),
                            rainbowGlow: hslToHex(glowHue, 100, 52),
                            pulse,
                        },
                    };
                });
                map.getSource('hex-grid').setData({ type: 'FeatureCollection', features: updated });
            }

            // Corona and rays — steady soft glow, no pulsing
            if (map.getLayer('hex-grid-corona'))
                map.setPaintProperty('hex-grid-corona', 'line-opacity', 0.15);
            if (map.getLayer('hex-grid-rays'))
                map.setPaintProperty('hex-grid-rays', 'line-opacity', 0.25);

            // T1: green gentle breathe
            if (map.getLayer('hex-glow-t1'))
                map.setPaintProperty('hex-glow-t1', 'line-opacity',
                    0.15 + 0.25 * Math.abs(Math.sin(t * 0.9)));
            if (map.getLayer('hex-glow-others-ambient'))
                map.setPaintProperty('hex-glow-others-ambient', 'line-opacity',
                    0.08 + 0.1 * Math.abs(Math.sin(t * 0.7)));
            if (map.getLayer('hex-glow-others-t1'))
                map.setPaintProperty('hex-glow-others-t1', 'line-opacity',
                    0.1 + 0.15 * Math.abs(Math.sin(t * 0.9)));
            // T2: blue medium shimmer
            if (map.getLayer('hex-glow-t2'))
                map.setPaintProperty('hex-glow-t2', 'line-opacity',
                    0.2 + 0.35 * Math.abs(Math.sin(t * 1.1)));
            if (map.getLayer('hex-glow-others-t2'))
                map.setPaintProperty('hex-glow-others-t2', 'line-opacity',
                    0.1 + 0.15 * Math.abs(Math.sin(t * 1.1)));
            // T3: gold fast sparkle
            if (map.getLayer('hex-glow-t3'))
                map.setPaintProperty('hex-glow-t3', 'line-opacity',
                    Math.pow(Math.max(0, Math.sin(t * 2.5)), 2) * 0.7);
            if (map.getLayer('hex-glow-others-t3'))
                map.setPaintProperty('hex-glow-others-t3', 'line-opacity',
                    Math.pow(Math.max(0, Math.sin(t * 2.5)), 2) * 0.35);
            // T4: pink throb
            if (map.getLayer('hex-glow-others-t4'))
                map.setPaintProperty('hex-glow-others-t4', 'line-opacity',
                    0.1 + 0.2 * Math.abs(Math.sin(t * 1.3)));

            // Hex border glow — breathes in sync with hull

            // Territory hull — slower, more majestic breathing
            const hullOuter = 0.15 + 0.12 * Math.sin(t * 0.7);
            const hullInner = 0.45 + 0.25 * Math.sin(t * 0.7 + 0.5);
            const hullEdge  = 0.8  + 0.15 * Math.sin(t * 0.7 + 1.0);
            if (map.getLayer('hull-outer-glow'))
                map.setPaintProperty('hull-outer-glow', 'line-opacity', hullOuter);
            if (map.getLayer('hull-inner-glow'))
                map.setPaintProperty('hull-inner-glow', 'line-opacity', hullInner);
            if (map.getLayer('hull-edge'))
                map.setPaintProperty('hull-edge', 'line-opacity', hullEdge);

            shimmerRef.current = requestAnimationFrame(animate);
        };
        animate();

        return () => {
            if (shimmerRef.current) cancelAnimationFrame(shimmerRef.current);
        };
    }, [userLocation, mapLoaded]);

    // ========== MY LOCATION HANDLER ==========
    const handleMyLocation = () => {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                mapRef.current?.flyTo({
                    center: [longitude, latitude],
                    zoom: DEFAULT_ZOOM,
                });
                setLocationError(null);
                setUserLocation({ latitude, longitude });

                if (locationMarkerRef.current) {
                    locationMarkerRef.current.setLngLat([longitude, latitude]);
                } else {
                    const el = document.createElement('div');
                    el.className = 'location-dot';
                    locationMarkerRef.current = new maplibregl.Marker({ element: el })
                        .setLngLat([longitude, latitude])
                        .addTo(mapRef.current);
                }
            },
            (err) => {
                if (err.code === 1) {
                    setLocationError('Location access denied — enable location permissions for this site in your browser settings, then refresh.');
                } else if (err.code === 3) {
                    setLocationError('Location timed out — please try again.');
                } else {
                    setLocationError('Could not get your location — please try again.');
                }
            },
            { enableHighAccuracy: true, timeout: 30000 }
        );
    };

    // ========== RENDER ==========
    return (
        <div className="h-screen overflow-hidden bg-gray-950 text-white relative flex flex-col">
            <HexBackground />

            {/* ========== NAVBAR ========== */}
            <Navbar />

            {/* ========== CONTENT ========== */}
            <div className="max-w-6xl w-full mx-auto px-4 pt-3 pb-4 relative z-10 flex flex-col flex-1 min-h-0">

                {/* ========== HEADER + LEGEND ========== */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <div>
                        <h2 className="text-2xl font-bold">Territory Map</h2>
                        <p className="text-gray-300 font-bold text-sm mt-1">
                            Every captured hex tile in the world
                        </p>
                    </div>
                    <div className="flex items-center gap-3 bg-gray-900/80 backdrop-blur border border-gray-700/60 rounded-2xl px-4 py-3 shadow-lg">
                        <div className="flex items-center gap-2">
                            <svg width="52" height="52" viewBox="-15 -15 130 130">
                                <defs>
                                    <filter id="hex-outer-glow" x="-60%" y="-60%" width="220%" height="220%">
                                        <feGaussianBlur stdDeviation="6" result="blur"/>
                                        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                                    </filter>
                                    <filter id="hex-hull-glow" x="-80%" y="-80%" width="260%" height="260%">
                                        <feGaussianBlur stdDeviation="2.5" result="blur"/>
                                        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                                    </filter>
                                </defs>
                                {/* outer glow halo */}
                                <polygon points="50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5"
                                    fill="none" stroke="#39ff14" strokeWidth="14"
                                    filter="url(#hex-outer-glow)" opacity="0.5"
                                />
                                {/* semi-transparent fill */}
                                <polygon points="50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5"
                                    fill="rgba(57,255,20,0.18)" stroke="none"
                                />
                                {/* green outer border */}
                                <polygon points="50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5"
                                    fill="none" stroke="#39ff14" strokeWidth="7"
                                />
                                {/* white core — sits right on top of green border */}
                                <polygon points="50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5"
                                    fill="none" stroke="#ffffff" strokeWidth="2.5"
                                />
                            </svg>
                            <div className="flex flex-col leading-tight">
                                <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Yours</span>
                                <span className="text-base font-bold text-white">{tileCount.mine}</span>
                            </div>
                        </div>
                        <div className="w-px h-8 bg-gray-700"/>
                        <div className="flex items-center gap-2">
                            <svg width="52" height="52" viewBox="-15 -15 130 130">
                                <defs>
                                    <filter id="hex-others-glow-legend" x="-60%" y="-60%" width="220%" height="220%">
                                        <feGaussianBlur stdDeviation="6" result="blur"/>
                                        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                                    </filter>
                                </defs>
                                {/* semi-transparent fill */}
                                <polygon points="50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5"
                                    fill="rgba(100,255,30,0.5)" stroke="none"
                                />
                                {/* green outer border with glow */}
                                <polygon points="50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5"
                                    fill="none" stroke="#39ff14" strokeWidth="14"
                                    filter="url(#hex-others-glow-legend)" opacity="0.4"
                                />
                                {/* green outer border */}
                                <polygon points="50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5"
                                    fill="none" stroke="#39ff14" strokeWidth="7"
                                />
                                {/* white core */}
                                <polygon points="50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5"
                                    fill="none" stroke="#ffffff" strokeWidth="2.5"
                                />
                            </svg>
                            <div className="flex flex-col leading-tight">
                                <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Others</span>
                                <span className="text-base font-bold text-white">{tileCount.total - tileCount.mine}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ========== LOCATION ERROR BANNER ========== */}
                {locationError && (
                    <div className="mb-4 px-4 py-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                        <p className="text-yellow-400 font-bold text-sm">{locationError}</p>
                    </div>
                )}

                {/* ========== CONTROLS ROW ========== */}
                <div className="mb-4 flex justify-end items-center">
                    <button
                        onClick={handleMyLocation}
                        className="bg-gray-900 hover:bg-gray-800 border border-gray-700 text-emerald-400 font-bold text-sm px-4 py-2 rounded-xl transition-colors flex items-center gap-2"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="3"/>
                            <line x1="12" y1="2" x2="12" y2="6"/>
                            <line x1="12" y1="18" x2="12" y2="22"/>
                            <line x1="2" y1="12" x2="6" y2="12"/>
                            <line x1="18" y1="12" x2="22" y2="12"/>
                        </svg>
                        My Location
                    </button>
                </div>

                {/* ========== MAP CONTAINER ========== */}
                <div
                    className="rounded-2xl overflow-hidden border border-gray-800 shadow-2xl relative flex-1"
                    style={{ minHeight: 0, backgroundColor: '#050514' }}
                >
                {/* Starfield behind the globe */}
                <canvas
                    ref={starCanvasRef}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0 }}
                />
                {loading && (
                    <div className="absolute inset-0 bg-gray-900 flex items-center justify-center rounded-2xl z-10">
                        <p className="text-emerald-400 font-bold text-lg animate-pulse">
                            Loading territory data...
                        </p>
                    </div>
                )}
                <div
                    ref={mapContainerRef}
                    style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        filter: 'brightness(0.88) saturate(0.9)',
                        zIndex: 1,
                    }}
                />
                {/* Atmosphere halo — only visible at globe zoom levels */}
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    zIndex: 2,
                    pointerEvents: 'none',
                    opacity: Math.max(0, Math.min(1, (4 - mapZoom) / 3)),
                    transition: 'opacity 0.6s ease',
                    background: 'radial-gradient(ellipse at center, transparent 38%, rgba(30, 80, 220, 0.18) 55%, rgba(10, 30, 120, 0.35) 68%, rgba(5, 5, 20, 0.88) 82%)',
                }}/>

                {/* ========== PLAYER PROFILE CARD ========== */}
                {selectedPlayer && (
                    <div style={{
                        position: 'absolute', bottom: 20, left: 20, zIndex: 10,
                        background: 'rgba(10,10,20,0.92)', backdropFilter: 'blur(16px)',
                        border: `1.5px solid ${selectedPlayer.tier.color}44`,
                        borderRadius: 16, padding: '16px 18px', minWidth: 210,
                        boxShadow: `0 0 24px ${selectedPlayer.tier.color}33`,
                        animation: 'fadeSlideUp 0.25s ease',
                    }}>
                        {/* Close */}
                        <button
                            onClick={() => setSelectedPlayer(null)}
                            style={{ position: 'absolute', top: 10, right: 12, background: 'none', border: 'none',
                                color: '#6b7280', fontSize: 18, cursor: 'pointer', lineHeight: 1 }}
                        >×</button>

                        {/* Shield + username */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                            <svg width="32" height="32" viewBox="0 0 64 64">
                                <path d="M32,4 L56,12 L56,34 Q56,54 32,62 Q8,54 8,34 L8,12 Z"
                                    fill="#111" stroke={selectedPlayer.tier.color} strokeWidth="3.5"/>
                                <path d="M32,11 L50,17 L50,34 Q50,49 32,56 Q14,49 14,34 L14,17 Z"
                                    fill="none" stroke={selectedPlayer.tier.color} strokeWidth="1.5" strokeOpacity="0.5"/>
                            </svg>
                            <div>
                                <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
                                    {selectedPlayer.username}
                                </div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: selectedPlayer.tier.color, marginTop: 2 }}>
                                    {selectedPlayer.tier.name}
                                </div>
                            </div>
                        </div>

                        {/* Stats */}
                        <div style={{ display: 'flex', gap: 16 }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 20, fontWeight: 800, color: selectedPlayer.tier.color }}>
                                    {selectedPlayer.totalTiles}
                                </div>
                                <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Tiles
                                </div>
                            </div>
                            <div style={{ width: 1, background: '#2a2a3a' }}/>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 20, fontWeight: 800, color: selectedPlayer.tier.color }}>
                                    {selectedPlayer.maxCapture}×
                                </div>
                                <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Max Cap
                                </div>
                            </div>
                            <div style={{ width: 1, background: '#2a2a3a' }}/>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 20 }}>
                                    {selectedPlayer.preferredActivity === 'RUN' ? '🏃' : '🚶'}
                                </div>
                                <div style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    {selectedPlayer.preferredActivity === 'RUN' ? 'Runner' : 'Walker'}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                </div>{/* end map container */}

                {/* Attribution — outside the map so it's always clickable */}
                <p className="text-center text-gray-600 text-xs mt-1.5">
                    <a href="https://maplibre.org" target="_blank" rel="noreferrer" className="hover:text-emerald-400 transition-colors">© MapLibre</a>
                    {' | '}
                    <a href="https://openfreemap.org" target="_blank" rel="noreferrer" className="hover:text-emerald-400 transition-colors">OpenFreeMap</a>
                    {' © '}
                    <a href="https://www.openmaptiles.org" target="_blank" rel="noreferrer" className="hover:text-emerald-400 transition-colors">OpenMapTiles</a>
                    {' · Data from '}
                    <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="hover:text-emerald-400 transition-colors">OpenStreetMap</a>
                </p>
            </div>{/* end max-w-6xl content */}

            {/* ========== EMPTY STATE ========== */}
            {!loading && territories.length === 0 && (
                <div className="text-center py-6 relative z-10">
                    <p className="text-gray-200 font-bold">No territory captured yet.</p>
                    <p className="text-gray-300 font-bold text-sm mt-1">
                        Log your first activity to claim your first hex tiles!
                    </p>
                    <button
                        onClick={() => navigate('/log-activity')}
                        className="mt-4 bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-6 py-2 rounded-xl transition-colors"
                    >
                        Log Activity
                    </button>
                </div>
            )}
        </div>
    );
}

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

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getTerritories } from '../services/api';
import HexBackground from '../components/HexBackground';
import Navbar from '../components/Navbar';
import { latLngToCell, gridDisk, cellToBoundary, cellToLatLng } from 'h3-js';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getLibertyNoBuildingsStyle } from '../utils/mapStyle';
import {
    COLOR_MINE,
    COLOR_THEIRS,
    DEFAULT_ZOOM,
    H3_RESOLUTION,
    HEX_GRID_RING_SIZE,
    ACCURACY_THRESHOLD_M,
    FLY_DURATION_MS,
    GLOBE_FLY_DURATION_MS,
} from '../utils/mapConstants';
import { playerColor, makeShieldImage, hslToHex, getTierColor } from '../utils/mapHelpers';
import MapLegend from '../components/map/MapLegend';
import PlayerCard from '../components/map/PlayerCard';
import MapEmptyState from '../components/map/MapEmptyState';
import MapControls from '../components/map/MapControls';
import StartingLocationPrompt from '../components/map/StartingLocationPrompt';
import { buildTerritoryFeatures, buildShieldFeatures, buildHullGeoJSON } from '../utils/territoryGeo';
import { addTerritoryLayers, addHullLayers, addHexGridLayers } from '../utils/mapLayers';
import { useStarfield } from '../hooks/useStarfield';
import { useGlobeSpin } from '../hooks/useGlobeSpin';

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
    const [showAddressInput, setShowAddressInput] = useState(false);
    const [addressQuery, setAddressQuery] = useState('');
    const [geocoding, setGeocoding] = useState(false);
    const [geocodeError, setGeocodeError] = useState(null);
    const [suggestions, setSuggestions] = useState([]);
    const [pinnedLocation, setPinnedLocation] = useState(() => {
        try {
            const saved = localStorage.getItem('hexcapture_home');
            return saved ? JSON.parse(saved) : null;
        } catch { return null; }
    });
    // A searched address that has been previewed on the map but not yet saved as
    // Home. It only becomes the Home pin once the user confirms the prompt.
    const [pendingLocation, setPendingLocation] = useState(null);

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
    const spinFrameRef = useRef(null);
    const programmaticNavRef = useRef(false);
    const territoriesRef = useRef([]);
    // Mirrors whether a player card is open, so the globe spin can hold still
    // over the selected shield (read inside the requestAnimationFrame loop).
    const cardOpenRef = useRef(false);
    // The currently selected player's id, so a second shield tap (or the card)
    // can tell it is the same player and zoom to their territory.
    const selectedPlayerIdRef = useRef(null);
    // Approximate location from low-accuracy geolocation — used to bias address
    // search suggestions before high-accuracy GPS resolves (or if it never does).
    const approxLocationRef = useRef(null);

    // Twinkling starfield behind the globe and the idle globe auto-spin.
    useStarfield(starCanvasRef);
    useGlobeSpin(mapRef, mapLoaded, programmaticNavRef, spinFrameRef, cardOpenRef);

    // Hold the globe still while a player card is open, and remember which player
    // is selected so a second shield tap can zoom to their territory.
    useEffect(() => {
        cardOpenRef.current = !!selectedPlayer;
        selectedPlayerIdRef.current = selectedPlayer?.ownerId ?? null;
    }, [selectedPlayer]);

    // Zoom to fit a player's entire territory. Stable (refs only) so the shield
    // click handler and the player card can share the same action.
    const zoomToPlayerTerritory = useCallback((ownerId) => {
        const map = mapRef.current;
        if (!map || !ownerId) return;
        const tiles = territoriesRef.current.filter(t => t.owner?.id?.toString() === ownerId);
        const coords = tiles.reduce((acc, t) => {
            try { const [lat, lng] = cellToLatLng(t.hexagonId); acc.push([lng, lat]); } catch { /* skip malformed H3 index */ }
            return acc;
        }, []);
        if (!coords.length) return;
        const lngs = coords.map(c => c[0]);
        const lats = coords.map(c => c[1]);
        programmaticNavRef.current = true;
        map.fitBounds(
            [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
            { padding: 140, maxZoom: 14, duration: FLY_DURATION_MS }
        );
        map.once('moveend', () => { programmaticNavRef.current = false; });
    }, []);

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

            const savedHome = (() => {
                try {
                    const s = localStorage.getItem('hexcapture_home');
                    return s ? JSON.parse(s) : null;
                } catch { return null; }
            })();

            const map = new maplibregl.Map({
                container: mapContainerRef.current,
                style,
                // Pinned home → start there at street zoom.
                // No pin → globe view over the US so the user knows to set their location.
                center: savedHome ? [savedHome.longitude, savedHome.latitude] : [-98, 39],
                zoom: savedHome ? DEFAULT_ZOOM : 2.5,
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
                if (savedHome) {
                    // Place marker only if it doesn't already exist
                    if (!locationMarkerRef.current) {
                        const el = document.createElement('div');
                        el.className = 'location-dot';
                        locationMarkerRef.current = new maplibregl.Marker({ element: el })
                            .setLngLat([savedHome.longitude, savedHome.latitude])
                            .addTo(map);
                    }
                    // Always seed userLocation — decoupled from marker so the hex
                    // grid draws even if a stale GPS callback already set the marker ref
                    setUserLocation({ latitude: savedHome.latitude, longitude: savedHome.longitude });
                }
                setMapLoaded(true);
            });

            map.on('zoom', () => setMapZoom(map.getZoom()));

            // ---- Fast low-accuracy pass ----
            // Resolves in <1s via IP/Wi-Fi. Seeds the territory load so shields
            // appear on the globe immediately without waiting for GPS.
            // No blue dot — low-accuracy can be miles off, a dot implies precision.
            // High-accuracy GPS overrides it when it resolves.
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
                    approxLocationRef.current = loc;
                    // Only use if GPS hasn't already resolved (functional update prevents override)
                    setUserLocation(prev => prev ?? loc);
                },
                () => {},
                { enableHighAccuracy: false, timeout: 3000, maximumAge: 300000 }
            );

            // ---- High-accuracy GPS ----
            // If a home is pinned: updates userLocation (hex grid) but never moves
            // the marker — desktop IP-based GPS can be miles off and would push the
            // dot off-screen. The pin IS the home; trust it over coarse GPS.
            // If no home is pinned: flies there and places the blue dot normally.
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude, accuracy } = position.coords;
                    const homeIsPinned = !!localStorage.getItem('hexcapture_home');

                    if (!homeIsPinned) {
                        // No pin — GPS is the only source of truth
                        if (accuracy < ACCURACY_THRESHOLD_M) {
                            map.flyTo({ center: [longitude, latitude], zoom: DEFAULT_ZOOM, duration: FLY_DURATION_MS });
                        }
                        setUserLocation({ latitude, longitude });

                        const el = document.createElement('div');
                        el.className = 'location-dot';
                        if (locationMarkerRef.current) {
                            locationMarkerRef.current.setLngLat([longitude, latitude]);
                        } else {
                            locationMarkerRef.current = new maplibregl.Marker({ element: el })
                                .setLngLat([longitude, latitude])
                                .addTo(map);
                        }
                    }
                    // When home is pinned: userLocation already seeded from savedHome in
                    // map.on('load'). GPS here would only override with a potentially
                    // wrong desktop location — skip it entirely.
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
            if (spinFrameRef.current) cancelAnimationFrame(spinFrameRef.current);
            if (shimmerRef.current) cancelAnimationFrame(shimmerRef.current);
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, []);

    // ========== LOAD TERRITORIES ==========
    // Loads all territories globally — no location filter. Fires once when the
    // map is ready. Shields appear on the globe regardless of where the viewer is.
    useEffect(() => {
        if (!mapLoaded) return;
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
    }, [mapLoaded]);

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
        // Build GeoJSON, ownership counts, and my hex ids in one pass.
        const { geojson, mineCount, myMaxCaptureCount, myHexIds } = buildTerritoryFeatures(territories, currentUserId);

        // Keep ref current so MapLibre click handlers can read latest territories
        territoriesRef.current = territories;

        // ---- Build point source for shield icons (exact H3 cell centers) ----
        const shieldGeojson = buildShieldFeatures(territories, currentUserId);

        // ---- Update existing source or create fresh ----
        // If territories reload (e.g. after logging a new activity),
        // we just swap the GeoJSON data — no need to recreate layers.
        if (map.getSource('territories')) {
            map.getSource('territories').setData(geojson);
            map.getSource('shield-points')?.setData(shieldGeojson);
        } else {
            map.addSource('territories', { type: 'geojson', data: geojson });
            map.addSource('shield-points', { type: 'geojson', data: shieldGeojson });

            // Territory fills, glows, and outlines (tiered by capture count).
            addTerritoryLayers(map);

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

                // Second tap on the already-selected shield zooms to their turf.
                if (selectedPlayerIdRef.current === ownerId) {
                    zoomToPlayerTerritory(ownerId);
                    return;
                }

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
                    ownerId,
                    totalTiles: playerTiles.length,
                    tier: tierInfo,
                    preferredActivity: runCount > playerTiles.length / 2 ? 'RUN' : 'WALK',
                    maxCapture,
                });

                // Hold the globe still and ease to center the shield without
                // zooming in, so the card reads against a framed, paused view.
                const [shieldLng, shieldLat] = e.features[0].geometry.coordinates;
                programmaticNavRef.current = true;
                map.easeTo({ center: [shieldLng, shieldLat], duration: 1200 });
                map.once('moveend', () => { programmaticNavRef.current = false; });
            });

            map.on('mouseenter', 'hex-others-icon', () => { map.getCanvas().style.cursor = 'pointer'; });
            map.on('mouseleave', 'hex-others-icon', () => { map.getCanvas().style.cursor = ''; });
        }

        // ---- Shield icons — runs on every territory update ----
        // Must be outside the if/else so new owners get images loaded even on reload.
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
            if (map.getLayer('hex-others-icon') || !map.getSource('shield-points')) return;
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

        setTileCount({ mine: mineCount, total: territories.length });

        // ---- Hull color matches player's highest tier ----
        const hullColor = getTierColor(myMaxCaptureCount);
        if (map.getLayer('hull-outer-glow')) map.setPaintProperty('hull-outer-glow', 'line-color', hullColor);
        if (map.getLayer('hull-inner-glow')) map.setPaintProperty('hull-inner-glow', 'line-color', hullColor);

        // ---- Territory hull — glowing outer boundary of all your captured hexes ----
        if (myHexIds.length > 0) {
            try {
                const hullGeoJSON = buildHullGeoJSON(myHexIds);

                if (map.getSource('territory-hull')) {
                    map.getSource('territory-hull').setData(hullGeoJSON);
                } else {
                    map.addSource('territory-hull', { type: 'geojson', data: hullGeoJSON });
                    addHullLayers(map, hullColor);
                }
            } catch (err) {
                console.warn('Territory hull failed:', err);
            }
        }

        // Auto-zoom to territories removed — pinned home and GPS handle starting location.

    }, [territories, user, mapLoaded, zoomToPlayerTerritory]);

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
            addHexGridLayers(map, beforeId);
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
    // Desktop IP geolocation can be off by miles. We gate on coords.accuracy
    // against ACCURACY_THRESHOLD_M: below it is GPS quality and we fly there; at
    // or above it the location is too coarse, so we nudge to address search.
    const handleMyLocation = () => {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude, accuracy } = position.coords;
                setLocationError(null);

                if (accuracy >= ACCURACY_THRESHOLD_M) {
                    // Desktop / IP-based location — too coarse to be useful
                    setLocationError(
                        `Desktop location is only accurate to ~${Math.round(accuracy / 1000)} km. Use "Input Address" for your exact location.`
                    );
                    return;
                }

                // Accurate GPS (mobile or good Wi-Fi triangulation)
                programmaticNavRef.current = true;
                mapRef.current?.flyTo({ center: [longitude, latitude], zoom: DEFAULT_ZOOM, duration: FLY_DURATION_MS });
                mapRef.current?.once('moveend', () => { programmaticNavRef.current = false; });
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

    // ========== ADDRESS AUTOCOMPLETE ==========
    useEffect(() => {
        if (addressQuery.trim().length < 3) { setSuggestions([]); return; }
        const timer = setTimeout(async () => {
            try {
                // Prefer GPS location, fall back to low-accuracy approx, then US-wide
                const bias = userLocation || approxLocationRef.current;
                let locationParams = 'countrycodes=us';
                if (bias) {
                    const { latitude: lat, longitude: lng } = bias;
                    locationParams = `viewbox=${lng - 1},${lat + 1},${lng + 1},${lat - 1}&bounded=0`;
                }
                const res = await fetch(
                    `https://nominatim.openstreetmap.org/search?format=json&limit=5&email=hexcapture.com&${locationParams}&q=${encodeURIComponent(addressQuery)}`,
                    { headers: { 'Accept-Language': 'en' } }
                );
                const results = await res.json();
                setSuggestions(results);
            } catch {
                setSuggestions([]);
            }
        }, 400);
        return () => clearTimeout(timer);
    }, [addressQuery, userLocation]);

    // Preview a searched address: fly there, draw the hex grid, drop the marker,
    // and stage it as pending. Does NOT save it as Home; that needs confirmation.
    const previewAddressLocation = (lat, lon, label = '') => {
        programmaticNavRef.current = true;
        mapRef.current?.flyTo({ center: [lon, lat], zoom: DEFAULT_ZOOM, duration: FLY_DURATION_MS });
        mapRef.current?.once('moveend', () => { programmaticNavRef.current = false; });
        setUserLocation({ latitude: lat, longitude: lon });
        if (locationMarkerRef.current) {
            locationMarkerRef.current.setLngLat([lon, lat]);
        } else {
            const el = document.createElement('div');
            el.className = 'location-dot';
            locationMarkerRef.current = new maplibregl.Marker({ element: el })
                .setLngLat([lon, lat])
                .addTo(mapRef.current);
        }
        setPendingLocation({ latitude: lat, longitude: lon, label });
        setShowAddressInput(false);
        setAddressQuery('');
        setSuggestions([]);
        setGeocodeError(null);
    };

    // Confirm the previewed address as the saved Home pin.
    const confirmStartingLocation = () => {
        if (!pendingLocation) return;
        localStorage.setItem('hexcapture_home', JSON.stringify(pendingLocation));
        setPinnedLocation(pendingLocation);
        setPendingLocation(null);
    };

    // Dismiss the prompt without saving. The map stays where it was previewed,
    // but nothing is written to storage, so a demo address is never kept.
    const dismissStartingLocation = () => setPendingLocation(null);

    const clearPin = () => {
        localStorage.removeItem('hexcapture_home');
        setPinnedLocation(null);
    };

    // Fly the camera back to the saved home pin. Lives here (not in MapControls)
    // because it touches the map instance and the programmatic-nav guard.
    const handleGoHome = () => {
        if (!pinnedLocation) return;
        programmaticNavRef.current = true;
        mapRef.current?.flyTo({ center: [pinnedLocation.longitude, pinnedLocation.latitude], zoom: DEFAULT_ZOOM, duration: FLY_DURATION_MS });
        mapRef.current?.once('moveend', () => { programmaticNavRef.current = false; });
    };

    // Pull the camera straight back to the globe view. Closes any open card and
    // guards the flight so the auto-spin does not fight it.
    const handleZoomToGlobe = () => {
        const map = mapRef.current;
        if (!map) return;
        setSelectedPlayer(null);
        programmaticNavRef.current = true;
        map.flyTo({ center: map.getCenter(), zoom: 2.2, bearing: 0, pitch: 0, duration: GLOBE_FLY_DURATION_MS, essential: true });
        map.once('moveend', () => { programmaticNavRef.current = false; });
    };

    const handleSuggestionClick = (suggestion) => {
        // Use the street line (house number + road), not just the first segment,
        // which on a precise address is only the house number.
        const label = suggestion.display_name.split(',').slice(0, 2).join(',').trim();
        previewAddressLocation(parseFloat(suggestion.lat), parseFloat(suggestion.lon), label);
    };

    // ========== ADDRESS SEARCH HANDLER ==========
    const handleAddressSearch = async (e) => {
        e.preventDefault();
        if (!addressQuery.trim()) return;
        setGeocoding(true);
        setGeocodeError(null);
        try {
            const bias = userLocation || approxLocationRef.current;
            let locationParams = 'countrycodes=us';
            if (bias) {
                const { latitude: lat, longitude: lng } = bias;
                locationParams = `viewbox=${lng - 1},${lat + 1},${lng + 1},${lat - 1}&bounded=0`;
            }
            const res = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&limit=1&email=hexcapture.com&${locationParams}&q=${encodeURIComponent(addressQuery)}`,
                { headers: { 'Accept-Language': 'en' } }
            );
            const results = await res.json();
            if (results.length > 0) {
                previewAddressLocation(parseFloat(results[0].lat), parseFloat(results[0].lon), addressQuery.trim());
            } else {
                setGeocodeError('Address not found. Try being more specific.');
            }
        } catch (err) {
            console.error('Geocoding failed:', err);
            setGeocodeError('Search failed. Please try again.');
        } finally {
            setGeocoding(false);
        }
    };

    // ========== RENDER ==========
    return (
        <div className="h-screen overflow-hidden bg-gray-950 text-white relative flex flex-col">
            <HexBackground />

            {/* ========== NAVBAR ========== */}
            <Navbar />

            {/* ========== CONTENT ========== */}
            <div className="max-w-6xl w-full mx-auto px-2 sm:px-4 pt-2 pb-2 relative z-10 flex flex-col flex-1 min-h-0">

                {/* Header + legend row */}
                <MapLegend tileCount={tileCount} />

                {/* ========== LOCATION ERROR BANNER ========== */}
                {locationError && (
                    <div className="mb-2 px-4 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                        <p className="text-yellow-400 font-bold text-sm">{locationError}</p>
                    </div>
                )}

                {/* Controls row: address search, home pin, my location */}
                <MapControls
                    showAddressInput={showAddressInput}
                    setShowAddressInput={setShowAddressInput}
                    addressQuery={addressQuery}
                    setAddressQuery={setAddressQuery}
                    geocoding={geocoding}
                    geocodeError={geocodeError}
                    setGeocodeError={setGeocodeError}
                    suggestions={suggestions}
                    onSearch={handleAddressSearch}
                    onSuggestionClick={handleSuggestionClick}
                    pinnedLocation={pinnedLocation}
                    onGoHome={handleGoHome}
                    onClearPin={clearPin}
                    onMyLocation={handleMyLocation}
                    onZoomToGlobe={handleZoomToGlobe}
                />

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

                {/* Confirm prompt before a previewed address is saved as Home */}
                <StartingLocationPrompt
                    location={pendingLocation}
                    onConfirm={confirmStartingLocation}
                    onDismiss={dismissStartingLocation}
                />

                {/* Player profile card: shown when a rival shield is tapped */}
                <PlayerCard
                    player={selectedPlayer}
                    onClose={() => setSelectedPlayer(null)}
                    onViewProfile={(id) => navigate(`/profile/${id}`)}
                    onZoomToTerritory={() => zoomToPlayerTerritory(selectedPlayer?.ownerId)}
                />
                {/* Empty state: globe overlay for new users with no territory */}
                <MapEmptyState
                    visible={!loading && territories.length === 0}
                    onLogActivity={() => navigate('/log-activity')}
                />
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

        </div>
    );
}

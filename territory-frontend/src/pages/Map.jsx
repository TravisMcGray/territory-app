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
    DEFAULT_ZOOM,
    H3_RESOLUTION,
    HEX_GRID_RING_SIZE,
    ACCURACY_THRESHOLD_M,
    FLY_DURATION_MS,
    GLOBE_FLY_DURATION_MS,
    PITCH_ZOOM,
    SKYLINE_PITCH,
    TOWER_GAP,
} from '../utils/mapConstants';
import { playerColor, makeShieldImage, hslToHex, getTierColor } from '../utils/mapHelpers';
import MapLegend from '../components/map/MapLegend';
import HexStatCard from '../components/map/HexStatCard';
import MapEmptyState from '../components/map/MapEmptyState';
import MapControls from '../components/map/MapControls';
import StartingLocationPrompt from '../components/map/StartingLocationPrompt';
import { buildTerritoryFeatures, buildShieldFeatures, buildHullGeoJSON, insetFeatureCollection } from '../utils/territoryGeo';
import { addTerritoryLayers, addRecencyGlow, addTerritoryExtrusion, addRecencyCrown, addHullLayers, addHexGridLayers } from '../utils/mapLayers';
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
    // Tracks when MapLibre's style has fully loaded: you CANNOT add
    // sources or layers until this is true. Attempting to do so throws.
    const [mapLoaded, setMapLoaded] = useState(false);
    const [mapZoom, setMapZoom] = useState(15);
    // 3D skyline toggle. On by default; when off the towers hide and the camera
    // stays flat so the map underneath is fully visible.
    const [skylineOn, setSkylineOn] = useState(true);
    // The tapped hex (from a tile or a rival's shield) drives the single unified
    // stat card. For a rival hex it also carries a `player` block (name, id,
    // highest capture) so the card can show who owns it and a fly-to action.
    const [selectedHex, setSelectedHex] = useState(null);
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
    // DOM and WebGL context, so putting it in state would cause issues.
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
    // Monotonic token for programmatic camera flights. If one flight interrupts
    // another, only the latest flight's moveend clears the nav guard, so a
    // cancelled flight's stale moveend cannot release it early (which would make
    // the lazy spin start before the new flight has actually finished).
    const navSeqRef = useRef(0);
    // Tracks whether the camera is currently pitched into the skyline view, so
    // the zoom handler only tilts/flattens once when crossing the threshold.
    const pitchedRef = useRef(false);
    // Ref mirror of skylineOn so the map event handlers (registered once) always
    // read the latest value without being re-bound.
    const skylineOnRef = useRef(true);
    // Approximate location from low-accuracy geolocation, used to bias address
    // search suggestions before high-accuracy GPS resolves (or if it never does).
    const approxLocationRef = useRef(null);

    // Twinkling starfield behind the globe and the idle globe auto-spin.
    useStarfield(starCanvasRef);
    useGlobeSpin(mapRef, mapLoaded, programmaticNavRef, spinFrameRef, cardOpenRef);

    // Hold the globe still while the stat card is open.
    useEffect(() => {
        cardOpenRef.current = !!selectedHex;
    }, [selectedHex]);

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
        const navSeq = ++navSeqRef.current;
        map.fitBounds(
            [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
            // Tighter padding + a higher cap so the cluster fills the view and
            // settles past the skyline-tilt threshold (lands in 3D, not flat).
            { padding: 60, maxZoom: 15, duration: FLY_DURATION_MS }
        );
        map.once('moveend', () => { if (navSeqRef.current === navSeq) programmaticNavRef.current = false; });
    }, []);

    // Build the rival-owner block for the unified stat card: their name, id, and
    // highest capture across all their tiles (so the card can read "Max Cap N×").
    // Stable (refs only) so the map click handlers can share it.
    const getPlayerBlock = useCallback((ownerId, username, fallbackCapture) => {
        const id = ownerId ? String(ownerId) : null;
        if (!id) return null;
        const tiles = territoriesRef.current.filter(t => t.owner?.id?.toString() === id);
        const maxCapture = tiles.length
            ? Math.max(...tiles.map(t => t.captureCount ?? 1))
            : (fallbackCapture || 1);
        return { ownerId: id, username, maxCapture };
    }, []);

    // ========== INITIALIZE MAP ==========
    // Async init: fetches the style JSON, customizes colors for visibility,
    // then creates the MapLibre instance. Building outlines are baked into
    // the customized style, so no need to add them manually after load.
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

            // Zoom +/- buttons (no compass, not useful for a 2D territory map)
            map.addControl(
                new maplibregl.NavigationControl({ showCompass: false }),
                'top-left'
            );

            // ---- Style loaded: safe to add sources/layers now ----

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
                    // Always seed userLocation, decoupled from marker so the hex
                    // grid draws even if a stale GPS callback already set the marker ref
                    setUserLocation({ latitude: savedHome.latitude, longitude: savedHome.longitude });
                }
                setMapLoaded(true);
            });

            map.on('zoom', () => setMapZoom(map.getZoom()));

            // Dragging the map dismisses any open cards, so a stray tap before a
            // pan never leaves a card blocking the view. dragstart fires only on
            // a real user drag, not on programmatic flights (those use movestart).
            map.on('dragstart', () => {
                setSelectedHex(null);
            });

            // Skyline tilt: once settled at street zoom, pitch the camera so the
            // 3D hexagons read as a skyline; flatten back out when zoomed away.
            map.on('zoomend', () => {
                // Skyline turned off: never auto-pitch, keep the map flat.
                if (!skylineOnRef.current) return;
                const zoomedIn = map.getZoom() >= PITCH_ZOOM;
                if (zoomedIn && !pitchedRef.current) {
                    pitchedRef.current = true;
                    map.easeTo({ pitch: SKYLINE_PITCH, duration: 800 });
                    // Shields are ground-anchored (MapLibre cannot float them to
                    // tower tops), so fade them out in skyline mode and let the
                    // towers stand in for the players.
                    if (map.getLayer('hex-others-icon')) map.setPaintProperty('hex-others-icon', 'icon-opacity', 0);
                } else if (!zoomedIn && pitchedRef.current) {
                    pitchedRef.current = false;
                    map.easeTo({ pitch: 0, duration: 800 });
                    if (map.getLayer('hex-others-icon')) map.setPaintProperty('hex-others-icon', 'icon-opacity', 0.92);
                }
            });

            // ---- Fast low-accuracy pass ----
            // Resolves in <1s via IP/Wi-Fi. Seeds the territory load so shields
            // appear on the globe immediately without waiting for GPS.
            // No blue dot: low-accuracy can be miles off, a dot implies precision.
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
            // the marker, since desktop IP-based GPS can be miles off and would push the
            // dot off-screen. The pin IS the home; trust it over coarse GPS.
            // If no home is pinned: flies there and places the blue dot normally.
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude, accuracy } = position.coords;
                    const homeIsPinned = !!localStorage.getItem('hexcapture_home');

                    if (!homeIsPinned) {
                        // No pin: GPS is the only source of truth
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
                    // wrong desktop location, so skip it entirely.
                },
                (err) => {
                    console.warn('GPS unavailable:', err.message);
                    if (err.code === 1) {
                        setLocationError('Location access denied. Enable location permissions for this site in your browser settings, then refresh.');
                    } else if (err.code === 3) {
                        setLocationError('Location timed out. Tap "My Location" to try again.');
                    } else {
                        setLocationError('Could not get your location. Tap "My Location" to try again.');
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
    // Loads all territories globally, with no location filter. Fires once when the
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
    // Leaflet created one L.polygon per hex: 1,000 hexes = 1,000 DOM elements.
    // MapLibre takes a single GeoJSON FeatureCollection and renders ALL hexes
    // in one GPU draw call. This scales to tens of thousands of hexes without
    // any performance degradation.
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !mapLoaded || !user) return;

        // ID normalization: profile returns 'id', AuthContext may store '_id'
        const currentUserId = (user?.id ?? user?._id)?.toString();
        // Build GeoJSON, ownership counts, and my hex ids in one pass.
        const { geojson, mineCount, myMaxCaptureCount, myHexIds } = buildTerritoryFeatures(territories, currentUserId);

        // Keep ref current so MapLibre click handlers can read latest territories
        territoriesRef.current = territories;

        // ---- Build point source for shield icons (exact H3 cell centers) ----
        const shieldGeojson = buildShieldFeatures(territories, currentUserId);

        // Inset copy of the hexes for the 3D towers, so each tower has a gutter
        // around it and the flat neon fills below show through.
        const geojson3d = insetFeatureCollection(geojson, TOWER_GAP);

        // ---- Update existing source or create fresh ----
        // If territories reload (e.g. after logging a new activity),
        // we just swap the GeoJSON data, so no need to recreate layers.
        if (map.getSource('territories')) {
            map.getSource('territories').setData(geojson);
            map.getSource('territories-3d')?.setData(geojson3d);
            map.getSource('shield-points')?.setData(shieldGeojson);
        } else {
            map.addSource('territories', { type: 'geojson', data: geojson });
            map.addSource('territories-3d', { type: 'geojson', data: geojson3d });
            map.addSource('shield-points', { type: 'geojson', data: shieldGeojson });

            // Territory fills, glows, and outlines (tiered by capture count).
            addTerritoryLayers(map);

            // Fresh-capture bloom: recently captured hexes glow white-hot.
            addRecencyGlow(map);

            // 3D extruded hexagons rising off the map (the territory skyline),
            // built from the inset source so towers stay separated.
            addTerritoryExtrusion(map);

            // White-hot crown on the freshest towers (recency cue for 3D view).
            addRecencyCrown(map);

            // ---- Click → hexagon stat card (docks top-right, never covers the
            // tiles the way the old on-map popup did) ----
            map.on('click', 'hex-fill', (e) => {
                if (!e.features?.length) return;

                const props = e.features[0].properties;
                // MapLibre may serialize booleans as strings when reading
                // back from queried features, so handle both forms safely
                const isMine = props.isMine === true || props.isMine === 'true';
                const captureCount = Number(props.captureCount) || 1;

                setSelectedHex({
                    owner: props.owner,
                    isMine,
                    activityType: props.activityType,
                    capturedAt: props.capturedAt,
                    captureCount,
                    player: isMine ? null : getPlayerBlock(props.ownerId, props.owner, captureCount),
                });
            });

            // Pointer cursor on hex hover so users know tiles are tappable
            map.on('mouseenter', 'hex-fill', () => {
                map.getCanvas().style.cursor = 'pointer';
            });
            map.on('mouseleave', 'hex-fill', () => {
                map.getCanvas().style.cursor = '';
            });

            // ---- Shield click → opens the same unified stat card ----
            map.on('click', 'hex-others-icon', (e) => {
                // In skyline mode the shields are faded to opacity 0, but opacity
                // alone does not stop click hit-testing. Without this guard, taps
                // on a hex would hit the invisible shield underneath.
                if (pitchedRef.current) return;
                if (!e.features?.length) return;
                const p = e.features[0].properties;
                const captureCount = Number(p.captureCount) || 1;

                setSelectedHex({
                    owner: p.ownerUsername,
                    isMine: false,
                    activityType: p.activityType,
                    capturedAt: p.capturedAt,
                    captureCount,
                    player: getPlayerBlock(p.ownerId, p.ownerUsername, captureCount),
                });

                // Hold the globe still and ease to center the shield without
                // zooming in, so the card reads against a framed, paused view.
                const [shieldLng, shieldLat] = e.features[0].geometry.coordinates;
                programmaticNavRef.current = true;
                const navSeq = ++navSeqRef.current;
                map.easeTo({ center: [shieldLng, shieldLat], duration: 1200 });
                map.once('moveend', () => { if (navSeqRef.current === navSeq) programmaticNavRef.current = false; });
            });

            map.on('mouseenter', 'hex-others-icon', () => { if (!pitchedRef.current) map.getCanvas().style.cursor = 'pointer'; });
            map.on('mouseleave', 'hex-others-icon', () => { map.getCanvas().style.cursor = ''; });
        }

        // ---- Shield icons: runs on every territory update ----
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

        // ---- Territory hull: glowing outer boundary of all your captured hexes ----
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

        // Auto-zoom to territories removed. Pinned home and GPS handle starting location.

    }, [territories, user, mapLoaded, zoomToPlayerTerritory, getPlayerBlock]);

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

        // Breathing shimmer: one RAF loop animates grid hexes + territory hull together
        if (shimmerRef.current) cancelAnimationFrame(shimmerRef.current);
        const animate = () => {
            if (!mapRef.current) return;
            const t = Date.now() / 1000;

            // Rainbow wave: each hex colored by longitude position + time offset
            const features = hexGridFeaturesRef.current;
            const { minLng, maxLng } = hexGridLngRangeRef.current;
            const lngSpan = maxLng - minLng || 0.001;
            if (features.length > 0 && map.getSource('hex-grid')) {
                const updated = features.map(f => {
                    const norm = (f.properties.lngCenter - minLng) / lngSpan;
                    // Smootherstep easing: edges linger, middle rushes to catch up
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

            // Corona and rays: steady soft glow, no pulsing
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

            // Hex border glow: breathes in sync with hull

            // Territory hull: slower, more majestic breathing
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
                    // Desktop / IP-based location: too coarse to be useful
                    setLocationError(
                        `Desktop location is only accurate to ~${Math.round(accuracy / 1000)} km. Use "Input Address" for your exact location.`
                    );
                    return;
                }

                // Accurate GPS (mobile or good Wi-Fi triangulation)
                programmaticNavRef.current = true;
                const navSeq = ++navSeqRef.current;
                mapRef.current?.flyTo({ center: [longitude, latitude], zoom: DEFAULT_ZOOM, duration: FLY_DURATION_MS });
                mapRef.current?.once('moveend', () => { if (navSeqRef.current === navSeq) programmaticNavRef.current = false; });
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
                    setLocationError('Location access denied. Enable location permissions for this site in your browser settings, then refresh.');
                } else if (err.code === 3) {
                    setLocationError('Location timed out. Please try again.');
                } else {
                    setLocationError('Could not get your location. Please try again.');
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
        const navSeq = ++navSeqRef.current;
        mapRef.current?.flyTo({ center: [lon, lat], zoom: DEFAULT_ZOOM, duration: FLY_DURATION_MS });
        mapRef.current?.once('moveend', () => { if (navSeqRef.current === navSeq) programmaticNavRef.current = false; });
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
        const navSeq = ++navSeqRef.current;
        mapRef.current?.flyTo({ center: [pinnedLocation.longitude, pinnedLocation.latitude], zoom: DEFAULT_ZOOM, duration: FLY_DURATION_MS });
        mapRef.current?.once('moveend', () => { if (navSeqRef.current === navSeq) programmaticNavRef.current = false; });
    };

    // Pull the camera straight back to the globe view. Closes any open card and
    // guards the flight so the auto-spin does not fight it.
    const handleZoomToGlobe = () => {
        const map = mapRef.current;
        if (!map) return;
        setSelectedHex(null);
        programmaticNavRef.current = true;
        const navSeq = ++navSeqRef.current;
        // easeTo with an ease-out curve: zoom out to the globe quickly (firing
        // the low-zoom tile requests early), then decelerate into a gentle
        // settle so those tiles finish loading before the camera stops.
        map.easeTo({
            center: map.getCenter(),
            zoom: 2.2,
            bearing: 0,
            pitch: 0,
            duration: GLOBE_FLY_DURATION_MS,
            easing: (t) => 1 - Math.pow(1 - t, 3),
            essential: true,
        });
        map.once('moveend', () => { if (navSeqRef.current === navSeq) programmaticNavRef.current = false; });
    };

    // Toggle the 3D skyline. Off hides the towers and flattens the camera so the
    // map underneath is fully visible; on restores the towers and pitches back
    // in if already at street zoom. Drives off the ref as source of truth so the
    // zoomend handler stays in sync.
    const handleToggleSkyline = () => {
        const map = mapRef.current;
        const next = !skylineOnRef.current;
        skylineOnRef.current = next;
        setSkylineOn(next);
        if (!map) return;

        // Towers and their recency crowns hide/show together (a crown with no
        // tower under it would float).
        ['hex-extrusion', 'hex-recency-crown'].forEach((id) => {
            if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', next ? 'visible' : 'none');
        });

        if (next) {
            // Pitch up only if already zoomed into street level.
            if (map.getZoom() >= PITCH_ZOOM) {
                pitchedRef.current = true;
                map.easeTo({ pitch: SKYLINE_PITCH, duration: 600 });
                if (map.getLayer('hex-others-icon')) map.setPaintProperty('hex-others-icon', 'icon-opacity', 0);
            }
        } else {
            // Flatten and bring the map (and shields) back into view.
            pitchedRef.current = false;
            map.easeTo({ pitch: 0, duration: 600 });
            if (map.getLayer('hex-others-icon')) map.setPaintProperty('hex-others-icon', 'icon-opacity', 0.92);
        }
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
                    skylineOn={skylineOn}
                    onToggleSkyline={handleToggleSkyline}
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
                {/* Atmosphere halo: only visible at globe zoom levels */}
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

                {/* Unified stat card: flies in top-right for any tapped hex or
                    rival shield. For a rival it also shows the owner + fly action. */}
                <HexStatCard
                    hex={selectedHex}
                    onClose={() => setSelectedHex(null)}
                    onViewProfile={(id) => navigate(`/profile/${id}`)}
                    onFlyToTerritory={(id) => { zoomToPlayerTerritory(id); setSelectedHex(null); }}
                />
                {/* Empty state: globe overlay for new users with no territory */}
                <MapEmptyState
                    visible={!loading && territories.length === 0}
                    onLogActivity={() => navigate('/log-activity')}
                />
                </div>{/* end map container */}

                {/* Attribution, outside the map so it's always clickable */}
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

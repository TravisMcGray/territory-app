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
import { cellToBoundary } from 'h3-js';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getCustomDarkStyle } from '../utils/mapStyle';

// ========== CONSTANTS ==========
// Colors chosen for outdoor visibility and instant ownership recognition.
// Emerald = yours, neon purple = theirs. No ambiguity.
const COLOR_MINE = '#10b981';
const COLOR_THEIRS = '#e879f9';
const DEFAULT_ZOOM = 15;
const FALLBACK_LAT = 27.9506;
const FALLBACK_LNG = -82.4572;

export default function Map() {
    const { user } = useAuth();
    const navigate = useNavigate();

    // ========== STATE ==========
    const [territories, setTerritories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [locationError, setLocationError] = useState(null);
    const [tileCount, setTileCount] = useState({ mine: 0, total: 0 });
    // Tracks when MapLibre's style has fully loaded — you CANNOT add
    // sources or layers until this is true. Attempting to do so throws.
    const [mapLoaded, setMapLoaded] = useState(false);

    // ========== REFS ==========
    // Map ref lives outside React state because MapLibre manages its own
    // DOM and WebGL context — putting it in state would cause issues.
    const mapRef = useRef(null);
    const mapContainerRef = useRef(null);
    const locationMarkerRef = useRef(null);

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
            const style = await getCustomDarkStyle();
            if (cancelled) return;

            const map = new maplibregl.Map({
                container: mapContainerRef.current,
                style,
                center: [FALLBACK_LNG, FALLBACK_LAT],  // MapLibre uses [lng, lat]
                zoom: DEFAULT_ZOOM,
                attributionControl: true,
            });

            // Zoom +/- buttons (no compass — not useful for a 2D territory map)
            map.addControl(
                new maplibregl.NavigationControl({ showCompass: false }),
                'top-left'
            );

            // ---- Style loaded — safe to add sources/layers now ----
            // Building outlines are already in the customized style,
            // so we just need to signal that layers can be added.
            map.on('load', () => {
                setMapLoaded(true);
            });

            // ---- GPS location ----
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    map.flyTo({ center: [longitude, latitude], zoom: DEFAULT_ZOOM });

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

        // ---- Build GeoJSON from territory data ----
        const features = [];

        territories.forEach((territory) => {
            const isMine = territory.owner?.id?.toString() === currentUserId;
            if (isMine) mineCount++;

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
                },
            });
        });

        const geojson = { type: 'FeatureCollection', features };

        // ---- Update existing source or create fresh ----
        // If territories reload (e.g. after logging a new activity),
        // we just swap the GeoJSON data — no need to recreate layers.
        if (map.getSource('territories')) {
            map.getSource('territories').setData(geojson);
        } else {
            map.addSource('territories', {
                type: 'geojson',
                data: geojson,
            });

            // Hex fill — semi-transparent so map detail shows through
            map.addLayer({
                id: 'hex-fill',
                type: 'fill',
                source: 'territories',
                paint: {
                    'fill-color': [
                        'case',
                        ['get', 'isMine'],
                        COLOR_MINE,
                        COLOR_THEIRS,
                    ],
                    'fill-opacity': 0.35,
                },
            });

            // Hex outlines — slightly brighter stroke for definition
            map.addLayer({
                id: 'hex-outline',
                type: 'line',
                source: 'territories',
                paint: {
                    'line-color': [
                        'case',
                        ['get', 'isMine'],
                        COLOR_MINE,
                        COLOR_THEIRS,
                    ],
                    'line-width': 1.5,
                    'line-opacity': 0.9,
                },
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
        }

        setTileCount({ mine: mineCount, total: territories.length });

    }, [territories, user, mapLoaded]);

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
        <div className="min-h-screen bg-gray-950 text-white relative">
            <HexBackground />

            {/* ========== NAVBAR ========== */}
            <Navbar />

            {/* ========== CONTENT ========== */}
            <div className="max-w-6xl mx-auto px-4 py-6 relative z-10">

                {/* ========== HEADER + LEGEND ========== */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <div>
                        <h2 className="text-2xl font-bold">Territory Map</h2>
                        <p className="text-gray-300 font-bold text-sm mt-1">
                            Every captured hex tile in the world
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLOR_MINE }} />
                            <span className="text-sm font-bold text-gray-300">
                                Yours ({tileCount.mine})
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLOR_THEIRS }} />
                            <span className="text-sm font-bold text-gray-300">
                                Others ({tileCount.total - tileCount.mine})
                            </span>
                        </div>
                    </div>
                </div>

                {/* ========== LOCATION ERROR BANNER ========== */}
                {locationError && (
                    <div className="mb-4 px-4 py-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                        <p className="text-yellow-400 font-bold text-sm">{locationError}</p>
                    </div>
                )}

                {/* ========== MY LOCATION BUTTON ========== */}
                <div className="mb-4 flex justify-end">
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
            </div>

            {/* ========== MAP CONTAINER ========== */}
            <div
                className="mx-4 rounded-2xl overflow-hidden border border-gray-800 shadow-2xl relative"
                style={{ height: '65vh', minHeight: '400px' }}
            >
                {loading && (
                    <div className="absolute inset-0 bg-gray-900 flex items-center justify-center rounded-2xl z-10">
                        <p className="text-emerald-400 font-bold text-lg animate-pulse">
                            Loading territory data...
                        </p>
                    </div>
                )}
                <div
                    ref={mapContainerRef}
                    style={{ width: '100%', height: '100%' }}
                />
            </div>

            {/* ========== EMPTY STATE ========== */}
            {!loading && territories.length === 0 && (
                <div className="mt-4 text-center py-6 relative z-10">
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
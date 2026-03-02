// ========== MAP PAGE ==========
// Full-screen territory map showing every captured hex tile in the world.
// Your tiles render in emerald green, everyone else's in neon purple/pink.
// Tap any tile to see who owns it and when they captured it.
// Centers on your GPS location on load so you immediately see your neighborhood.

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getTerritories } from '../services/api';
import HexBackground from '../components/HexBackground';
import { cellToBoundary } from 'h3-js';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconUrl: markerIcon,
    iconRetinaUrl: markerIcon2x,
    shadowUrl: markerShadow,
});

// ========== CONSTANTS ==========
// Colors chosen for outdoor visibility and instant ownership recognition.
// Emerald = yours, neon purple = theirs. No ambiguity.
const COLOR_MINE = '#10b981';
const COLOR_MINE_FILL = '#10b98133';
const COLOR_THEIRS = '#e879f9';
const COLOR_THEIRS_FILL = '#e879f933';
const DEFAULT_ZOOM = 15;
const FALLBACK_LAT = 27.9506;  
const FALLBACK_LNG = -82.4572;

export default function Map() {
    const { user, logoutUser } = useAuth();
    const navigate = useNavigate();

    // ========== STATE ==========
    const [territories, setTerritories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [locationError, setLocationError] = useState(null);
    const [tileCount, setTileCount] = useState({ mine: 0, total: 0 });

    // ========== REFS ==========
    // Map and layer refs live outside React state because Leaflet manages
    // its own DOM — putting them in state would cause double-render issues.
    const mapRef = useRef(null);
    const hexLayerRef = useRef(null);

    // ========== MAP REF CALLBACK ==========
// useCallback ref fires the instant the DOM node attaches — guarantees
// Leaflet always gets a real node, unlike useEffect which can fire too early.
const mapContainerRef = useCallback((node) => {
    if (!node || mapRef.current) return;

    const map = L.map(node, {
        center: [FALLBACK_LAT, FALLBACK_LNG],
        zoom: DEFAULT_ZOOM,
        zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
    }).addTo(map);

    hexLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    navigator.geolocation.getCurrentPosition(
        (position) => {
            map.setView([position.coords.latitude, position.coords.longitude], DEFAULT_ZOOM);
        },
        (err) => {
            console.warn('GPS unavailable:', err.message);
            setLocationError('Could not get your location — showing default view.');
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );

    return () => {
        map.remove();
        mapRef.current = null;
        hexLayerRef.current = null;
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
    // Runs whenever territories load or the user profile changes.
    // Clears and redraws all tiles so ownership colors stay accurate.
    useEffect(() => {
        if (!hexLayerRef.current || !user) return;

        hexLayerRef.current.clearLayers();

        let mineCount = 0;

        territories.forEach((territory) => {
            const isMyTile = territory.owner?.id?.toString() === user._id?.toString();

            if (isMyTile) mineCount++;

            // cellToBoundary returns [[lat, lng], ...] — exactly what Leaflet needs
            let boundary;
            try {
                boundary = cellToBoundary(territory.hexagonId);
            } catch (err) {
                // Skip malformed H3 indices rather than crashing the whole map
                console.warn('Invalid H3 index:', territory.hexagonId);
                return;
            }

            const color = isMyTile ? COLOR_MINE : COLOR_THEIRS;
            const fillColor = isMyTile ? COLOR_MINE_FILL : COLOR_THEIRS_FILL;

            const capturedDate = territory.capturedAt
                ? new Date(territory.capturedAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                })
                : 'Unknown';

            const activityLabel = territory.activityType === 'WALK' ? '🚶 Walk' : '🏃 Run';

            const popupContent = `
                <div style="
                    background: #111827;
                    color: #f9fafb;
                    border-radius: 10px;
                    padding: 10px 14px;
                    min-width: 160px;
                    font-family: sans-serif;
                ">
                    <div style="font-size: 15px; font-weight: 800; color: ${color}; margin-bottom: 4px;">
                        ${territory.owner?.username ?? 'Unknown'}
                    </div>
                    <div style="font-size: 12px; color: #9ca3af; margin-bottom: 2px;">
                        ${activityLabel}
                    </div>
                    <div style="font-size: 12px; color: #6b7280;">
                        Captured ${capturedDate}
                    </div>
                </div>
            `;

            const polygon = L.polygon(boundary, {
                color,
                fillColor,
                weight: 1.5,
                opacity: 0.9,
                fillOpacity: 0.35,
            });

            polygon.bindPopup(popupContent, {
                className: 'hex-popup',
                closeButton: false,
                maxWidth: 220,
            });

            hexLayerRef.current.addLayer(polygon);
        });

        setTileCount({ mine: mineCount, total: territories.length });

    }, [territories, user]);

    const handleLogout = () => {
        logoutUser();
        navigate('/login');
    };

    // ========== RENDER ==========
    return (
        <div className="min-h-screen bg-gray-950 text-white relative">
            <HexBackground />

            {/* ========== NAVBAR ========== */}
            <nav className="border-b border-gray-800 bg-gray-900 px-4 py-3 sticky top-0 z-20">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <h1 className="text-xl font-black tracking-tight">
                        Territory<span className="text-emerald-400">Capture</span>
                    </h1>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/profile')}
                            className="text-gray-400 hover:text-white text-sm transition-colors hidden sm:block"
                        >
                            {user?.username}
                        </button>
                        <button
                            onClick={() => navigate('/log-activity')}
                            className="bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors"
                        >
                            + Log Activity
                        </button>
                        <button
                            onClick={handleLogout}
                            className="text-gray-500 hover:text-white text-sm transition-colors"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </nav>

            {/* ========== CONTENT ========== */}
            {/* relative z-10 here so header sits above HexBackground */}
            <div className="max-w-6xl mx-auto px-4 py-6 relative z-10">

                {/* ========== HEADER + LEGEND ========== */}
                {/* HexBackground is visible behind this section */}
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
            </div>

            {/* ========== MAP CONTAINER ========== */}
            {/* Intentionally outside the relative z-10 content wrapper above.
                This lets Leaflet manage its own stacking context freely
                without being trapped inside our z-index hierarchy. */}
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
                    <p className="text-gray-300 font-bold">No territory captured yet.</p>
                    <p className="text-gray-400 font-bold text-sm mt-1">
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
// ========== LOG ACTIVITY PAGE ==========
// Handles the full lifecycle of recording an activity:
// 1. Setup - pick activity type
// 2. Tracking - GPS running, timer counting, coordinates collecting
// 3. Summary - review before submitting to backend
// 4. Result - show what was captured including new achievements
//
// TRACKING MAP (MapLibre + OpenFreeMap):
// During active tracking, the map shows:
//   - Dark vector tile base map (matches app theme)
//   - Building outlines (subtle gray-700)
//   - Live hex grid around user's position (H3 resolution 10)
//   - Hexagons light up as user walks through them
//   - Route polyline showing path taken
//   - Blue GPS dot following current position
// This gives users real-time visual feedback of territory being captured.

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createActivity } from '../services/api';
import HexBackground from '../components/HexBackground';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { latLngToCell, gridDisk, cellToBoundary } from 'h3-js';
import { getCustomLightStyle } from '../utils/mapStyle';

// ========== CONSTANTS ==========
// Only accept GPS readings with accuracy better than 30 meters.
// Anything worse is too noisy and will draw bad hexagon paths.
const MAX_ACCEPTABLE_ACCURACY = 30;

// Minimum distance (meters) between points to avoid recording duplicates
// while standing still. Prevents hexagon inflation.
const MIN_DISTANCE_BETWEEN_POINTS = 5;

// H3 hex resolution — must match backend (routes/activities.js).
// Resolution 10 = ~130m diameter hexagons, perfect for walking/running.
const H3_RESOLUTION = 10;

// How many rings of hexagons to show around the user's current position.
// k=5 gives 91 hexagons covering ~570m radius — fills a zoom-17 viewport.
const HEX_GRID_RING_SIZE = 5;

// ========== HAVERSINE DISTANCE ==========
// Calculate distance in meters between two GPS points.
// Named after the mathematical formula it uses.
// We need this on the frontend to show live distance while tracking —
// the backend calculates the official distance on submission.
const haversineDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371000; // Earth radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ========== FORMAT HELPERS ==========
const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const formatDistance = (meters) => {
    const miles = meters * 0.000621371;
    return miles.toFixed(2);
};

// ========== ACTIVITY TYPE HEX ICONS ==========
// Walk = blue, Run = emerald. Matches color scheme throughout the app.

const WalkHexIcon = ({ size = 48, active = false }) => (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
        <polygon
            points="2,14 8,3 20,3 26,14 20,25 8,25"
            fill="#0e0d0d"
            stroke={active ? '#3b82f6' : '#374151'}
            strokeWidth="2"
        />
        <text
            x="14"
            y="15"
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="7"
            fill={active ? '#3b82f6' : '#6b7280'}
            fontWeight="800"
            fontFamily="Oxanium, sans-serif"
        >
            WALK
        </text>
    </svg>
);

const RunHexIcon = ({ size = 48, active = false }) => (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
        <polygon
            points="2,14 8,3 20,3 26,14 20,25 8,25"
            fill="#0e0d0d"
            stroke={active ? '#10b981' : '#374151'}
            strokeWidth="2"
        />
        <text
            x="14"
            y="15"
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="7"
            fill={active ? '#10b981' : '#6b7280'}
            fontWeight="800"
            fontFamily="Oxanium, sans-serif"
        >
            RUN
        </text>
    </svg>
);

// ========== MAIN COMPONENT ==========
export default function LogActivity() {
    const navigate = useNavigate();

    // Which screen we're on
    const [phase, setPhase] = useState('setup'); // 'setup' | 'tracking' | 'summary' | 'result'

    // Activity type chosen by user
    const [activityType, setActivityType] = useState('walk');
    const [lastActivity, setLastActivity] = useState(null);

    // GPS and tracking state
    const [coordinates, setCoordinates] = useState([]);
    const [distanceMeters, setDistanceMeters] = useState(0);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [elevationGain, setElevationGain] = useState(0);
    const [elevationLoss, setElevationLoss] = useState(0);
    const [gpsStatus, setGpsStatus] = useState('idle'); // 'idle' | 'acquiring' | 'active' | 'error'
    const [gpsAccuracy, setGpsAccuracy] = useState(null);

    // Submission state
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState(null);

    // Refs — these hold values that need to persist across renders
    // without triggering re-renders themselves. Critical for GPS callbacks.
    const watchIdRef = useRef(null);
    const timerRef = useRef(null);
    const coordinatesRef = useRef([]);
    const distanceRef = useRef(0);
    const lastAltitudeRef = useRef(null);

    // ========== CLEANUP ON UNMOUNT ==========
    // If user navigates away mid-activity, stop GPS and timer.
    useEffect(() => {
        return () => {
            stopGPS();
            stopTimer();
        };
    }, []);

    // ========== TIMER ==========
    const startTimer = () => {
        timerRef.current = setInterval(() => {
            setElapsedSeconds(prev => prev + 1);
        }, 1000);
    };

    const stopTimer = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };

    // ========== GPS ==========
    const startGPS = () => {
        if (!navigator.geolocation) {
            setGpsStatus('error');
            setError('GPS is not supported on this device.');
            return;
        }

        setGpsStatus('acquiring');

        watchIdRef.current = navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude, accuracy, altitude } = position.coords;
                setGpsAccuracy(Math.round(accuracy));

                // Reject noisy readings — accuracy value is the radius of
                // uncertainty in meters. Lower = more accurate.
                if (accuracy > MAX_ACCEPTABLE_ACCURACY) return;

                const newPoint = { latitude, longitude, timestamp: Date.now() };
                const current = coordinatesRef.current;

                // Reject duplicate points — if user is standing still,
                // don't keep adding the same coordinate.
                if (current.length > 0) {
                    const last = current[current.length - 1];
                    const dist = haversineDistance(
                        last.latitude, last.longitude,
                        latitude, longitude
                    );
                    if (dist < MIN_DISTANCE_BETWEEN_POINTS) return;

                    // Update live distance display
                    distanceRef.current += dist;
                    setDistanceMeters(distanceRef.current);
                }

                // Track elevation — browser provides altitude in meters when available.
                // iOS Safari and Android Chrome both report it outdoors; desktops do not.
                if (altitude != null && lastAltitudeRef.current != null) {
                    const diff = altitude - lastAltitudeRef.current;
                    if (diff > 0.5) setElevationGain(prev => prev + diff);
                    else if (diff < -0.5) setElevationLoss(prev => Math.abs(diff) + prev);
                }
                if (altitude != null) lastAltitudeRef.current = altitude;

                // Add point to our collection
                coordinatesRef.current = [...current, newPoint];
                setCoordinates(coordinatesRef.current);
                setGpsStatus('active');
            },
            (err) => {
                // GPS errors: 1=permission denied, 2=unavailable, 3=timeout
                if (err.code === 1) {
                    setError('GPS permission denied. Please allow location access and try again.');
                } else {
                    setError('GPS signal lost. Please check your location settings.');
                }
                setGpsStatus('error');
            },
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 0, // Always get fresh position, never use cached
            }
        );
    };

    const stopGPS = () => {
        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
        }
    };

    // ========== ACTIVITY CONTROLS ==========
    const handleStart = () => {
        // Reset all state for a fresh activity
        setCoordinates([]);
        setDistanceMeters(0);
        setElapsedSeconds(0);
        setElevationGain(0);
        setElevationLoss(0);
        setError('');
        coordinatesRef.current = [];
        distanceRef.current = 0;
        lastAltitudeRef.current = null;

        setPhase('tracking');
        startGPS();
        startTimer();
    };

    const handlePause = () => {
        stopGPS();
        stopTimer();
        setPhase('paused');
    };

    const handleResume = () => {
        setPhase('tracking');
        startGPS();
        startTimer();
    };

    const handleStop = () => {
        stopGPS();
        stopTimer();
        setPhase('summary');
    };

    // ========== SUBMIT TO BACKEND ==========
    const handleSubmit = async () => {
        if (coordinates.length < 2) {
            setError('Not enough GPS points collected. Try moving around more before stopping.');
            return;
        }

        setSubmitting(true);
        setError('');

        try {
            const payload = {
                activityType,
                coordinates,
                duration: elapsedSeconds,
                elevationGain: Math.round(elevationGain),
            };

            const res = await createActivity(payload);
            setResult(res.data);
            setPhase('result');
        } catch (err) {
            const message = err.response?.data?.message || 'Failed to save activity.';            setError(message);
        } finally {
            setSubmitting(false);
        }
    };

    // ========== RENDER PHASES ==========
    return (
        <div className="min-h-screen bg-gray-950 text-white relative">
            <HexBackground />

            {/* Navbar */}
            <nav className="border-b border-gray-800 bg-gray-900 px-4 py-3 sticky top-0 z-10">
                <div className="max-w-lg mx-auto flex items-center justify-between">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="font-bold text-gray-200 hover:text-white transition-colors text-sm"
                    >
                        ← Back
                    </button>
                    <h1 className="text-lg font-black tracking-tight">
                        Hex<span className="text-emerald-400">Capture</span>
                    </h1>
                    <div className="w-12" /> {/* Spacer to center title */}
                </div>
            </nav>

            <div className="max-w-lg mx-auto px-4 py-8 relative z-10">
                {phase === 'setup' && (
                    <SetupPhase
                        activityType={activityType}
                        setActivityType={setActivityType}
                        onStart={handleStart}
                        lastActivity={lastActivity}
                    />
                )}
                {(phase === 'tracking' || phase === 'paused') && (
                    <TrackingPhase
                        activityType={activityType}
                        phase={phase}
                        elapsedSeconds={elapsedSeconds}
                        distanceMeters={distanceMeters}
                        coordinateCount={coordinates.length}
                        coordinates={coordinates}
                        gpsStatus={gpsStatus}
                        gpsAccuracy={gpsAccuracy}
                        elevationGainMeters={elevationGain}
                        onPause={handlePause}
                        onResume={handleResume}
                        onStop={handleStop}
                    />
                )}
                {phase === 'summary' && (
                    <SummaryPhase
                        activityType={activityType}
                        elapsedSeconds={elapsedSeconds}
                        distanceMeters={distanceMeters}
                        coordinateCount={coordinates.length}
                        elevationGainMeters={elevationGain}
                        elevationLossMeters={elevationLoss}
                        submitting={submitting}
                        error={error}
                        onSubmit={handleSubmit}
                        onDiscard={() => navigate('/dashboard')}
                    />
                )}
                {phase === 'result' && result && (
                    <ResultPhase
                        result={result}
                        onDone={() => navigate('/dashboard')}
                    />
                )}
            </div>
        </div>
    );
}

// ========== SETUP PHASE ==========
function SetupPhase({ activityType, setActivityType, onStart, lastActivity }) {
    const isWalk = activityType === 'walk';

    const taglines = {
        walk: [
            "Every step claims new ground!",
            "Your territory grows with every stride!",
            "Walkers never lose what they earn!",
            "The map is yours for the taking!",
        ],
        run: [
            "Runners take what they want!",
            "Speed is power. Go steal some hexagons!",
            "Other runners won't know what hit them!",
            "Fast feet, more territory. Let's go!",
        ],
    };

    // Pick a random tagline for the current activity type
    const tagline = taglines[activityType][Math.floor(Math.random() * taglines[activityType].length)];

    return (
        <div className="space-y-6">

            {/* ========== HEADER ========== */}
            <div>
                <h2 className="text-3xl font-black">Let's Go!</h2>
                <p className="font-bold text-gray-300 mt-1 text-sm">
                    Choose your activity and claim your territory.
                </p>
            </div>

            {/* ========== LAST ACTIVITY STAT ========== */}
            {lastActivity && (
                <div className="flex items-center gap-2 px-4 py-2 bg-gray-900 border border-gray-800 rounded-xl w-fit">
                    <span className="text-gray-400 text-xs font-bold">Last time:</span>
                    <span className="text-emerald-400 text-xs font-black">
                        {lastActivity.distance}mi
                    </span>
                    <span className="text-gray-600 text-xs">·</span>
                    <span className="text-gray-400 text-xs font-bold">
                        {lastActivity.hexagons} hexagons
                    </span>
                </div>
            )}

            {/* ========== ACTIVITY CARDS ========== */}
            <div className="grid grid-cols-2 gap-3">

                {/* WALK CARD */}
                <button
                    type="button"
                    onClick={() => setActivityType('walk')}
                    className={`relative rounded-2xl border-2 transition-all overflow-hidden text-left ${
                        activityType === 'walk'
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-gray-800 bg-gray-900 hover:border-gray-700'
                    }`}
                    style={{ minHeight: '200px' }}
                >
                    {/* Animated hex pulse when selected */}
                    {activityType === 'walk' && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-32 h-32 rounded-full bg-blue-500/10 animate-ping" />
                        </div>
                    )}
                    <div className="relative p-6 flex flex-col h-full gap-3">
                        <WalkHexIcon size={52} active={activityType === 'walk'} />
                        <div className="font-black text-xl text-white">Walk</div>
                        <div className="font-bold text-gray-300 text-xs leading-relaxed">
                            Claim unclaimed land forever. Nobody can take it from you.
                        </div>
                        {activityType === 'walk' && (
                            <div className="mt-auto">
                                <span className="text-blue-400 text-xs font-black uppercase tracking-widest">
                                    Selected ✓
                                </span>
                            </div>
                        )}
                    </div>
                </button>

                {/* RUN CARD */}
                <button
                    type="button"
                    onClick={() => setActivityType('run')}
                    className={`relative rounded-2xl border-2 transition-all overflow-hidden text-left ${
                        activityType === 'run'
                            ? 'border-emerald-500 bg-emerald-500/10'
                            : 'border-gray-800 bg-gray-900 hover:border-gray-700'
                    }`}
                    style={{ minHeight: '200px' }}
                >
                    {/* Animated hex pulse when selected */}
                    {activityType === 'run' && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-32 h-32 rounded-full bg-emerald-500/10 animate-ping" />
                        </div>
                    )}
                    <div className="relative p-6 flex flex-col h-full gap-3">
                        <RunHexIcon size={52} active={activityType === 'run'} />
                        <div className="font-black text-xl text-white">Run</div>
                        <div className="font-bold text-gray-300 text-xs leading-relaxed">
                            Steal territory from other runners. Speed wins.
                        </div>
                        {activityType === 'run' && (
                            <div className="mt-auto">
                                <span className="text-emerald-400 text-xs font-black uppercase tracking-widest">
                                    Selected ✓
                                </span>
                            </div>
                        )}
                    </div>
                </button>
            </div>

            {/* ========== MOTIVATIONAL TAGLINE ========== */}
            <div className={`text-center py-3 px-4 rounded-xl border transition-all ${
                isWalk
                    ? 'bg-blue-500/10 border-blue-500/20 text-blue-300'
                    : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
            }`}>
                <p className="font-black text-sm">{tagline}</p>
            </div>

            {/* ========== RULES ========== */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-2">
                <p className="font-bold text-gray-100 text-sm uppercase tracking-wide">
                    Territory Rules
                </p>
                <p className="font-bold text-gray-400 text-sm">
                    <span className="font-bold text-white">Walkers</span> capture unclaimed land and keep it forever!
                </p>
                <p className="font-bold text-gray-400 text-sm">
                    <span className="font-bold text-white">Runners</span> can steal territory from other runners only!
                </p>
            </div>

            {/* ========== START BUTTON ========== */}
            <button
                type="button"
                onClick={onStart}
                className={`w-full font-black text-xl py-5 rounded-2xl transition-all transform active:scale-95 ${
                    isWalk
                        ? 'bg-blue-500 hover:bg-blue-400 text-white'
                        : 'bg-emerald-500 hover:bg-emerald-400 text-white'
                }`}
            >
                {isWalk ? '🚶 Start Walk' : '🏃 Start Run'}
            </button>
        </div>
    );
}

// ========== TRACKING PHASE ==========
// This is where the magic happens. The map shows:
//   1. A hex grid around the user's current position (faint outlines)
//   2. Hexagons lighting up in real-time as the user walks through them
//   3. A route polyline tracing the path taken
//   4. A blue GPS dot at current position
//   5. Building outlines for spatial context
//
// The hex grid uses H3 resolution 10 (same as backend) so what the user
// sees during tracking exactly matches what gets captured on submission.
function TrackingPhase({
    activityType,
    phase,
    elapsedSeconds,
    distanceMeters,
    coordinateCount,
    coordinates,
    gpsStatus,
    gpsAccuracy,
    elevationGainMeters,
    onPause,
    onResume,
    onStop,
}) {
    const isWalk = activityType === 'walk';
    const isPaused = phase === 'paused';

    // Activity color — blue for walk, emerald for run
    const activityColor = isWalk ? '#3b82f6' : '#10b981';

    // ---- Map refs ----
    const mapRef = useRef(null);
    const mapContainerRef = useRef(null);
    const locationMarkerRef = useRef(null);
    const mapLoadedRef = useRef(false);

    // Track which H3 hexagons the user has physically entered during
    // this activity. Persists across re-renders via ref, not state,
    // because we don't want 91 hex updates to trigger React re-renders.
    const visitedHexesRef = useRef(new Set());

    // ========== INITIALIZE MAP ==========
    // Async init: fetches the style JSON, customizes colors for visibility,
    // then creates the MapLibre instance. Building outlines are baked into
    // the customized style. Adds empty GeoJSON sources for the hex grid
    // and route line. Runs once when TrackingPhase mounts.
    useEffect(() => {
        if (mapRef.current) return;

        let cancelled = false;

        async function initMap() {
            const style = await getCustomLightStyle();
            if (cancelled) return;

            const map = new maplibregl.Map({
                container: mapContainerRef.current,
                style,
                center: [0, 0],
                zoom: 17,
                attributionControl: false,
                // Disable rotation — not useful during activity tracking
                // and prevents accidental rotation on mobile
                dragRotate: false,
                pitchWithRotate: false,
                touchZoomRotate: true,
            });

            map.on('load', () => {
                mapLoadedRef.current = true;

                // ---- Hex grid source (empty until GPS fires) ----
                map.addSource('hex-grid', {
                    type: 'geojson',
                    data: { type: 'FeatureCollection', features: [] },
                });

                // Hex fill — only visited hexagons get filled with activity color.
                // Unvisited hexagons stay transparent so only the outline shows.
                map.addLayer({
                    id: 'hex-visited-fill',
                    type: 'fill',
                    source: 'hex-grid',
                    filter: ['==', ['get', 'visited'], true],
                    paint: {
                        'fill-color': activityColor,
                        'fill-opacity': 0.35,
                    },
                });

                // Hex outlines — visited hexes get bright activity color,
                // unvisited hexes get a faint gray outline so the grid is
                // visible but doesn't compete with captured territory.
                map.addLayer({
                    id: 'hex-grid-outline',
                    type: 'line',
                    source: 'hex-grid',
                    paint: {
                        'line-color': [
                            'case',
                            ['get', 'visited'],
                            activityColor,      // bright for captured
                            '#4b5563',           // gray-600 for uncaptured grid
                        ],
                        'line-width': [
                            'case',
                            ['get', 'visited'],
                            1.5,                 // thicker for captured
                            0.5,                 // thin for grid
                        ],
                        'line-opacity': [
                            'case',
                            ['get', 'visited'],
                            0.9,                 // bright for captured
                            0.4,                 // subtle for grid
                        ],
                    },
                });

                // ---- Route line source (empty until GPS fires) ----
                map.addSource('route', {
                    type: 'geojson',
                    data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } },
                });

                // Route polyline — traces the user's path in activity color
                map.addLayer({
                    id: 'route-line',
                    type: 'line',
                    source: 'route',
                    paint: {
                        'line-color': activityColor,
                        'line-width': 4,
                        'line-opacity': 0.9,
                    },
                });
            });

            mapRef.current = map;
        }

        initMap();

        return () => {
            cancelled = true;
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
                mapLoadedRef.current = false;
            }
        };
    }, []);

    // ========== UPDATE MAP ON NEW COORDINATES ==========
    // Every time a new GPS point arrives, this effect:
    //   1. Determines which H3 hex the user is standing in
    //   2. Adds it to the visited set
    //   3. Rebuilds the hex grid GeoJSON (gridDisk around current position)
    //   4. Updates the route polyline
    //   5. Moves the blue dot marker
    //   6. Smoothly pans the map to follow the user
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !mapLoadedRef.current || coordinates.length === 0) return;

        const latest = coordinates[coordinates.length - 1];

        // ---- Track which hex the user just entered ----
        // latLngToCell converts a GPS point to its containing H3 index.
        // Same function the backend uses, so what lights up here is
        // exactly what gets captured when the activity is submitted.
        const currentH3 = latLngToCell(latest.latitude, latest.longitude, H3_RESOLUTION);
        visitedHexesRef.current.add(currentH3);

        // ---- Build hex grid around current position ----
        // gridDisk returns all H3 indices within k rings of the center.
        // k=5 gives ~91 hexagons — enough to fill the visible viewport.
        const gridHexes = gridDisk(currentH3, HEX_GRID_RING_SIZE);

        const hexFeatures = [];
        for (const h3Index of gridHexes) {
            let boundary;
            try {
                boundary = cellToBoundary(h3Index);
            } catch (err) {
                continue; // Skip invalid indices (shouldn't happen but be safe)
            }

            // CRITICAL: h3-js returns [[lat, lng], ...], GeoJSON needs [lng, lat]
            const coords = boundary.map(([lat, lng]) => [lng, lat]);
            coords.push(coords[0]); // Close the polygon ring

            hexFeatures.push({
                type: 'Feature',
                geometry: {
                    type: 'Polygon',
                    coordinates: [coords],
                },
                properties: {
                    visited: visitedHexesRef.current.has(h3Index),
                },
            });
        }

        map.getSource('hex-grid')?.setData({
            type: 'FeatureCollection',
            features: hexFeatures,
        });

        // ---- Update route polyline ----
        const routeCoords = coordinates.map(c => [c.longitude, c.latitude]);
        map.getSource('route')?.setData({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: routeCoords },
        });

        // ---- Move or create the blue GPS dot ----
        if (locationMarkerRef.current) {
            locationMarkerRef.current.setLngLat([latest.longitude, latest.latitude]);
        } else {
            const el = document.createElement('div');
            el.className = 'location-dot';
            locationMarkerRef.current = new maplibregl.Marker({ element: el })
                .setLngLat([latest.longitude, latest.latitude])
                .addTo(map);
        }

        // ---- Smooth pan to follow the user ----
        map.easeTo({
            center: [latest.longitude, latest.latitude],
            duration: 500, // ms — smooth but responsive
        });

    }, [coordinates]);

    return (
        <div className="space-y-4">

            {/* Paused banner */}
            {isPaused && (
                <div className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
                    <span className="w-2 h-2 rounded-full bg-yellow-400" />
                    <span className="text-yellow-400 font-black text-sm tracking-widest uppercase">Paused</span>
                </div>
            )}

            {/* GPS status indicator */}
            {!isPaused && (
                <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm w-fit ${
                    gpsStatus === 'active'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : gpsStatus === 'acquiring'
                        ? 'bg-yellow-500/20 font-bold text-yellow-500'
                        : 'bg-red-500/20 text-red-400'
                }`}>
                    <span className={`w-2 h-2 rounded-full ${
                        gpsStatus === 'active'
                            ? 'bg-emerald-400 animate-pulse'
                            : gpsStatus === 'acquiring'
                            ? 'bg-yellow-400 animate-pulse'
                            : 'bg-red-400'
                    }`} />
                    {gpsStatus === 'active'
                        ? `GPS Active — ±${gpsAccuracy}m accuracy`
                        : gpsStatus === 'acquiring'
                        ? 'Acquiring GPS signal...'
                        : 'GPS Error'}
                </div>
            )}

            {/* Activity type badge */}
            <div>
                <span className={`text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full ${
                    isWalk
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-emerald-500/20 text-emerald-400'
                }`}>
                    {isWalk ? '🚶 Walking' : '🏃 Running'}
                </span>
            </div>

            {/* Big timer */}
            <div>
                <div className="text-6xl font-black tabular-nums tracking-tight">
                    {formatTime(elapsedSeconds)}
                </div>
                <div className="font-bold text-gray-300 text-sm mt-1">Elapsed time</div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                    <div className="text-2xl font-black text-white">
                        {formatDistance(distanceMeters)}
                    </div>
                    <div className="font-bold text-gray-300 text-xs mt-1">Miles</div>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                    <div className={`text-2xl font-black ${isWalk ? 'text-blue-400' : 'text-emerald-400'}`}>
                        {visitedHexesRef.current.size}
                    </div>
                    <div className="font-bold text-gray-300 text-xs mt-1">Hexagons</div>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                    <div className="text-2xl font-black text-amber-400">
                        {Math.round(elevationGainMeters * 3.28084)}
                    </div>
                    <div className="font-bold text-gray-300 text-xs mt-1">↑ Elev ft</div>
                </div>
            </div>

            {/* ========== LIVE MAP ========== */}
            <div
                className="relative rounded-2xl overflow-hidden border border-gray-800 shadow-2xl"
                style={{ height: '45vh', minHeight: '280px' }}
            >
                {gpsStatus === 'acquiring' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900 rounded-2xl z-10">
                        <p className="text-yellow-400 font-bold text-sm animate-pulse">
                            Acquiring GPS signal...
                        </p>
                    </div>
                )}
                <div
                    ref={mapContainerRef}
                    style={{ width: '100%', height: '100%' }}
                />
            </div>

            {/* Acquiring GPS message */}
            {gpsStatus === 'acquiring' && (
                <p className="font-bold text-yellow-500 text-sm text-center bg-yellow-500/10 rounded-xl p-3">
                    Waiting for GPS signal. Walk outside and away from buildings for best results.
                </p>
            )}

            {/* Controls */}
            {isPaused ? (
                <div className="grid grid-cols-2 gap-3">
                    <button
                        type="button"
                        onClick={onResume}
                        className={`font-black text-lg py-5 rounded-2xl transition-colors text-white ${
                            isWalk ? 'bg-blue-500 hover:bg-blue-400' : 'bg-emerald-500 hover:bg-emerald-400'
                        }`}
                    >
                        ▶ Resume
                    </button>
                    <button
                        type="button"
                        onClick={onStop}
                        className="bg-red-500 hover:bg-red-400 text-white font-black text-lg py-5 rounded-2xl transition-colors"
                    >
                        ■ Finish
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-3">
                    <button
                        type="button"
                        onClick={onPause}
                        className="bg-gray-700 hover:bg-gray-600 text-white font-black text-lg py-5 rounded-2xl transition-colors"
                    >
                        ⏸ Pause
                    </button>
                    <button
                        type="button"
                        onClick={onStop}
                        className="bg-red-500 hover:bg-red-400 text-white font-black text-lg py-5 rounded-2xl transition-colors"
                    >
                        ■ Finish
                    </button>
                </div>
            )}

            <p className="font-bold text-gray-300 text-xs text-center">
                Keep this screen open while tracking. Locking your phone may pause GPS.
            </p>
        </div>
    );
}

// ========== SUMMARY PHASE ==========
function SummaryPhase({
    activityType,
    elapsedSeconds,
    distanceMeters,
    coordinateCount,
    elevationGainMeters,
    elevationLossMeters,
    submitting,
    error,
    onSubmit,
    onDiscard,
}) {
    const isWalk = activityType === 'walk';
    const hasEnoughPoints = coordinateCount >= 2;
    const elevGainFt = Math.round(elevationGainMeters * 3.28084);
    const elevLossFt = Math.round(elevationLossMeters * 3.28084);

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-black">Activity Summary</h2>
                <p className="font-bold text-gray-300 mt-1 text-sm">
                    Review your activity before saving.
                </p>
            </div>

            {/* Summary card */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center gap-3">
                    <span className="text-2xl">{isWalk ? '🚶' : '🏃'}</span>
                    <div>
                        <div className="font-bold text-lg capitalize">{activityType}</div>
                        <div className="font-bold text-gray-400 text-sm">
                            {new Date().toLocaleDateString('en-US', {
                                weekday: 'long',
                                month: 'long',
                                day: 'numeric'
                            })}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="text-center">
                        <div className="text-xl font-black">{formatTime(elapsedSeconds)}</div>
                        <div className="font-bold text-gray-300 text-xs">duration</div>
                    </div>
                    <div className="text-center">
                        <div className="text-xl font-black">{formatDistance(distanceMeters)}</div>
                        <div className="font-bold text-gray-300 text-xs">miles</div>
                    </div>
                    {elevGainFt > 0 && (
                        <div className="text-center">
                            <div className="text-xl font-black text-amber-400">{elevGainFt} ft</div>
                            <div className="font-bold text-gray-300 text-xs">↑ elevation gain</div>
                        </div>
                    )}
                    {elevLossFt > 0 && (
                        <div className="text-center">
                            <div className="text-xl font-black text-blue-400">{elevLossFt} ft</div>
                            <div className="font-bold text-gray-300 text-xs">↓ elevation loss</div>
                        </div>
                    )}
                </div>
            </div>

            {/* Not enough points warning */}
            {!hasEnoughPoints && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                    <p className="font-bold text-yellow-500 text-sm font-semibold">Not enough GPS data</p>
                    <p className="font-bold text-yellow-400/80 text-xs mt-1">
                        Only {coordinateCount} GPS point{coordinateCount !== 1 ? 's' : ''} were collected.
                        You need at least 2. This usually happens when GPS couldn't get a signal.
                    </p>
                </div>
            )}

            {error && (
                <p className="text-red-400 text-sm text-center bg-red-500/10 rounded-xl p-3">
                    {error}
                </p>
            )}

            {/* Actions */}
            <div className="space-y-3">
                <button
                    type="button"
                    onClick={onSubmit}
                    disabled={submitting || !hasEnoughPoints}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed text-white font-black text-lg py-4 rounded-2xl transition-colors"
                >
                    {submitting ? 'Saving...' : 'Save Activity'}
                </button>

                <button
                    type="button"
                    onClick={onDiscard}
                    className="w-full bg-transparent border border-gray-800 hover:border-gray-600 text-gray-300 hover:text-white font-semibold py-3 rounded-2xl transition-colors"
                >
                    Discard
                </button>
            </div>
        </div>
    );
}

// ========== RESULT PHASE ==========
function ResultPhase({ result, onDone }) {
    const activity = result.activity;
    const achievements = result.newAchievements || [];
    const milestone = result.milestone;

    return (
        <div className="space-y-6">
            <div className="text-center py-4">
                <div className="text-5xl mb-3">🎉</div>
                <h2 className="text-3xl font-black">Activity Saved!</h2>
                <p className="text-gray-500 mt-1 text-sm">
                    Territory captured and stats updated.
                </p>
            </div>

            {/* Results card */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <ResultStat label="Distance" value={activity.distance} />
                    <ResultStat label="Duration" value={activity.duration} />
                    <ResultStat
                        label="New Territory"
                        value={`${activity.newTerritory} hex`}
                        accent="emerald"
                    />
                    <ResultStat
                        label="Stolen"
                        value={`${activity.stolenTerritory} hex`}
                        accent={activity.stolenTerritory > 0 ? 'red' : 'gray'}
                    />
                    {(activity.elevationGain ?? 0) > 0 && (
                        <ResultStat
                            label="Elevation Gain"
                            value={`${Math.round((activity.elevationGain ?? 0) * 3.28084)} ft`}
                            accent="amber"
                        />
                    )}
                </div>
                <div className="border-t border-gray-800 pt-3 text-center">
                    <span className="text-white font-black">{activity.estimatedCalories ?? 0} kcal</span>
                    <span className="text-gray-500 text-xs ml-2">estimated calories burned</span>
                </div>
            </div>

            {/* New achievements */}
            {achievements.length > 0 && (
                <div className="space-y-2">
                    <p className="text-emerald-400 font-bold text-sm uppercase tracking-wide">
                        🏆 New Achievements Unlocked!
                    </p>
                    {achievements.map((achievement, i) => (
                        <div
                            key={i}
                            className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4"
                        >
                            <div className="font-bold text-white">{achievement.name}</div>
                            <div className="text-gray-400 text-sm mt-0.5">
                                {achievement.description}
                            </div>
                            <div className="text-emerald-400 text-xs mt-1 uppercase tracking-wide">
                                {achievement.rarity}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Milestone */}
            {milestone && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                    <p className="text-blue-400 text-sm font-semibold">🎯 Milestone Reached!</p>
                    <p className="text-blue-300 text-sm mt-1">{milestone}</p>
                </div>
            )}

            <button
                type="button"
                onClick={onDone}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-black text-lg py-4 rounded-2xl transition-colors"
            >
                Back to Dashboard
            </button>
        </div>
    );
}

// ========== RESULT STAT SUB-COMPONENT ==========
function ResultStat({ label, value, accent = 'white' }) {
    const colors = {
        white: 'text-white',
        emerald: 'text-emerald-400',
        red: 'text-red-400',
        gray: 'text-gray-500',
        amber: 'text-amber-400',
    };

    return (
        <div className="text-center">
            <div className={`text-xl font-black ${colors[accent]}`}>{value}</div>
            <div className="text-gray-500 text-xs mt-0.5">{label}</div>
        </div>
    );
}
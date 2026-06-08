import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createActivity } from '../services/api';
import HexBackground from '../components/HexBackground';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { latLngToCell, gridDisk, cellToBoundary } from 'h3-js';
import { getCustomLightStyle } from '../utils/mapStyle';

const MAX_ACCEPTABLE_ACCURACY = 30;
const MIN_DISTANCE_BETWEEN_POINTS = 5;
const H3_RESOLUTION = 10;
const HEX_GRID_RING_SIZE = 5;

const haversineDistance = (lat1, lng1, lat2, lng2) => {
    const R = 6371000;
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

const WalkHexIcon = ({ size = 48, active = false }) => (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
        <polygon points="2,14 8,3 20,3 26,14 20,25 8,25"
            fill={active ? 'rgba(59,130,246,0.08)' : '#f8fafc'}
            stroke={active ? '#3b82f6' : '#cbd5e1'} strokeWidth="2"/>
        <text x="14" y="15" textAnchor="middle" dominantBaseline="middle" fontSize="7"
            fill={active ? '#3b82f6' : '#94a3b8'} fontWeight="800" fontFamily="Oxanium, sans-serif">
            WALK
        </text>
    </svg>
);

const RunHexIcon = ({ size = 48, active = false }) => (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
        <polygon points="2,14 8,3 20,3 26,14 20,25 8,25"
            fill={active ? 'rgba(16,185,129,0.08)' : '#f8fafc'}
            stroke={active ? '#10b981' : '#cbd5e1'} strokeWidth="2"/>
        <text x="14" y="15" textAnchor="middle" dominantBaseline="middle" fontSize="7"
            fill={active ? '#10b981' : '#94a3b8'} fontWeight="800" fontFamily="Oxanium, sans-serif">
            RUN
        </text>
    </svg>
);

export default function LogActivity() {
    const navigate = useNavigate();

    const [phase, setPhase] = useState('setup');
    const [activityType, setActivityType] = useState('walk');
    const [lastActivity] = useState(null);
    const [coordinates, setCoordinates] = useState([]);
    const [distanceMeters, setDistanceMeters] = useState(0);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [elevationGain, setElevationGain] = useState(0);
    const [elevationLoss, setElevationLoss] = useState(0);
    const [gpsStatus, setGpsStatus] = useState('idle');
    const [gpsAccuracy, setGpsAccuracy] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [retryAttempt, setRetryAttempt] = useState(0);
    const [error, setError] = useState('');
    const [result, setResult] = useState(null);

    const watchIdRef = useRef(null);
    const timerRef = useRef(null);
    const coordinatesRef = useRef([]);
    const distanceRef = useRef(0);
    const lastAltitudeRef = useRef(null);

    useEffect(() => {
        return () => { stopGPS(); stopTimer(); };
    }, []);

    const startTimer = () => {
        timerRef.current = setInterval(() => { setElapsedSeconds(prev => prev + 1); }, 1000);
    };

    const stopTimer = () => {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };

    const startGPS = () => {
        if (!navigator.geolocation) { setGpsStatus('error'); setError('GPS is not supported on this device.'); return; }
        setGpsStatus('acquiring');
        watchIdRef.current = navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude, accuracy, altitude } = position.coords;
                setGpsAccuracy(Math.round(accuracy));
                if (accuracy > MAX_ACCEPTABLE_ACCURACY) return;

                const newPoint = { latitude, longitude, timestamp: Date.now() };
                const current = coordinatesRef.current;

                if (current.length > 0) {
                    const last = current[current.length - 1];
                    const dist = haversineDistance(last.latitude, last.longitude, latitude, longitude);
                    if (dist < MIN_DISTANCE_BETWEEN_POINTS) return;
                    distanceRef.current += dist;
                    setDistanceMeters(distanceRef.current);
                }

                if (altitude != null && lastAltitudeRef.current != null) {
                    const diff = altitude - lastAltitudeRef.current;
                    if (diff > 0.5) setElevationGain(prev => prev + diff);
                    else if (diff < -0.5) setElevationLoss(prev => Math.abs(diff) + prev);
                }
                if (altitude != null) lastAltitudeRef.current = altitude;

                coordinatesRef.current = [...current, newPoint];
                setCoordinates(coordinatesRef.current);
                setGpsStatus('active');
            },
            (err) => {
                if (err.code === 1) setError('GPS permission denied. Please allow location access and try again.');
                else setError('GPS signal lost. Please check your location settings.');
                setGpsStatus('error');
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    };

    const stopGPS = () => {
        if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
    };

    const handleStart = () => {
        setCoordinates([]); setDistanceMeters(0); setElapsedSeconds(0);
        setElevationGain(0); setElevationLoss(0); setError('');
        coordinatesRef.current = []; distanceRef.current = 0; lastAltitudeRef.current = null;
        setPhase('tracking'); startGPS(); startTimer();
    };

    const handlePause = () => { stopGPS(); stopTimer(); setPhase('paused'); };
    const handleResume = () => { setPhase('tracking'); startGPS(); startTimer(); };
    const handleStop = () => { stopGPS(); stopTimer(); setPhase('summary'); };

    const handleSubmit = async () => {
        if (coordinates.length < 2) {
            setError('Not enough GPS points collected. Try moving around more before stopping.');
            return;
        }

        setSubmitting(true); setRetryAttempt(0); setError('');

        const payload = { activityType, coordinates, duration: elapsedSeconds, elevationGain: Math.round(elevationGain) };
        const MAX_RETRIES = 3;
        let lastError;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                const res = await createActivity(payload);
                setResult(res.data); setPhase('result'); setSubmitting(false); return;
            } catch (err) {
                lastError = err;
                const status = err.response?.status;
                if (status && status >= 400 && status < 500) break;
                if (attempt < MAX_RETRIES) { setRetryAttempt(attempt); await new Promise(r => setTimeout(r, 1000 * attempt)); }
            }
        }

        const status = lastError?.response?.status;
        const serverMessage = lastError?.response?.data?.message;
        let message;
        if (!lastError?.response) message = 'No internet connection. Your run data is safe — check your signal and try again.';
        else if (status >= 500) message = serverMessage || 'Our server hit an issue saving your run. Please try again in a moment.';
        else message = serverMessage || 'Could not save your activity. Please try again.';

        setError(message); setRetryAttempt(0); setSubmitting(false);
    };

    return (
        <div className="min-h-screen bg-slate-100 text-slate-900 relative">
            <HexBackground />

            {/* Navbar */}
            <nav className="border-b border-gray-200 bg-white px-4 py-3 sticky top-0 z-10 shadow-sm">
                <div className="max-w-lg mx-auto flex items-center justify-between">
                    <button onClick={() => navigate('/dashboard')}
                        className="font-bold text-slate-600 hover:text-slate-900 transition-colors text-sm">
                        ← Back
                    </button>
                    <h1 className="text-lg font-black tracking-tight text-slate-900">
                        Hex<span className="text-emerald-500">Capture</span>
                    </h1>
                    <div className="w-12" />
                </div>
            </nav>

            <div className="max-w-lg mx-auto px-4 py-8 relative z-10">
                {phase === 'setup' && (
                    <SetupPhase activityType={activityType} setActivityType={setActivityType} onStart={handleStart} lastActivity={lastActivity}/>
                )}
                {(phase === 'tracking' || phase === 'paused') && (
                    <TrackingPhase
                        activityType={activityType} phase={phase}
                        elapsedSeconds={elapsedSeconds} distanceMeters={distanceMeters}
                        coordinates={coordinates}
                        gpsStatus={gpsStatus} gpsAccuracy={gpsAccuracy}
                        elevationGainMeters={elevationGain}
                        onPause={handlePause} onResume={handleResume} onStop={handleStop}
                    />
                )}
                {phase === 'summary' && (
                    <SummaryPhase
                        activityType={activityType} elapsedSeconds={elapsedSeconds}
                        distanceMeters={distanceMeters} coordinateCount={coordinates.length}
                        elevationGainMeters={elevationGain} elevationLossMeters={elevationLoss}
                        submitting={submitting} retryAttempt={retryAttempt} error={error}
                        onSubmit={handleSubmit} onDiscard={() => navigate('/dashboard')}
                    />
                )}
                {phase === 'result' && result && (
                    <ResultPhase result={result} onDone={() => navigate('/dashboard')}/>
                )}
            </div>
        </div>
    );
}

// Static motivational copy, defined once at module scope.
const TAGLINES = {
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

// Pick a random tagline for the given activity type. Called from the lazy state
// initializer and from the activity toggle handler, never during render.
function pickTagline(type) {
    const list = TAGLINES[type];
    return list[Math.floor(Math.random() * list.length)];
}

function SetupPhase({ activityType, setActivityType, onStart, lastActivity }) {
    const isWalk = activityType === 'walk';

    // Tagline re-rolls whenever the user switches activity (see handleSelectType),
    // so each mode gets a fresh, exciting line.
    const [tagline, setTagline] = useState(() => pickTagline(activityType));

    const handleSelectType = (type) => {
        setActivityType(type);
        setTagline(pickTagline(type));
    };

    return (
        <div className="space-y-6">

            <div>
                <h2 className="text-3xl font-black text-slate-900">Let's Go!</h2>
                <p className="font-bold text-slate-500 mt-1 text-sm">Choose your activity and claim your territory.</p>
            </div>

            {lastActivity && (
                <div className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl w-fit shadow-sm">
                    <span className="text-slate-400 text-xs font-bold">Last time:</span>
                    <span className="text-emerald-600 text-xs font-black">{lastActivity.distance}mi</span>
                    <span className="text-slate-300 text-xs">·</span>
                    <span className="text-slate-400 text-xs font-bold">{lastActivity.hexagons} hexagons</span>
                </div>
            )}

            {/* Activity cards */}
            <div className="grid grid-cols-2 gap-3">

                <button type="button" onClick={() => handleSelectType('walk')}
                    className={`relative rounded-2xl border-2 transition-all overflow-hidden text-left ${
                        activityType === 'walk'
                            ? 'border-blue-400 bg-blue-50'
                            : 'border-gray-200 bg-white hover:border-gray-300 shadow-sm'
                    }`}
                    style={{ minHeight: '200px' }}
                >
                    {activityType === 'walk' && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-32 h-32 rounded-full bg-blue-400/10 animate-ping" />
                        </div>
                    )}
                    <div className="relative p-6 flex flex-col h-full gap-3">
                        <WalkHexIcon size={52} active={activityType === 'walk'} />
                        <div className="font-black text-xl text-slate-900">Walk</div>
                        <div className="font-bold text-slate-500 text-xs leading-relaxed">
                            Claim unclaimed land forever. Nobody can take it from you.
                        </div>
                        {activityType === 'walk' && (
                            <div className="mt-auto">
                                <span className="text-blue-500 text-xs font-black uppercase tracking-widest">Selected ✓</span>
                            </div>
                        )}
                    </div>
                </button>

                <button type="button" onClick={() => handleSelectType('run')}
                    className={`relative rounded-2xl border-2 transition-all overflow-hidden text-left ${
                        activityType === 'run'
                            ? 'border-emerald-400 bg-emerald-50'
                            : 'border-gray-200 bg-white hover:border-gray-300 shadow-sm'
                    }`}
                    style={{ minHeight: '200px' }}
                >
                    {activityType === 'run' && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-32 h-32 rounded-full bg-emerald-400/10 animate-ping" />
                        </div>
                    )}
                    <div className="relative p-6 flex flex-col h-full gap-3">
                        <RunHexIcon size={52} active={activityType === 'run'} />
                        <div className="font-black text-xl text-slate-900">Run</div>
                        <div className="font-bold text-slate-500 text-xs leading-relaxed">
                            Steal territory from other runners. Speed wins.
                        </div>
                        {activityType === 'run' && (
                            <div className="mt-auto">
                                <span className="text-emerald-600 text-xs font-black uppercase tracking-widest">Selected ✓</span>
                            </div>
                        )}
                    </div>
                </button>
            </div>

            {/* Tagline */}
            <div className={`text-center py-3 px-4 rounded-xl border transition-all ${
                isWalk
                    ? 'bg-blue-50 border-blue-200 text-blue-600'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-600'
            }`}>
                <p className="font-black text-sm">{tagline}</p>
            </div>

            {/* Rules */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-2 shadow-sm">
                <p className="font-bold text-slate-700 text-sm uppercase tracking-wide">Territory Rules</p>
                <p className="font-bold text-slate-500 text-sm">
                    <span className="font-bold text-slate-900">Walkers</span> capture unclaimed land and keep it forever!
                </p>
                <p className="font-bold text-slate-500 text-sm">
                    <span className="font-bold text-slate-900">Runners</span> can steal territory from other runners only!
                </p>
            </div>

            {/* Start button */}
            <style>{`
                @keyframes stepAppear {
                    0%   { opacity: 0; transform: scale(0.5) rotate(90deg); }
                    15%  { opacity: 0.7; transform: scale(1) rotate(90deg); }
                    60%  { opacity: 0.4; transform: scale(1) rotate(90deg); }
                    100% { opacity: 0; transform: scale(1) rotate(90deg); }
                }
                @keyframes samusRun {
                    0%         { transform: translateX(-80px); opacity: 0; }
                    5%         { opacity: 1; }
                    70%        { transform: translateX(480px); opacity: 1; }
                    75%        { transform: translateX(480px); opacity: 0; }
                    100%       { transform: translateX(480px); opacity: 0; }
                }
                @keyframes samusGhost1 {
                    0%         { transform: translateX(-100px); opacity: 0; }
                    5%         { opacity: 0; }
                    8%         { opacity: 0.45; }
                    70%        { transform: translateX(460px); opacity: 0.3; }
                    75%        { opacity: 0; }
                    100%       { opacity: 0; }
                }
                @keyframes samusGhost2 {
                    0%         { transform: translateX(-120px); opacity: 0; }
                    5%         { opacity: 0; }
                    10%        { opacity: 0.25; }
                    70%        { transform: translateX(440px); opacity: 0.15; }
                    75%        { opacity: 0; }
                    100%       { opacity: 0; }
                }
                @keyframes samusFlash {
                    0%         { opacity: 0; }
                    6%         { opacity: 0.12; }
                    70%        { opacity: 0.04; }
                    75%        { opacity: 0; }
                    100%       { opacity: 0; }
                }
            `}</style>
            <button type="button" onClick={onStart}
                className="w-full font-black text-xl py-5 rounded-2xl transition-all transform active:scale-95 text-white relative overflow-hidden"
                style={{ backgroundImage: `linear-gradient(135deg, ${isWalk ? '#1d4ed8, #06b6d4' : '#059669, #10b981'})` }}
            >
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                    {isWalk
                        ? [0,1,2,3,4,5,6].map(i => (
                            <svg key={i} width="14" height="22" viewBox="0 0 40 60"
                                style={{
                                    position: 'absolute',
                                    left: `${6 + i * 13}%`,
                                    top: i % 2 === 0 ? '20%' : '52%',
                                    animation: `stepAppear 2.8s ease-in-out ${i * 0.4}s infinite`,
                                    opacity: 0,
                                }}
                            >
                                <ellipse cx="20" cy="30" rx="13" ry="22" fill="rgba(255,255,255,0.6)"/>
                            </svg>
                        ))
                        : <>
                            <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.08)', animation: 'samusFlash 2.5s ease-out infinite' }}/>
                            <div style={{ position: 'absolute', left: 0, top: '15%', width: 80, height: '70%',
                                background: 'linear-gradient(90deg, transparent, rgba(167,243,208,0.3), rgba(255,255,255,0.2))',
                                borderRadius: 4, filter: 'blur(4px)', animation: 'samusGhost2 2.5s cubic-bezier(0.4,0,0.2,1) infinite', opacity: 0 }}/>
                            <div style={{ position: 'absolute', left: 0, top: '10%', width: 55, height: '80%',
                                background: 'linear-gradient(90deg, transparent, rgba(167,243,208,0.5), rgba(255,255,255,0.4))',
                                borderRadius: 4, filter: 'blur(2px)', animation: 'samusGhost1 2.5s cubic-bezier(0.4,0,0.2,1) infinite', opacity: 0 }}/>
                            <div style={{ position: 'absolute', left: 0, top: '5%', width: 28, height: '90%',
                                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.95))',
                                borderRadius: 4, filter: 'blur(1px)', boxShadow: '0 0 12px 4px rgba(255,255,255,0.6)',
                                animation: 'samusRun 2.5s cubic-bezier(0.4,0,0.2,1) infinite', opacity: 0 }}/>
                          </>
                    }
                </div>
                <span style={{ position: 'relative', zIndex: 1 }}>
                    {isWalk ? 'Start Walk' : 'Start Run'}
                </span>
            </button>
        </div>
    );
}

function TrackingPhase({ activityType, phase, elapsedSeconds, distanceMeters, coordinates, gpsStatus, gpsAccuracy, elevationGainMeters, onPause, onResume, onStop }) {
    const isWalk = activityType === 'walk';
    const isPaused = phase === 'paused';
    const activityColor = isWalk ? '#3b82f6' : '#10b981';

    // Mirror the visited-hex count into state so render never reads a ref.
    const [hexCount, setHexCount] = useState(0);

    const mapRef = useRef(null);
    const mapContainerRef = useRef(null);
    const locationMarkerRef = useRef(null);
    const mapLoadedRef = useRef(false);
    const visitedHexesRef = useRef(new Set());

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
                dragRotate: false,
                pitchWithRotate: false,
                touchZoomRotate: true,
            });

            map.on('load', () => {
                mapLoadedRef.current = true;

                map.addSource('hex-grid', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

                map.addLayer({ id: 'hex-visited-fill', type: 'fill', source: 'hex-grid',
                    filter: ['==', ['get', 'visited'], true],
                    paint: { 'fill-color': activityColor, 'fill-opacity': 0.35 } });

                map.addLayer({ id: 'hex-grid-outline', type: 'line', source: 'hex-grid',
                    paint: {
                        'line-color': ['case', ['get', 'visited'], activityColor, '#4b5563'],
                        'line-width': ['case', ['get', 'visited'], 1.5, 0.5],
                        'line-opacity': ['case', ['get', 'visited'], 0.9, 0.4],
                    } });

                map.addSource('route', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } } });

                map.addLayer({ id: 'route-line', type: 'line', source: 'route',
                    paint: { 'line-color': activityColor, 'line-width': 4, 'line-opacity': 0.9 } });
            });

            mapRef.current = map;
        }

        initMap();

        return () => {
            cancelled = true;
            if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; mapLoadedRef.current = false; }
        };
    }, []);

    useEffect(() => {
        const map = mapRef.current;
        if (!map || !mapLoadedRef.current || coordinates.length === 0) return;

        const latest = coordinates[coordinates.length - 1];
        const currentH3 = latLngToCell(latest.latitude, latest.longitude, H3_RESOLUTION);
        visitedHexesRef.current.add(currentH3);
        setHexCount(visitedHexesRef.current.size);

        const gridHexes = gridDisk(currentH3, HEX_GRID_RING_SIZE);
        const hexFeatures = [];
        for (const h3Index of gridHexes) {
            let boundary;
            try { boundary = cellToBoundary(h3Index); } catch { continue; }
            const coords = boundary.map(([lat, lng]) => [lng, lat]);
            coords.push(coords[0]);
            hexFeatures.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] },
                properties: { visited: visitedHexesRef.current.has(h3Index) } });
        }

        map.getSource('hex-grid')?.setData({ type: 'FeatureCollection', features: hexFeatures });
        map.getSource('route')?.setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: coordinates.map(c => [c.longitude, c.latitude]) } });

        if (locationMarkerRef.current) {
            locationMarkerRef.current.setLngLat([latest.longitude, latest.latitude]);
        } else {
            const el = document.createElement('div');
            el.className = 'location-dot';
            locationMarkerRef.current = new maplibregl.Marker({ element: el })
                .setLngLat([latest.longitude, latest.latitude]).addTo(map);
        }

        map.easeTo({ center: [latest.longitude, latest.latitude], duration: 500 });
    }, [coordinates]);

    return (
        <div className="space-y-4">

            {isPaused && (
                <div className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-amber-50 border border-amber-200">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <span className="text-amber-600 font-black text-sm tracking-widest uppercase">Paused</span>
                </div>
            )}

            {!isPaused && (
                <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm w-fit ${
                    gpsStatus === 'active' ? 'bg-emerald-50 text-emerald-600'
                    : gpsStatus === 'acquiring' ? 'bg-amber-50 font-bold text-amber-600'
                    : 'bg-red-50 text-red-500'
                }`}>
                    <span className={`w-2 h-2 rounded-full ${
                        gpsStatus === 'active' ? 'bg-emerald-500 animate-pulse'
                        : gpsStatus === 'acquiring' ? 'bg-amber-400 animate-pulse'
                        : 'bg-red-400'
                    }`} />
                    {gpsStatus === 'active' ? `GPS Active — ±${gpsAccuracy}m accuracy`
                        : gpsStatus === 'acquiring' ? 'Acquiring GPS signal...'
                        : 'GPS Error'}
                </div>
            )}

            <div>
                <span className={`text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full ${
                    isWalk ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
                }`}>
                    {isWalk ? (
                        <span className="flex items-center gap-1.5">
                            <svg width="13" height="13" viewBox="0 0 40 40" fill="currentColor">
                                <ellipse cx="28" cy="28" rx="2.2" ry="3.5" transform="rotate(-35 28 28)"/>
                                <ellipse cx="20" cy="24" rx="2.2" ry="3.5" opacity="0.7" transform="rotate(-35 20 24)"/>
                                <ellipse cx="22" cy="17" rx="2.2" ry="3.5" opacity="0.45" transform="rotate(-35 22 17)"/>
                                <ellipse cx="14" cy="14" rx="2.2" ry="3.5" opacity="0.2" transform="rotate(-35 14 14)"/>
                            </svg>
                            Walking
                        </span>
                    ) : (
                        <span className="flex items-center gap-1.5">
                            <svg width="13" height="13" viewBox="0 0 40 40" fill="currentColor">
                                <polygon points="23,4 13,22 20,22 17,36 27,18 20,18"/>
                            </svg>
                            Running
                        </span>
                    )}
                </span>
            </div>

            <div>
                <div className="text-6xl font-black tabular-nums tracking-tight text-slate-900">
                    {formatTime(elapsedSeconds)}
                </div>
                <div className="font-bold text-slate-500 text-sm mt-1">Elapsed time</div>
            </div>

            <div className="grid grid-cols-3 gap-3">
                <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                    <div className="text-2xl font-black text-slate-900">{formatDistance(distanceMeters)}</div>
                    <div className="font-bold text-slate-400 text-xs mt-1">Miles</div>
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                    <div className={`text-2xl font-black ${isWalk ? 'text-blue-500' : 'text-emerald-600'}`}>
                        {hexCount}
                    </div>
                    <div className="font-bold text-slate-400 text-xs mt-1">Hexagons</div>
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                    <div className="text-2xl font-black text-amber-500">
                        {Math.round(elevationGainMeters * 3.28084)}
                    </div>
                    <div className="font-bold text-slate-400 text-xs mt-1">↑ Elev ft</div>
                </div>
            </div>

            <div className="relative rounded-2xl overflow-hidden border border-gray-200 shadow-md" style={{ height: '45vh', minHeight: '280px' }}>
                {gpsStatus === 'acquiring' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-50 rounded-2xl z-10">
                        <p className="text-amber-500 font-bold text-sm animate-pulse">Acquiring GPS signal...</p>
                    </div>
                )}
                <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }}/>
            </div>

            {gpsStatus === 'acquiring' && (
                <p className="font-bold text-amber-600 text-sm text-center bg-amber-50 rounded-xl p-3 border border-amber-200">
                    Waiting for GPS signal. Walk outside and away from buildings for best results.
                </p>
            )}

            {isPaused ? (
                <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={onResume}
                        className={`font-black text-lg py-5 rounded-2xl transition-colors text-white ${
                            isWalk ? 'bg-blue-500 hover:bg-blue-400' : 'bg-emerald-500 hover:bg-emerald-400'
                        }`}>
                        ▶ Resume
                    </button>
                    <button type="button" onClick={onStop}
                        className="bg-red-500 hover:bg-red-400 text-white font-black text-lg py-5 rounded-2xl transition-colors">
                        ■ Finish
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-3">
                    <button type="button" onClick={onPause}
                        className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-black text-lg py-5 rounded-2xl transition-colors">
                        ⏸ Pause
                    </button>
                    <button type="button" onClick={onStop}
                        className="bg-red-500 hover:bg-red-400 text-white font-black text-lg py-5 rounded-2xl transition-colors">
                        ■ Finish
                    </button>
                </div>
            )}

            <p className="font-bold text-slate-400 text-xs text-center">
                Keep this screen open while tracking. Locking your phone may pause GPS.
            </p>
        </div>
    );
}

function SummaryPhase({ activityType, elapsedSeconds, distanceMeters, coordinateCount, elevationGainMeters, elevationLossMeters, submitting, retryAttempt, error, onSubmit, onDiscard }) {
    const [confirmingDiscard, setConfirmingDiscard] = useState(false);
    const isWalk = activityType === 'walk';
    const hasEnoughPoints = coordinateCount >= 2;
    const elevGainFt = Math.round(elevationGainMeters * 3.28084);
    const elevLossFt = Math.round(elevationLossMeters * 3.28084);

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-black text-slate-900">Activity Summary</h2>
                <p className="font-bold text-slate-500 mt-1 text-sm">Review your activity before saving.</p>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4 shadow-sm">
                <div className="flex items-center gap-3">
                    <svg width="28" height="28" viewBox="0 0 40 40" fill={isWalk ? '#3b82f6' : '#10b981'}>
                        {isWalk
                            ? <>
                                <ellipse cx="28" cy="28" rx="2.2" ry="3.5" transform="rotate(-35 28 28)"/>
                                <ellipse cx="20" cy="24" rx="2.2" ry="3.5" opacity="0.7" transform="rotate(-35 20 24)"/>
                                <ellipse cx="22" cy="17" rx="2.2" ry="3.5" opacity="0.45" transform="rotate(-35 22 17)"/>
                                <ellipse cx="14" cy="14" rx="2.2" ry="3.5" opacity="0.2" transform="rotate(-35 14 14)"/>
                              </>
                            : <polygon points="23,4 13,22 20,22 17,36 27,18 20,18"/>
                        }
                    </svg>
                    <div>
                        <div className="font-bold text-lg capitalize text-slate-900">{activityType}</div>
                        <div className="font-bold text-slate-400 text-sm">
                            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="text-center">
                        <div className="text-xl font-black text-slate-900">{formatTime(elapsedSeconds)}</div>
                        <div className="font-bold text-slate-400 text-xs">duration</div>
                    </div>
                    <div className="text-center">
                        <div className="text-xl font-black text-slate-900">{formatDistance(distanceMeters)}</div>
                        <div className="font-bold text-slate-400 text-xs">miles</div>
                    </div>
                    {elevGainFt > 0 && (
                        <div className="text-center">
                            <div className="text-xl font-black text-amber-500">{elevGainFt} ft</div>
                            <div className="font-bold text-slate-400 text-xs">↑ elevation gain</div>
                        </div>
                    )}
                    {elevLossFt > 0 && (
                        <div className="text-center">
                            <div className="text-xl font-black text-blue-500">{elevLossFt} ft</div>
                            <div className="font-bold text-slate-400 text-xs">↓ elevation loss</div>
                        </div>
                    )}
                </div>
            </div>

            {!hasEnoughPoints && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <p className="font-bold text-amber-700 text-sm">Not enough GPS data</p>
                    <p className="font-bold text-amber-600/80 text-xs mt-1">
                        Only {coordinateCount} GPS point{coordinateCount !== 1 ? 's' : ''} were collected.
                        You need at least 2. This usually happens when GPS couldn't get a signal.
                    </p>
                </div>
            )}

            {error && (
                <p className="text-red-500 text-sm text-center bg-red-50 border border-red-100 rounded-xl p-3">{error}</p>
            )}

            {submitting && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                    <span className="text-amber-500 text-base mt-0.5">⚠️</span>
                    <p className="text-amber-700 text-xs font-semibold leading-snug">
                        {retryAttempt > 0
                            ? `Connection issue — retrying to save your run (attempt ${retryAttempt} of 3). Please keep the app open.`
                            : 'Saving your run — please keep the app open until this completes.'
                        }
                    </p>
                </div>
            )}

            <div className="space-y-3">
                <button type="button" onClick={onSubmit} disabled={submitting || !hasEnoughPoints}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-black text-lg py-4 rounded-2xl transition-colors">
                    {submitting
                        ? retryAttempt > 0 ? `Retrying... (${retryAttempt} of 3)` : 'Saving...'
                        : 'Save Activity'
                    }
                </button>

                {!confirmingDiscard ? (
                    <button type="button" onClick={() => setConfirmingDiscard(true)} disabled={submitting}
                        className="w-full bg-transparent border border-gray-200 hover:border-red-300 disabled:opacity-40 disabled:cursor-not-allowed text-slate-400 hover:text-red-500 font-semibold py-3 rounded-2xl transition-colors">
                        Discard
                    </button>
                ) : (
                    <div className="space-y-2">
                        <p className="text-center text-sm text-red-500 font-semibold">
                            This will permanently delete your run. Are you sure?
                        </p>
                        <div className="flex gap-2">
                            <button type="button" onClick={() => setConfirmingDiscard(false)}
                                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-2xl transition-colors">
                                Keep it
                            </button>
                            <button type="button" onClick={onDiscard}
                                className="flex-1 bg-red-50 hover:bg-red-100 border border-red-200 text-red-500 font-bold py-3 rounded-2xl transition-colors">
                                Yes, discard
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function ResultPhase({ result, onDone }) {
    const activity = result.activity;
    const achievements = result.newAchievements || [];
    const milestone = result.milestone;

    return (
        <div className="space-y-6">
            <div className="text-center py-4">
                <div className="text-5xl mb-3">🎉</div>
                <h2 className="text-3xl font-black text-slate-900">Activity Saved!</h2>
                <p className="text-slate-400 mt-1 text-sm">Territory captured and stats updated.</p>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4 shadow-sm">
                <div className="grid grid-cols-2 gap-4">
                    <ResultStat label="Distance" value={activity.distance} />
                    <ResultStat label="Duration" value={activity.duration} />
                    <ResultStat label="New Territory" value={`${activity.newTerritory} hex`} accent="emerald"/>
                    <ResultStat label="Stolen" value={`${activity.stolenTerritory} hex`} accent={activity.stolenTerritory > 0 ? 'red' : 'gray'}/>
                    {(activity.elevationGain ?? 0) > 0 && (
                        <ResultStat label="Elevation Gain" value={`${Math.round((activity.elevationGain ?? 0) * 3.28084)} ft`} accent="amber"/>
                    )}
                </div>
                <div className="border-t border-gray-100 pt-3 text-center">
                    <span className="text-slate-900 font-black">{activity.estimatedCalories ?? 0} kcal</span>
                    <span className="text-slate-400 text-xs ml-2">estimated calories burned</span>
                </div>
            </div>

            {achievements.length > 0 && (
                <div className="space-y-2">
                    <p className="text-emerald-600 font-bold text-sm uppercase tracking-wide">🏆 New Achievements Unlocked!</p>
                    {achievements.map((achievement, i) => (
                        <div key={i} className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                            <div className="font-bold text-slate-900">{achievement.name}</div>
                            <div className="text-slate-500 text-sm mt-0.5">{achievement.description}</div>
                            <div className="text-emerald-600 text-xs mt-1 uppercase tracking-wide">{achievement.rarity}</div>
                        </div>
                    ))}
                </div>
            )}

            {milestone && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <p className="text-blue-600 text-sm font-semibold">🎯 Milestone Reached!</p>
                    <p className="text-blue-700 text-sm mt-1">{milestone}</p>
                </div>
            )}

            <button type="button" onClick={onDone}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-black text-lg py-4 rounded-2xl transition-colors">
                Back to Dashboard
            </button>
        </div>
    );
}

function ResultStat({ label, value, accent = 'default' }) {
    const colors = {
        default: 'text-slate-900',
        emerald: 'text-emerald-600',
        red: 'text-red-500',
        gray: 'text-slate-400',
        amber: 'text-amber-500',
    };

    return (
        <div className="text-center">
            <div className={`text-xl font-black ${colors[accent]}`}>{value}</div>
            <div className="text-slate-400 text-xs mt-0.5">{label}</div>
        </div>
    );
}

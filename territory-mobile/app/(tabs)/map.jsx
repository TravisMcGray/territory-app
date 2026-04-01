// ========== UNIFIED MAP SCREEN ==========
// Three modes + activity type selector:
// 1. EXPLORE — view territory, browse hex grid
// 2. SELECT — choose walk/run with pulsing hex cards (matches web LogActivity setup phase)
// 3. TRACKING — live GPS with dark card stats overlay
// 4. PAUSED — GPS stopped, can resume or stop
// 5. SUMMARY — pre-save review
// 6. RESULT — post-save showing captures, achievements, milestones

import { useState, useEffect, useRef, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    ScrollView,
    Animated,
} from 'react-native';
import MapView, { Polygon, Polyline, Marker, } from 'react-native-maps';
import * as Location from 'expo-location';
import { useAuth } from '../../context/AuthContext';
import { getTerritories, getNearbyHexagons, createActivity } from '../../services/api';
import Svg, { Polygon as SvgPolygon, Rect } from 'react-native-svg';

// ========== CONSTANTS ==========
const DEFAULT_ZOOM_DELTA = 0.008;
const TRACKING_ZOOM_DELTA = 0.004;

// Territory colors
const COLOR_MINE_FILL = 'rgba(16, 185, 129, 0.45)';
const COLOR_MINE_STROKE = '#10b981';
const COLOR_OTHERS_FILL = 'rgba(168, 85, 247, 0.35)';
const COLOR_OTHERS_STROKE = '#a855f7';
const COLOR_GRID_FILL = 'rgba(107, 114, 128, 0.08)';
const COLOR_GRID_STROKE = 'rgba(107, 114, 128, 0.25)';
const COLOR_WALK = '#3b82f6';
const COLOR_RUN = '#10b981';

// Light map style
const LIGHT_MAP_STYLE = [
    { elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#f5f5f5' }] },
    { featureType: 'administrative.land_parcel', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#eeeeee' }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#e0f2e9' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
    { featureType: 'road', elementType: 'labels', stylers: [{ visibility: 'simplified' }] },
    { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#f0f0f0' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#dadada' }] },
    { featureType: 'road.local', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9e8f5' }] },
    { featureType: 'water', elementType: 'labels', stylers: [{ visibility: 'off' }] },
];

// ========== MOTIVATIONAL TAGLINES ==========
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

// ========== HELPERS ==========
const getDistanceMiles = (lat1, lng1, lat2, lng2) => {
    const R = 3958.8;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const formatDuration = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const formatPace = (miles, seconds) => {
    if (miles <= 0 || seconds <= 0) return '--:--';
    const paceSeconds = seconds / miles;
    const paceMin = Math.floor(paceSeconds / 60);
    const paceSec = Math.floor(paceSeconds % 60);
    return `${paceMin}:${String(paceSec).padStart(2, '0')}`;
};

// ========== HEX ICON COMPONENT ==========
function HexIcon({ size = 52, label, active, color }) {
    return (
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
                <SvgPolygon
                    points="2,14 8,3 20,3 26,14 20,25 8,25"
                    fill="#0e0d0d"
                    stroke={active ? color : '#374151'}
                    strokeWidth="2"
                />
            </Svg>
            <Text style={{
                position: 'absolute',
                fontSize: 7,
                fontWeight: '800',
                color: active ? color : '#6b7280',
                letterSpacing: 0.5,
            }}>{label}</Text>
        </View>
    );
}

// ========== CONTROL HEX ICONS ==========
function HexPauseIcon({ size = 28, color = '#ffffff' }) {
    return (
        <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
            <SvgPolygon points="2,14 8,3 20,3 26,14 20,25 8,25" fill="none" stroke={color} strokeWidth="2" />
            <Rect x="10" y="9" width="3" height="10" rx="1" fill={color} />
            <Rect x="15" y="9" width="3" height="10" rx="1" fill={color} />
        </Svg>
    );
}

function HexStopIcon({ size = 28, color = '#ffffff' }) {
    return (
        <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
            <SvgPolygon points="2,14 8,3 20,3 26,14 20,25 8,25" fill="none" stroke={color} strokeWidth="2" />
            <Rect x="10" y="9" width="8" height="10" rx="1.5" fill={color} />
        </Svg>
    );
}

function HexPlayIcon({ size = 28, color = '#ffffff' }) {
    return (
        <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
            <SvgPolygon points="2,14 8,3 20,3 26,14 20,25 8,25" fill="none" stroke={color} strokeWidth="2" />
            <SvgPolygon points="11,8 11,20 20,14" fill={color} />
        </Svg>
    );
}

// ========== MAIN COMPONENT ==========
export default function MapScreen() {
    const { user } = useAuth();
    const currentUserId = (user?.id ?? user?._id)?.toString();
    const mapRef = useRef(null);

    // Map state
    const [location, setLocation] = useState(null);
    const [territories, setTerritories] = useState([]);
    const [gridHexagons, setGridHexagons] = useState([]);
    const [loading, setLoading] = useState(true);
    const [locationError, setLocationError] = useState(null);
    const [tileCount, setTileCount] = useState({ mine: 0, total: 0 });

    // Tracking state
    // mode: 'explore' | 'select' | 'tracking' | 'paused' | 'summary' | 'result'
    const [mode, setMode] = useState('explore');
    const [activityType, setActivityType] = useState('walk');
    const [coordinates, setCoordinates] = useState([]);
    const [routeSegments, setRouteSegments] = useState([[]]);
    const [distance, setDistance] = useState(0);
    const [duration, setDuration] = useState(0);
    const [elevationGain, setElevationGain] = useState(0);
    const [elevationLoss, setElevationLoss] = useState(0);
    const [saving, setSaving] = useState(false);
    const [result, setResult] = useState(null);

    // Refs
    const locationSubscription = useRef(null);
    const timerInterval = useRef(null);
    const lastCoord = useRef(null);
    const lastAltitude = useRef(null);

    // Animations
    const pulseAnim = useRef(new Animated.Value(0)).current;
    const [currentTagline, setCurrentTagline] = useState(() =>
        TAGLINES.walk[Math.floor(Math.random() * TAGLINES.walk.length)]
    );

    // Pulse animation for activity selector
    useEffect(() => {
        const pulse = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
            ])
        );
        pulse.start();
        return () => pulse.stop();
    }, []);

    // Update tagline when activity type changes
    useEffect(() => {
        const lines = TAGLINES[activityType];
        setCurrentTagline(lines[Math.floor(Math.random() * lines.length)]);
    }, [activityType]);

    // ========== INITIAL LOAD ==========
    useEffect(() => {
        const init = async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') {
                    setLocationError('Location permission denied.');
                    setLoading(false);
                    return;
                }
                const loc = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.High,
                });
                setLocation(loc.coords);
                try {
                    const gridRes = await getNearbyHexagons(loc.coords.latitude, loc.coords.longitude, 6);
                    setGridHexagons(gridRes.data.hexagons || []);
                } catch (err) {
                    console.error('Failed to load hex grid:', err);
                }
            } catch (err) {
                setLocationError('Could not get your location.');
            } finally {
                setLoading(false);
            }
        };
        init();
    }, []);

    // Load territories
    useEffect(() => {
        const loadTerritories = async () => {
            try {
                const res = await getTerritories();
                const terrs = res.data.territories || [];
                setTerritories(terrs);
                let mine = 0;
                terrs.forEach(t => {
                    if ((t.owner?.id ?? t.owner?._id)?.toString() === currentUserId) mine++;
                });
                setTileCount({ mine, total: terrs.length });
            } catch (err) {
                console.error('Failed to load territories:', err);
            }
        };
        loadTerritories();
    }, [currentUserId]);

    // ========== GPS TRACKING ==========
    const startGPSWatch = async () => {
        locationSubscription.current = await Location.watchPositionAsync(
            { accuracy: Location.Accuracy.High, distanceInterval: 5, timeInterval: 3000 },
            (loc) => {
                const { latitude, longitude, altitude } = loc.coords;
                const timestamp = Date.now();
                const newPoint = { latitude, longitude, timestamp };
                setLocation(loc.coords);
                if (lastCoord.current) {
                    const segDist = getDistanceMiles(
                        lastCoord.current.latitude, lastCoord.current.longitude,
                        latitude, longitude
                    );
                    setDistance(prev => prev + segDist);
                }
                lastCoord.current = newPoint;
                // Track elevation changes
                if (altitude != null && lastAltitude.current != null) {
                    const diff = altitude - lastAltitude.current;
                    if (diff > 0.5) {
                        setElevationGain(prev => prev + diff);
                    } else if (diff < -0.5) {
                        setElevationLoss(prev => prev + Math.abs(diff));
                    }
                }
                if (altitude != null) lastAltitude.current = altitude;
                setCoordinates(prev => [...prev, newPoint]);
                setRouteSegments(prev => {
                    const updated = [...prev];
                    const currentSeg = [...updated[updated.length - 1], { latitude, longitude }];
                    updated[updated.length - 1] = currentSeg;
                    return updated;
                });
                mapRef.current?.animateToRegion({
                    latitude, longitude,
                    latitudeDelta: TRACKING_ZOOM_DELTA,
                    longitudeDelta: TRACKING_ZOOM_DELTA,
                }, 300);
            }
        );
    };

    const stopGPSWatch = () => {
        if (locationSubscription.current) {
            locationSubscription.current.remove();
            locationSubscription.current = null;
        }
    };

    const startTimer = () => {
        timerInterval.current = setInterval(() => {
            setDuration(prev => prev + 1);
        }, 1000);
    };

    const stopTimer = () => {
        if (timerInterval.current) {
            clearInterval(timerInterval.current);
            timerInterval.current = null;
        }
    };

    // ========== TRACKING CONTROLS ==========
const startTracking = async (type) => {
        setActivityType(type);
        setCoordinates([]);
        setRouteSegments([[]]);
        setDistance(0);
        setDuration(0);
        setElevationGain(0);
        setElevationLoss(0);
        setResult(null);
        lastCoord.current = null;
        lastAltitude.current = null;

        // Request permission explicitly before starting
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Location Required', 'HexCapture needs location access to track your activity. Please enable it in Settings.');
                return;
            }
            setMode('tracking');
            startTimer();
            await startGPSWatch();
        } catch (err) {
            console.error('Failed to start tracking:', err);
            Alert.alert('Error', 'Could not start GPS tracking. Please try again.');
        }
    };

    const pauseTracking = () => {
        stopGPSWatch();
        stopTimer();
        setMode('paused');
    };

    const resumeTracking = async () => {
        setMode('tracking');
        setRouteSegments(prev => [...prev, []]);
        lastCoord.current = null;
        startTimer();
        await startGPSWatch();
    };

    const stopTracking = () => {
        stopGPSWatch();
        stopTimer();
        if (coordinates.length < 2) {
            Alert.alert(
                'No Data Recorded',
                'Not enough GPS points to save. Discard this activity?',
                [
                    { text: 'Resume', onPress: resumeTracking },
                    { text: 'Discard', style: 'destructive', onPress: returnToExplore },
                ]
            );
            return;
        }
        setMode('summary');
    };

    // ========== SAVE / DISCARD ==========
    const saveActivity = async () => {
        setSaving(true);
        try {
            const res = await createActivity({
                coordinates: coordinates.map(c => ({
                    latitude: c.latitude,
                    longitude: c.longitude,
                    timestamp: c.timestamp,
                })),
                activityType,
                duration,
                elevationGain: Math.round(elevationGain),
            });
            setResult(res.data);
            setMode('result');

            // Reload territories
            try {
                const terrRes = await getTerritories();
                const terrs = terrRes.data.territories || [];
                setTerritories(terrs);
                let mine = 0;
                terrs.forEach(t => {
                    if ((t.owner?.id ?? t.owner?._id)?.toString() === currentUserId) mine++;
                });
                setTileCount({ mine, total: terrs.length });
                if (location) {
                    const gridRes = await getNearbyHexagons(location.latitude, location.longitude, 6);
                    setGridHexagons(gridRes.data.hexagons || []);
                }
            } catch {}
        } catch (err) {
            Alert.alert('Error', err.response?.data?.message || 'Failed to save activity.');
        } finally {
            setSaving(false);
        }
    };

    const discardActivity = () => {
        Alert.alert('Discard Activity', 'Are you sure? Your route data will be lost.', [
            { text: 'Keep', style: 'cancel' },
            { text: 'Discard', style: 'destructive', onPress: returnToExplore },
        ]);
    };

    const returnToExplore = () => {
        setCoordinates([]);
        setRouteSegments([[]]);
        setDistance(0);
        setDuration(0);
        setResult(null);
        setActivityType('walk');
        setElevationGain(0);
        setElevationLoss(0);
        setMode('explore');
    };

    // ========== CENTER ON USER ==========
    const handleCenterOnUser = useCallback(() => {
        if (!location || !mapRef.current) return;
        const delta = (mode === 'tracking' || mode === 'paused') ? TRACKING_ZOOM_DELTA : DEFAULT_ZOOM_DELTA;
        mapRef.current.animateToRegion({
            latitude: location.latitude, longitude: location.longitude,
            latitudeDelta: delta, longitudeDelta: delta,
        }, 500);
    }, [location, mode]);

    // ========== CLEANUP ==========
    useEffect(() => {
        return () => { stopGPSWatch(); stopTimer(); };
    }, []);

    // ========== LOADING ==========
    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#10b981" />
                <Text style={styles.loadingText}>Finding your location...</Text>
            </View>
        );
    }

    const initialRegion = location ? {
        latitude: location.latitude, longitude: location.longitude,
        latitudeDelta: DEFAULT_ZOOM_DELTA, longitudeDelta: DEFAULT_ZOOM_DELTA,
    } : { latitude: 27.9506, longitude: -82.4572, latitudeDelta: 0.05, longitudeDelta: 0.05 };

    const routeColor = activityType === 'run' ? COLOR_RUN : COLOR_WALK;
    const isWalk = activityType === 'walk';
    const accentColor = isWalk ? COLOR_WALK : COLOR_RUN;

    // ========== SELECT MODE (Activity Type Picker) ==========
    if (mode === 'select') {
        const pulseScale = pulseAnim.interpolate({
            inputRange: [0, 1], outputRange: [0.8, 1.3],
        });
        const pulseOpacity = pulseAnim.interpolate({
            inputRange: [0, 1], outputRange: [0.4, 0],
        });

        return (
            <View style={styles.fullScreen}>
                <ScrollView contentContainerStyle={styles.selectContent}>
                    <Text style={styles.selectTitle}>Let's Go!</Text>
                    <Text style={styles.selectSubtitle}>Choose your activity and claim your territory.</Text>

                    {/* Activity Cards */}
                    <View style={styles.cardRow}>
                        {/* WALK CARD */}
                        <TouchableOpacity
                            style={[
                                styles.activityCard,
                                isWalk && { borderColor: COLOR_WALK, backgroundColor: 'rgba(59,130,246,0.1)' },
                            ]}
                            onPress={() => setActivityType('walk')}
                            activeOpacity={0.8}
                        >
                            {isWalk && (
                                <Animated.View style={[styles.pulseCircle, {
                                    backgroundColor: COLOR_WALK,
                                    transform: [{ scale: pulseScale }],
                                    opacity: pulseOpacity,
                                }]} />
                            )}
                            <View style={styles.cardContent}>
                                <HexIcon size={52} label="WALK" active={isWalk} color={COLOR_WALK} />
                                <Text style={styles.cardTitle}>Walk</Text>
                                <Text style={styles.cardDesc}>
                                    Claim unclaimed land forever. Nobody can take it from you.
                                </Text>
                                {isWalk && (
                                    <Text style={[styles.selectedBadge, { color: COLOR_WALK }]}>SELECTED ✓</Text>
                                )}
                            </View>
                        </TouchableOpacity>

                        {/* RUN CARD */}
                        <TouchableOpacity
                            style={[
                                styles.activityCard,
                                !isWalk && { borderColor: COLOR_RUN, backgroundColor: 'rgba(16,185,129,0.1)' },
                            ]}
                            onPress={() => setActivityType('run')}
                            activeOpacity={0.8}
                        >
                            {!isWalk && (
                                <Animated.View style={[styles.pulseCircle, {
                                    backgroundColor: COLOR_RUN,
                                    transform: [{ scale: pulseScale }],
                                    opacity: pulseOpacity,
                                }]} />
                            )}
                            <View style={styles.cardContent}>
                                <HexIcon size={52} label="RUN" active={!isWalk} color={COLOR_RUN} />
                                <Text style={styles.cardTitle}>Run</Text>
                                <Text style={styles.cardDesc}>
                                    Steal territory from other runners. Speed wins.
                                </Text>
                                {!isWalk && (
                                    <Text style={[styles.selectedBadge, { color: COLOR_RUN }]}>SELECTED ✓</Text>
                                )}
                            </View>
                        </TouchableOpacity>
                    </View>

                    {/* Motivational tagline */}
                    <View style={[styles.taglineCard, {
                        backgroundColor: isWalk ? 'rgba(59,130,246,0.1)' : 'rgba(16,185,129,0.1)',
                        borderColor: isWalk ? 'rgba(59,130,246,0.2)' : 'rgba(16,185,129,0.2)',
                    }]}>
                        <Text style={[styles.taglineText, { color: isWalk ? '#93c5fd' : '#6ee7b7' }]}>
                            {currentTagline}
                        </Text>
                    </View>

                    {/* Territory Rules */}
                    <View style={styles.rulesCard}>
                        <Text style={styles.rulesTitle}>TERRITORY RULES</Text>
                        <Text style={styles.rulesText}>
                            <Text style={{ color: '#ffffff', fontWeight: '900' }}>Walkers</Text> capture unclaimed land and keep it forever!
                        </Text>
                        <Text style={styles.rulesText}>
                            <Text style={{ color: '#ffffff', fontWeight: '900' }}>Runners</Text> can steal territory from other runners only!
                        </Text>
                    </View>

                    {/* Start Button */}
                    <TouchableOpacity
                        style={[styles.bigStartButton, { backgroundColor: accentColor }]}
                        onPress={() => startTracking(activityType)}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.bigStartButtonText}>
                            {isWalk ? '🚶  Start Walk' : '🏃  Start Run'}
                        </Text>
                    </TouchableOpacity>

                    {/* Back to map */}
                    <TouchableOpacity onPress={() => setMode('explore')} style={styles.backLink}>
                        <Text style={styles.backLinkText}>← Back to map</Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>
        );
    }

    // ========== RESULT MODE ==========
    if (mode === 'result' && result) {
        const activity = result.activity || {};
        const achievements = result.newAchievements || [];
        const milestone = result.milestone;

        return (
            <View style={styles.fullScreen}>
                <ScrollView contentContainerStyle={styles.resultContent}>
                    <Text style={styles.resultEmoji}>🎉</Text>
                    <Text style={styles.resultTitle}>Activity Saved!</Text>
                    <Text style={styles.resultSubtitle}>Territory captured and stats updated.</Text>

                    <View style={styles.resultCard}>
                        <View style={styles.resultGrid}>
                            <View style={styles.resultStatItem}>
                                <Text style={styles.resultStatValue}>{activity.distance ?? distance.toFixed(2)}</Text>
                                <Text style={styles.resultStatLabel}>distance</Text>
                            </View>
                            <View style={styles.resultStatItem}>
                                <Text style={styles.resultStatValue}>{activity.duration ?? formatDuration(duration)}</Text>
                                <Text style={styles.resultStatLabel}>duration</Text>
                            </View>
                            <View style={styles.resultStatItem}>
                                <Text style={[styles.resultStatValue, { color: '#10b981' }]}>
                                    {activity.newTerritory ?? activity.hexagonsCaptured ?? 0} hex
                                </Text>
                                <Text style={styles.resultStatLabel}>new territory</Text>
                            </View>
                            <View style={styles.resultStatItem}>
                                <Text style={[styles.resultStatValue, {
                                    color: (activity.stolenTerritory ?? 0) > 0 ? '#f87171' : '#6b7280'
                                }]}>
                                    {activity.stolenTerritory ?? 0} hex
                                </Text>
                                <Text style={styles.resultStatLabel}>stolen</Text>
                            </View>
                            <View style={styles.resultStatItem}>
                                <Text style={[styles.resultStatValue, { color: '#60a5fa' }]}>
                                    {Math.round(elevationGain * 3.281)} ft
                                </Text>
                                <Text style={styles.resultStatLabel}>↑ elevation</Text>
                            </View>
                            <View style={styles.resultStatItem}>
                                <Text style={[styles.resultStatValue, { color: '#f59e0b' }]}>
                                    {Math.round(elevationLoss * 3.281)} ft
                                </Text>
                                <Text style={styles.resultStatLabel}>↓ elevation</Text>
                            </View>
                        </View>
                        <View style={styles.resultCalories}>
                            <Text style={{ color: '#ffffff', fontWeight: '900' }}>
                                {activity.estimatedCalories ?? 0} kcal
                            </Text>
                            <Text style={{ color: '#6b7280', fontSize: 11, marginLeft: 8 }}>
                                estimated calories burned
                            </Text>
                        </View>
                    </View>

                    {achievements.length > 0 && (
                        <View style={styles.achievementsSection}>
                            <Text style={styles.achievementsLabel}>🏆 New Achievements Unlocked!</Text>
                            {achievements.map((a, i) => (
                                <View key={i} style={styles.achievementItem}>
                                    <Text style={styles.achievementName}>{a.name}</Text>
                                    <Text style={styles.achievementDesc}>{a.description}</Text>
                                    <Text style={styles.achievementRarity}>{a.rarity}</Text>
                                </View>
                            ))}
                        </View>
                    )}

                    {milestone && (
                        <View style={styles.milestoneCard}>
                            <Text style={styles.milestoneText}>🎯 {milestone}</Text>
                        </View>
                    )}

                    <TouchableOpacity style={styles.doneButton} onPress={returnToExplore}>
                        <Text style={styles.doneButtonText}>Back to Map</Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>
        );
    }

    // ========== MAP + EXPLORE / TRACKING / PAUSED / SUMMARY ==========
    return (
        <View style={styles.container}>
            <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={initialRegion}
                customMapStyle={LIGHT_MAP_STYLE}
                showsUserLocation={false}
                showsMyLocationButton={false}
                showsCompass={false}
                showsPointsOfInterest={false}
                showsBuildings={false}
                showsTraffic={false}
                showsIndoors={false}
            >
                {/* Hex grid */}
                {gridHexagons.map(hex => {
                    const isCaptured = territories.some(t => t.hexagonId === hex.hexagonId);
                    if (isCaptured) return null;
                    return (
                        <Polygon key={`grid-${hex.hexagonId}`} coordinates={hex.polygon}
                            fillColor={COLOR_GRID_FILL} strokeColor={COLOR_GRID_STROKE} strokeWidth={1} />
                    );
                })}

                {/* Territories */}
                {territories.map(territory => {
                    if (!territory.polygon) return null;
                    const isMine = (territory.owner?.id ?? territory.owner?._id)?.toString() === currentUserId;
                    return (
                        <Polygon key={territory.hexagonId} coordinates={territory.polygon}
                            fillColor={isMine ? COLOR_MINE_FILL : COLOR_OTHERS_FILL}
                            strokeColor={isMine ? COLOR_MINE_STROKE : COLOR_OTHERS_STROKE}
                            strokeWidth={1.5} tappable={mode === 'explore'}
                            onPress={() => {
                                if (mode !== 'explore') return;
                                const label = territory.activityType === 'walk' ? '🚶 Walk' : '🏃 Run';
                                const date = territory.capturedAt
                                    ? new Date(territory.capturedAt).toLocaleDateString('en-US', {
                                        month: 'short', day: 'numeric', year: 'numeric',
                                    }) : 'Unknown';
                                Alert.alert(territory.owner?.username ?? 'Unknown', `${label}\nCaptured ${date}`);
                            }}
                        />
                    );
                })}

                {/* Route polyline */}
                {(mode === 'tracking' || mode === 'paused' || mode === 'summary') &&
                    routeSegments.map((segment, i) => {
                        if (segment.length < 2) return null;
                        return (
                            <Polyline key={`route-${i}`} coordinates={segment}
                                strokeColor={routeColor} strokeWidth={4}
                                lineCap="round" lineJoin="round" />
                        );
                    })
                }

                {/* Location dot */}
                {location && (
                    <Marker coordinate={{ latitude: location.latitude, longitude: location.longitude }}
                        anchor={{ x: 0.5, y: 0.5 }}>
                        <View style={styles.locationDotOuter}>
                            <View style={styles.locationDotInner} />
                        </View>
                    </Marker>
                )}
            </MapView>

            {/* ===== LEGEND (explore only) ===== */}
            {mode === 'explore' && (
                <View style={styles.legendContainer}>
                    <View style={styles.legendCard}>
                        <View style={styles.legendRow}>
                            <View style={[styles.legendDot, { backgroundColor: COLOR_MINE_STROKE }]} />
                            <Text style={styles.legendText}>Yours ({tileCount.mine})</Text>
                        </View>
                        <View style={styles.legendRow}>
                            <View style={[styles.legendDot, { backgroundColor: COLOR_OTHERS_STROKE }]} />
                            <Text style={styles.legendText}>Others ({tileCount.total - tileCount.mine})</Text>
                        </View>
                    </View>
                </View>
            )}

            {/* ===== TRACKING STATS ===== */}
            {(mode === 'tracking' || mode === 'paused') && (
                <View style={styles.trackingOverlay}>
                    <View style={styles.trackingCard}>
                        {mode === 'paused' && (
                            <View style={styles.pausedBanner}>
                                <Text style={styles.pausedText}>⏸  PAUSED</Text>
                            </View>
                        )}
                        <View style={styles.trackingBadge}>
                            <View style={[styles.gpsDot, { backgroundColor: accentColor }]} />
                            <Text style={[styles.trackingBadgeText, { color: accentColor }]}>
                                {isWalk ? 'WALKING' : 'RUNNING'}
                            </Text>
                        </View>
                        <Text style={styles.bigTimer}>{formatDuration(duration)}</Text>
                        <View style={styles.trackingStatsRow}>
                            <View style={styles.trackingStat}>
                                <Text style={styles.trackingStatValue}>{distance.toFixed(2)}</Text>
                                <Text style={styles.trackingStatLabel}>miles</Text>
                            </View>
                            <View style={[styles.trackingStatDivider, { backgroundColor: '#1f2937' }]} />
                            <View style={styles.trackingStat}>
                                <Text style={styles.trackingStatValue}>{formatPace(distance, duration)}</Text>
                                <Text style={styles.trackingStatLabel}>pace /mi</Text>
                            </View>
                            <View style={[styles.trackingStatDivider, { backgroundColor: '#1f2937' }]} />
                            <View style={styles.trackingStat}>
                                <Text style={styles.trackingStatValue}>{Math.round(elevationGain * 3.281)}</Text>
                                <Text style={styles.trackingStatLabel}>↑ ft</Text>
                            </View>
                        </View>
                    </View>
                </View>
            )}

            {/* ===== SUMMARY OVERLAY ===== */}
            {mode === 'summary' && (
                <View style={styles.summaryOverlay}>
                    <View style={styles.summaryCard}>
                        {saving ? (
                            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                                <ActivityIndicator size="large" color="#10b981" />
                                <Text style={{ color: '#10b981', fontSize: 14, fontWeight: '700', marginTop: 12 }}>
                                    Saving activity...
                                </Text>
                            </View>
                        ) : (
                            <>
                                <Text style={styles.summaryTitle}>Activity Summary</Text>
                                <Text style={styles.summarySubtitle}>Review your activity before saving.</Text>

                                <View style={styles.summaryInfoCard}>
                                    <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '900', textTransform: 'capitalize' }}>
                                        {isWalk ? '🚶' : '🏃'}  {activityType}
                                    </Text>
                                    <Text style={{ color: '#9ca3af', fontSize: 12, fontWeight: '700', marginTop: 4 }}>
                                        {new Date().toLocaleDateString('en-US', {
                                            weekday: 'long', month: 'long', day: 'numeric',
                                        })}
                                    </Text>
                                </View>

                                <View style={styles.summaryStatsRow}>
                                    <View style={styles.summaryStatItem}>
                                        <Text style={styles.summaryStatValue}>{formatDuration(duration)}</Text>
                                        <Text style={styles.summaryStatLabel}>duration</Text>
                                    </View>
                                    <View style={styles.summaryStatItem}>
                                        <Text style={styles.summaryStatValue}>{distance.toFixed(2)}</Text>
                                        <Text style={styles.summaryStatLabel}>miles</Text>
                                    </View>
                                </View>
                                <View style={styles.summaryStatsRow}>
                                    <View style={styles.summaryStatItem}>
                                        <Text style={[styles.summaryStatValue, { color: '#10b981' }]}>
                                            {Math.round(elevationGain * 3.281)}
                                        </Text>
                                        <Text style={styles.summaryStatLabel}>↑ elev ft</Text>
                                    </View>
                                    <View style={styles.summaryStatItem}>
                                        <Text style={[styles.summaryStatValue, { color: '#f87171' }]}>
                                            {Math.round(elevationLoss * 3.281)}
                                        </Text>
                                        <Text style={styles.summaryStatLabel}>↓ elev ft</Text>
                                    </View>
                                </View>

                                <TouchableOpacity style={styles.saveButton} onPress={saveActivity}>
                                    <Text style={styles.saveButtonText}>Save Activity</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.discardButton} onPress={discardActivity}>
                                    <Text style={styles.discardButtonText}>Discard</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </View>
            )}

            {/* ===== LOCATION ERROR ===== */}
            {locationError && (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{locationError}</Text>
                </View>
            )}

            {/* ===== CENTER BUTTON ===== */}
            {location && mode !== 'summary' && mode !== 'result' && (
                <TouchableOpacity
                    style={[styles.centerButton,
                        (mode === 'tracking' || mode === 'paused') && { bottom: 100 }]}
                    onPress={handleCenterOnUser}
                >
                    <View style={styles.centerButtonInner}>
                        <View style={styles.centerButtonDot} />
                    </View>
                </TouchableOpacity>
            )}

            {/* ===== EXPLORE BOTTOM — "Start Activity" button ===== */}
            {mode === 'explore' && (
                <View style={styles.exploreBottom}>
                    <TouchableOpacity
                        style={styles.startActivityButton}
                        onPress={() => setMode('select')}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.startActivityText}>Start Activity</Text>
                    </TouchableOpacity>
                </View>
            )}

{/* ===== TRACKING BOTTOM CONTROLS ===== */}
            {mode === 'tracking' && (
                <View style={styles.bottomControls}>
                    <TouchableOpacity style={styles.ctrlPause} onPress={pauseTracking}>
                        <View style={styles.ctrlContent}>
                            <HexPauseIcon size={28} color="#ffffff" />
                            <Text style={styles.ctrlText}>Pause</Text>
                        </View>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.ctrlStop} onPress={stopTracking}>
                        <View style={styles.ctrlContent}>
                            <HexStopIcon size={28} color="#ffffff" />
                            <Text style={styles.ctrlText}>Stop</Text>
                        </View>
                    </TouchableOpacity>
                </View>
            )}

            {/* ===== PAUSED BOTTOM CONTROLS ===== */}
            {mode === 'paused' && (
                <View style={styles.bottomControls}>
                    <TouchableOpacity
                        style={[styles.ctrlPause, { backgroundColor: accentColor }]}
                        onPress={resumeTracking}
                    >
                        <View style={styles.ctrlContent}>
                            <HexPlayIcon size={28} color="#ffffff" />
                            <Text style={styles.ctrlText}>Resume</Text>
                        </View>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.ctrlStop} onPress={stopTracking}>
                        <View style={styles.ctrlContent}>
                            <HexStopIcon size={28} color="#ffffff" />
                            <Text style={styles.ctrlText}>Stop</Text>
                        </View>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}

// ========== STYLES ==========
const styles = {
    container: { flex: 1, backgroundColor: '#030712' },
    fullScreen: { flex: 1, backgroundColor: '#030712' },
    loadingContainer: { flex: 1, backgroundColor: '#030712', justifyContent: 'center', alignItems: 'center' },
    loadingText: { color: '#10b981', fontSize: 14, fontWeight: '700', marginTop: 12 },
    map: { flex: 1 },

    // ===== SELECT MODE =====
    selectContent: { paddingHorizontal: 20, paddingTop: 64, paddingBottom: 40 },
    selectTitle: { color: '#ffffff', fontSize: 32, fontWeight: '900', marginBottom: 4 },
    selectSubtitle: { color: '#d1d5db', fontSize: 14, fontWeight: '700', marginBottom: 24 },
    cardRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
    activityCard: {
        flex: 1, borderWidth: 2, borderColor: '#1f2937', backgroundColor: '#111827',
        borderRadius: 20, minHeight: 200, overflow: 'hidden', position: 'relative',
    },
    pulseCircle: {
        position: 'absolute', top: '50%', left: '50%',
        width: 120, height: 120, borderRadius: 60,
        marginTop: -60, marginLeft: -60,
    },
    cardContent: { padding: 20, flex: 1, gap: 8, zIndex: 1 },
    cardTitle: { color: '#ffffff', fontSize: 20, fontWeight: '900' },
    cardDesc: { color: '#d1d5db', fontSize: 12, fontWeight: '700', lineHeight: 18 },
    selectedBadge: { fontSize: 10, fontWeight: '900', letterSpacing: 2, marginTop: 'auto' },
    taglineCard: {
        borderWidth: 1, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16,
        alignItems: 'center', marginBottom: 16,
    },
    taglineText: { fontSize: 14, fontWeight: '900', textAlign: 'center' },
    rulesCard: {
        backgroundColor: '#111827', borderWidth: 1, borderColor: '#1f2937',
        borderRadius: 20, padding: 20, marginBottom: 24, gap: 8,
    },
    rulesTitle: { color: '#d1d5db', fontSize: 13, fontWeight: '900', letterSpacing: 1 },
    rulesText: { color: '#9ca3af', fontSize: 13, fontWeight: '700' },
    bigStartButton: { borderRadius: 20, paddingVertical: 20, alignItems: 'center', marginBottom: 16 },
    bigStartButtonText: { color: '#ffffff', fontSize: 20, fontWeight: '900' },
    backLink: { alignItems: 'center' },
    backLinkText: { color: '#9ca3af', fontSize: 14, fontWeight: '700' },

    // ===== LEGEND =====
    legendContainer: { position: 'absolute', top: 56, left: 16, right: 16 },
    legendCard: {
        backgroundColor: 'rgba(17, 24, 39, 0.9)', borderRadius: 12,
        paddingVertical: 8, paddingHorizontal: 14,
        flexDirection: 'row', justifyContent: 'center', gap: 20,
        borderWidth: 1, borderColor: '#1f2937',
    },
    legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendDot: { width: 10, height: 10, borderRadius: 2 },
    legendText: { color: '#d1d5db', fontSize: 12, fontWeight: '700' },

    // ===== TRACKING OVERLAY =====
    trackingOverlay: { position: 'absolute', top: 48, left: 12, right: 12 },
    trackingCard: {
        backgroundColor: 'rgba(17, 24, 39, 0.95)', borderRadius: 20,
        padding: 16, borderWidth: 1, borderColor: '#1f2937',
    },
    pausedBanner: {
        backgroundColor: 'rgba(245, 158, 11, 0.15)', borderRadius: 8,
        paddingVertical: 6, marginBottom: 10, alignItems: 'center',
    },
    pausedText: { color: '#f59e0b', fontSize: 13, fontWeight: '900', letterSpacing: 1 },
    trackingBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
    gpsDot: { width: 8, height: 8, borderRadius: 4 },
    trackingBadgeText: { fontSize: 11, fontWeight: '900', letterSpacing: 2 },
    bigTimer: { color: '#ffffff', fontSize: 48, fontWeight: '900', letterSpacing: -1 },
    trackingStatsRow: { flexDirection: 'row', marginTop: 12, alignItems: 'center' },
    trackingStat: { flex: 1, alignItems: 'center' },
    trackingStatValue: { color: '#ffffff', fontSize: 18, fontWeight: '900' },
    trackingStatLabel: { color: '#6b7280', fontSize: 10, fontWeight: '700', marginTop: 2 },
    trackingStatDivider: { width: 1, height: 28 },

    // ===== BOTTOM CONTROLS =====
    exploreBottom: { position: 'absolute', bottom: 24, left: 16, right: 16 },
    startActivityButton: {
        backgroundColor: '#10b981', borderRadius: 20,
        paddingVertical: 18, alignItems: 'center',
    },
    startActivityText: { color: '#ffffff', fontSize: 18, fontWeight: '900' },
    bottomControls: {
        position: 'absolute', bottom: 24, left: 16, right: 16,
        flexDirection: 'row', gap: 12,
    },
    ctrlPause: {
        flex: 1, backgroundColor: '#f59e0b', borderRadius: 18,
        paddingVertical: 18, alignItems: 'center',
    },
    ctrlStop: {
        flex: 1, backgroundColor: '#ef4444', borderRadius: 18,
        paddingVertical: 18, alignItems: 'center',
    },
    ctrlContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    ctrlText: { color: '#ffffff', fontSize: 16, fontWeight: '900' },

    // ===== SUMMARY =====
    summaryOverlay: {
        position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
        backgroundColor: 'rgba(3, 7, 18, 0.9)', justifyContent: 'center', paddingHorizontal: 20,
    },
    summaryCard: {
        backgroundColor: '#111827', borderRadius: 24, padding: 24,
        borderWidth: 1, borderColor: '#1f2937',
    },
    summaryTitle: { color: '#ffffff', fontSize: 24, fontWeight: '900', marginBottom: 4 },
    summarySubtitle: { color: '#9ca3af', fontSize: 13, fontWeight: '700', marginBottom: 20 },
    summaryInfoCard: {
        backgroundColor: '#1f2937', borderRadius: 14, padding: 16, marginBottom: 20,
    },
    summaryStatsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 24 },
    summaryStatItem: { alignItems: 'center' },
    summaryStatValue: { color: '#ffffff', fontSize: 24, fontWeight: '900' },
    summaryStatLabel: { color: '#6b7280', fontSize: 11, fontWeight: '700', marginTop: 4 },
    saveButton: { backgroundColor: '#10b981', borderRadius: 16, paddingVertical: 18, alignItems: 'center', marginBottom: 10 },
    saveButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '900' },
    discardButton: { borderWidth: 1, borderColor: '#1f2937', borderRadius: 16, paddingVertical: 14, alignItems: 'center' },
    discardButtonText: { color: '#9ca3af', fontSize: 14, fontWeight: '700' },

    // ===== RESULT =====
    resultContent: { paddingHorizontal: 20, paddingTop: 80, paddingBottom: 40, alignItems: 'center' },
    resultEmoji: { fontSize: 56, marginBottom: 12 },
    resultTitle: { color: '#ffffff', fontSize: 28, fontWeight: '900', marginBottom: 4 },
    resultSubtitle: { color: '#6b7280', fontSize: 13, fontWeight: '700', marginBottom: 24 },
    resultCard: {
        backgroundColor: '#111827', borderRadius: 20, padding: 24,
        borderWidth: 1, borderColor: '#1f2937', width: '100%', marginBottom: 16,
    },
    resultGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    resultStatItem: { width: '50%', alignItems: 'center', marginBottom: 16 },
    resultStatValue: { color: '#ffffff', fontSize: 22, fontWeight: '900' },
    resultStatLabel: { color: '#6b7280', fontSize: 11, fontWeight: '700', marginTop: 4 },
    resultCalories: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        borderTopWidth: 1, borderTopColor: '#1f2937', paddingTop: 12,
    },
    achievementsSection: { width: '100%', marginBottom: 16 },
    achievementsLabel: { color: '#10b981', fontSize: 13, fontWeight: '900', letterSpacing: 1, marginBottom: 8 },
    achievementItem: {
        backgroundColor: 'rgba(16,185,129,0.1)', borderWidth: 1,
        borderColor: 'rgba(16,185,129,0.3)', borderRadius: 14, padding: 14, marginBottom: 8,
    },
    achievementName: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
    achievementDesc: { color: '#9ca3af', fontSize: 12, fontWeight: '700', marginTop: 4 },
    achievementRarity: { color: '#10b981', fontSize: 10, fontWeight: '700', marginTop: 6, letterSpacing: 1 },
    milestoneCard: {
        backgroundColor: 'rgba(59,130,246,0.1)', borderWidth: 1,
        borderColor: 'rgba(59,130,246,0.3)', borderRadius: 14, padding: 14,
        width: '100%', marginBottom: 16,
    },
    milestoneText: { color: '#93c5fd', fontSize: 13, fontWeight: '700' },
    doneButton: { backgroundColor: '#10b981', borderRadius: 16, paddingVertical: 18, alignItems: 'center', width: '100%' },
    doneButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '900' },

    // ===== ERROR + CENTER =====
    errorContainer: {
        position: 'absolute', top: 100, left: 16, right: 16,
        backgroundColor: 'rgba(234,179,8,0.15)', borderWidth: 1,
        borderColor: 'rgba(234,179,8,0.3)', borderRadius: 12, padding: 12,
    },
    errorText: { color: '#facc15', fontSize: 12, fontWeight: '700', textAlign: 'center' },
    centerButton: {
        position: 'absolute', bottom: 100, right: 16,
        width: 48, height: 48, borderRadius: 24,
        backgroundColor: 'rgba(17, 24, 39, 0.9)',
        borderWidth: 1, borderColor: '#1f2937',
        justifyContent: 'center', alignItems: 'center',
    },
    centerButtonInner: {
        width: 20, height: 20, borderRadius: 10,
        borderWidth: 2, borderColor: '#10b981',
        justifyContent: 'center', alignItems: 'center',
    },
    centerButtonDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' },
    locationDotOuter: {
        width: 24, height: 24, borderRadius: 12,
        backgroundColor: 'rgba(16, 185, 129, 0.25)',
        justifyContent: 'center', alignItems: 'center',
    },
    locationDotInner: {
        width: 12, height: 12, borderRadius: 6,
        backgroundColor: '#10b981', borderWidth: 2, borderColor: '#ffffff',
    },
};
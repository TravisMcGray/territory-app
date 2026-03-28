import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import MapView, { Polygon, Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { useAuth } from '../../context/AuthContext';
import { getTerritories } from '../../services/api';

const DEFAULT_ZOOM_DELTA = 0.008;

const COLOR_MINE_FILL = 'rgba(16, 185, 129, 0.45)';
const COLOR_MINE_STROKE = '#10b981';
const COLOR_OTHERS_FILL = 'rgba(168, 85, 247, 0.35)';
const COLOR_OTHERS_STROKE = '#a855f7';

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

export default function MapScreen() {
    const { user } = useAuth();
    const currentUserId = (user?.id ?? user?._id)?.toString();
    const mapRef = useRef(null);

    const [location, setLocation] = useState(null);
    const [territories, setTerritories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [locationError, setLocationError] = useState(null);
    const [tileCount, setTileCount] = useState({ mine: 0, total: 0 });

    // ========== REQUEST LOCATION ==========
    useEffect(() => {
        const getLocation = async () => {
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
            } catch (err) {
                setLocationError('Could not get your location.');
            } finally {
                setLoading(false);
            }
        };
        getLocation();
    }, []);

    // ========== LOAD TERRITORIES ==========
    useEffect(() => {
        const loadTerritories = async () => {
            try {
                const res = await getTerritories();
                const terrs = res.data.territories || [];
                console.log('TERRITORIES LOADED:', terrs.length, 'has polygon:', terrs[0]?.polygon ? 'YES' : 'NO');
                setTerritories(terrs);

                let mine = 0;
                terrs.forEach(t => {
                    if (t.owner?.id?.toString() === currentUserId) mine++;
                });
                setTileCount({ mine, total: terrs.length });
            } catch (err) {
                console.error('Failed to load territories:', err);
            }
        };
        loadTerritories();
    }, [currentUserId]);

    // ========== CENTER ON USER ==========
    const handleCenterOnUser = useCallback(() => {
        if (!location || !mapRef.current) return;
        mapRef.current.animateToRegion({
            latitude: location.latitude,
            longitude: location.longitude,
            latitudeDelta: DEFAULT_ZOOM_DELTA,
            longitudeDelta: DEFAULT_ZOOM_DELTA,
        }, 500);
    }, [location]);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#10b981" />
                <Text style={styles.loadingText}>Finding your location...</Text>
            </View>
        );
    }

    const initialRegion = location ? {
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: DEFAULT_ZOOM_DELTA,
        longitudeDelta: DEFAULT_ZOOM_DELTA,
    } : {
        latitude: 27.9506,
        longitude: -82.4572,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
    };

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
                {/* ===== CAPTURED TERRITORIES ===== */}
                {territories.map(territory => {
                    if (!territory.polygon) return null;
                    const isMine = territory.owner?.id?.toString() === currentUserId;

                    return (
                        <Polygon
                            key={territory.hexagonId}
                            coordinates={territory.polygon}
                            fillColor={isMine ? COLOR_MINE_FILL : COLOR_OTHERS_FILL}
                            strokeColor={isMine ? COLOR_MINE_STROKE : COLOR_OTHERS_STROKE}
                            strokeWidth={1.5}
                            tappable={true}
                            onPress={() => {
                                const label = territory.activityType === 'WALK' ? '🚶 Walk' : '🏃 Run';
                                const date = territory.capturedAt
                                    ? new Date(territory.capturedAt).toLocaleDateString('en-US', {
                                        month: 'short', day: 'numeric', year: 'numeric',
                                    }) : 'Unknown';
                                Alert.alert(
                                    territory.owner?.username ?? 'Unknown',
                                    `${label}\nCaptured ${date}`
                                );
                            }}
                        />
                    );
                })}

                {/* ===== LOCATION DOT ===== */}
                {location && (
                    <Marker
                        coordinate={{
                            latitude: location.latitude,
                            longitude: location.longitude,
                        }}
                        anchor={{ x: 0.5, y: 0.5 }}
                    >
                        <View style={styles.locationDotOuter}>
                            <View style={styles.locationDotInner} />
                        </View>
                    </Marker>
                )}
            </MapView>

            {/* ===== LEGEND ===== */}
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

            {/* ===== LOCATION ERROR ===== */}
            {locationError && (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{locationError}</Text>
                </View>
            )}

            {/* ===== CENTER BUTTON ===== */}
            {location && (
                <TouchableOpacity style={styles.centerButton} onPress={handleCenterOnUser}>
                    <View style={styles.centerButtonInner}>
                        <View style={styles.centerButtonDot} />
                    </View>
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = {
    container: { flex: 1, backgroundColor: '#030712' },
    loadingContainer: { flex: 1, backgroundColor: '#030712', justifyContent: 'center', alignItems: 'center' },
    loadingText: { color: '#10b981', fontSize: 14, fontWeight: '700', marginTop: 12 },
    map: { flex: 1 },
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
    errorContainer: {
        position: 'absolute', top: 100, left: 16, right: 16,
        backgroundColor: 'rgba(234,179,8,0.15)', borderWidth: 1,
        borderColor: 'rgba(234,179,8,0.3)', borderRadius: 12, padding: 12,
    },
    errorText: { color: '#facc15', fontSize: 12, fontWeight: '700', textAlign: 'center' },
    centerButton: {
        position: 'absolute', bottom: 24, right: 16,
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
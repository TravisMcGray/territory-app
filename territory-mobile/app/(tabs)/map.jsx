import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';

const DEFAULT_ZOOM_DELTA = 0.008;

export default function MapScreen() {
    const mapRef = useRef(null);
    const [location, setLocation] = useState(null);
    const [loading, setLoading] = useState(true);
    const [locationError, setLocationError] = useState(null);

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
            <View style={{ flex: 1, backgroundColor: '#030712', justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#10b981" />
                <Text style={{ color: '#10b981', fontSize: 14, fontWeight: '700', marginTop: 12 }}>
                    Finding your location...
                </Text>
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
        <View style={{ flex: 1, backgroundColor: '#030712' }}>
            <MapView
                ref={mapRef}
                style={{ flex: 1 }}
                initialRegion={initialRegion}
                showsUserLocation={true}
                showsMyLocationButton={false}
            />

            {locationError && (
                <View style={{ position: 'absolute', top: 56, left: 16, right: 16, backgroundColor: 'rgba(234,179,8,0.15)', borderWidth: 1, borderColor: 'rgba(234,179,8,0.3)', borderRadius: 12, padding: 12 }}>
                    <Text style={{ color: '#facc15', fontSize: 12, fontWeight: '700', textAlign: 'center' }}>{locationError}</Text>
                </View>
            )}

            {location && (
                <TouchableOpacity
                    style={{ position: 'absolute', bottom: 24, right: 16, width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(17,24,39,0.9)', borderWidth: 1, borderColor: '#1f2937', justifyContent: 'center', alignItems: 'center' }}
                    onPress={handleCenterOnUser}
                >
                    <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#10b981', justifyContent: 'center', alignItems: 'center' }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' }} />
                    </View>
                </TouchableOpacity>
            )}
        </View>
    );
}
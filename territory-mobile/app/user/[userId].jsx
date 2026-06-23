// ========== OTHER USER PROFILE ==========
// Shows another user's public profile, their activity list,
// and a tappable full-detail activity card with route map snapshot.

import { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MapView, { Polyline } from 'react-native-maps';
import { useAuth } from '../../context/AuthContext';
import { getUserById, getUserActivities, followUser, unfollowUser, getActivity } from '../../services/api';
import HexBackground from '../../components/HexBackground';

// ========== HELPERS ==========
const timeAgo = (dateString) => {
    const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatDuration = (seconds) => {
    if (!seconds) return '0m';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
};

const formatPace = (miles, seconds) => {
    if (!miles || !seconds || miles <= 0) return '--:--';
    const paceSeconds = seconds / miles;
    const paceMin = Math.floor(paceSeconds / 60);
    const paceSec = Math.floor(paceSeconds % 60);
    return `${paceMin}:${String(paceSec).padStart(2, '0')}`;
};

const hexCount = (capturedHexagons) => {
    if (typeof capturedHexagons === 'number') return capturedHexagons;
    if (Array.isArray(capturedHexagons)) return capturedHexagons.length;
    return 0;
};

// Calculates a map region that fits all coordinates with padding
const getBoundingRegion = (coords) => {
    if (!coords || coords.length === 0) return null;
    const lats = coords.map(c => c.latitude);
    const lngs = coords.map(c => c.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const latPad = Math.max((maxLat - minLat) * 0.3, 0.004);
    const lngPad = Math.max((maxLng - minLng) * 0.3, 0.004);
    return {
        latitude: (minLat + maxLat) / 2,
        longitude: (minLng + maxLng) / 2,
        latitudeDelta: (maxLat - minLat) + latPad,
        longitudeDelta: (maxLng - minLng) + lngPad,
    };
};

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
    { featureType: 'road.local', elementType: 'labels', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9e8f5' }] },
    { featureType: 'water', elementType: 'labels', stylers: [{ visibility: 'off' }] },
];

// ========== MAIN COMPONENT ==========
export default function UserProfile() {
    const router = useRouter();
    const { userId } = useLocalSearchParams();
    const { user: currentUser } = useAuth();
    const currentUserId = (currentUser?.id ?? currentUser?._id)?.toString();

    const [profile, setProfile] = useState(null);
    const [activities, setActivities] = useState([]);
    const [followersCount, setFollowersCount] = useState(0);
    const [followingCount, setFollowingCount] = useState(0);
    const [isFollowing, setIsFollowing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [followLoading, setFollowLoading] = useState(false);
    const [selectedActivity, setSelectedActivity] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);

    // Redirect to own profile tab if somehow navigating to own ID
    useEffect(() => {
        if (userId && String(userId) === currentUserId) {
            router.replace('/(tabs)/profile');
        }
    }, [userId, currentUserId]);

    // Load profile and activities. Activities are fetched separately so a
    // missing backend endpoint doesn't prevent the profile from rendering.
    useEffect(() => {
        const load = async () => {
            try {
                const profileRes = await getUserById(userId);
                const userData = profileRes.data.user;
                const relationship = profileRes.data.relationshipStatus;
                setProfile(userData);
                setFollowersCount(userData.followers ?? 0);
                setFollowingCount(userData.following ?? 0);
                setIsFollowing(relationship?.isFollowing ?? false);
            } catch (err) {
                console.error('Profile load error:', err);
            } finally {
                setLoading(false);
            }

            try {
                const activitiesRes = await getUserActivities(userId);
                setActivities(activitiesRes.data.activities || []);
            } catch (err) {
                // Endpoint not yet available, so activities section shows empty state
            }
        };
        if (userId) load();
    }, [userId]);

    // Tap an activity row to fetch full detail (includes coordinates + elevation)
    const handleActivityPress = async (activity) => {
        setDetailLoading(true);
        setSelectedActivity({ ...activity, _loading: true });
        try {
            const res = await getActivity(activity._id);
            setSelectedActivity(res.data.activity ?? res.data);
        } catch (err) {
            // Fall back to list data if detail fetch fails
            setSelectedActivity(activity);
        } finally {
            setDetailLoading(false);
        }
    };

    // Follow toggle
    const handleFollowToggle = async () => {
        setFollowLoading(true);
        try {
            if (isFollowing) {
                await unfollowUser(userId);
                setIsFollowing(false);
                setFollowersCount(prev => Math.max(0, prev - 1));
            } else {
                await followUser(userId);
                setIsFollowing(true);
                setFollowersCount(prev => prev + 1);
            }
        } catch (err) {}
        finally { setFollowLoading(false); }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#10b981" />
            </View>
        );
    }

    if (!profile) {
        return (
            <View style={styles.loadingContainer}>
                <Text style={{ color: '#f87171', fontSize: 16, fontWeight: '700' }}>
                    Profile not found
                </Text>
                <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
                    <Text style={{ color: '#10b981', fontWeight: '700' }}>← Go back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const stats = profile.stats || {};

    return (
        <View style={styles.container}>
            <HexBackground />
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>

                {/* Back button */}
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Text style={styles.backText}>← Back</Text>
                </TouchableOpacity>

                {/* ===== PROFILE HEADER ===== */}
                <View style={styles.headerCard}>
                    <View style={styles.headerTop}>
                        <View style={styles.headerUser}>
                            <View style={styles.avatarLarge}>
                                <Text style={styles.avatarText}>
                                    {profile.username?.[0]?.toUpperCase() ?? '?'}
                                </Text>
                            </View>
                            <View>
                                <Text style={styles.usernameText}>{profile.username}</Text>
                                <Text style={styles.memberSince}>
                                    Member since {new Date(profile.createdAt).toLocaleDateString('en-US', {
                                        month: 'long', year: 'numeric',
                                    })}
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            onPress={handleFollowToggle}
                            disabled={followLoading}
                            style={[styles.followButton, isFollowing && styles.followButtonFollowing]}
                        >
                            <Text style={[styles.followButtonText, isFollowing && styles.followButtonTextFollowing]}>
                                {followLoading ? '...' : isFollowing ? 'Following' : 'Follow'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Stats grid */}
                    <View style={styles.statsGrid}>
                        <StatItem label="Followers" value={followersCount} />
                        <StatItem label="Following" value={followingCount} />
                        <StatItem label="Hexagons" value={stats.totalHexagonsCaptured ?? 0} color="#10b981" />
                        <StatItem label="Miles" value={(stats.totalDistance ?? 0).toFixed(1)} color="#60a5fa" />
                        <StatItem label="Activities" value={(stats.totalWalks ?? 0) + (stats.totalRuns ?? 0)} color="#a78bfa" />
                        <StatItem label="Stolen" value={stats.totalStolenTerritories ?? 0} color="#f87171" />
                    </View>
                </View>

                {/* ===== ACTIVITIES ===== */}
                <View style={styles.sectionCard}>
                    <Text style={styles.sectionTitle}>Activities</Text>

                    {activities.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>No activities yet.</Text>
                        </View>
                    ) : (
                        activities.map(activity => (
                            <ActivityRow
                                key={activity._id}
                                activity={activity}
                                onPress={() => handleActivityPress(activity)}
                            />
                        ))
                    )}
                </View>

                <View style={{ height: 20 }} />
            </ScrollView>

            {/* ===== ACTIVITY DETAIL MODAL ===== */}
            <ActivityDetailModal
                activity={selectedActivity}
                loading={detailLoading}
                onClose={() => setSelectedActivity(null)}
            />
        </View>
    );
}

// ========== ACTIVITY ROW ==========
function ActivityRow({ activity, onPress }) {
    const isWalk = activity.activityType === 'walk';
    const hex = hexCount(activity.capturedHexagons);
    const duration = formatDuration(activity.duration);

    return (
        <TouchableOpacity style={styles.activityRow} onPress={onPress} activeOpacity={0.75}>
            <View style={[styles.activityIcon, {
                backgroundColor: isWalk ? 'rgba(59,130,246,0.2)' : 'rgba(16,185,129,0.2)'
            }]}>
                <Text style={{ fontSize: 18 }}>{isWalk ? '🚶' : '🏃'}</Text>
            </View>
            <View style={{ flex: 1 }}>
                <Text style={styles.activityType}>
                    {isWalk ? 'Walk' : 'Run'}
                </Text>
                <Text style={styles.activityStats}>
                    {(activity.distance ?? 0).toFixed(2)}mi · {duration} · {hex} hex
                </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.activityDate}>{timeAgo(activity.createdAt)}</Text>
                <Text style={styles.activityChevron}>›</Text>
            </View>
        </TouchableOpacity>
    );
}

// ========== ACTIVITY DETAIL MODAL ==========
function ActivityDetailModal({ activity, loading, onClose }) {
    if (!activity) return null;

    const isWalk = activity.activityType === 'walk';
    const accentColor = isWalk ? '#3b82f6' : '#10b981';
    const hex = hexCount(activity.capturedHexagons);
    const coordinates = activity.coordinates || [];
    const mapRegion = getBoundingRegion(coordinates);
    const elevGainFt = activity.elevationGain ? Math.round(activity.elevationGain * 3.281) : 0;
    const elevLossFt = activity.elevationLoss ? Math.round(activity.elevationLoss * 3.281) : 0;

    return (
        <Modal
            visible={true}
            transparent={true}
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalCard}>
                    {/* Header */}
                    <View style={styles.modalHeader}>
                        <View style={{ flex: 1 }}>
                            <View style={[styles.modalTypeBadge, { backgroundColor: isWalk ? 'rgba(59,130,246,0.15)' : 'rgba(16,185,129,0.15)' }]}>
                                <Text style={[styles.modalTypeText, { color: accentColor }]}>
                                    {isWalk ? '🚶  Walk' : '🏃  Run'}
                                </Text>
                            </View>
                            <Text style={styles.modalDate}>{timeAgo(activity.createdAt)}</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.modalClose}>
                            <Text style={styles.modalCloseText}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false}>

                        {/* Route Map */}
                        {loading ? (
                            <View style={styles.mapPlaceholder}>
                                <ActivityIndicator color="#10b981" />
                                <Text style={{ color: '#6b7280', fontSize: 12, marginTop: 8 }}>Loading route...</Text>
                            </View>
                        ) : mapRegion && coordinates.length > 1 ? (
                            <View style={styles.mapContainer}>
                                <MapView
                                    style={styles.map}
                                    initialRegion={mapRegion}
                                    customMapStyle={LIGHT_MAP_STYLE}
                                    scrollEnabled={false}
                                    zoomEnabled={false}
                                    rotateEnabled={false}
                                    pitchEnabled={false}
                                    showsUserLocation={false}
                                    showsCompass={false}
                                    showsPointsOfInterest={false}
                                    showsBuildings={false}
                                    showsTraffic={false}
                                >
                                    <Polyline
                                        coordinates={coordinates}
                                        strokeColor={accentColor}
                                        strokeWidth={4}
                                        lineCap="round"
                                        lineJoin="round"
                                    />
                                </MapView>
                                <View style={[styles.mapBadge, { borderColor: accentColor }]}>
                                    <Text style={[styles.mapBadgeText, { color: accentColor }]}>Route</Text>
                                </View>
                            </View>
                        ) : (
                            <View style={styles.mapPlaceholder}>
                                <Text style={{ fontSize: 28 }}>🗺️</Text>
                                <Text style={{ color: '#4b5563', fontSize: 12, marginTop: 6 }}>Route not available</Text>
                            </View>
                        )}

                        {/* Primary Stats */}
                        <View style={styles.statsBlock}>
                            <View style={styles.statRow}>
                                <DetailStat
                                    label="Distance"
                                    value={`${(activity.distance ?? 0).toFixed(2)}`}
                                    unit="miles"
                                    color="#60a5fa"
                                />
                                <View style={styles.statDivider} />
                                <DetailStat
                                    label="Duration"
                                    value={formatDuration(activity.duration)}
                                    unit="total time"
                                    color="#ffffff"
                                />
                            </View>
                            <View style={styles.statRowDivider} />
                            <View style={styles.statRow}>
                                <DetailStat
                                    label="Pace"
                                    value={formatPace(activity.distance, activity.duration)}
                                    unit="min / mile"
                                    color={accentColor}
                                />
                                <View style={styles.statDivider} />
                                <DetailStat
                                    label="Calories"
                                    value={`${activity.estimatedCalories ?? 0}`}
                                    unit="kcal burned"
                                    color="#f59e0b"
                                />
                            </View>
                        </View>

                        {/* Elevation */}
                        <View style={styles.elevationBlock}>
                            <Text style={styles.elevationTitle}>ELEVATION</Text>
                            <View style={styles.statRow}>
                                <DetailStat
                                    label="Gain"
                                    value={`${elevGainFt}`}
                                    unit="feet ↑"
                                    color="#34d399"
                                />
                                <View style={styles.statDivider} />
                                <DetailStat
                                    label="Loss"
                                    value={`${elevLossFt}`}
                                    unit="feet ↓"
                                    color="#f87171"
                                />
                            </View>
                        </View>

                        {/* Territory */}
                        <View style={styles.territoryBlock}>
                            <Text style={styles.elevationTitle}>TERRITORY</Text>
                            <View style={styles.statRow}>
                                <DetailStat
                                    label="Captured"
                                    value={`${hex}`}
                                    unit="hexagons"
                                    color="#10b981"
                                />
                                <View style={styles.statDivider} />
                                <DetailStat
                                    label="Stolen"
                                    value={`${activity.stolenHexagons ?? 0}`}
                                    unit="hexagons"
                                    color={activity.stolenHexagons > 0 ? '#f87171' : '#4b5563'}
                                />
                            </View>
                        </View>

                        {/* Social */}
                        <View style={styles.socialBlock}>
                            <View style={styles.socialItem}>
                                <Text style={styles.socialIcon}>⚡</Text>
                                <Text style={styles.socialValue}>{activity.kudosCount ?? 0}</Text>
                                <Text style={styles.socialLabel}>kudos</Text>
                            </View>
                            <View style={styles.socialItem}>
                                <Text style={styles.socialIcon}>💬</Text>
                                <Text style={styles.socialValue}>{activity.commentCount ?? 0}</Text>
                                <Text style={styles.socialLabel}>comments</Text>
                            </View>
                        </View>

                        <View style={{ height: 16 }} />
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

// ========== DETAIL STAT CELL ==========
function DetailStat({ label, value, unit, color }) {
    return (
        <View style={styles.detailStat}>
            <Text style={styles.detailStatLabel}>{label}</Text>
            <Text style={[styles.detailStatValue, { color }]}>{value}</Text>
            <Text style={styles.detailStatUnit}>{unit}</Text>
        </View>
    );
}

// ========== STAT ITEM ==========
function StatItem({ label, value, color = '#ffffff' }) {
    return (
        <View style={styles.statItem}>
            <Text style={[styles.statItemValue, { color }]}>{value}</Text>
            <Text style={styles.statItemLabel}>{label}</Text>
        </View>
    );
}

// ========== STYLES ==========
const styles = {
    container: { flex: 1, backgroundColor: '#030712' },
    loadingContainer: { flex: 1, backgroundColor: '#030712', justifyContent: 'center', alignItems: 'center' },
    scrollView: { flex: 1, zIndex: 1 },
    scrollContent: { paddingHorizontal: 16, paddingTop: 56, paddingBottom: 20 },

    backButton: { marginBottom: 16 },
    backText: { color: '#10b981', fontSize: 14, fontWeight: '700' },

    // Profile header
    headerCard: { backgroundColor: '#111827', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#1f2937', marginBottom: 16 },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    headerUser: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatarLarge: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#1f2937', borderWidth: 1, borderColor: '#374151', alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: '#10b981', fontSize: 20, fontWeight: '900' },
    usernameText: { color: '#ffffff', fontSize: 18, fontWeight: '900' },
    memberSince: { color: '#9ca3af', fontSize: 12, fontWeight: '700', marginTop: 2 },
    followButton: { backgroundColor: '#10b981', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
    followButtonFollowing: { backgroundColor: '#1f2937' },
    followButtonText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
    followButtonTextFollowing: { color: '#9ca3af' },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#1f2937' },
    statItem: { width: '33.33%', alignItems: 'center', marginBottom: 12 },
    statItemValue: { fontSize: 18, fontWeight: '900' },
    statItemLabel: { color: '#9ca3af', fontSize: 10, fontWeight: '700', marginTop: 2 },

    // Activities section
    sectionCard: { backgroundColor: '#111827', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#1f2937' },
    sectionTitle: { color: '#ffffff', fontSize: 16, fontWeight: '900', marginBottom: 16 },
    emptyState: { paddingVertical: 24, alignItems: 'center' },
    emptyText: { color: '#6b7280', fontSize: 13, fontWeight: '700' },

    // Activity row
    activityRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1f2937' },
    activityIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    activityType: { color: '#ffffff', fontSize: 14, fontWeight: '700', textTransform: 'capitalize' },
    activityStats: { color: '#6b7280', fontSize: 12, marginTop: 2 },
    activityDate: { color: '#4b5563', fontSize: 11, fontWeight: '700' },
    activityChevron: { color: '#374151', fontSize: 22, lineHeight: 24 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(3,7,18,0.85)', justifyContent: 'flex-end' },
    modalCard: {
        backgroundColor: '#111827',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        borderWidth: 1,
        borderColor: '#1f2937',
        maxHeight: '90%',
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    modalHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
    modalTypeBadge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginBottom: 4 },
    modalTypeText: { fontSize: 14, fontWeight: '900' },
    modalDate: { color: '#6b7280', fontSize: 12, fontWeight: '700' },
    modalClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1f2937', alignItems: 'center', justifyContent: 'center' },
    modalCloseText: { color: '#9ca3af', fontSize: 14, fontWeight: '700' },

    // Route map
    mapContainer: { borderRadius: 16, overflow: 'hidden', marginBottom: 16, position: 'relative' },
    map: { width: '100%', height: 200 },
    mapBadge: {
        position: 'absolute', top: 10, left: 10,
        backgroundColor: '#111827', borderWidth: 1,
        borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
    },
    mapBadgeText: { fontSize: 11, fontWeight: '700' },
    mapPlaceholder: { height: 120, backgroundColor: '#1f2937', borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },

    // Stat blocks
    statsBlock: { backgroundColor: '#1f2937', borderRadius: 16, marginBottom: 10, overflow: 'hidden' },
    elevationBlock: { backgroundColor: '#1f2937', borderRadius: 16, marginBottom: 10, overflow: 'hidden', paddingTop: 12 },
    territoryBlock: { backgroundColor: '#1f2937', borderRadius: 16, marginBottom: 10, overflow: 'hidden', paddingTop: 12 },
    elevationTitle: { color: '#4b5563', fontSize: 10, fontWeight: '900', letterSpacing: 1, paddingHorizontal: 16, marginBottom: 8 },
    statRow: { flexDirection: 'row' },
    statRowDivider: { height: 1, backgroundColor: '#374151' },
    statDivider: { width: 1, backgroundColor: '#374151' },

    // Detail stat cell
    detailStat: { flex: 1, alignItems: 'center', paddingVertical: 16, paddingHorizontal: 8 },
    detailStatLabel: { color: '#6b7280', fontSize: 10, fontWeight: '900', letterSpacing: 0.5, marginBottom: 6 },
    detailStatValue: { fontSize: 26, fontWeight: '900' },
    detailStatUnit: { color: '#4b5563', fontSize: 10, fontWeight: '700', marginTop: 4 },

    // Social
    socialBlock: { flexDirection: 'row', gap: 12, backgroundColor: '#1f2937', borderRadius: 16, padding: 16 },
    socialItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    socialIcon: { fontSize: 16 },
    socialValue: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
    socialLabel: { color: '#6b7280', fontSize: 12 },
};

// ========== DASHBOARD SCREEN ==========
// Main hub after login. Shows stats, recent feed preview, and leaderboard preview.
// Matches web Dashboard.jsx functionality.
// Usernames and leaderboard rows navigate to profile.

import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { getProfile, getFeed, getHexagonLeaderboard, getUnreadCount } from '../../services/api';
import HexBackground from '../../components/HexBackground';
import Svg, { Polygon, Line, Polyline, G } from 'react-native-svg';

// ========== MEDAL HEXAGON ==========
function MedalHex({ rank }) {
    const configs = {
        1: { fill: '#0e0d0d', stroke: '#ffb004', textColor: '#ffffff' },
        2: { fill: '#000000', stroke: '#9daec5', textColor: '#ffffff' },
        3: { fill: '#000000', stroke: '#ad4d11', textColor: '#ffffff' },
    };

    const config = configs[rank];

    if (config) {
        return (
            <View style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
                <Svg width="32" height="32" viewBox="0 0 28 28" fill="none">
                    <Polygon
                        points="2,14 8,3 20,3 26,14 20,25 8,25"
                        fill={config.fill}
                        stroke={config.stroke}
                        strokeWidth="2"
                    />
                </Svg>
                <Text style={{
                    position: 'absolute',
                    color: config.textColor,
                    fontSize: 12,
                    fontWeight: '700',
                }}>{rank}</Text>
            </View>
        );
    }

    return (
        <View style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <Polygon
                    points="2,14 8,3 20,3 26,14 20,25 8,25"
                    fill="none"
                    stroke="#4b5563"
                    strokeWidth="1.5"
                />
            </Svg>
            <Text style={{
                position: 'absolute',
                color: '#6b7280',
                fontSize: rank > 99 ? 7 : 10,
                fontWeight: '700',
            }}>{rank > 99 ? `#${rank}` : rank}</Text>
        </View>
    );
}

// ========== MAIN COMPONENT ==========
export default function Dashboard() {
    const router = useRouter();
    const { user: currentUser } = useAuth();
    const currentUserId = (currentUser?.id ?? currentUser?._id)?.toString();

    const [profile, setProfile] = useState(null);
    const [feed, setFeed] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);

    // ========== LOAD DATA ==========
    useEffect(() => {
        const loadDashboard = async () => {
            try {
                const [profileRes, feedRes, leaderRes] = await Promise.all([
                    getProfile(),
                    getFeed(),
                    getHexagonLeaderboard(),
                ]);
                setProfile(profileRes.data.profile);
                setFeed(feedRes.data.activities || []);
                setLeaderboard(leaderRes.data.leaderboard || []);
            } catch (err) {
                console.error('Dashboard load error:', err);
            } finally {
                setLoading(false);
            }
        };
        loadDashboard();
    }, []);

    useEffect(() => {
        const loadUnread = async () => {
            try {
                const res = await getUnreadCount();
                setUnreadCount(res.data.unreadCount ?? 0);
            } catch (err) {}
        };
        loadUnread();
    }, []);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#10b981" />
            </View>
        );
    }

    const stats = profile?.stats || {};

    return (
        <View style={styles.container}>
            <HexBackground />
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>

{/* ===== HEADER ===== */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <Text style={styles.logoText}>
                        Hex<Text style={styles.logoAccent}>Capture</Text>
                    </Text>
                    <TouchableOpacity
                        onPress={() => router.push('/notifications')}
                        style={{
                            width: 40, height: 40, borderRadius: 12,
                            backgroundColor: '#111827', borderWidth: 1, borderColor: '#1f2937',
                            alignItems: 'center', justifyContent: 'center',
                        }}
                    >
                        <Text style={{ fontSize: 18 }}>🔔</Text>
                        {unreadCount > 0 && (
                            <View style={{
                                position: 'absolute', top: -4, right: -4,
                                backgroundColor: '#ef4444', borderRadius: 8,
                                minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center',
                                paddingHorizontal: 4,
                            }}>
                                <Text style={{ color: '#ffffff', fontSize: 9, fontWeight: '900' }}>
                                    {unreadCount > 99 ? '99+' : unreadCount}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>

                {/* ===== STATS GRID ===== */}
                <View style={styles.statsRow}>
                    <StatCard label="Hexagons" value={stats.totalHexagonsCaptured ?? 0} color="#10b981" />
                    <StatCard label="Miles" value={`${(stats.totalDistance ?? 0).toFixed(1)}`} color="#60a5fa" />
                </View>
                <View style={styles.statsRow}>
                    <StatCard label="Activities" value={(stats.totalWalks ?? 0) + (stats.totalRuns ?? 0)} color="#a78bfa" />
                    <StatCard label="Stolen" value={stats.totalStolenTerritories ?? 0} color="#f87171" />
                </View>

                {/* ===== RECENT FEED ===== */}
                <View style={styles.sectionCard}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Recent Activity</Text>
                        <TouchableOpacity onPress={() => router.push('/feed')}>
                            <Text style={styles.viewAllText}>View all</Text>
                        </TouchableOpacity>
                    </View>
                    {feed.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>No activity yet.</Text>
                            <Text style={styles.emptySubtext}>Follow people to see their activities here.</Text>
                        </View>
                    ) : (
                        feed.slice(0, 4).map(activity => (
                            <TouchableOpacity
                                key={activity._id}
                                style={styles.feedItem}
                                onPress={() => {
                                    const id = activity.userId?.toString();
                                    if (id === currentUserId) {
                                        router.push('/profile');
                                    } else if (id) {
                                        router.push(`/user/${id}`);
                                    }
                                }}
                            >
                                <View style={[
                                    styles.feedIcon,
                                    { backgroundColor: activity.activityType === 'walk' ? 'rgba(59,130,246,0.2)' : 'rgba(16,185,129,0.2)' }
                                ]}>
                                    <Text style={styles.feedIconText}>
                                        {activity.activityType === 'walk' ? '🚶' : '🏃'}
                                    </Text>
                                </View>
                                <View style={styles.feedContent}>
                                    <Text style={styles.feedUsername}>{activity.username ?? 'Unknown'}</Text>
                                    <Text style={styles.feedStats}>
                                        {(activity.distance ?? 0).toFixed(2)}mi · {
                                            typeof activity.capturedHexagons === 'number'
                                                ? activity.capturedHexagons
                                                : Array.isArray(activity.capturedHexagons)
                                                ? activity.capturedHexagons.length
                                                : 0
                                        } hexagons
                                    </Text>
                                </View>
                                <Text style={styles.feedType}>
                                    {activity.activityType === 'walk' ? 'Walk' : 'Run'}
                                </Text>
                            </TouchableOpacity>
                        ))
                    )}
                </View>

                {/* ===== LEADERBOARD PREVIEW ===== */}
                <View style={styles.sectionCard}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Hexagon Leaderboard</Text>
                        <TouchableOpacity onPress={() => router.push('/leaderboard')}>
                            <Text style={styles.viewAllText}>View all</Text>
                        </TouchableOpacity>
                    </View>
                    {leaderboard.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>No data yet.</Text>
                            <Text style={styles.emptySubtext}>Be the first to capture territory!</Text>
                        </View>
                    ) : (
                        leaderboard.slice(0, 5).map((entry, index) => {
                            const isCurrentUser = String(entry.id) === currentUserId;
                            return (
                                <TouchableOpacity
                                    key={entry.id}
                                    style={[
                                        styles.leaderRow,
                                        isCurrentUser && styles.leaderRowCurrent,
                                    ]}
                                    onPress={() => {
                                        if (isCurrentUser) {
                                            router.push('/profile');
                                        } else {
                                            router.push(`/user/${entry.id}`);
                                        }
                                    }}
                                >
                                    <MedalHex rank={index + 1} />
                                    <Text style={[
                                        styles.leaderUsername,
                                        isCurrentUser && styles.leaderUsernameCurrent,
                                    ]} numberOfLines={1}>
                                        {entry.username}
                                        {isCurrentUser ? '  ' : ''}
                                    </Text>
                                    {isCurrentUser && (
                                        <Text style={styles.youBadge}>you</Text>
                                    )}
                                    <Text style={[
                                        styles.leaderValue,
                                        isCurrentUser && styles.leaderValueCurrent,
                                    ]}>
                                        {entry.hexagons} hex
                                    </Text>
                                </TouchableOpacity>
                            );
                        })
                    )}
                </View>

                {/* Bottom spacing for tab bar */}
                <View style={{ height: 20 }} />
            </ScrollView>
        </View>
    );
}

// ========== STAT CARD ==========
function StatCard({ label, value, color }) {
    return (
        <View style={styles.statCard}>
            <Text style={[styles.statValue, { color }]}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );
}

// ========== STYLES ==========
const styles = {
    container: {
        flex: 1,
        backgroundColor: '#030712',
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: '#030712',
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollView: {
        flex: 1,
        zIndex: 1,
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingTop: 56,
        paddingBottom: 20,
    },
    logoText: {
        fontSize: 22,
        fontWeight: '900',
        color: '#ffffff',
        marginBottom: 20,
    },
    logoAccent: {
        color: '#10b981',
    },
    welcomeCard: {
        backgroundColor: '#111827',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: '#1f2937',
        marginBottom: 16,
    },
    welcomeText: {
        color: '#ffffff',
        fontSize: 20,
        fontWeight: '900',
    },
    usernameText: {
        color: '#10b981',
    },
    subtitle: {
        color: '#9ca3af',
        fontSize: 14,
        fontWeight: '700',
        marginTop: 4,
    },
    statsRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 12,
    },
    statCard: {
        flex: 1,
        backgroundColor: '#111827',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#1f2937',
        alignItems: 'center',
    },
    statValue: {
        fontSize: 24,
        fontWeight: '900',
    },
    statLabel: {
        color: '#9ca3af',
        fontSize: 11,
        fontWeight: '700',
        marginTop: 4,
    },
    sectionCard: {
        backgroundColor: '#111827',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: '#1f2937',
        marginBottom: 16,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '900',
    },
    viewAllText: {
        color: '#10b981',
        fontSize: 13,
        fontWeight: '700',
    },
    emptyState: {
        paddingVertical: 24,
        alignItems: 'center',
    },
    emptyText: {
        color: '#d1d5db',
        fontSize: 14,
        fontWeight: '700',
    },
    emptySubtext: {
        color: '#9ca3af',
        fontSize: 12,
        fontWeight: '700',
        marginTop: 4,
    },
    feedItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#1f2937',
    },
    feedIcon: {
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    feedIconText: {
        fontSize: 16,
    },
    feedContent: {
        flex: 1,
    },
    feedUsername: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '700',
    },
    feedStats: {
        color: '#6b7280',
        fontSize: 11,
        marginTop: 2,
    },
    feedType: {
        color: '#4b5563',
        fontSize: 11,
    },
    leaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 8,
        paddingHorizontal: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'transparent',
        marginBottom: 4,
    },
    leaderRowCurrent: {
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderColor: 'rgba(16, 185, 129, 0.3)',
    },
    leaderUsername: {
        flex: 1,
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '700',
    },
    leaderUsernameCurrent: {
        color: '#10b981',
    },
    youBadge: {
        color: '#facc15',
        fontSize: 11,
        fontWeight: '700',
    },
    leaderValue: {
        color: '#10b981',
        fontSize: 13,
        fontWeight: '700',
    },
    leaderValueCurrent: {
        color: '#10b981',
    },
};
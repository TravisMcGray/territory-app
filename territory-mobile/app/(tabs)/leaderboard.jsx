// ========== LEADERBOARD SCREEN ==========
// Three leaderboard categories: hexagons, distance, activity.
// All data loads at once — tabs switch without refetching.
// Rows navigate to user profiles.
// Matches web Leaderboard.jsx functionality.

import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import {
    getHexagonLeaderboard,
    getDistanceLeaderboard,
    getActivityLeaderboard,
} from '../../services/api';
import HexBackground from '../../components/HexBackground';
import Svg, { Polygon } from 'react-native-svg';

// ========== TAB DEFINITIONS ==========
const TABS = [
    { key: 'hexagons', label: 'Hexagons', description: 'Most territory owned' },
    { key: 'distance', label: 'Distance', description: 'Most miles logged' },
    { key: 'activity', label: 'Activity', description: 'Most activities logged' },
];

// ========== MEDAL HEXAGON ==========
function MedalHex({ rank }) {
    const configs = {
        1: { fill: '#0e0d0d', stroke: '#ffb004', textColor: '#ffffff', scale: 1.3 },
        2: { fill: '#000000', stroke: '#9daec5', textColor: '#ffffff', scale: 1.2 },
        3: { fill: '#000000', stroke: '#ad4d11', textColor: '#ffffff', scale: 1.1 },
    };

    const config = configs[rank];
    const size = config ? 36 : 30;

    return (
        <View style={{
            width: size,
            height: size,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ scale: config?.scale ?? 1 }],
        }}>
            <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
                <Polygon
                    points="2,14 8,3 20,3 26,14 20,25 8,25"
                    fill={config?.fill ?? 'none'}
                    stroke={config?.stroke ?? '#4b5563'}
                    strokeWidth={config ? '2' : '1.5'}
                />
            </Svg>
            <Text style={{
                position: 'absolute',
                color: config?.textColor ?? '#6b7280',
                fontSize: config ? 12 : (rank > 99 ? 7 : 10),
                fontWeight: '700',
            }}>{rank > 99 ? `#${rank}` : rank}</Text>
        </View>
    );
}

// ========== MAIN COMPONENT ==========
export default function Leaderboard() {
    const { user } = useAuth();
    const router = useRouter();
    const currentUserId = (user?.id ?? user?._id)?.toString();

    const [activeTab, setActiveTab] = useState('hexagons');
    const [data, setData] = useState({ hexagons: [], distance: [], activity: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // ========== LOAD ALL THREE ==========
    useEffect(() => {
        const loadLeaderboards = async () => {
            try {
                const [hexRes, distRes, actRes] = await Promise.all([
                    getHexagonLeaderboard(),
                    getDistanceLeaderboard(),
                    getActivityLeaderboard(),
                ]);
                setData({
                    hexagons: hexRes.data.leaderboard || [],
                    distance: distRes.data.leaderboard || [],
                    activity: actRes.data.leaderboard || [],
                });
            } catch (err) {
                setError('Failed to load leaderboards.');
            } finally {
                setLoading(false);
            }
        };
        loadLeaderboards();
    }, []);

    const currentList = data[activeTab];
    const currentTab = TABS.find(t => t.key === activeTab);

    const formatValue = (entry) => {
        if (activeTab === 'hexagons') return `${entry.hexagons ?? 0} hex`;
        if (activeTab === 'distance') return `${(entry.distance ?? 0).toFixed(1)} mi`;
        if (activeTab === 'activity') return `${entry.totalActivities ?? 0}`;
        return '';
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#10b981" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <HexBackground />
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>

                <Text style={styles.pageTitle}>Leaderboard</Text>
                <Text style={styles.pageSubtitle}>{currentTab.description}</Text>

                {/* ===== TAB SWITCHER ===== */}
                <View style={styles.tabBar}>
                    {TABS.map(tab => {
                        const active = activeTab === tab.key;
                        return (
                            <TouchableOpacity
                                key={tab.key}
                                onPress={() => setActiveTab(tab.key)}
                                style={[styles.tab, active && styles.tabActive]}
                            >
                                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                                    {tab.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* ===== ERROR ===== */}
                {error !== '' && (
                    <View style={styles.errorContainer}>
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )}

                {/* ===== EMPTY STATE ===== */}
                {!error && currentList.length === 0 && (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyEmoji}>🏆</Text>
                        <Text style={styles.emptyTitle}>No data yet</Text>
                        <Text style={styles.emptyText}>Be the first to claim the top spot!</Text>
                    </View>
                )}

                {/* ===== LEADERBOARD LIST ===== */}
                {!error && currentList.map((entry, index) => {
                    const isCurrentUser = String(entry.id) === currentUserId;
                    return (
                        <TouchableOpacity
                            key={entry.id}
                            style={[styles.row, isCurrentUser && styles.rowCurrent]}
                            onPress={() => {
                                if (isCurrentUser) {
                                    router.push('/profile');
                                } else {
                                    router.push(`/user/${entry.id}`);
                                }
                            }}
                        >
                            <MedalHex rank={index + 1} />

                            {/* Avatar */}
                            <View style={styles.avatar}>
                                <Text style={styles.avatarText}>
                                    {entry.username?.[0]?.toUpperCase() ?? '?'}
                                </Text>
                            </View>

                            {/* Username */}
                            <Text
                                style={[styles.username, isCurrentUser && styles.usernameCurrent]}
                                numberOfLines={1}
                            >
                                {entry.username}
                            </Text>

                            {isCurrentUser && (
                                <Text style={styles.youBadge}>you</Text>
                            )}

                            {/* Value */}
                            <Text style={[styles.value, isCurrentUser && styles.valueCurrent]}>
                                {formatValue(entry)}
                            </Text>
                        </TouchableOpacity>
                    );
                })}

                <View style={{ height: 20 }} />
            </ScrollView>
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
    pageTitle: {
        color: '#ffffff',
        fontSize: 24,
        fontWeight: '900',
        marginBottom: 4,
    },
    pageSubtitle: {
        color: '#d1d5db',
        fontSize: 13,
        fontWeight: '700',
        marginBottom: 20,
    },
    tabBar: {
        flexDirection: 'row',
        backgroundColor: '#111827',
        borderRadius: 12,
        padding: 4,
        borderWidth: 1,
        borderColor: '#1f2937',
        marginBottom: 20,
        gap: 4,
    },
    tab: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
    },
    tabActive: {
        backgroundColor: '#10b981',
    },
    tabText: {
        color: '#6b7280',
        fontSize: 13,
        fontWeight: '700',
    },
    tabTextActive: {
        color: '#ffffff',
    },
    errorContainer: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.3)',
        borderRadius: 12,
        padding: 12,
    },
    errorText: {
        color: '#f87171',
        fontSize: 13,
        fontWeight: '700',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 48,
    },
    emptyEmoji: {
        fontSize: 48,
        marginBottom: 16,
    },
    emptyTitle: {
        color: '#ffffff',
        fontSize: 20,
        fontWeight: '900',
        marginBottom: 8,
    },
    emptyText: {
        color: '#6b7280',
        fontSize: 13,
        fontWeight: '700',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#111827',
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: '#1f2937',
        marginBottom: 8,
    },
    rowCurrent: {
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderColor: 'rgba(16, 185, 129, 0.3)',
    },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#1f2937',
        borderWidth: 1,
        borderColor: '#374151',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        color: '#10b981',
        fontSize: 12,
        fontWeight: '700',
    },
    username: {
        flex: 1,
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '700',
    },
    usernameCurrent: {
        color: '#10b981',
    },
    youBadge: {
        color: '#facc15',
        fontSize: 11,
        fontWeight: '700',
    },
    value: {
        color: '#d1d5db',
        fontSize: 13,
        fontWeight: '700',
    },
    valueCurrent: {
        color: '#10b981',
    },
};
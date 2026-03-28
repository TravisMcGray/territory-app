// ========== OTHER USER PROFILE ==========
// Dynamic route: /profile/:userId
// Shows another user's public profile with follow button.
// Separate from the tab profile which is always your own.

import { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { getUserById, followUser, unfollowUser } from '../../services/api';
import HexBackground from '../../components/HexBackground';

export default function UserProfile() {
    const router = useRouter();
    const { userId } = useLocalSearchParams();
    const { user: currentUser } = useAuth();
    const currentUserId = (currentUser?.id ?? currentUser?._id)?.toString();

    const [profile, setProfile] = useState(null);
    const [followersCount, setFollowersCount] = useState(0);
    const [followingCount, setFollowingCount] = useState(0);
    const [isFollowing, setIsFollowing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [followLoading, setFollowLoading] = useState(false);

    // Redirect to own profile tab if they somehow navigate to their own ID
    useEffect(() => {
        if (userId && String(userId) === currentUserId) {
            router.replace('/(tabs)/profile');
        }
    }, [userId, currentUserId]);

    // Load profile
    useEffect(() => {
        const loadProfile = async () => {
            try {
                const res = await getUserById(userId);
                const userData = res.data.user;
                const relationship = res.data.relationshipStatus;
                setProfile(userData);
                setFollowersCount(userData.followers ?? 0);
                setFollowingCount(userData.following ?? 0);
                setIsFollowing(relationship?.isFollowing ?? false);
            } catch (err) {
                console.error('Profile load error:', err);
            } finally {
                setLoading(false);
            }
        };
        if (userId) loadProfile();
    }, [userId]);

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

                {/* Profile header */}
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

                <View style={{ height: 20 }} />
            </ScrollView>
        </View>
    );
}

function StatItem({ label, value, color = '#ffffff' }) {
    return (
        <View style={styles.statItem}>
            <Text style={[styles.statItemValue, { color }]}>{value}</Text>
            <Text style={styles.statItemLabel}>{label}</Text>
        </View>
    );
}

const styles = {
    container: { flex: 1, backgroundColor: '#030712' },
    loadingContainer: { flex: 1, backgroundColor: '#030712', justifyContent: 'center', alignItems: 'center' },
    scrollView: { flex: 1, zIndex: 1 },
    scrollContent: { paddingHorizontal: 16, paddingTop: 56, paddingBottom: 20 },
    backButton: { marginBottom: 16 },
    backText: { color: '#10b981', fontSize: 14, fontWeight: '700' },
    headerCard: { backgroundColor: '#111827', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#1f2937' },
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
};
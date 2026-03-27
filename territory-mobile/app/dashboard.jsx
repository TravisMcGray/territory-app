// ========== DASHBOARD SCREEN (PLACEHOLDER) ==========
// Simple screen to confirm auth is working.
// Shows username and basic stats from the profile.
// Will be replaced with the unified map as the home screen later.

import { View, Text, TouchableOpacity } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
    const { user, logoutUser } = useAuth();

    const stats = user?.stats || {};

    return (
        <View style={styles.container}>
            {/* ===== HEADER ===== */}
            <View style={styles.header}>
                <Text style={styles.logoText}>
                    Hex<Text style={styles.logoAccent}>Capture</Text>
                </Text>
            </View>

            {/* ===== WELCOME ===== */}
            <View style={styles.welcomeCard}>
                <Text style={styles.welcomeText}>
                    Welcome back, <Text style={styles.usernameText}>{user?.username}</Text>
                </Text>
                <Text style={styles.subtitle}>Ready to capture more territory?</Text>
            </View>

            {/* ===== STATS ===== */}
            <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                    <Text style={[styles.statValue, { color: '#10b981' }]}>
                        {stats.totalHexagonsCaptured ?? 0}
                    </Text>
                    <Text style={styles.statLabel}>Hexagons</Text>
                </View>
                <View style={styles.statCard}>
                    <Text style={[styles.statValue, { color: '#60a5fa' }]}>
                        {(stats.totalDistance ?? 0).toFixed(1)}
                    </Text>
                    <Text style={styles.statLabel}>Miles</Text>
                </View>
                <View style={styles.statCard}>
                    <Text style={[styles.statValue, { color: '#a78bfa' }]}>
                        {(stats.totalWalks ?? 0) + (stats.totalRuns ?? 0)}
                    </Text>
                    <Text style={styles.statLabel}>Activities</Text>
                </View>
            </View>

            {/* ===== AUTH CONFIRMED MESSAGE ===== */}
            <View style={styles.confirmCard}>
                <Text style={styles.confirmEmoji}>✅</Text>
                <Text style={styles.confirmText}>
                    Mobile app connected to backend successfully!
                </Text>
                <Text style={styles.confirmSubtext}>
                    Auth, API calls, and secure storage are all working.
                </Text>
            </View>

            {/* ===== LOGOUT ===== */}
            <TouchableOpacity onPress={logoutUser} style={styles.logoutButton}>
                <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
        </View>
    );
}

// ========== STYLES ==========
const styles = {
    container: {
        flex: 1,
        backgroundColor: '#030712',
        paddingHorizontal: 20,
        paddingTop: 60,
    },
    header: {
        marginBottom: 24,
    },
    logoText: {
        fontSize: 24,
        fontWeight: '900',
        color: '#ffffff',
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
        marginBottom: 20,
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
    statsGrid: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 20,
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
        fontSize: 22,
        fontWeight: '900',
    },
    statLabel: {
        color: '#9ca3af',
        fontSize: 11,
        fontWeight: '700',
        marginTop: 4,
    },
    confirmCard: {
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.3)',
        alignItems: 'center',
        marginBottom: 20,
    },
    confirmEmoji: {
        fontSize: 32,
        marginBottom: 8,
    },
    confirmText: {
        color: '#10b981',
        fontSize: 14,
        fontWeight: '900',
        textAlign: 'center',
    },
    confirmSubtext: {
        color: '#9ca3af',
        fontSize: 12,
        fontWeight: '700',
        textAlign: 'center',
        marginTop: 4,
    },
    logoutButton: {
        backgroundColor: '#1f2937',
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
    },
    logoutText: {
        color: '#9ca3af',
        fontSize: 14,
        fontWeight: '900',
    },
};
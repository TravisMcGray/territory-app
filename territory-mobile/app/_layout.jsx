// ========== ROOT LAYOUT ==========
// This is the entry point for expo-router.
// Wraps the entire app with AuthProvider so every screen can access auth state.
// Handles routing: unauthenticated users see login, authenticated users see the app.

import { useEffect } from 'react';
import { Slot, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { AuthProvider, useAuth } from '../context/AuthContext';

// ========== AUTH GATE ==========
// Watches auth state and redirects accordingly:
// - No user + trying to access app screens → redirect to /login
// - Has user + on login screen → redirect to /dashboard
function AuthGate() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const segments = useSegments();
    const navigationState = useRootNavigationState();

    useEffect(() => {
        // Don't redirect until navigation is ready AND auth check is complete
        if (!navigationState?.key || loading) return;

        const onAuthScreen = segments[0] === 'login' || segments[0] === 'signup';

        if (!user && !onAuthScreen) {
            // Not logged in, trying to access protected screen → send to login
            router.replace('/login');
        } else if (user && onAuthScreen) {
            // Logged in but on login/signup screen → send to dashboard
            router.replace('/dashboard');
        }
    }, [user, loading, segments, navigationState?.key]);

    // Show loading spinner while checking auth state
    if (loading) {
        return (
            <View style={{ flex: 1, backgroundColor: '#030712', justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#10b981" />
            </View>
        );
    }

    return <Slot />;
}

// ========== ROOT LAYOUT ==========
export default function RootLayout() {
    return (
        <AuthProvider>
            <StatusBar style="light" />
            <AuthGate />
        </AuthProvider>
    );
}
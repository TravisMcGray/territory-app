import { useEffect, useState } from 'react';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { AuthProvider, useAuth } from '../context/AuthContext';

function AuthGate() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const segments = useSegments();
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setIsReady(true), 100);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (!isReady || loading) return;

        const onAuthScreen = segments[0] === 'login' || segments[0] === 'signup';
        const onTabsScreen = segments[0] === '(tabs)';

        if (!user && !onAuthScreen) {
            router.replace('/login');
        } else if (user && !onTabsScreen) {
            router.replace('/(tabs)/dashboard');
        }
    }, [user, loading, segments, isReady]);

    if (loading || !isReady) {
        return (
            <View style={{ flex: 1, backgroundColor: '#030712', justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#10b981" />
            </View>
        );
    }

    return <Slot />;
}

export default function RootLayout() {
    return (
        <AuthProvider>
            <StatusBar style="light" />
            <AuthGate />
        </AuthProvider>
    );
}
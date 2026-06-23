// ========== AUTH CONTEXT (REACT NATIVE) ==========
// Same pattern as the web AuthContext:
// - Stores JWT token securely
// - Hydrates user profile on app load
// - Provides loginUser / logoutUser to all screens
//
// Key difference from web: uses expo-secure-store instead of localStorage.
// SecureStore encrypts the token on the device, more secure than localStorage.

import { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { getProfile } from '../services/api';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // ========== HYDRATE ON APP LOAD ==========
    // Check if a token exists in secure storage.
    // If so, fetch the full profile to hydrate the user state.
    useEffect(() => {
        const loadUser = async () => {
            try {
                const token = await SecureStore.getItemAsync('token');
                if (token) {
                    const res = await getProfile();
                    setUser(res.data.profile);
                }
            } catch (err) {
                // Token expired or invalid, so clear it
                console.error('Auth hydration failed:', err.message);
                await SecureStore.deleteItemAsync('token');
                setUser(null);
            } finally {
                setLoading(false);
            }
        };

        loadUser();
    }, []);

    // ========== LOGIN ==========
    // Store the token securely, then fetch the full profile.
    // The profile gives us username, stats, and all user data.
    const loginUser = async (token) => {
        await SecureStore.setItemAsync('token', token);
        try {
            const res = await getProfile();
            setUser(res.data.profile);
        } catch (err) {
            console.error('Profile fetch after login failed:', err.message);
        }
    };

    // ========== LOGOUT ==========
    // Clear the token and reset user state.
    const logoutUser = async () => {
        await SecureStore.deleteItemAsync('token');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, loading, loginUser, logoutUser }}>
            {children}
        </AuthContext.Provider>
    );
}

// ========== HOOK ==========
// Use this in any screen: const { user, loginUser, logoutUser } = useAuth();
export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
// ========== AUTH CONTEXT ==========
// Provides authentication state to the entire app.
// Any component can check if user is logged in without prop drilling.

import { createContext, useContext, useState, useEffect } from 'react';
import { getProfile } from '../services/api';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // ========== INITIALIZE ==========
    // Attempt profile fetch on load — the httpOnly cookie is sent automatically.
    // 200 means valid session; 401 means no cookie or expired, user stays null.
    useEffect(() => {
        getProfile()
            .then(res => setUser(res.data.profile))
            .catch(() => setUser(null))
            .finally(() => setLoading(false));
    }, []);

    // ========== AUTH ACTIONS ==========
    const loginUser = (userData) => {
        setUser(userData);
        // Fetch full profile so username and stats are immediately available
        getProfile()
            .then(res => setUser(res.data.profile))
            .catch(() => {});
    };

    const logoutUser = async () => {
        try { await api.post('/api/auth/logout'); } catch { /* best-effort: ignore logout network errors */ }
        setUser(null);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <div className="text-emerald-400 text-lg font-semibold animate-pulse">
                    Loading...
                </div>
            </div>
        );
    }

    return (
        <AuthContext.Provider value={{ user, setUser, loginUser, logoutUser }}>
            {children}
        </AuthContext.Provider>
    );
}

// ========== HOOK ==========
// Clean way for any component to access auth state. The hook is intentionally
// colocated with the provider; disabling the fast-refresh rule for this one
// export keeps the common useAuth + AuthProvider pattern in a single file.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
    return useContext(AuthContext);
}

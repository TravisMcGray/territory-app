// ========== AUTH CONTEXT ==========
// Provides authentication state to the entire app.
// Any component can check if user is logged in without prop drilling.

import { createContext, useContext, useState, useEffect } from 'react';
import { getProfile } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // ========== INITIALIZE ==========
    // Check if user has a token on app load and fetch their profile.
    useEffect(() => {
    const token = localStorage.getItem('token');
    
    if (token) {
        setUser({ _id: 'loading' });
        
        getProfile()
            .then(res => setUser(res.data.profile))
            .catch((err) => {
                if (err.response?.status === 401) {
                    localStorage.removeItem('token');
                    setUser(null);
                } else {
                    setUser({ _id: 'offline' });
                }
            })
            .finally(() => setLoading(false));
    } else {
        setLoading(false);
    }
}, []);

    // ========== AUTH ACTIONS ==========
    const loginUser = (token, userData) => {
        localStorage.setItem('token', token);
        setUser(userData);
        // Fetch full profile immediately so username and stats are available
        getProfile()
            .then(res => setUser(res.data.profile))
            .catch(() => {}); // silently keep the partial user if profile fetch fails
    };

    const logoutUser = () => {
        localStorage.removeItem('token');
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
// Clean way for any component to access auth state.
export function useAuth() {
    return useContext(AuthContext);
}
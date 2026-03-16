// ========== APP ==========
// Root component handling all routing.

import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import LogActivity from './pages/LogActivity';
import Feed from './pages/Feed';
import Leaderboard from './pages/Leaderboard';
import Profile from './pages/Profile';
import Map from './pages/Map';
import ResetPassword from './pages/ResetPassword';

// Redirect unauthenticated users to login
function ProtectedRoute({ children }) {
    const { user } = useAuth();
    return user ? children : <Navigate to="/login" />;
}

export default function App() {
    const { user } = useAuth();

    return (
        <Routes>
            {/* ========== AUTH ROUTES ========== */}
            <Route
                path="/login"
                element={user ? <Navigate to="/dashboard" /> : <Login />}
            />
            {/* /verify-email is not used directly — backend redirects to /login?verified=true */}
            {/* But we define it as a fallback in case someone navigates here directly */}
            <Route
                path="/verify-email"
                element={<Navigate to="/login" />}
            />
            <Route
                path="/reset-password"
                element={<ResetPassword />}
            />

            {/* ========== PROTECTED ROUTES ========== */}
            <Route
                path="/dashboard"
                element={<ProtectedRoute><Dashboard /></ProtectedRoute>}
            />
            <Route
                path="/log-activity"
                element={<ProtectedRoute><LogActivity /></ProtectedRoute>}
            />
            <Route
                path="/feed"
                element={<ProtectedRoute><Feed /></ProtectedRoute>}
            />
            <Route
                path="/leaderboard"
                element={<ProtectedRoute><Leaderboard /></ProtectedRoute>}
            />
            <Route
                path="/profile"
                element={<ProtectedRoute><Profile /></ProtectedRoute>}
            />
            <Route
                path="/profile/:userId"
                element={<ProtectedRoute><Profile /></ProtectedRoute>}
            />
            <Route
                path="/map"
                element={<ProtectedRoute><Map /></ProtectedRoute>}
            />

            {/* ========== FALLBACK ========== */}
            <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
    );
}
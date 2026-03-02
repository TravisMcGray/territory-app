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

// Redirect unauthenticated users to login
function ProtectedRoute({ children }) {
    const { user } = useAuth();
    return user ? children : <Navigate to="/login" />;
}

export default function App() {
    const { user } = useAuth();

    return (
        <Routes>
            <Route
                path="/login"
                element={user ? <Navigate to="/dashboard" /> : <Login />}
            />
            <Route
                path="/dashboard"
                element={
                    <ProtectedRoute>
                        <Dashboard />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/log-activity"
                element={
                    <ProtectedRoute>
                        <LogActivity />
                    </ProtectedRoute>
                }
            />
            <Route
              path="/feed"
              element={
                  <ProtectedRoute>
                    <Feed />
                  </ProtectedRoute>
              }
            />
            <Route
                path="/leaderboard"
                element={
                    <ProtectedRoute>
                        <Leaderboard />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/profile"
                element={
                    <ProtectedRoute>
                        <Profile />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/profile/:userId"
                element={
                    <ProtectedRoute>
                        <Profile />
                    </ProtectedRoute>
                }
            />
            <Route 
                path="*" 
                element={
                <Navigate to="/login" />
                } 
            />
            <Route 
                path="/map"
                element={
                <ProtectedRoute>
                    <Map />
                </ProtectedRoute>} 
            />
        </Routes>
    );
}
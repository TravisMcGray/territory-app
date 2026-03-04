// ========== NAVBAR COMPONENT ==========
// Shared navigation bar used on every page.
// Single source of truth for navigation — update here, updates everywhere.

import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logoutUser } = useAuth();

    const handleLogout = () => {
        logoutUser();
        navigate('/login');
    };

    // ========== ACTIVE ROUTE DETECTION ==========
    // Highlights the current page's nav link so users know where they are.
    const isActive = (path) => location.pathname === path;

    const navLinkClass = (path) =>
        `font-bold text-sm px-3 py-2 rounded-lg transition-colors ${
            isActive(path)
                ? 'text-emerald-400 bg-emerald-400/10'
                : 'text-gray-300 hover:text-white hover:bg-gray-800'
        }`;

    // ========== RENDER ==========
    return (
        <nav className="border-b border-gray-800 bg-gray-900 px-4 py-3 sticky top-0 z-20">
            <div className="max-w-6xl mx-auto flex items-center justify-between">

                {/* ========== LOGO ========== */}
                <button
                    onClick={() => navigate('/dashboard')}
                    className="text-xl font-black tracking-tight"
                >
                    Territory<span className="text-emerald-400">Capture</span>
                </button>

                {/* ========== NAV LINKS ========== */}
                <div className="hidden sm:flex items-center gap-1">
                    <button onClick={() => navigate('/dashboard')} className={navLinkClass('/dashboard')}>
                        Dashboard
                    </button>
                    <button onClick={() => navigate('/map')} className={navLinkClass('/map')}>
                        Map
                    </button>
                    <button onClick={() => navigate('/feed')} className={navLinkClass('/feed')}>
                        Feed
                    </button>
                    <button onClick={() => navigate('/leaderboard')} className={navLinkClass('/leaderboard')}>
                        Leaderboard
                    </button>
                </div>

                {/* ========== RIGHT SIDE ========== */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/profile')}
                        className="text-white font-bold hover:text-emerald-400 text-sm transition-colors hidden sm:block"
                    >
                        {user?.username}
                    </button>
                    <button
                        onClick={() => navigate('/log-activity')}
                        className="bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors"
                    >
                        + Log Activity
                    </button>
                    <button
                        onClick={handleLogout}
                        className="text-gray-500 hover:text-white text-sm font-bold transition-colors"
                    >
                        Logout
                    </button>
                </div>
            </div>
        </nav>
    );
}
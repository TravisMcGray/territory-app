import { useState } from 'react';
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

    const isActive = (path) => location.pathname === path;

    const navLinkClass = (path) =>
        `font-bold text-md px-3 py-2 rounded-lg transition-colors ${
            isActive(path)
                ? 'text-emerald-600 bg-emerald-500/10'
                : 'text-slate-600 hover:text-slate-900 hover:bg-gray-100'
        }`;

    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <nav className="border-b border-gray-200 bg-white px-4 py-3 sticky top-0 z-20 shadow-sm">
            <div className="w-full max-w-6xl mx-auto flex items-center justify-between">

                {/* ========== LOGO ========== */}
                <button
                    onClick={() => navigate('/dashboard')}
                    className="text-xl font-black tracking-tight text-slate-900"
                >
                    Hex<span className="text-emerald-500">Capture</span>
                </button>

                {/* ========== DESKTOP NAV LINKS ========== */}
                <div className="hidden md:flex items-center gap-1">
                    <button onClick={() => navigate('/dashboard')} className={navLinkClass('/dashboard')}>Dashboard</button>
                    <button onClick={() => navigate('/map')} className={navLinkClass('/map')}>Map</button>
                    <button onClick={() => navigate('/feed')} className={navLinkClass('/feed')}>Feed</button>
                    <button onClick={() => navigate('/leaderboard')} className={navLinkClass('/leaderboard')}>Leaderboard</button>
                </div>

                {/* ========== DESKTOP RIGHT SIDE ========== */}
                <div className="hidden md:flex items-center gap-4">
                    <button
                        onClick={() => navigate('/profile')}
                        className="text-slate-900 font-bold hover:text-emerald-600 text-md transition-colors"
                    >
                        {user?.username}
                    </button>
                    <button
                        onClick={() => navigate('/log-activity')}
                        className="bg-emerald-500 hover:bg-emerald-400 text-white text-md font-bold px-4 py-2 rounded-xl transition-colors"
                    >
                        + Log Activity
                    </button>
                    <button
                        onClick={handleLogout}
                        className="text-gray-400 hover:text-gray-700 text-md font-bold transition-colors"
                    >
                        Logout
                    </button>
                </div>

                {/* ========== MOBILE HAMBURGER BUTTON ========== */}
                <button
                    onClick={() => setMenuOpen(prev => !prev)}
                    className="md:hidden flex flex-col justify-center items-center w-8 h-8 gap-1.5"
                >
                    <span className={`block w-6 h-0.5 bg-gray-600 transition-all ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
                    <span className={`block w-6 h-0.5 bg-gray-600 transition-all ${menuOpen ? 'opacity-0' : ''}`} />
                    <span className={`block w-6 h-0.5 bg-gray-600 transition-all ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
                </button>
            </div>

            {/* ========== MOBILE DROPDOWN MENU ========== */}
            {menuOpen && (
                <div className="md:hidden border-t border-gray-200 mt-3 pt-3 pb-2 space-y-1">
                    {[
                        { label: 'Dashboard', path: '/dashboard' },
                        { label: 'Map', path: '/map' },
                        { label: 'Feed', path: '/feed' },
                        { label: 'Leaderboard', path: '/leaderboard' },
                        { label: user?.username ?? 'Profile', path: '/profile' },
                    ].map(({ label, path }) => (
                        <button
                            key={path}
                            onClick={() => { navigate(path); setMenuOpen(false); }}
                            className={`w-full text-left px-3 py-2.5 rounded-lg text-md font-bold transition-colors ${
                                isActive(path)
                                    ? 'text-emerald-600 bg-emerald-500/10'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-gray-100'
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                    <button
                        onClick={() => { navigate('/log-activity'); setMenuOpen(false); }}
                        className="w-full text-left px-3 py-2.5 rounded-lg text-md font-bold bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-colors"
                    >
                        + Log Activity
                    </button>
                    <button
                        onClick={() => { handleLogout(); setMenuOpen(false); }}
                        className="w-full text-left px-3 py-2.5 rounded-lg text-md font-bold text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                        Logout
                    </button>
                </div>
            )}
        </nav>
    );
}

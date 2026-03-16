// ========== LEADERBOARD PAGE ==========
// Shows three leaderboards: hexagons owned, total distance, and total activities.
// Tabs switch between categories without re-fetching — all data loads at once.
// Rows are clickable — navigates to /profile/:userId for other users.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getHexagonLeaderboard, getDistanceLeaderboard, getActivityLeaderboard } from '../services/api';
import { useAuth } from '../context/AuthContext';
import HexBackground from '../components/HexBackground';
import Navbar from '../components/Navbar';

// ========== HEX ICONS ==========
const HexIcon = ({ color, fill = 'none', children }) => (
    <svg width="36" height="36" viewBox="0 0 28 28" fill="none">
        <polygon
            points="2,14 8,3 20,3 26,14 20,25 8,25"
            stroke={color}
            strokeWidth="1.5"
            fill={fill}
        />
        {children}
    </svg>
);

const HexTerritoryIcon = ({ color, active }) => (
    <HexIcon color={color} fill={active ? '#10b98122' : 'none'}>
        <text x="14" y="18" textAnchor="middle" fontSize="9" fill={color} fontWeight="800">HEX</text>
    </HexIcon>
);

const HexDistanceIcon = ({ color, active }) => (
    <HexIcon color={color} fill={active ? '#10b98122' : 'none'}>
        <line x1="8" y1="14" x2="20" y2="14" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="8" y1="11" x2="8" y2="17" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="20" y1="11" x2="20" y2="17" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </HexIcon>
);

const HexActivityIcon = ({ color, active }) => (
    <HexIcon color={color} fill={active ? '#10b98122' : 'none'}>
        <polyline
            points="5,14 8,14 11,9 15,19 18,12 21,14 24,14"
            stroke={color}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
        />
    </HexIcon>
);

// ========== TAB DEFINITIONS ==========
const TABS = [
    { key: 'hexagons', label: 'Hexagons', description: 'Most territory owned', icon: HexTerritoryIcon },
    { key: 'distance', label: 'Distance', description: 'Most miles logged', icon: HexDistanceIcon },
    { key: 'activity', label: 'Activity', description: 'Most activities logged', icon: HexActivityIcon },
];

// ========== MAIN COMPONENT ==========
export default function Leaderboard() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState('hexagons');
    const [data, setData] = useState({ hexagons: [], distance: [], activity: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Normalize current user ID — getProfile() returns 'id', context may store either
    const currentUserId = user?.id ?? user?._id;

    // ========== LOAD ALL THREE LEADERBOARDS ==========
    useEffect(() => {
        const loadLeaderboards = async () => {
            try {
                const [hexRes, distRes, actRes] = await Promise.all([
                    getHexagonLeaderboard(),
                    getDistanceLeaderboard(),
                    getActivityLeaderboard(),
                ]);
                setData({
                    hexagons: hexRes.data.leaderboard || [],
                    distance: distRes.data.leaderboard || [],
                    activity: actRes.data.leaderboard || [],
                });
            } catch (err) {
                setError('Failed to load leaderboards. Please try again.');
            } finally {
                setLoading(false);
            }
        };
        loadLeaderboards();
    }, []);

    const currentList = data[activeTab];
    const currentTab = TABS.find(t => t.key === activeTab);

    const handleRowClick = (entry) => {
        const isCurrentUser = String(entry.id) === String(currentUserId);
        if (isCurrentUser) {
            // Navigate to own profile page
            navigate('/profile');
        } else {
            navigate(`/profile/${entry.id}`);
        }
    };

    // ========== RENDER ==========
    if (loading) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <div className="text-emerald-400 text-lg font-semibold animate-pulse">
                    Loading leaderboard data...
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-950 text-white relative">
            <HexBackground />
            <Navbar />

            <div className="max-w-lg mx-auto px-4 py-6 relative z-10">

                <div className="mb-6">
                    <h2 className="text-2xl font-black">Leaderboard</h2>
                    <p className="font-bold text-gray-300 text-sm mt-1">{currentTab.description}</p>
                </div>

                {/* ========== TAB SWITCHER ========== */}
                <div className="flex bg-gray-900 border border-gray-800 rounded-xl p-1 mb-6 gap-1">
                    {TABS.map(tab => {
                        const active = activeTab === tab.key;
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex-1 py-2 px-2 rounded-lg text-xs font-bold transition-all flex flex-col items-center gap-1 ${
                                    active ? 'bg-emerald-500 text-white' : 'text-gray-500 hover:text-white'
                                }`}
                            >
                                <Icon color={active ? '#ffffff' : '#6b7280'} active={active} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* ========== ERROR STATE ========== */}
                {error && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
                        {error}
                    </div>
                )}

                {/* ========== EMPTY STATE ========== */}
                {!error && currentList.length === 0 && (
                    <div className="text-center py-16">
                        <div className="text-5xl mb-4">🏆</div>
                        <h3 className="text-xl font-bold mb-2">No data yet</h3>
                        <p className="text-gray-500 text-sm">Be the first to claim the top spot!</p>
                    </div>
                )}

                {/* ========== LEADERBOARD LIST ========== */}
                {!error && currentList.length > 0 && (
                    <div className="space-y-2">
                        {currentList.map((entry, index) => {
                            const isCurrentUser = String(entry.id) === String(currentUserId);
                            return (
                                <LeaderboardRow
                                    key={entry.id}
                                    entry={entry}
                                    rank={index + 1}
                                    tab={activeTab}
                                    isCurrentUser={isCurrentUser}
                                    onClick={() => handleRowClick(entry)}
                                />
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

// ========== MEDAL HEXAGONS ==========
function MedalHex({ rank }) {
    const configs = {
        1: { fill: '#0e0d0d', stroke: '#ffb004', textColor: '#ffffff', label: '1' },
        2: { fill: '#000000', stroke: '#9daec5', textColor: '#ffffff', label: '2' },
        3: { fill: '#000000', stroke: '#ad4d11', textColor: '#ffffff', label: '3' },
    };

    const config = configs[rank];

    if (config) {
        return (
            <svg width="36" height="36" viewBox="0 0 28 28" fill="none">
                <polygon
                    points="2,14 8,3 20,3 26,14 20,25 8,25"
                    fill={config.fill}
                    stroke={config.stroke}
                    strokeWidth="2"
                />
                <text
                    x="14"
                    y="15"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="12"
                    fill={config.textColor}
                    fontWeight="700"
                    fontFamily="Oxanium, sans-serif"
                >
                    {config.label}
                </text>
            </svg>
        );
    }

    return (
        <svg width="32" height="32" viewBox="0 0 28 28" fill="none">
            <polygon
                points="2,14 8,3 20,3 26,14 20,25 8,25"
                fill="none"
                stroke="#4b5563"
                strokeWidth="1.5"
            />
            <text
                x="14"
                y="15"
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={rank > 99 ? "7" : "10"}
                fill="#6b7280"
                fontWeight="700"
                fontFamily="Oxanium, sans-serif"
            >
                {rank > 99 ? `#${rank}` : rank}
            </text>
        </svg>
    );
}

// ========== LEADERBOARD ROW ==========
function LeaderboardRow({ entry, rank, tab, isCurrentUser, onClick }) {
    const formatValue = () => {
        if (tab === 'hexagons') return `${entry.hexagons ?? 0} hex`;
        if (tab === 'distance') return `${(entry.distance ?? 0).toFixed(1)} mi`;
        if (tab === 'activity') return `${entry.totalActivities ?? 0} activities`;
        return '';
    };

    return (
        <button
            type="button"
            onClick={onClick}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors text-left ${
                isCurrentUser
                    ? 'bg-gray-900 border-emerald-500/30 hover:border-emerald-500/60'
                    : 'bg-gray-900 border-gray-800 hover:border-emerald-500/50 hover:bg-gray-800'
            }`}
        >
            {/* Medal / rank hexagon */}
            <div
                className="flex items-center justify-center flex-shrink-0"
                style={{
                    transform: rank === 1 ? 'scale(1.4)'
                            : rank === 2 ? 'scale(1.3)'
                            : rank === 3 ? 'scale(1.2)'
                            : 'scale(1.1)',
                    transition: 'transform 0.2s'
                }}
            >
                <MedalHex rank={rank} />
            </div>

            {/* Avatar initial */}
            <div className="w-8 h-8 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-xs font-bold text-emerald-400 flex-shrink-0">
                {entry.username?.[0]?.toUpperCase() ?? '?'}
            </div>

            {/* Username */}
            <span className={`flex-1 font-semibold truncate ${
                isCurrentUser ? 'text-emerald-400' : 'text-white'
            }`}>
                {entry.username}
                {isCurrentUser && (
                    <span className="font-bold text-yellow-400 text-xs ml-2">you</span>
                )}
            </span>

            {/* Stat value */}
            <span className={`text-sm font-bold flex-shrink-0 ${
                isCurrentUser ? 'text-emerald-400' : 'text-gray-300'
            }`}>
                {formatValue()}
            </span>
        </button>
    );
}
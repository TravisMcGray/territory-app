// ========== LEADERBOARD PAGE ==========
// Shows three leaderboards: hexagons owned, total distance, and total activities.
// Tabs switch between categories without re-fetching — all data loads at once.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getHexagonLeaderboard, getDistanceLeaderboard, getActivityLeaderboard } from '../services/api';
import { useAuth } from '../context/AuthContext';
import HexBackground from '../components/HexBackground';

// ========== TAB DEFINITIONS ==========
// Centralized so adding a new leaderboard category is one line change.
const TABS = [
    { key: 'hexagons', label: '🗺️ Hexagons', description: 'Most territory owned' },
    { key: 'distance', label: '📏 Distance', description: 'Most miles logged' },
    { key: 'activity', label: '🏃 Activity',  description: 'Most activities logged' },
];

// ========== MAIN COMPONENT ==========
export default function Leaderboard() {
    const navigate = useNavigate();
    const { user } = useAuth();

    const [activeTab, setActiveTab] = useState('hexagons');
    const [data, setData] = useState({
        hexagons: [],
        distance: [],
        activity: [],
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // ========== LOAD ALL THREE LEADERBOARDS ==========
    // Fetch all at once using Promise.all so switching tabs is instant.
    // No per-tab loading states needed — one initial load covers everything.
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

    // ========== RENDER ==========
    return (
        <div className="min-h-screen bg-gray-950 text-white relative">
            <HexBackground />

            {/* Navbar */}
            <nav className="border-b border-gray-800 bg-gray-900 px-4 py-3 sticky top-0 z-10">
                <div className="max-w-lg mx-auto flex items-center justify-between">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="font-bold text-gray-200 hover:text-white transition-colors text-sm"
                    >
                        ← Back
                    </button>
                    <h1 className="text-lg font-black tracking-tight">
                        Territory<span className="text-emerald-400">Capture</span>
                    </h1>
                    <div className="w-12" />
                </div>
            </nav>

            <div className="max-w-lg mx-auto px-4 py-6 relative z-10">

                <div className="mb-6">
                    <h2 className="text-2xl font-black">Leaderboard</h2>
                    <p className="font-bold text-gray-300 text-sm mt-1">{currentTab.description}</p>
                </div>

                {/* Tab switcher */}
                <div className="flex bg-gray-900 border border-gray-800 rounded-xl p-1 mb-6 gap-1">
                    {TABS.map(tab => (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex-1 py-2 px-2 rounded-lg text-xs font-bold transition-all ${
                                activeTab === tab.key
                                    ? 'bg-emerald-500 text-white'
                                    : 'text-gray-500 hover:text-white'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Loading state */}
                {loading && (
                    <div className="space-y-2">
                        {[1, 2, 3, 4, 5].map(i => (
                            <div
                                key={i}
                                className="bg-gray-900 border border-gray-800 rounded-xl p-4 animate-pulse flex items-center gap-3"
                            >
                                <div className="w-8 h-4 bg-gray-800 rounded" />
                                <div className="flex-1 h-4 bg-gray-800 rounded" />
                                <div className="w-16 h-4 bg-gray-800 rounded" />
                            </div>
                        ))}
                    </div>
                )}

                {/* Error state */}
                {error && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
                        {error}
                    </div>
                )}

                {/* Empty state */}
                {!loading && !error && currentList.length === 0 && (
                    <div className="text-center py-16">
                        <div className="text-5xl mb-4">🏆</div>
                        <h3 className="text-xl font-bold mb-2">No data yet</h3>
                        <p className="text-gray-500 text-sm">
                            Be the first to claim the top spot!
                        </p>
                    </div>
                )}

                {/* Leaderboard list */}
                {!loading && !error && currentList.length > 0 && (
                    <div className="space-y-2">
                        {currentList.map((entry, index) => (
                            <LeaderboardRow
                                key={entry._id}
                                entry={entry}
                                rank={index + 1}
                                tab={activeTab}
                                isCurrentUser={entry._id === user?._id}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ========== LEADERBOARD ROW ==========
// Displays a single entry. Highlights the current user's row
// so they can instantly find themselves in the rankings.
function LeaderboardRow({ entry, rank, tab, isCurrentUser }) {
    const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };

    // Format the stat value differently per leaderboard type
    const formatValue = () => {
        if (tab === 'hexagons') {
            return `${entry.territoriesOwned ?? 0} hex`;
        }
        if (tab === 'distance') {
            const miles = ((entry.totalDistance ?? 0)).toFixed(1);
            return `${miles} mi`;
        }
        if (tab === 'activity') {
            const total = (entry.totalWalks ?? 0) + (entry.totalRuns ?? 0);
            return `${total} activities`;
        }
        return '';
    };

    return (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
            isCurrentUser
                ? 'bg-emerald-500/10 border-emerald-500/30'
                : 'bg-gray-900 border-gray-800 hover:border-gray-700'
        }`}>

            {/* Rank */}
            <div className="w-8 text-center flex-shrink-0">
                {medals[rank] ? (
                    <span className="text-lg">{medals[rank]}</span>
                ) : (
                    <span className="text-gray-500 text-sm font-bold">{rank}</span>
                )}
            </div>

            {/* Avatar + username */}
            <div className="w-8 h-8 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-xs font-bold text-emerald-400 flex-shrink-0">
                {entry.username?.[0]?.toUpperCase() ?? '?'}
            </div>

            <span className={`flex-1 font-semibold truncate ${
                isCurrentUser ? 'text-emerald-400' : 'text-white'
            }`}>
                {entry.username}
                {isCurrentUser && (
                    <span className="text-emerald-600 text-xs ml-2 font-normal">you</span>
                )}
            </span>

            {/* Stat value */}
            <span className={`text-sm font-bold flex-shrink-0 ${
                isCurrentUser ? 'text-emerald-400' : 'text-gray-300'
            }`}>
                {formatValue()}
            </span>
        </div>
    );
}
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getHexagonLeaderboard, getDistanceLeaderboard, getActivityLeaderboard, getTerritoryLeaderboard } from '../services/api';
import { useAuth } from '../context/AuthContext';
import HexBackground from '../components/HexBackground';
import Navbar from '../components/Navbar';

const HexIcon = ({ color, fill = 'none', children }) => (
    <svg width="36" height="36" viewBox="0 0 28 28" fill="none">
        <polygon points="2,14 8,3 20,3 26,14 20,25 8,25" stroke={color} strokeWidth="1.5" fill={fill}/>
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
        <polyline points="5,14 8,14 11,9 15,19 18,12 21,14 24,14"
            stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </HexIcon>
);

const HexTerritoryControlIcon = ({ color, active }) => (
    <HexIcon color={color} fill={active ? '#10b98122' : 'none'}>
        <polygon points="14,6 20,10 20,18 14,22 8,18 8,10" fill={color} opacity="0.7" />
    </HexIcon>
);

const TABS = [
    { key: 'territory', label: 'Territory', description: 'Most tiles owned right now', icon: HexTerritoryControlIcon },
    { key: 'hexagons', label: 'Lifetime',   description: 'Most tiles ever captured',   icon: HexTerritoryIcon },
    { key: 'distance', label: 'Distance',   description: 'Most miles logged',           icon: HexDistanceIcon },
    { key: 'activity', label: 'Activity',   description: 'Most activities logged',      icon: HexActivityIcon },
];

export default function Leaderboard() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState('territory');
    const [data, setData] = useState({ territory: [], hexagons: [], distance: [], activity: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const currentUserId = user?.id ?? user?._id;

    useEffect(() => {
        const loadLeaderboards = async () => {
            try {
                const [terrRes, hexRes, distRes, actRes] = await Promise.all([
                    getTerritoryLeaderboard(),
                    getHexagonLeaderboard(),
                    getDistanceLeaderboard(),
                    getActivityLeaderboard(),
                ]);
                setData({
                    territory: terrRes.data.leaderboard || [],
                    hexagons:  hexRes.data.leaderboard  || [],
                    distance:  distRes.data.leaderboard || [],
                    activity:  actRes.data.leaderboard  || [],
                });
            } catch {
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
        if (isCurrentUser) navigate('/profile');
        else navigate(`/profile/${entry.id}`);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-100 flex items-center justify-center">
                <div className="text-emerald-500 text-lg font-semibold animate-pulse">
                    Loading leaderboard data...
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-100 text-slate-900 relative">
            <HexBackground />
            <Navbar />

            <div className="max-w-lg mx-auto px-4 py-6 relative z-10">

                <div className="mb-6">
                    <h2 className="text-2xl font-black text-slate-900">Leaderboard</h2>
                    <p className="font-bold text-slate-500 text-sm mt-1">{currentTab.description}</p>
                </div>

                {/* ========== TAB SWITCHER ========== */}
                <div className="flex bg-white border border-gray-200 rounded-xl p-1 mb-6 gap-1 shadow-sm">
                    {TABS.map(tab => {
                        const active = activeTab === tab.key;
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex-1 py-2 px-2 rounded-lg text-xs font-bold transition-all flex flex-col items-center gap-1 ${
                                    active ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-slate-700'
                                }`}
                            >
                                <Icon color={active ? '#ffffff' : '#94a3b8'} active={active} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm">
                        {error}
                    </div>
                )}

                {!error && currentList.length === 0 && (
                    <div className="text-center py-16">
                        <div className="text-5xl mb-4">🏆</div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">No data yet</h3>
                        <p className="text-slate-500 text-sm">Be the first to claim the top spot!</p>
                    </div>
                )}

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

function MedalHex({ rank }) {
    const configs = {
        1: { fill: '#1e293b', stroke: '#ffb004', textColor: '#ffffff', label: '1' },
        2: { fill: '#1e293b', stroke: '#9daec5', textColor: '#ffffff', label: '2' },
        3: { fill: '#1e293b', stroke: '#ad4d11', textColor: '#ffffff', label: '3' },
    };

    const config = configs[rank];

    if (config) {
        return (
            <svg width="36" height="36" viewBox="0 0 28 28" fill="none">
                <polygon points="2,14 8,3 20,3 26,14 20,25 8,25" fill={config.fill} stroke={config.stroke} strokeWidth="2"/>
                <text x="14" y="15" textAnchor="middle" dominantBaseline="middle" fontSize="12"
                    fill={config.textColor} fontWeight="700" fontFamily="Oxanium, sans-serif">
                    {config.label}
                </text>
            </svg>
        );
    }

    return (
        <svg width="32" height="32" viewBox="0 0 28 28" fill="none">
            <polygon points="2,14 8,3 20,3 26,14 20,25 8,25" fill="none" stroke="#cbd5e1" strokeWidth="1.5"/>
            <text x="14" y="15" textAnchor="middle" dominantBaseline="middle"
                fontSize={rank > 99 ? "7" : "10"} fill="#94a3b8" fontWeight="700" fontFamily="Oxanium, sans-serif">
                {rank > 99 ? `#${rank}` : rank}
            </text>
        </svg>
    );
}

function LeaderboardRow({ entry, rank, tab, isCurrentUser, onClick }) {
    const formatValue = () => {
        if (tab === 'territory') return `${entry.tilesOwned ?? 0} owned`;
        if (tab === 'hexagons') return `${entry.hexagons ?? 0} lifetime`;
        if (tab === 'distance') return `${(entry.distance ?? 0).toFixed(1)} mi`;
        if (tab === 'activity') return `${entry.totalActivities ?? 0} activities`;
        return '';
    };

    return (
        <button
            type="button"
            onClick={onClick}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors text-left shadow-sm ${
                isCurrentUser
                    ? 'bg-white border-emerald-400/40 hover:border-emerald-500/60'
                    : 'bg-white border-gray-200 hover:border-emerald-400/40 hover:bg-gray-50'
            }`}
        >
            <div
                className="flex items-center justify-center flex-shrink-0"
                style={{
                    transform: rank === 1 ? 'scale(1.4)' : rank === 2 ? 'scale(1.3)' : rank === 3 ? 'scale(1.2)' : 'scale(1.1)',
                    transition: 'transform 0.2s'
                }}
            >
                <MedalHex rank={rank} />
            </div>

            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-emerald-600 flex-shrink-0">
                {entry.username?.[0]?.toUpperCase() ?? '?'}
            </div>

            <span className={`flex-1 font-semibold truncate ${isCurrentUser ? 'text-emerald-600' : 'text-slate-900'}`}>
                {entry.username}
                {isCurrentUser && (
                    <span className="font-bold text-amber-500 text-xs ml-2">you</span>
                )}
            </span>

            <span className={`text-sm font-bold flex-shrink-0 ${isCurrentUser ? 'text-emerald-600' : 'text-slate-500'}`}>
                {formatValue()}
            </span>
        </button>
    );
}

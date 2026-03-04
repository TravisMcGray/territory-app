// ========== DASHBOARD PAGE ==========
// Main hub after login. Shows stats, quick actions, and recent activity.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProfile, getFeed, getHexagonLeaderboard } from '../services/api';
import HexBackground from '../components/HexBackground';
import Navbar from '../components/Navbar';

// ========== STAT CARD ICONS ==========
// Matches the leaderboard hexagon style exactly:
// dark fill, colored stroke, strokeWidth 3.

const HexIcon = ({ stroke, children }) => (
    <svg width="36" height="36" viewBox="0 0 28 28" fill="none">
        <polygon
            // Flat-top (matches HexBackground — CORRECT shape)
            points="2,14 8,3 20,3 26,14 20,25 8,25"
            fill="#0e0d0d"
            stroke={stroke}
            strokeWidth="2"
        />
        {children}
    </svg>
);

// Hexagons owned — dot grid pattern
// Hexagons owned — matches leaderboard HexTerritoryIcon style
const HexOwnedIcon = () => (
    <HexIcon stroke="#10b981">
        <text x="14" y="17" textAnchor="middle" fontSize="8" fill="#10b981" fontWeight="800">HEX</text>
    </HexIcon>
);

// Distance — matches leaderboard HexDistanceIcon style
const HexDistanceIcon = () => (
    <HexIcon stroke="#3b82f6">
        <line x1="8" y1="14" x2="20" y2="14" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="8" y1="11" x2="8" y2="17" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="20" y1="11" x2="20" y2="17" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round"/>
    </HexIcon>
);

// Activities — lightning bolt
const HexActivitiesIcon = () => (
    <HexIcon stroke="#a855f7">
        <polyline
            points="16,8 12,14 15,14 12,20"
            stroke="#a855f7"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
        />
    </HexIcon>
);

// Stolen — cross/sword shape
const HexStolenIcon = () => (
    <HexIcon stroke="#ef4444">
        <line x1="14" y1="7" x2="14" y2="21" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="9" y1="12" x2="19" y2="12" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round"/>
    </HexIcon>
);

// ========== MEDAL HEXAGONS ==========
// Exact same style as Leaderboard.jsx — dark fill, colored stroke, thick border.
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
                // Flat-top (matches HexBackground — CORRECT shape)
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
            // Flat-top (matches HexBackground — CORRECT shape)
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

export default function Dashboard() {
    const navigate = useNavigate();

    const [profile, setProfile] = useState(null);
    const [feed, setFeed] = useState([]);
    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);

    // ========== LOAD DATA ==========
    useEffect(() => {
        const loadDashboard = async () => {
            try {
                const [profileRes, feedRes, leaderRes] = await Promise.all([
                    getProfile(),
                    getFeed(),
                    getHexagonLeaderboard(),
                ]);
                setProfile(profileRes.data.profile);
                setFeed(feedRes.data.activities || []);
                setLeaderboard(leaderRes.data.leaderboard || []);
            } catch (err) {
                console.error('Dashboard load error:', err);
            } finally {
                setLoading(false);
            }
        };

        loadDashboard();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <div className="text-emerald-400 text-lg font-semibold animate-pulse">
                    Loading dashboard data...
                </div>
            </div>
        );
    }

    const stats = profile?.stats || {};

    // ========== RENDER ==========
    return (
        <div className="min-h-screen bg-gray-950 text-white relative">
            <HexBackground />
            <Navbar />

            <div className="max-w-6xl mx-auto px-4 py-6 space-y-6 relative z-10">

                {/* ========== WELCOME ========== */}
                <div>
                    <h2 className="text-2xl font-bold">
                        Welcome back, <span className="text-emerald-400">{profile?.username}</span>
                    </h2>
                    <p className="font-bold text-gray-300 text-sm mt-1">
                        Ready to capture more territory?
                    </p>
                </div>

                {/* ========== STATS GRID ========== */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatCard
                        label="Hexagons Owned"
                        value={stats.territoriesOwned ?? 0}
                        accent="emerald"
                        icon={<HexOwnedIcon />}
                    />
                    <StatCard
                        label="Total Distance"
                        value={`${(stats.totalDistance ?? 0).toFixed(1)}mi`}
                        accent="blue"
                        icon={<HexDistanceIcon />}
                    />
                    <StatCard
                        label="Activities"
                        value={stats.totalActivities ?? 0}
                        accent="purple"
                        icon={<HexActivitiesIcon />}
                    />
                    <StatCard
                        label="Stolen"
                        value={stats.territoriesStolenFrom ?? 0}
                        accent="red"
                        icon={<HexStolenIcon />}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* ========== RECENT FEED ========== */}
                    <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-lg">Recent Activity</h3>
                            <button
                                onClick={() => navigate('/feed')}
                                className="font-bold text-emerald-400 text-sm hover:text-emerald-300 transition-colors"
                            >
                                View all
                            </button>
                        </div>
                        {feed.length === 0 ? (
                            <div className="text-center py-8">
                                <p className="font-bold text-gray-300 text-sm">No activity yet.</p>
                                <p className="font-bold text-gray-400 text-xs mt-1">
                                    Follow people or log your first activity!
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {feed.slice(0, 4).map(activity => (
                                    <ActivityItem key={activity._id} activity={activity} />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* ========== LEADERBOARD PREVIEW ========== */}
                    <div className="bg-gray-900 rounded-2xl border border-gray-800 p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-lg">Hexagon Leaderboard</h3>
                            <button
                                onClick={() => navigate('/leaderboard')}
                                className="font-bold text-emerald-400 text-sm hover:text-emerald-300 transition-colors"
                            >
                                View all
                            </button>
                        </div>
                        {leaderboard.length === 0 ? (
                            <div className="text-center py-8">
                                <p className="text-gray-400 font-bold text-sm">No data yet.</p>
                                <p className="text-gray-500 font-bold text-xs mt-1">
                                    Be the first to capture territory!
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {leaderboard.slice(0, 5).map((entry, index) => (
                                    <LeaderboardItem
                                        key={entry.id}
                                        entry={entry}
                                        rank={index + 1}
                                        currentUserId={profile?._id}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ========== STAT CARD ==========
// Icon on the left, value and label centered in the remaining space.
function StatCard({ label, value, accent, icon }) {
    const accentColors = {
        emerald: 'text-emerald-400',
        blue: 'text-blue-400',
        purple: 'text-purple-400',
        red: 'text-red-400',
    };

    return (
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4 flex items-center gap-3">
            {/* Icon on the left */}
            <div className="flex-shrink-0">
                {icon}
            </div>
            {/* Value + label centered in remaining space */}
            <div className="flex-1 text-center">
                <div className={`text-2xl font-black ${accentColors[accent]}`}>
                    {value}
                </div>
                <div className="text-gray-400 text-xs mt-0.5 font-bold">{label}</div>
            </div>
        </div>
    );
}

// ========== ACTIVITY ITEM ==========
function ActivityItem({ activity }) {
    const isWalk = activity.activityType === 'WALKING';
    const distance = (activity.distance ?? 0).toFixed(2);
    const hexCount = activity.capturedHexagons ?? 0;

    return (
        <div className="flex items-center gap-3 py-2 border-b border-gray-800 last:border-0">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                isWalk ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400'
            }`}>
                {isWalk ? '🚶' : '🏃'}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">
                    {activity.username ?? 'Unknown'}
                </p>
                <p className="text-gray-500 text-xs">
                    {distance}mi · {hexCount} hexagons
                </p>
            </div>
            <div className="text-gray-600 text-xs flex-shrink-0">
                {isWalk ? 'Walk' : 'Run'}
            </div>
        </div>
    );
}

// ========== LEADERBOARD ITEM ==========
function LeaderboardItem({ entry, rank, currentUserId }) {
    const isCurrentUser = entry.id === currentUserId;

    return (
        <div className={`flex items-center gap-3 px-3 py-2 rounded-xl ${
            isCurrentUser ? 'bg-emerald-500/10 border border-emerald-500/30' : 'hover:bg-gray-800'
        } transition-colors`}>
            <div className="flex items-center justify-center flex-shrink-0">
                <MedalHex rank={rank} />
            </div>
            <span className={`flex-1 text-sm font-semibold truncate ${
                isCurrentUser ? 'text-emerald-400' : 'text-white'
            }`}>
                {entry.username}
            </span>
            <span className="text-emerald-400 text-sm font-bold flex-shrink-0">
                {entry.hexagons} hex
            </span>
        </div>
    );
}
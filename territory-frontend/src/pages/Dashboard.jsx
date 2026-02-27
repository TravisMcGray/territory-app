// ========== DASHBOARD PAGE ==========
// Main hub after login. Shows stats, quick actions, and recent activity.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getProfile, getFeed, getHexagonLeaderboard } from '../services/api';
import HexBackground from '../components/HexBackground';

export default function Dashboard() {
    const { user, logoutUser } = useAuth();
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
                setProfile(profileRes.data.profile);  // ← was .user, backend returns .profile
                setFeed(feedRes.data.activities || []);
                setLeaderboard(leaderRes.data.leaderboard || []);            } catch (err) {
                console.error('Dashboard load error:', err);
            } finally {
                setLoading(false);
            }
        };

        loadDashboard();
    }, []);

    const handleLogout = () => {
        logoutUser();
        navigate('/login');
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <div className="text-emerald-400 text-lg font-semibold animate-pulse">
                    Loading territory data...
                </div>
            </div>
        );
    }

    const stats = profile?.stats || {};

    // ========== RENDER ==========
return (
    <div className="min-h-screen bg-gray-950 text-white relative">
        <HexBackground />

        {/* ========== NAVBAR ========== */}
            <nav className="border-b border-gray-800 bg-gray-900 px-4 py-3 sticky top-0 z-10">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <h1 className="text-xl font-black tracking-tight">
                        Territory<span className="text-emerald-400">Capture</span>
                    </h1>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/profile')}
                            className="text-gray-400 hover:text-white text-sm transition-colors hidden sm:block"
                        >
                            {profile?.username}
                        </button>
                        <button
                            onClick={() => navigate('/log-activity')}
                            className="bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors"
                        >
                            + Log Activity
                        </button>
                        <button
                            onClick={handleLogout}
                            className="text-gray-500 hover:text-white text-sm transition-colors"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </nav>

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
                    />
                    <StatCard
                        label="Total Distance"
                        value={`${((stats.totalDistance ?? 0) / 1000).toFixed(1)}km`}
                        accent="blue"
                    />
                    <StatCard
                        label="Activities"
                        value={stats.totalActivities ?? 0}
                        accent="purple"
                    />
                    <StatCard
                        label="Stolen"
                        value={stats.territoriesStolenFrom ?? 0}
                        accent="red"
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
                                <p className="text-gray-600 text-sm">No data yet.</p>
                                <p className="text-gray-700 text-xs mt-1">
                                    Be the first to capture territory!
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {leaderboard.slice(0, 5).map((entry, index) => (
                                    <LeaderboardItem
                                        key={entry.id} // ← backend returns .id not ._id
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

// ========== SUB COMPONENTS ==========

function StatCard({ label, value, accent }) {
    const accents = {
        emerald: 'text-emerald-400 bg-emerald-400',
        blue: 'text-blue-400 bg-blue-400',
        purple: 'text-purple-400 bg-purple-400',
        red: 'text-red-400 bg-red-400',
    };

    return (
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-4">
            <div className={`text-2xl font-black ${accents[accent].split(' ')[0]}`}>
                {value}
            </div>
            <div className="text-gray-400 text-xs mt-1 font-bold">{label}</div>
        </div>
    );
}

function ActivityItem({ activity }) {
    const isWalk = activity.activityType === 'WALKING';
    const distance = ((activity.distance ?? 0) / 1000).toFixed(2);
    const hexCount = activity.hexagonsCaptured?.length ?? 0;

    return (
        <div className="flex items-center gap-3 py-2 border-b border-gray-800 last:border-0">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                isWalk ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400'
            }`}>
                {isWalk ? '🚶' : '🏃'}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">
                    {activity.userId?.username ?? 'Unknown'}
                </p>
                <p className="text-gray-500 text-xs">
                    {distance}km · {hexCount} hexagons
                </p>
            </div>
            <div className="text-gray-600 text-xs flex-shrink-0">
                {isWalk ? 'Walk' : 'Run'}
            </div>
        </div>
    );
}

function LeaderboardItem({ entry, rank, currentUserId }) {
    const isCurrentUser = entry.id === currentUserId;
    const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };

    return (
        <div className={`flex items-center gap-3 px-3 py-2 rounded-xl ${
            isCurrentUser ? 'bg-emerald-500/10 border border-emerald-500/30' : 'hover:bg-gray-800'
        } transition-colors`}>
            <span className="text-sm w-6 text-center flex-shrink-0">
                {medals[rank] ?? `${rank}`}
            </span>
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
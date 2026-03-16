// ========== PROFILE PAGE ==========
// Serves double duty:
// - /profile → your own profile (own stats, achievements, activities)
// - /profile/:userId → someone else's profile (public stats, follow button)
//
// isOwnProfile check normalizes both user.id and user._id from AuthContext
// because getProfile() returns 'id' but the context may hydrate either field.

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    getProfile,
    getUserById,
    getUserAchievements,
    getActivities,
    followUser,
    unfollowUser,
} from '../services/api';
import HexBackground from '../components/HexBackground';
import Navbar from '../components/Navbar';

// ========== PROFILE TAB ICONS ==========
const ActivityTabIcon = ({ color = 'currentColor' }) => (
    <svg width="14" height="14" viewBox="0 0 28 28" fill="none">
        <polyline
            points="2,14 6,14 9,6 13,22 17,10 20,14 26,14"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
        />
    </svg>
);

const AchievementTabIcon = ({ color = 'currentColor' }) => (
    <svg width="14" height="14" viewBox="0 0 28 28" fill="none">
        <polygon
            points="2,14 8,3 20,3 26,14 20,25 8,25"
            stroke={color}
            strokeWidth="2.5"
            fill="none"
        />
        <circle cx="14" cy="14" r="2" fill={color} />
    </svg>
);

// ========== TIME HELPER ==========
const timeAgo = (dateString) => {
    const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric',
    });
};

// ========== MAIN COMPONENT ==========
export default function Profile() {
    const navigate = useNavigate();
    const { userId } = useParams();
    const { user: currentUser } = useAuth();

    // Normalize: getProfile() returns 'id', AuthContext may store '_id' or 'id'
    // Use whichever is populated to avoid "undefined" string comparison bugs
    const currentUserId = currentUser?.id ?? currentUser?._id;
    const isOwnProfile = !userId || String(userId) === String(currentUserId);

    const [profile, setProfile] = useState(null);
    const [achievements, setAchievements] = useState([]);
    const [activities, setActivities] = useState([]);
    const [followersCount, setFollowersCount] = useState(0);
    const [followingCount, setFollowingCount] = useState(0);
    const [isFollowing, setIsFollowing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [followLoading, setFollowLoading] = useState(false);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('activities');

    // ========== LOAD PROFILE DATA ==========
    useEffect(() => {
        const loadProfile = async () => {
            try {
                if (isOwnProfile) {
                    // Own profile: load profile + unlocked achievements + activity history
                    const [profileRes, achievementsRes, activitiesRes] = await Promise.all([
                        getProfile(),
                        getUserAchievements(),  // GET /api/achievements/user → populated unlocked list
                        getActivities(),
                    ]);

                    const profileData = profileRes.data.profile;
                    setProfile(profileData);
                    setActivities(activitiesRes.data.activities || []);

                    // followers/following are Numbers on own profile response
                    setFollowersCount(profileData.followers ?? 0);
                    setFollowingCount(profileData.following ?? 0);

                    // Each achievement: { achievementId: { name, description, rarity, ... }, unlockedAt }
                    setAchievements(achievementsRes.data.achievements || []);

                } else {
                    // Other user: GET /api/users/:userId → toPublicJSON + relationshipStatus
                    const profileRes = await getUserById(userId);
                    const userData = profileRes.data.user;
                    const relationship = profileRes.data.relationshipStatus;

                    setProfile(userData);

                    // followers/following are Numbers on toPublicJSON
                    setFollowersCount(userData.followers ?? 0);
                    setFollowingCount(userData.following ?? 0);
                    setIsFollowing(relationship?.isFollowing ?? false);
                }
            } catch (err) {
                console.error('Profile load error:', err);
                setError('Failed to load profile.');
            } finally {
                setLoading(false);
            }
        };

        loadProfile();
    }, [userId, isOwnProfile]);

    // ========== FOLLOW TOGGLE ==========
    const handleFollowToggle = async () => {
        setFollowLoading(true);
        try {
            if (isFollowing) {
                await unfollowUser(userId);
                setIsFollowing(false);
                setFollowersCount(prev => Math.max(0, prev - 1));
            } else {
                await followUser(userId);
                setIsFollowing(true);
                setFollowersCount(prev => prev + 1);
            }
        } catch (err) {
            // silently fail — state stays as-is
        } finally {
            setFollowLoading(false);
        }
    };

    // ========== LOADING STATE ==========
    if (loading) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <div className="text-emerald-400 text-lg font-semibold animate-pulse">
                    Loading profile data...
                </div>
            </div>
        );
    }

    if (error || !profile) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <div className="text-red-400 text-center">
                    <p className="text-lg font-bold">Profile not found</p>
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="font-bold text-emerald-400 text-sm mt-3 hover:text-emerald-300"
                    >
                        ← Back to dashboard
                    </button>
                </div>
            </div>
        );
    }

    const stats = profile.stats || {};

    // ========== RENDER ==========
    return (
        <div className="min-h-screen bg-gray-950 text-white relative">
            <HexBackground />
            <Navbar />

            <div className="max-w-lg mx-auto px-4 py-6 relative z-10 space-y-6">

                {/* ========== PROFILE HEADER ========== */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-gray-800 border border-gray-700 flex items-center justify-center text-2xl font-black text-emerald-400">
                                {profile.username?.[0]?.toUpperCase() ?? '?'}
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-white">
                                    {profile.username}
                                </h2>
                                <p className="font-bold text-gray-400 text-sm mt-0.5">
                                    Member since {new Date(profile.createdAt).toLocaleDateString('en-US', {
                                        month: 'long',
                                        year: 'numeric',
                                    })}
                                </p>
                            </div>
                        </div>

                        {/* Follow / Unfollow — only on other users' profiles */}
                        {!isOwnProfile && (
                            <button
                                type="button"
                                onClick={handleFollowToggle}
                                disabled={followLoading}
                                className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                                    isFollowing
                                        ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                                        : 'bg-emerald-500 hover:bg-emerald-400 text-white'
                                }`}
                            >
                                {followLoading ? '...' : isFollowing ? 'Following' : 'Follow'}
                            </button>
                        )}
                    </div>

                    {/* ========== STATS GRID ========== */}
                    {/* totalStolenTerritories is included in toPublicJSON — intentional, it's a competitive stat */}
                    <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-gray-800">
                        <div className="text-center">
                            <div className="text-xl font-black text-white">{followersCount}</div>
                            <div className="text-gray-400 text-xs font-bold mt-0.5">Followers</div>
                        </div>
                        <div className="text-center">
                            <div className="text-xl font-black text-white">{followingCount}</div>
                            <div className="text-gray-400 text-xs font-bold mt-0.5">Following</div>
                        </div>
                        <div className="text-center">
                            <div className="text-xl font-black text-emerald-400">
                                {stats.totalHexagonsCaptured ?? 0}
                            </div>
                            <div className="text-gray-400 text-xs font-bold mt-0.5">Hexagons</div>
                        </div>
                        <div className="text-center">
                            <div className="text-xl font-black text-blue-400">
                                {(stats.totalDistance ?? 0).toFixed(1)}
                            </div>
                            <div className="text-gray-400 text-xs font-bold mt-0.5">Miles</div>
                        </div>
                        <div className="text-center">
                            <div className="text-xl font-black text-purple-400">
                                {(stats.totalWalks ?? 0) + (stats.totalRuns ?? 0)}
                            </div>
                            <div className="text-gray-400 text-xs font-bold mt-0.5">Activities</div>
                        </div>
                        <div className="text-center">
                            <div className="text-xl font-black text-red-400">
                                {stats.totalStolenTerritories ?? 0}
                            </div>
                            <div className="text-gray-400 text-xs font-bold mt-0.5">Stolen</div>
                        </div>
                    </div>
                </div>

                {/* ========== TABS — own profile only ========== */}
                {/* No public endpoint exists for other users' activity history or achievements */}
                {isOwnProfile && (
                    <>
                        <div className="flex bg-gray-900 border border-gray-800 rounded-xl p-1 gap-1">
                            <button
                                type="button"
                                onClick={() => setActiveTab('activities')}
                                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                                    activeTab === 'activities'
                                        ? 'bg-emerald-500 text-white'
                                        : 'text-gray-500 hover:text-white'
                                }`}
                            >
                                <ActivityTabIcon color={activeTab === 'activities' ? '#ffffff' : '#6b7280'} />
                                Activities
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('achievements')}
                                className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                                    activeTab === 'achievements'
                                        ? 'bg-emerald-500 text-white'
                                        : 'text-gray-500 hover:text-white'
                                }`}
                            >
                                <AchievementTabIcon color={activeTab === 'achievements' ? '#ffffff' : '#6b7280'} />
                                Achievements
                            </button>
                        </div>

                        {/* ========== ACTIVITIES TAB ========== */}
                        {activeTab === 'activities' && (
                            <div className="space-y-3">
                                {activities.length === 0 ? (
                                    <div className="text-center py-12">
                                        <svg width="48" height="48" viewBox="0 0 28 28" fill="none" className="mx-auto mb-3">
                                            <polygon points="2,14 8,3 20,3 26,14 20,25 8,25" stroke="#374151" strokeWidth="2" fill="#0e0d0d"/>
                                            <polyline
                                                points="5,14 8,14 11,9 15,19 18,12 21,14 24,14"
                                                stroke="#374151"
                                                strokeWidth="1.5"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                fill="none"
                                            />
                                        </svg>
                                        <p className="text-white font-bold">No activities yet</p>
                                        <p className="text-gray-400 text-sm font-bold mt-1">
                                            Get outside and start capturing territory!
                                        </p>
                                    </div>
                                ) : (
                                    activities.map(activity => (
                                        <ActivityRow key={activity._id} activity={activity} />
                                    ))
                                )}
                            </div>
                        )}

                        {/* ========== ACHIEVEMENTS TAB ========== */}
                        {activeTab === 'achievements' && (
                            <div className="space-y-3">
                                {achievements.length === 0 ? (
                                    <div className="text-center py-12">
                                        <svg width="48" height="48" viewBox="0 0 28 28" fill="none" className="mx-auto mb-3">
                                            <polygon points="2,14 8,3 20,3 26,14 20,25 8,25" stroke="#374151" strokeWidth="2" fill="#0e0d0d"/>
                                            <text x="14" y="15" textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="#374151" fontWeight="800" fontFamily="Oxanium, sans-serif">HEX</text>
                                        </svg>
                                        <p className="text-white font-bold">No achievements yet</p>
                                        <p className="text-gray-400 text-sm font-bold mt-1">
                                            Log activities to unlock achievements!
                                        </p>
                                    </div>
                                ) : (
                                    achievements.map((achievement, index) => (
                                        <AchievementRow
                                            key={achievement._id ?? achievement.achievementId?._id ?? index}
                                            achievement={achievement}
                                        />
                                    ))
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

// ========== ACTIVITY ROW ==========
function ActivityRow({ activity }) {
    const isWalk = activity.activityType === 'walk' || activity.activityType === 'WALK';
    const distanceMiles = (activity.distance ?? 0).toFixed(2);

    const formatDuration = (seconds) => {
        if (!seconds) return '0m';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m`;
    };

    // capturedHexagons from GET /api/activities is a full array — use .length
    const hexCount = Array.isArray(activity.capturedHexagons)
        ? activity.capturedHexagons.length
        : (activity.capturedHexagons ?? 0);

    return (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${
                isWalk ? 'bg-blue-500/20' : 'bg-emerald-500/20'
            }`}>
                {isWalk ? '🚶' : '🏃'}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm capitalize">
                    {activity.activityType?.toLowerCase()}
                </p>
                <p className="text-gray-400 text-xs font-bold mt-0.5">
                    {distanceMiles}mi · {formatDuration(activity.duration)} · {hexCount} hexagons
                </p>
            </div>
            <div className="text-gray-500 text-xs font-bold flex-shrink-0">
                {timeAgo(activity.createdAt)}
            </div>
        </div>
    );
}

// ========== ACHIEVEMENT ROW ==========
// Shape from GET /api/achievements/user:
// { achievementId: { name, description, rarity, points, badgeUrl }, unlockedAt }
// Every item from this endpoint is already unlocked — no locked state needed.
function AchievementRow({ achievement }) {
    const details = achievement.achievementId ?? {};
    const name = details.name ?? 'Achievement';
    const description = details.description ?? '';
    const rarity = details.rarity ?? '';
    const unlockedAt = achievement.unlockedAt;

    return (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3">
            <div className="text-2xl flex-shrink-0">🏆</div>
            <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-white">{name}</p>
                <p className="text-gray-400 text-xs font-bold mt-0.5">{description}</p>
                {unlockedAt && (
                    <p className="text-emerald-400 text-xs mt-1 font-bold">
                        Unlocked {timeAgo(unlockedAt)}
                    </p>
                )}
            </div>
            {rarity && (
                <div className="text-emerald-400 text-xs font-bold uppercase tracking-wide flex-shrink-0">
                    {rarity}
                </div>
            )}
        </div>
    );
}
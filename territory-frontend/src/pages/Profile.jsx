// ========== PROFILE PAGE ==========
// Serves double duty:
// - /profile → your own profile
// - /profile/:userId → someone else's profile
// Same component, two modes. Own profile shows edit options,
// other profile shows follow/unfollow button.

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
    getFollowers,
    getFollowing,
} from '../services/api';
import HexBackground from '../components/HexBackground';
import Navbar from '../components/Navbar';

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

    // If no userId in URL, we're viewing our own profile
    const isOwnProfile = !userId || userId === currentUser?._id;

    const [profile, setProfile] = useState(null);
    const [achievements, setAchievements] = useState([]);
    const [activities, setActivities] = useState([]);
    const [followers, setFollowers] = useState([]);
    const [following, setFollowing] = useState([]);
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
                // Load own profile
                const [profileRes, achievementsRes, activitiesRes] = await Promise.all([
                    getProfile(),
                    getUserAchievements(),
                    getActivities(),
                ]);
                setProfile(profileRes.data.profile);
                setAchievements(achievementsRes.data.achievements || []);
                setActivities(activitiesRes.data.activities || []);

                const profileId = profileRes.data.profile.id;
                const [followersRes, followingRes] = await Promise.all([
                    getFollowers(profileId),
                    getFollowing(profileId),
                ]);
                setFollowers(followersRes.data.followers || []);
                setFollowing(followingRes.data.following || []);

            } else {
                // Load someone else's profile
                const profileRes = await getUserById(userId);
                setProfile(profileRes.data.user);
                setFollowers(Array(profileRes.data.relationshipStatus.followerCount).fill({}));
                setFollowing(Array(profileRes.data.relationshipStatus.followingCount).fill({}));
                setIsFollowing(profileRes.data.relationshipStatus.isFollowing);
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

            {/* Navbar */}
            <Navbar />

            <div className="max-w-lg mx-auto px-4 py-6 relative z-10 space-y-6">

                {/* ========== PROFILE HEADER ========== */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                            {/* Avatar */}
                            <div className="w-16 h-16 rounded-2xl bg-gray-800 border border-gray-700 flex items-center justify-center text-2xl font-black text-emerald-400">
                                {profile.username?.[0]?.toUpperCase() ?? '?'}
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-white">
                                    {profile.username}
                                </h2>
                                <p className="text-gray-400 text-sm mt-0.5">
                                    Member since {new Date(profile.createdAt).toLocaleDateString('en-US', {
                                        month: 'long',
                                        year: 'numeric',
                                    })}
                                </p>
                            </div>
                        </div>

                        {/* Follow button — only on other profiles */}
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

                    {/* Followers / Following counts */}
                    <div className="flex gap-6 mt-5 pt-5 border-t border-gray-800">
                        <div className="text-center">
                            <div className="text-xl font-black text-white">
                                {followers.length}
                            </div>
                            <div className="text-gray-400 text-xs font-bold mt-0.5">
                                Followers
                            </div>
                        </div>
                        <div className="text-center">
                            <div className="text-xl font-black text-white">
                                {following.length}
                            </div>
                            <div className="text-gray-400 text-xs font-bold mt-0.5">
                                Following
                            </div>
                        </div>
                        <div className="text-center">
                            <div className="text-xl font-black text-emerald-400">
                                {stats.territoriesOwned ?? 0}
                            </div>
                            <div className="text-gray-400 text-xs font-bold mt-0.5">
                                Hexagons
                            </div>
                        </div>
                        <div className="text-center">
                            <div className="text-xl font-black text-blue-400">
                                {((stats.totalDistance ?? 0) / 1609).toFixed(1)}
                            </div>
                            <div className="text-gray-400 text-xs font-bold mt-0.5">
                                Miles
                            </div>
                        </div>
                        <div className="text-center">
                            <div className="text-xl font-black text-purple-400">
                                {stats.totalActivities ?? 0}
                            </div>
                            <div className="text-gray-400 text-xs font-bold mt-0.5">
                                Activities
                            </div>
                        </div>
                    </div>
                </div>

                {/* ========== TABS ========== */}
                <div className="flex bg-gray-900 border border-gray-800 rounded-xl p-1 gap-1">
                    {['activities', 'achievements'].map(tab => (
                        <button
                            key={tab}
                            type="button"
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all capitalize ${
                                activeTab === tab
                                    ? 'bg-emerald-500 text-white'
                                    : 'text-gray-500 hover:text-white'
                            }`}
                        >
                            {tab === 'activities' ? '🏃 Activities' : '🏆 Achievements'}
                        </button>
                    ))}
                </div>

                {/* ========== ACTIVITIES TAB ========== */}
                {activeTab === 'activities' && (
                    <div className="space-y-3">
                        {activities.length === 0 ? (
                            <div className="text-center py-12">
                                <div className="text-4xl mb-3">🗺️</div>
                                <p className="text-white font-bold">No activities yet</p>
                                <p className="text-gray-400 text-sm font-bold mt-1">
                                    Get outside and start capturing territory!
                                </p>
                            </div>
                        ) : (
                            activities.slice(0, 10).map(activity => (
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
                                <div className="text-4xl mb-3">🏆</div>
                                <p className="text-white font-bold">No achievements yet</p>
                                <p className="text-gray-400 text-sm font-bold mt-1">
                                    Log activities to unlock achievements!
                                </p>
                            </div>
                        ) : (
                            achievements.map(achievement => (
                                <AchievementRow
                                    key={achievement._id}
                                    achievement={achievement}
                                />
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// ========== ACTIVITY ROW ==========
function ActivityRow({ activity }) {
    const isWalk = activity.activityType === 'walk' || activity.activityType === 'WALKING';
    const distanceMiles = (activity.distance ?? 0).toFixed(2);

    const formatDuration = (seconds) => {
        if (!seconds) return '0m';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m`;
    };

    return (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${
                isWalk ? 'bg-blue-500/20' : 'bg-emerald-500/20'
            }`}>
                {isWalk ? '🚶' : '🏃'}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-sm capitalize">
                    {activity.activityType}
                </p>
                <p className="text-gray-400 text-xs font-bold mt-0.5">
                    {distanceMiles}mi · {formatDuration(activity.duration)} · {activity.capturedHexagons ?? 0} hexagons
                </p>
            </div>
            <div className="text-gray-500 text-xs font-bold flex-shrink-0">
                {timeAgo(activity.createdAt)}
            </div>
        </div>
    );
}

// ========== ACHIEVEMENT ROW ==========
function AchievementRow({ achievement }) {
    const isUnlocked = achievement.unlockedAt || achievement.earned;

    return (
        <div className={`border rounded-xl p-4 flex items-center gap-3 ${
            isUnlocked
                ? 'bg-emerald-500/10 border-emerald-500/30'
                : 'bg-gray-900 border-gray-800 opacity-50'
        }`}>
            <div className="text-2xl flex-shrink-0">
                {isUnlocked ? '🏆' : '🔒'}
            </div>
            <div className="flex-1 min-w-0">
                <p className={`font-bold text-sm ${
                    isUnlocked ? 'text-white' : 'text-gray-500'
                }`}>
                    {achievement.name ?? achievement.achievementId?.name ?? 'Achievement'}
                </p>
                <p className="text-gray-400 text-xs font-bold mt-0.5">
                    {achievement.description ?? achievement.achievementId?.description ?? ''}
                </p>
                {isUnlocked && achievement.unlockedAt && (
                    <p className="text-emerald-400 text-xs mt-1 font-bold">
                        Unlocked {timeAgo(achievement.unlockedAt)}
                    </p>
                )}
            </div>
            {isUnlocked && (
                <div className="text-emerald-400 text-xs font-bold uppercase tracking-wide flex-shrink-0">
                    {achievement.rarity ?? achievement.achievementId?.rarity ?? ''}
                </div>
            )}
        </div>
    );
}
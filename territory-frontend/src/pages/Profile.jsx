import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    getProfile,
    getUserById,
    getUserActivities,
    getUserAchievements,
    getAllAchievements,
    getActivities,
    followUser,
    unfollowUser,
    requestAccountDeletion,
    confirmAccountDeletion,
    updateBodyStats,
    updateUsername,
} from '../services/api';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getCustomLightStyle } from '../utils/mapStyle';
import HexBackground from '../components/HexBackground';
import Navbar from '../components/Navbar';

const ActivityTabIcon = ({ color = 'currentColor' }) => (
    <svg width="14" height="14" viewBox="0 0 28 28" fill="none">
        <polyline points="2,14 6,14 9,6 13,22 17,10 20,14 26,14"
            stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
);

const AchievementTabIcon = ({ color = 'currentColor' }) => (
    <svg width="14" height="14" viewBox="0 0 28 28" fill="none">
        <polygon points="2,14 8,3 20,3 26,14 20,25 8,25" stroke={color} strokeWidth="2.5" fill="none"/>
        <circle cx="14" cy="14" r="2" fill={color} />
    </svg>
);

const SettingsTabIcon = ({ color = 'currentColor' }) => (
    <svg width="14" height="14" viewBox="0 0 28 28" fill="none">
        <circle cx="14" cy="14" r="5" stroke={color} strokeWidth="2.5" fill="none" />
        <line x1="14" y1="2" x2="14" y2="7" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
        <line x1="14" y1="21" x2="14" y2="26" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
        <line x1="2" y1="14" x2="7" y2="14" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
        <line x1="21" y1="14" x2="26" y2="14" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
);

const timeAgo = (dateString) => {
    const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

function DeleteAccountModal({ profile, onClose, onDeleted }) {
    const [step, setStep] = useState('warning');
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleRequestDeletion = async () => {
        setLoading(true);
        setError('');
        try {
            await requestAccountDeletion();
            setStep('code');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to send code. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmDeletion = async () => {
        if (code.trim().length !== 6) {
            setError('Please enter the 6-digit code from your email.');
            return;
        }
        setLoading(true);
        setError('');
        try {
            await confirmAccountDeletion({ code: code.trim() });
            setStep('success');
            setTimeout(() => onDeleted(), 3000);
        } catch (err) {
            setError(err.response?.data?.message || 'Invalid or expired code. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md">

                {step === 'warning' && (
                    <>
                        <div className="text-center mb-6">
                            <div className="text-4xl mb-3">⚠️</div>
                            <h2 className="text-xl font-black text-white mb-2">Delete Account</h2>
                            <p className="text-gray-400 text-sm font-bold">
                                This action is <span className="text-red-400">permanent and cannot be undone.</span>
                            </p>
                        </div>
                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6 space-y-2">
                            <p className="text-red-400 text-xs font-black uppercase tracking-wide mb-3">
                                The following will be permanently deleted:
                            </p>
                            {[
                                'Your account and profile',
                                'All captured territories on the map',
                                'All activities and route history',
                                'All comments and kudos',
                                'All followers and following',
                                'All achievements and stats',
                            ].map((item, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <span className="text-red-400 text-xs">✕</span>
                                    <span className="text-gray-300 text-sm">{item}</span>
                                </div>
                            ))}
                        </div>
                        <p className="text-gray-400 text-sm text-center mb-6">
                            We'll send a confirmation code to{' '}
                            <span className="text-white font-bold">{profile?.email}</span>
                        </p>
                        {error && <p className="text-red-400 text-sm text-center mb-4">{error}</p>}
                        <div className="space-y-3">
                            <button type="button" onClick={handleRequestDeletion} disabled={loading}
                                className="w-full bg-red-500 hover:bg-red-600 disabled:bg-gray-800 disabled:text-gray-600 text-white font-black py-3 rounded-xl transition-colors">
                                {loading ? 'Sending code...' : 'Yes, delete my account'}
                            </button>
                            <button type="button" onClick={onClose} disabled={loading}
                                className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-3 rounded-xl transition-colors">
                                Cancel — keep my account
                            </button>
                        </div>
                    </>
                )}

                {step === 'code' && (
                    <>
                        <div className="text-center mb-6">
                            <div className="text-4xl mb-3">📧</div>
                            <h2 className="text-xl font-black text-white mb-2">Check your email</h2>
                            <p className="text-gray-400 text-sm font-bold">
                                We sent a 6-digit code to <span className="text-white">{profile?.email}</span>
                            </p>
                            <p className="text-gray-500 text-xs mt-1">Code expires in 15 minutes</p>
                        </div>
                        <input
                            type="text" value={code}
                            onChange={e => { const val = e.target.value.replace(/\D/g, '').slice(0, 6); setCode(val); setError(''); }}
                            placeholder="000000" maxLength={6}
                            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-4 text-white text-center text-2xl font-black tracking-widest placeholder-gray-600 focus:outline-none focus:border-red-500 transition-colors mb-4"
                        />
                        {error && <p className="text-red-400 text-sm text-center mb-4">{error}</p>}
                        <div className="space-y-3">
                            <button type="button" onClick={handleConfirmDeletion} disabled={loading || code.length !== 6}
                                className="w-full bg-red-500 hover:bg-red-600 disabled:bg-gray-800 disabled:text-gray-600 text-white font-black py-3 rounded-xl transition-colors">
                                {loading ? 'Deleting account...' : 'Permanently delete my account'}
                            </button>
                            <button type="button" onClick={onClose} disabled={loading}
                                className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-3 rounded-xl transition-colors">
                                Cancel — keep my account
                            </button>
                        </div>
                        <p className="text-center mt-4">
                            <button type="button" onClick={handleRequestDeletion} disabled={loading}
                                className="text-gray-500 hover:text-gray-300 text-xs font-bold transition-colors">
                                Didn't receive it? Resend code
                            </button>
                        </p>
                    </>
                )}

                {step === 'success' && (
                    <div className="text-center py-4">
                        <div className="text-4xl mb-4">👋</div>
                        <h2 className="text-xl font-black text-white mb-2">Account deleted</h2>
                        <p className="text-gray-400 text-sm font-bold">
                            Your account has been permanently deleted. Thanks for being part of HexCapture.
                        </p>
                        <p className="text-gray-500 text-xs mt-3">Redirecting you now...</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function Profile() {
    const navigate = useNavigate();
    const { userId } = useParams();
    const { user: currentUser, logoutUser } = useAuth();

    const currentUserId = currentUser?.id ?? currentUser?._id;
    const isOwnProfile = !userId || String(userId) === String(currentUserId);

    const [profile, setProfile] = useState(null);
    const [achievements, setAchievements] = useState([]);
    const [activities, setActivities] = useState([]);
    const [userActivities, setUserActivities] = useState([]);
    const [selectedActivity, setSelectedActivity] = useState(null);
    const [followersCount, setFollowersCount] = useState(0);
    const [followingCount, setFollowingCount] = useState(0);
    const [isFollowing, setIsFollowing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [followLoading, setFollowLoading] = useState(false);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('activities');
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    useEffect(() => {
        const loadProfile = async () => {
            try {
                if (isOwnProfile) {
                    const [profileRes, allAchievementsRes, userAchievementsRes, activitiesRes] = await Promise.all([
                        getProfile(), getAllAchievements(), getUserAchievements(), getActivities(),
                    ]);

                    const profileData = profileRes.data.profile;
                    setProfile(profileData);
                    setActivities(activitiesRes.data.activities || []);
                    setFollowersCount(profileData.followers ?? 0);
                    setFollowingCount(profileData.following ?? 0);

                    const allList = allAchievementsRes.data.achievements || [];
                    const userList = userAchievementsRes.data.achievements || [];

                    const unlockedMap = new Map();
                    for (const ua of userList) {
                        const id = ua.achievementId?._id ?? ua.achievementId;
                        if (id) unlockedMap.set(String(id), ua.unlockedAt);
                    }

                    const merged = allList.map(a => ({
                        ...a,
                        isUnlocked: unlockedMap.has(String(a._id)),
                        unlockedAt: unlockedMap.get(String(a._id)) || null,
                    }));

                    const rarityOrder = { LEGENDARY: 5, EPIC: 4, RARE: 3, UNCOMMON: 2, COMMON: 1 };
                    merged.sort((a, b) => {
                        if (a.isUnlocked !== b.isUnlocked) return a.isUnlocked ? -1 : 1;
                        return (rarityOrder[b.rarity] || 0) - (rarityOrder[a.rarity] || 0);
                    });

                    setAchievements(merged);

                } else {
                    const profileRes = await getUserById(userId);
                    const userData = profileRes.data.user;
                    const relationship = profileRes.data.relationshipStatus;

                    setProfile(userData);
                    setFollowersCount(userData.followers ?? 0);
                    setFollowingCount(userData.following ?? 0);
                    setIsFollowing(relationship?.isFollowing ?? false);

                    try {
                        const activitiesRes = await getUserActivities(userId);
                        setUserActivities(activitiesRes.data.activities || []);
                    } catch { /* non-fatal: profile still shows without activities */ }
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
        } catch { /* non-fatal: button re-enables in finally */ }
        finally { setFollowLoading(false); }
    };

    const handleAccountDeleted = () => {
        if (logoutUser) logoutUser();
        navigate('/login');
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-100 flex items-center justify-center">
                <div className="text-emerald-500 text-lg font-semibold animate-pulse">Loading profile data...</div>
            </div>
        );
    }

    if (error || !profile) {
        return (
            <div className="min-h-screen bg-slate-100 flex items-center justify-center">
                <div className="text-red-500 text-center">
                    <p className="text-lg font-bold">Profile not found</p>
                    <button onClick={() => navigate('/dashboard')}
                        className="font-bold text-emerald-600 text-sm mt-3 hover:text-emerald-500">
                        ← Back to dashboard
                    </button>
                </div>
            </div>
        );
    }

    const stats = profile.stats || {};

    const getTier = (tilesOwned) => {
        if (tilesOwned >= 500) return { level: 4, name: 'Overlord',   color: '#ff00aa', next: null,  progress: 100, from: 500 };
        if (tilesOwned >= 200) return { level: 3, name: 'Commander',  color: '#f5a623', next: 500,  progress: ((tilesOwned - 200) / 300) * 100, from: 200 };
        if (tilesOwned >= 50)  return { level: 2, name: 'Scout',      color: '#00ccff', next: 200,  progress: ((tilesOwned - 50)  / 150) * 100, from: 50  };
        return                        { level: 1, name: 'Recruit',    color: '#10b981', next: 50,   progress: (tilesOwned / 50) * 100,          from: 0   };
    };

    const getWeekRings = (activityList) => {
        const days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            return d.toDateString();
        });
        const activeDays = new Set(activityList.map(a => new Date(a.createdAt || a.date).toDateString()));
        return days.map(d => ({ label: new Date(d).toLocaleDateString('en-US', { weekday: 'short' })[0], active: activeDays.has(d) }));
    };

    const tier = getTier(profile.tilesOwned ?? 0);
    const weekRings = getWeekRings(isOwnProfile ? activities : userActivities);
    const totalActivities = (stats.totalWalks ?? 0) + (stats.totalRuns ?? 0);

    return (
        <div className="min-h-screen bg-slate-100 text-slate-900 relative">
            <style>{`
                @keyframes achievementSlideIn {
                    from { opacity: 0; transform: translateY(12px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
            `}</style>
            <HexBackground />
            <Navbar />

            {showDeleteModal && (
                <DeleteAccountModal
                    profile={profile}
                    onClose={() => setShowDeleteModal(false)}
                    onDeleted={handleAccountDeleted}
                />
            )}

            <div className="max-w-lg mx-auto px-4 py-6 relative z-10 space-y-4">

                {/* ========== HERO CARD ========== */}
                <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-md bg-white">

                    {/* Banner */}
                    <div style={{
                        background: `linear-gradient(135deg, ${tier.color}20 0%, #ffffff 65%)`,
                        borderBottom: `1px solid ${tier.color}33`,
                        padding: '24px 20px 16px',
                        position: 'relative',
                        overflow: 'hidden',
                    }}>
                        <div className="flex items-center justify-between relative z-10">
                            <div className="flex items-center gap-4">
                                {/* Avatar */}
                                <div style={{
                                    width: 72, height: 72, borderRadius: 20,
                                    background: `${tier.color}15`,
                                    border: `2.5px solid ${tier.color}`,
                                    boxShadow: `0 0 20px ${tier.color}33`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 28, fontWeight: 900, color: tier.color,
                                    flexShrink: 0,
                                }}>
                                    {profile.username?.[0]?.toUpperCase() ?? '?'}
                                </div>

                                <div>
                                    <h2 className="text-2xl font-black text-slate-900 leading-tight">
                                        {profile.username}
                                    </h2>
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 4,
                                        background: `${tier.color}15`, border: `1px solid ${tier.color}44`,
                                        borderRadius: 20, padding: '2px 10px' }}>
                                        <svg width="10" height="10" viewBox="0 0 100 100">
                                            <polygon points="50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5" fill={tier.color}/>
                                        </svg>
                                        <span style={{ fontSize: 11, fontWeight: 800, color: tier.color, letterSpacing: '0.05em' }}>
                                            TIER {tier.level} · {tier.name.toUpperCase()}
                                        </span>
                                    </div>
                                    <p className="text-slate-400 text-xs mt-1.5">
                                        Member since {new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                    </p>
                                </div>
                            </div>

                            {!isOwnProfile && (
                                <button type="button" onClick={handleFollowToggle} disabled={followLoading}
                                    style={{
                                        padding: '8px 16px', borderRadius: 12, fontSize: 13, fontWeight: 700,
                                        border: isFollowing ? '1px solid #e2e8f0' : `1px solid ${tier.color}`,
                                        background: isFollowing ? '#f8fafc' : `${tier.color}15`,
                                        color: isFollowing ? '#64748b' : tier.color,
                                        cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0,
                                    }}
                                >
                                    {followLoading ? '...' : isFollowing ? 'Following' : 'Follow'}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Big three stats */}
                    <div style={{ background: '#f8fafc', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderBottom: '1px solid #e2e8f0' }}>
                        {[
                            { value: profile.tilesOwned ?? 0, label: 'Tiles Owned', color: tier.color },
                            { value: (stats.totalDistance ?? 0).toFixed(1), label: 'Miles', color: '#3b82f6' },
                            { value: totalActivities, label: 'Activities', color: '#8b5cf6' },
                        ].map((s, i) => (
                            <div key={i} style={{ padding: '16px 8px', textAlign: 'center', borderRight: i < 2 ? '1px solid #e2e8f0' : 'none' }}>
                                <div style={{ fontSize: 28, fontWeight: 900, color: s.color, lineHeight: 1 }}>
                                    {s.value}
                                </div>
                                <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>
                                    {s.label}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Tier progress bar */}
                    <div style={{ background: '#ffffff', padding: '12px 16px', borderBottom: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: tier.color }}>Tier {tier.level} · {tier.name}</span>
                            {tier.next
                                ? <span style={{ fontSize: 11, color: '#94a3b8' }}>{tier.next - (profile.tilesOwned ?? 0)} tiles to Tier {tier.level + 1}</span>
                                : <span style={{ fontSize: 11, color: tier.color }}>Max Tier Reached</span>
                            }
                        </div>
                        <div style={{ height: 6, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden' }}>
                            <div style={{
                                height: '100%', borderRadius: 99,
                                width: `${Math.min(100, tier.progress)}%`,
                                background: `linear-gradient(90deg, ${tier.color}88, ${tier.color})`,
                                boxShadow: `0 0 8px ${tier.color}66`,
                                transition: 'width 1s ease',
                            }}/>
                        </div>
                    </div>

                    {/* Weekly activity rings */}
                    <div style={{ background: '#ffffff', padding: '12px 16px', borderBottom: '1px solid #e2e8f0' }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                            This Week
                        </p>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                            {weekRings.map((day, i) => (
                                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                    <div style={{
                                        width: 32, height: 32, borderRadius: '50%',
                                        background: day.active ? `${tier.color}15` : '#f1f5f9',
                                        border: `2px solid ${day.active ? tier.color : '#e2e8f0'}`,
                                        boxShadow: day.active ? `0 0 10px ${tier.color}44` : 'none',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        {day.active && (
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                                                <polyline points="4,12 8,12 10,6 14,18 16,10 18,12 20,12"
                                                    stroke={tier.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                                            </svg>
                                        )}
                                    </div>
                                    <span style={{ fontSize: 9, fontWeight: 700, color: day.active ? tier.color : '#94a3b8' }}>
                                        {day.label}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Secondary stats */}
                    <div style={{ background: '#f8fafc', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', padding: '12px 0' }}>
                        {[
                            { value: followersCount,                        label: 'Followers' },
                            { value: followingCount,                        label: 'Following' },
                            { value: stats.totalHexagonsCaptured ?? 0,     label: 'Lifetime' },
                            { value: stats.totalStolenTerritories ?? 0,    label: 'Stolen' },
                        ].map((s, i) => (
                            <div key={i} style={{ textAlign: 'center', borderRight: i < 3 ? '1px solid #e2e8f0' : 'none' }}>
                                <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{s.value}</div>
                                <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>{s.label}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ========== TABS — own profile only ========== */}
                {isOwnProfile && (
                    <>
                        <div style={{
                            display: 'flex', gap: 0,
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: 16, overflow: 'hidden',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                        }}>
                            {[
                                { key: 'activities',   label: 'Activities',    Icon: ActivityTabIcon },
                                { key: 'achievements', label: 'Achievements',  Icon: AchievementTabIcon },
                                { key: 'settings',     label: 'Settings',      Icon: SettingsTabIcon },
                            ].map(({ key, label, Icon }, i) => {
                                const active = activeTab === key;
                                return (
                                    <button key={key} type="button" onClick={() => setActiveTab(key)}
                                        style={{
                                            flex: 1, padding: '12px 4px',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                                            fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
                                            background: active ? `${tier.color}10` : 'transparent',
                                            color: active ? tier.color : '#94a3b8',
                                            borderRight: i < 2 ? '1px solid #e2e8f0' : 'none',
                                            borderBottom: active ? `2px solid ${tier.color}` : '2px solid transparent',
                                            cursor: 'pointer', transition: 'all 0.2s',
                                        }}
                                    >
                                        <Icon color={active ? tier.color : '#94a3b8'} />
                                        {label}
                                    </button>
                                );
                            })}
                        </div>

                        {activeTab === 'activities' && (
                            <div className="space-y-3">
                                {activities.length === 0 ? (
                                    <div className="text-center py-12">
                                        <svg width="48" height="48" viewBox="0 0 28 28" fill="none" className="mx-auto mb-3">
                                            <polygon points="2,14 8,3 20,3 26,14 20,25 8,25" stroke="#cbd5e1" strokeWidth="2" fill="none"/>
                                            <polyline points="5,14 8,14 11,9 15,19 18,12 21,14 24,14"
                                                stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                                        </svg>
                                        <p className="text-slate-900 font-bold">No activities yet</p>
                                        <p className="text-slate-500 text-sm font-bold mt-1">Get outside and start capturing territory!</p>
                                    </div>
                                ) : (
                                    activities.map(activity => (
                                        <ActivityRow key={activity._id} activity={activity} onClick={() => setSelectedActivity(activity)}/>
                                    ))
                                )}
                            </div>
                        )}

                        {activeTab === 'achievements' && (
                            <div className="space-y-3">
                                {achievements.length === 0 ? (
                                    <div className="text-center py-12">
                                        <svg width="48" height="48" viewBox="0 0 28 28" fill="none" className="mx-auto mb-3">
                                            <polygon points="2,14 8,3 20,3 26,14 20,25 8,25" stroke="#cbd5e1" strokeWidth="2" fill="none"/>
                                            <text x="14" y="15" textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="#cbd5e1" fontWeight="800" fontFamily="Oxanium, sans-serif">HEX</text>
                                        </svg>
                                        <p className="text-slate-900 font-bold">No achievements yet</p>
                                        <p className="text-slate-500 text-sm font-bold mt-1">Log activities to unlock achievements!</p>
                                    </div>
                                ) : (
                                    achievements.map((achievement, index) => (
                                        <AchievementRow
                                            key={achievement._id ?? achievement.achievementId?._id ?? index}
                                            achievement={achievement}
                                            index={index}
                                        />
                                    ))
                                )}
                            </div>
                        )}

                        {activeTab === 'settings' && (
                            <SettingsTab
                                profile={profile}
                                setProfile={setProfile}
                                onShowDeleteModal={() => setShowDeleteModal(true)}
                            />
                        )}
                    </>
                )}

                {!isOwnProfile && (
                    <div className="space-y-3">
                        <h3 className="text-slate-900 font-black text-sm px-1">Recent Activities</h3>
                        {userActivities.length === 0 ? (
                            <div className="text-center py-12 bg-white border border-gray-200 rounded-xl shadow-sm">
                                <svg width="48" height="48" viewBox="0 0 28 28" fill="none" className="mx-auto mb-3">
                                    <polygon points="2,14 8,3 20,3 26,14 20,25 8,25" stroke="#cbd5e1" strokeWidth="2" fill="none"/>
                                    <polyline points="5,14 8,14 11,9 15,19 18,12 21,14 24,14"
                                        stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                                </svg>
                                <p className="text-slate-900 font-bold">No activities yet</p>
                                <p className="text-slate-500 text-sm font-bold mt-1">This user hasn't logged any activities.</p>
                            </div>
                        ) : (
                            userActivities.map(activity => (
                                <ActivityRow key={activity._id} activity={activity} onClick={() => setSelectedActivity(activity)}/>
                            ))
                        )}
                    </div>
                )}

            </div>

            {selectedActivity && (
                <ActivityDetailModal activity={selectedActivity} onClose={() => setSelectedActivity(null)}/>
            )}
        </div>
    );
}

const WalkHexIcon = () => (
    <svg width="40" height="40" viewBox="0 0 40 40">
        <polygon points="20,2 37,11 37,29 20,38 3,29 3,11" fill="rgba(59,130,246,0.1)" stroke="#3b82f6" strokeWidth="1.5"/>
        <ellipse cx="28" cy="28" rx="2.2" ry="3.5" fill="#3b82f6" transform="rotate(-35 28 28)"/>
        <ellipse cx="20" cy="24" rx="2.2" ry="3.5" fill="#3b82f6" opacity="0.7" transform="rotate(-35 20 24)"/>
        <ellipse cx="22" cy="17" rx="2.2" ry="3.5" fill="#3b82f6" opacity="0.45" transform="rotate(-35 22 17)"/>
        <ellipse cx="14" cy="14" rx="2.2" ry="3.5" fill="#3b82f6" opacity="0.2" transform="rotate(-35 14 14)"/>
    </svg>
);

const RunHexIcon = () => (
    <svg width="40" height="40" viewBox="0 0 40 40">
        <polygon points="20,2 37,11 37,29 20,38 3,29 3,11" fill="rgba(16,185,129,0.1)" stroke="#10b981" strokeWidth="1.5"/>
        <polygon points="23,8 15,22 20,22 17,32 25,18 20,18" fill="#10b981"/>
    </svg>
);

function ActivityRow({ activity, onClick }) {
    const isWalk = activity.activityType === 'walk' || activity.activityType === 'WALK';
    const distanceMiles = (activity.distance ?? 0).toFixed(2);

    const formatDuration = (seconds) => {
        if (!seconds) return '0m';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m`;
    };

    const hexCount = Array.isArray(activity.capturedHexagons)
        ? activity.capturedHexagons.length
        : (activity.capturedHexagons ?? 0);

    return (
        <div
            className={`bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3 shadow-sm ${
                onClick ? 'cursor-pointer hover:border-gray-300 hover:shadow-md transition-all' : ''
            }`}
            onClick={onClick}
            role={onClick ? 'button' : undefined}
        >
            <div className="flex-shrink-0">
                {isWalk ? <WalkHexIcon /> : <RunHexIcon />}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-slate-900 font-bold text-sm capitalize">{activity.activityType?.toLowerCase()}</p>
                <p className="text-slate-500 text-xs font-bold mt-0.5">
                    {distanceMiles}mi · {formatDuration(activity.duration)} · {hexCount} hexagons
                </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
                <div className="text-slate-400 text-xs font-bold">{timeAgo(activity.createdAt)}</div>
                {onClick && (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-slate-300">
                        <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                )}
            </div>
        </div>
    );
}

function ActivityDetailModal({ activity, onClose }) {
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);

    const isWalk = activity.activityType === 'walk' || activity.activityType === 'WALK';
    const distanceMiles = (activity.distance ?? 0).toFixed(2);
    const hexCount = Array.isArray(activity.capturedHexagons)
        ? activity.capturedHexagons.length
        : (activity.capturedHexagons ?? 0);

    const formatDuration = (seconds) => {
        if (!seconds) return '0m';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m`;
    };

    const formatPace = () => {
        if (!activity.duration || !activity.distance || activity.distance === 0) return '—';
        const minPerMile = activity.duration / 60 / activity.distance;
        const mins = Math.floor(minPerMile);
        const secs = Math.round((minPerMile - mins) * 60);
        return `${mins}:${String(secs).padStart(2, '0')}/mi`;
    };

    const elevationFt = Math.round((activity.elevationGain ?? 0) * 3.28084);
    const hasRoute = Array.isArray(activity.coordinates) && activity.coordinates.length > 1;

    useEffect(() => {
        if (!mapContainerRef.current || !hasRoute) return;
        let cancelled = false;

        getCustomLightStyle().then(style => {
            if (cancelled || !mapContainerRef.current) return;
            const coords = activity.coordinates;
            const lngs = coords.map(c => c.longitude);
            const lats = coords.map(c => c.latitude);
            const bounds = [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]];

            const map = new maplibregl.Map({
                container: mapContainerRef.current,
                style,
                interactive: false,
                attributionControl: false,
            });

            map.on('load', () => {
                if (cancelled) { map.remove(); return; }
                map.fitBounds(bounds, { padding: 32, animate: false });
                map.addSource('route', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: coords.map(c => [c.longitude, c.latitude]) } } });
                map.addLayer({ id: 'route-line', type: 'line', source: 'route', paint: { 'line-color': isWalk ? '#3b82f6' : '#10b981', 'line-width': 3, 'line-opacity': 0.9 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
                mapRef.current = map;
            });
        });

        return () => {
            cancelled = true;
            if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
            <div className="bg-white border border-gray-200 rounded-t-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        {isWalk ? <WalkHexIcon /> : <RunHexIcon />}
                        <div>
                            <p className="text-slate-900 font-black capitalize">{activity.activityType?.toLowerCase()}</p>
                            <p className="text-slate-400 text-xs font-bold">{timeAgo(activity.createdAt)}</p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose}
                        className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors">
                        ✕
                    </button>
                </div>

                {hasRoute ? (
                    <div ref={mapContainerRef} className="w-full h-48 bg-gray-100"/>
                ) : (
                    <div className="w-full h-24 bg-gray-100 flex items-center justify-center">
                        <p className="text-slate-400 text-sm font-bold">No route data</p>
                    </div>
                )}

                <div className="p-5 grid grid-cols-2 gap-3">
                    {[
                        { label: 'Distance', value: <>{distanceMiles}<span className="text-slate-400 text-sm ml-1">mi</span></> },
                        { label: 'Duration', value: formatDuration(activity.duration) },
                        { label: 'Pace', value: formatPace() },
                        { label: 'Calories', value: <>{activity.estimatedCalories ?? '—'}<span className="text-slate-400 text-sm ml-1">kcal</span></> },
                        { label: 'Elevation Gain', value: <>{elevationFt}<span className="text-slate-400 text-sm ml-1">ft</span></> },
                    ].map((s, i) => (
                        <div key={i} className="bg-slate-50 rounded-xl p-4">
                            <p className="text-slate-400 text-xs font-bold mb-1">{s.label}</p>
                            <p className="text-slate-900 text-xl font-black">{s.value}</p>
                        </div>
                    ))}
                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                        <p className="text-slate-400 text-xs font-bold mb-1">Hexagons</p>
                        <p className="text-emerald-600 text-xl font-black">{hexCount}<span className="text-slate-400 text-sm ml-1">captured</span></p>
                    </div>
                    {(activity.stolenHexagons ?? 0) > 0 && (
                        <div className="bg-red-50 border border-red-100 rounded-xl p-4 col-span-2">
                            <p className="text-slate-400 text-xs font-bold mb-1">Stolen</p>
                            <p className="text-red-500 text-xl font-black">{activity.stolenHexagons}<span className="text-slate-400 text-sm ml-1">hexagons taken from others</span></p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function AchievementRow({ achievement, index = 0 }) {
    const name = achievement.name ?? 'Achievement';
    const description = achievement.description ?? '';
    const rarity = achievement.rarity ?? '';
    const isUnlocked = achievement.isUnlocked;
    const unlockedAt = achievement.unlockedAt;

    const rarityColors = {
        COMMON: 'text-gray-400',
        UNCOMMON: 'text-green-500',
        RARE: 'text-blue-500',
        EPIC: 'text-purple-500',
        LEGENDARY: 'text-amber-500',
    };

    return (
        <div
            className={`rounded-xl p-4 flex items-center gap-3 transition-all ${
                isUnlocked
                    ? 'bg-emerald-50 border border-emerald-200'
                    : 'bg-slate-50 border border-slate-200 opacity-60'
            }`}
            style={{ animation: `achievementSlideIn 0.3s ease-out ${index * 0.06}s both` }}
        >
            <div className={`text-2xl flex-shrink-0 ${isUnlocked ? '' : 'grayscale'}`}>
                {isUnlocked ? '🏆' : '🔒'}
            </div>
            <div className="flex-1 min-w-0">
                <p className={`font-bold text-sm ${isUnlocked ? 'text-slate-900' : 'text-slate-500'}`}>{name}</p>
                <p className={`text-xs font-bold mt-0.5 ${isUnlocked ? 'text-slate-500' : 'text-slate-400'}`}>{description}</p>
                {isUnlocked && unlockedAt && (
                    <p className="text-emerald-600 text-xs mt-1 font-bold">Unlocked {timeAgo(unlockedAt)}</p>
                )}
            </div>
            {rarity && (
                <div className={`text-xs font-bold uppercase tracking-wide flex-shrink-0 ${
                    isUnlocked ? (rarityColors[rarity] || 'text-emerald-600') : 'text-slate-300'
                }`}>
                    {rarity}
                </div>
            )}
        </div>
    );
}

function SettingsTab({ profile, setProfile, onShowDeleteModal }) {
    const [weight, setWeight] = useState(profile.weight ?? '');
    const [age, setAge] = useState(profile.age ?? '');
    const [sex, setSex] = useState(profile.sex ?? '');
    const [heightFeet, setHeightFeet] = useState(profile.heightFeet ?? '');
    const [heightInches, setHeightInches] = useState(profile.heightInches ?? '');
    const [stepLength, setStepLength] = useState(profile.stepLength ?? '');
    const [bodyStatsLoading, setBodyStatsLoading] = useState(false);
    const [bodyStatsMsg, setBodyStatsMsg] = useState('');
    const [bodyStatsError, setBodyStatsError] = useState('');
    const [newUsername, setNewUsername] = useState('');
    const [usernameLoading, setUsernameLoading] = useState(false);
    const [usernameMsg, setUsernameMsg] = useState('');
    const [usernameError, setUsernameError] = useState('');
    const [showSexTooltip, setShowSexTooltip] = useState(false);
    const [showStepTooltip, setShowStepTooltip] = useState(false);
    const [stepLengthManual, setStepLengthManual] = useState(false);

    useEffect(() => {
        if (heightFeet && heightInches !== '' && !stepLengthManual) {
            const totalInches = (Number(heightFeet) * 12) + Number(heightInches);
            if (totalInches > 0) setStepLength(Math.round(totalInches * 0.413));
        }
    }, [heightFeet, heightInches]);

    const handleSaveBodyStats = async () => {
        setBodyStatsLoading(true); setBodyStatsMsg(''); setBodyStatsError('');
        try {
            const data = {};
            if (weight !== '') data.weight = Number(weight);
            if (age !== '') data.age = Number(age);
            if (sex !== '') data.sex = sex;
            if (heightFeet !== '') data.heightFeet = Number(heightFeet);
            if (heightInches !== '') data.heightInches = Number(heightInches);
            if (stepLength !== '') data.stepLength = Number(stepLength);
            const res = await updateBodyStats(data);
            setProfile(res.data.profile);
            setBodyStatsMsg('Saved!');
            setTimeout(() => setBodyStatsMsg(''), 3000);
        } catch (err) {
            setBodyStatsError(err.response?.data?.message || 'Failed to save. Please try again.');
        } finally { setBodyStatsLoading(false); }
    };

    const handleChangeUsername = async () => {
        if (!newUsername.trim()) return;
        setUsernameLoading(true); setUsernameMsg(''); setUsernameError('');
        try {
            const res = await updateUsername({ newUsername: newUsername.trim() });
            setProfile(res.data.profile);
            setNewUsername('');
            setUsernameMsg('Username changed!');
            setTimeout(() => setUsernameMsg(''), 3000);
        } catch (err) {
            setUsernameError(err.response?.data?.message || 'Failed to change username.');
        } finally { setUsernameLoading(false); }
    };

    const inputClass = "w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 text-sm font-bold focus:outline-none focus:border-emerald-500 transition-colors";

    return (
        <div className="space-y-6">

            {/* Body Stats */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <h3 className="text-sm font-black text-slate-600 uppercase tracking-wide mb-1">Body Stats</h3>
                <p className="text-slate-400 text-xs font-bold mb-5">Optional — improves calorie and distance accuracy</p>

                <div className="space-y-4">
                    <div>
                        <label className="text-slate-600 text-xs font-bold block mb-1.5">Weight (lbs)</label>
                        <input type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder="154" min="50" max="1000" className={inputClass}/>
                    </div>
                    <div>
                        <label className="text-slate-600 text-xs font-bold block mb-1.5">Age</label>
                        <input type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="25" min="13" max="120" className={inputClass}/>
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5 mb-1.5">
                            <label className="text-slate-600 text-xs font-bold">Sex</label>
                            <div className="relative">
                                <button type="button"
                                    onClick={() => setShowSexTooltip(prev => !prev)}
                                    onMouseEnter={() => setShowSexTooltip(true)}
                                    onMouseLeave={() => setShowSexTooltip(false)}
                                    className="w-4 h-4 rounded-full bg-slate-100 text-slate-400 text-xs font-black flex items-center justify-center hover:bg-slate-200 transition-colors">
                                    !
                                </button>
                                {showSexTooltip && (
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-white border border-gray-200 rounded-lg p-3 text-xs text-slate-600 font-bold shadow-xl z-30">
                                        Biological sex affects metabolic rate, which impacts calorie burn calculations by ~10-15%. This is optional and only used for accuracy.
                                        <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-white border-r border-b border-gray-200 rotate-45 -mt-1" />
                                    </div>
                                )}
                            </div>
                        </div>
                        <select value={sex} onChange={e => setSex(e.target.value)} className={`${inputClass} ${!sex ? 'text-slate-400' : ''}`}>
                            <option value="">Select...</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="prefer_not_to_say">Prefer not to say</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-slate-600 text-xs font-bold block mb-1.5">Height</label>
                        <div className="flex gap-2">
                            <div className="flex-1 relative">
                                <input type="number" value={heightFeet} onChange={e => setHeightFeet(e.target.value)} placeholder="5" min="3" max="8" className={inputClass}/>
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">ft</span>
                            </div>
                            <div className="flex-1 relative">
                                <input type="number" value={heightInches} onChange={e => setHeightInches(e.target.value)} placeholder="10" min="0" max="11" className={inputClass}/>
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">in</span>
                            </div>
                        </div>
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5 mb-1.5">
                            <label className="text-slate-600 text-xs font-bold">
                                Step Length (inches)
                                {heightFeet && heightInches !== '' && !stepLengthManual && (
                                    <span className="text-emerald-500 ml-2">auto-estimated from height</span>
                                )}
                            </label>
                            <div className="relative">
                                <button type="button"
                                    onClick={() => setShowStepTooltip(prev => !prev)}
                                    onMouseEnter={() => setShowStepTooltip(true)}
                                    onMouseLeave={() => setShowStepTooltip(false)}
                                    className="w-4 h-4 rounded-full bg-slate-100 text-slate-400 text-xs font-black flex items-center justify-center hover:bg-slate-200 transition-colors">
                                    !
                                </button>
                                {showStepTooltip && (
                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-white border border-gray-200 rounded-lg p-3 text-xs text-slate-600 font-bold shadow-xl z-30">
                                        The auto-estimate is approximate (~5/10 accuracy). For a precise measurement: walk 10 normal steps, measure the total distance in inches, and divide by 10.
                                        <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-white border-r border-b border-gray-200 rotate-45 -mt-1" />
                                    </div>
                                )}
                            </div>
                        </div>
                        <input type="number" value={stepLength} onChange={e => { setStepLength(e.target.value); setStepLengthManual(e.target.value !== ''); }}
                            placeholder="24" min="10" max="50" className={inputClass}/>
                    </div>
                </div>

                <div className="mt-5">
                    {bodyStatsError && <p className="text-red-500 text-sm font-bold mb-3">{bodyStatsError}</p>}
                    {bodyStatsMsg && <p className="text-emerald-600 text-sm font-bold mb-3">{bodyStatsMsg}</p>}
                    <button type="button" onClick={handleSaveBodyStats} disabled={bodyStatsLoading}
                        className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold py-2.5 rounded-xl transition-colors text-sm">
                        {bodyStatsLoading ? 'Saving...' : 'Save Body Stats'}
                    </button>
                </div>
            </div>

            {/* Username Change */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <h3 className="text-sm font-black text-slate-600 uppercase tracking-wide mb-1">Change Username</h3>
                {profile.canChangeUsername ? (
                    <>
                        <p className="text-slate-400 text-xs font-bold mb-4">
                            Current: <span className="text-slate-900">{profile.username}</span>
                        </p>
                        <input type="text" value={newUsername} onChange={e => { setNewUsername(e.target.value); setUsernameError(''); }}
                            placeholder="New username" maxLength={20} className={`${inputClass} mb-3`}/>
                        {usernameError && <p className="text-red-500 text-sm font-bold mb-3">{usernameError}</p>}
                        {usernameMsg && <p className="text-emerald-600 text-sm font-bold mb-3">{usernameMsg}</p>}
                        <button type="button" onClick={handleChangeUsername} disabled={usernameLoading || !newUsername.trim()}
                            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold py-2.5 rounded-xl transition-colors text-sm">
                            {usernameLoading ? 'Changing...' : 'Change Username'}
                        </button>
                    </>
                ) : (
                    <div className="mt-2">
                        <p className="text-slate-400 text-xs font-bold">Capture 100 hexagons to unlock username changes</p>
                        <div className="mt-3 bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div className="bg-emerald-500 h-full rounded-full transition-all"
                                style={{ width: `${Math.min(100, ((profile.stats?.totalHexagonsCaptured ?? 0) / 100) * 100)}%` }}/>
                        </div>
                        <p className="text-slate-400 text-xs font-bold mt-1.5 text-right">
                            {profile.stats?.totalHexagonsCaptured ?? 0} / 100
                        </p>
                    </div>
                )}
            </div>

            {/* Danger Zone */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <h3 className="text-sm font-black text-slate-600 uppercase tracking-wide mb-4">Danger Zone</h3>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-slate-900 font-bold text-sm">Delete Account</p>
                        <p className="text-slate-400 text-xs mt-0.5">Permanently delete your account and all data</p>
                    </div>
                    <button type="button" onClick={onShowDeleteModal}
                        className="px-4 py-2 rounded-xl text-sm font-bold bg-red-50 border border-red-200 text-red-500 hover:bg-red-100 transition-colors">
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
}

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProfile, getFeed, getTerritoryLeaderboard } from '../services/api';
import { useAuth } from '../context/AuthContext';
import HexBackground from '../components/HexBackground';
import Navbar from '../components/Navbar';

const getTier = (tilesOwned) => {
    if (tilesOwned >= 500) return { level: 4, name: 'Overlord',  color: '#ff00aa' };
    if (tilesOwned >= 200) return { level: 3, name: 'Commander', color: '#f5a623' };
    if (tilesOwned >= 50)  return { level: 2, name: 'Scout',     color: '#00ccff' };
    return                        { level: 1, name: 'Recruit',   color: '#10b981' };
};

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

const WalkIcon = ({ size = 14, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 40 40" fill={color}>
        <ellipse cx="28" cy="28" rx="2.2" ry="3.5" transform="rotate(-35 28 28)"/>
        <ellipse cx="20" cy="24" rx="2.2" ry="3.5" opacity="0.7" transform="rotate(-35 20 24)"/>
        <ellipse cx="22" cy="17" rx="2.2" ry="3.5" opacity="0.45" transform="rotate(-35 22 17)"/>
        <ellipse cx="14" cy="14" rx="2.2" ry="3.5" opacity="0.2" transform="rotate(-35 14 14)"/>
    </svg>
);

const RunIcon = ({ size = 14, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 40 40" fill={color}>
        <polygon points="23,4 13,22 20,22 17,36 27,18 20,18"/>
    </svg>
);

function MedalHex({ rank }) {
    const configs = {
        1: { stroke: '#ffb004', label: '1' },
        2: { stroke: '#9daec5', label: '2' },
        3: { stroke: '#ad4d11', label: '3' },
    };
    const config = configs[rank];
    if (config) return (
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <polygon points="2,14 8,3 20,3 26,14 20,25 8,25" fill="#1e293b" stroke={config.stroke} strokeWidth="2"/>
            <text x="14" y="15" textAnchor="middle" dominantBaseline="middle" fontSize="10" fill="#fff" fontWeight="700">{config.label}</text>
        </svg>
    );
    return (
        <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
            <polygon points="2,14 8,3 20,3 26,14 20,25 8,25" fill="none" stroke="#cbd5e1" strokeWidth="1.5"/>
            <text x="14" y="15" textAnchor="middle" dominantBaseline="middle" fontSize="9" fill="#94a3b8" fontWeight="700">{rank}</text>
        </svg>
    );
}

export default function Dashboard() {
    const navigate = useNavigate();
    const { user: currentUser } = useAuth();
    const currentUserId = currentUser?.id ?? currentUser?._id;

    const [profile, setProfile] = useState(null);
    const [feed, setFeed] = useState([]);
    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadDashboard = async () => {
            try {
                const [profileRes, feedRes, leaderRes] = await Promise.all([
                    getProfile(),
                    getFeed(),
                    getTerritoryLeaderboard(),
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
            <div className="min-h-screen bg-slate-100 flex items-center justify-center">
                <div className="text-emerald-500 text-lg font-semibold animate-pulse">Loading...</div>
            </div>
        );
    }

    const stats = profile?.stats || {};
    const tier = getTier(profile?.tilesOwned ?? 0);
    const totalActivities = (stats.totalWalks ?? 0) + (stats.totalRuns ?? 0);
    const myRankEntry = leaderboard.findIndex(e => String(e.id) === String(currentUserId));
    const myRank = myRankEntry >= 0 ? myRankEntry + 1 : null;

    return (
        <div className="min-h-screen bg-slate-100 text-slate-900 relative">
            <style>{`
                @keyframes fadeUp {
                    from { opacity: 0; transform: translateY(10px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                @keyframes globeSpin {
                    from { transform: translateX(-50%); }
                    to   { transform: translateX(0%); }
                }
                @keyframes hexGlow {
                    0%, 100% { filter: drop-shadow(0 0 6px #10b981) drop-shadow(0 0 12px #10b981); }
                    50%      { filter: drop-shadow(0 0 14px #10b981) drop-shadow(0 0 28px #10b981); }
                }
                @keyframes globeFloat {
                    0%, 100% { transform: translateY(0px); }
                    50%      { transform: translateY(-4px); }
                }
                .dashboard-hero {
                    display: grid;
                    grid-template-columns: 300px 1fr;
                    gap: 40px;
                }
                @media (max-width: 768px) {
                    .dashboard-hero {
                        grid-template-columns: 1fr;
                        gap: 24px;
                    }
                }
                .feed-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
                    gap: 12px;
                }
                @media (max-width: 540px) {
                    .feed-grid {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
            <HexBackground />
            <Navbar />

            <div className="max-w-6xl mx-auto px-6 py-8 relative z-10">

                {/* ========== HERO ROW: Globe left, Stats + Rank right ========== */}
                <div className="dashboard-hero" style={{ marginBottom: 24, animation: 'fadeUp 0.4s ease both' }}>

                    {/* ---- LEFT: Globe ---- */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ position: 'relative', width: 280, height: 280, animation: 'globeFloat 4s ease-in-out infinite' }}>
                            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', animation: 'hexGlow 3s ease-in-out infinite' }}
                                viewBox="0 0 280 280">
                                <polygon points="140,8 264,74 264,206 140,272 16,206 16,74"
                                    fill="none" stroke="#10b981" strokeWidth="2.5"/>
                                <polygon points="140,26 246,86 246,194 140,254 34,194 34,86"
                                    fill="none" stroke="#10b981" strokeWidth="1" opacity="0.35"/>
                            </svg>
                            <div style={{
                                position: 'absolute', top: '50%', left: '50%',
                                transform: 'translate(-50%, -50%)',
                                width: 200, height: 200,
                                borderRadius: '50%', overflow: 'hidden',
                                boxShadow: '0 0 40px rgba(16,185,129,0.3), inset -8px -8px 20px rgba(0,0,0,0.5)',
                                background: '#1a6b9a',
                            }}>
                                <div style={{
                                    position: 'absolute', top: 0, left: 0,
                                    width: '200%', height: '100%',
                                    animation: 'globeSpin 30s linear infinite',
                                    backgroundImage: 'url(/world2.jpg)',
                                    backgroundSize: '50% 100%',
                                    backgroundRepeat: 'repeat-x',
                                }}/>
                                <div style={{
                                    position: 'absolute', inset: 0,
                                    background: 'radial-gradient(circle at 30% 28%, rgba(255,255,255,0.15) 0%, transparent 55%)',
                                }}/>
                            </div>
                        </div>
                    </div>

                    {/* ---- RIGHT: Welcome + Stats + Territory Rank ---- */}
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 20 }}>

                        {/* Welcome */}
                        <div>
                            <h1 style={{ fontSize: 32, fontWeight: 900, color: '#0f172a', lineHeight: 1.2 }}>
                                Welcome back, <span style={{ color: '#10b981' }}>{profile?.username}</span>
                            </h1>
                        </div>

                        {/* Global Rank Achievement Card */}
                        {profile?.tilesOwned > 0 && myRank && (
                            <div style={{
                                background: '#ffffff',
                                border: '1px solid #e2e8f0',
                                borderLeft: myRank === 1 ? '4px solid #f59e0b' : '4px solid #10b981',
                                borderRadius: 16,
                                padding: '16px 20px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 16,
                                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                            }}>
                                {/* Icon badge */}
                                <div style={{
                                    width: 52, height: 52, borderRadius: 12, flexShrink: 0,
                                    background: myRank === 1 ? 'rgba(245,158,11,0.08)' : 'rgba(16,185,129,0.08)',
                                    border: `1px solid ${myRank === 1 ? 'rgba(245,158,11,0.25)' : 'rgba(16,185,129,0.2)'}`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 26,
                                }}>
                                    {myRank === 1 ? '🏆' : '🌐'}
                                </div>
                                {/* Text */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{
                                        fontSize: 10, fontWeight: 800, letterSpacing: '0.1em',
                                        textTransform: 'uppercase', marginBottom: 3,
                                        color: myRank === 1 ? '#d97706' : '#059669',
                                    }}>
                                        Global Ranking
                                    </div>
                                    <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', lineHeight: 1.1, fontFamily: "'Oxanium', sans-serif" }}>
                                        #{myRank} Worldwide
                                    </div>
                                    <div style={{ fontSize: 12, fontWeight: 700, marginTop: 3, fontFamily: "'Oxanium', sans-serif",
                                        color: myRank === 1 ? '#d97706' : '#10b981',
                                    }}>
                                        {profile.tilesOwned} tiles captured
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Stats strip */}
                        <div style={{
                            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
                            gap: 1, background: '#e2e8f0', borderRadius: 16,
                            overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                        }}>
                            {[
                                { label: 'Tiles Owned', value: profile?.tilesOwned ?? 0,                    color: tier.color },
                                { label: 'Miles',        value: (stats.totalDistance ?? 0).toFixed(1),       color: '#3b82f6' },
                                { label: 'Activities',   value: totalActivities,                              color: '#8b5cf6' },
                                { label: 'Stolen',       value: stats.totalStolenTerritories ?? 0,           color: '#ef4444' },
                            ].map((s, i) => (
                                <div key={i} style={{ background: '#ffffff', padding: '16px 12px', textAlign: 'center' }}>
                                    <div style={{ fontSize: 26, fontWeight: 900, color: s.color, lineHeight: 1 }}>{s.value}</div>
                                    <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700,
                                        textTransform: 'uppercase', letterSpacing: '0.07em', marginTop: 4 }}>
                                        {s.label}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Territory Rank */}
                        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                                <h3 style={{ fontSize: 13, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                                    Territory Rank
                                </h3>
                                <button onClick={() => navigate('/leaderboard')}
                                    style={{ fontSize: 11, fontWeight: 700, color: '#10b981', background: 'none', border: 'none', cursor: 'pointer' }}>
                                    See all →
                                </button>
                            </div>
                            {leaderboard.length === 0 ? (
                                <p style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: '8px 0' }}>No rankings yet.</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {leaderboard.slice(0, 5).map((entry, index) => {
                                        const isMe = String(entry.id) === String(currentUserId);
                                        return (
                                            <button key={entry.id} type="button"
                                                onClick={() => isMe ? navigate('/profile') : navigate(`/profile/${entry.id}`)}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: 8,
                                                    background: isMe ? 'rgba(16,185,129,0.08)' : 'transparent',
                                                    border: `1px solid ${isMe ? 'rgba(16,185,129,0.25)' : 'transparent'}`,
                                                    borderRadius: 10, padding: '6px 8px',
                                                    cursor: 'pointer', width: '100%', textAlign: 'left',
                                                    transition: 'background 0.15s',
                                                }}
                                            >
                                                <MedalHex rank={index + 1}/>
                                                <span style={{ flex: 1, fontSize: 13, fontWeight: 700,
                                                    color: isMe ? '#10b981' : '#0f172a',
                                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {entry.username}
                                                    {isMe && <span style={{ fontSize: 9, color: '#f59e0b', marginLeft: 5 }}>you</span>}
                                                </span>
                                                <span style={{ fontSize: 12, fontWeight: 800, color: isMe ? '#10b981' : '#64748b', flexShrink: 0 }}>
                                                    {entry.tilesOwned}
                                                </span>
                                            </button>
                                        );
                                    })}
                                    {myRank && myRank > 5 && (
                                        <>
                                            <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 11 }}>· · ·</div>
                                            <button type="button" onClick={() => navigate('/profile')}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: 8,
                                                    background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)',
                                                    borderRadius: 10, padding: '6px 8px',
                                                    cursor: 'pointer', width: '100%', textAlign: 'left',
                                                }}
                                            >
                                                <MedalHex rank={myRank}/>
                                                <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#10b981' }}>
                                                    {profile?.username}
                                                    <span style={{ fontSize: 9, color: '#f59e0b', marginLeft: 5 }}>you</span>
                                                </span>
                                                <span style={{ fontSize: 12, fontWeight: 800, color: '#10b981', flexShrink: 0 }}>
                                                    {profile?.tilesOwned ?? 0}
                                                </span>
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ========== ACTIVITY FEED: full width below ========== */}
                <div style={{
                    background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16,
                    padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                    animation: 'fadeUp 0.4s ease 0.15s both',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <h3 style={{ fontSize: 13, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                            Activity Feed
                        </h3>
                        <button onClick={() => navigate('/feed')}
                            style={{ fontSize: 11, fontWeight: 700, color: '#10b981', background: 'none', border: 'none', cursor: 'pointer' }}>
                            See all →
                        </button>
                    </div>

                    {feed.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '24px 0' }}>
                            <p style={{ color: '#94a3b8', fontSize: 13 }}>No activity yet.</p>
                            <button onClick={() => navigate('/leaderboard')}
                                style={{ fontSize: 12, color: '#10b981', background: 'none', border: 'none', cursor: 'pointer', marginTop: 8, fontWeight: 600 }}>
                                Find people to follow →
                            </button>
                        </div>
                    ) : (
                        <div className="feed-grid">
                            {feed.slice(0, 6).map(activity => {
                                const isWalk = activity.activityType === 'walk' || activity.activityType === 'WALK';
                                const accent = isWalk ? '#3b82f6' : '#10b981';
                                const hexCount = typeof activity.capturedHexagons === 'number'
                                    ? activity.capturedHexagons
                                    : (Array.isArray(activity.capturedHexagons) ? activity.capturedHexagons.length : 0);
                                return (
                                    <div key={activity._id} style={{
                                        display: 'flex', alignItems: 'center', gap: 12,
                                        padding: '12px 14px',
                                        background: '#f8fafc', borderRadius: 12,
                                        border: `1px solid ${accent}22`,
                                        borderLeft: `3px solid ${accent}`,
                                    }}>
                                        <div style={{
                                            width: 34, height: 34, borderRadius: 10,
                                            background: `${accent}15`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                        }}>
                                            {isWalk ? <WalkIcon size={15} color={accent}/> : <RunIcon size={15} color={accent}/>}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <p style={{ fontSize: 13, fontWeight: 700, color: '#0f172a',
                                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {activity.username ?? 'Unknown'}
                                            </p>
                                            <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
                                                {(activity.distance ?? 0).toFixed(1)}mi · {hexCount} hex
                                            </p>
                                        </div>
                                        <span style={{ fontSize: 11, color: '#94a3b8', flexShrink: 0 }}>
                                            {timeAgo(activity.createdAt)}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

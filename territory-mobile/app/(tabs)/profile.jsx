// ========== PROFILE SCREEN ==========
// Own profile: three tabs — Activities, Achievements, Settings.
// Other users' profiles are handled by app/user/[userId].jsx.

import { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    TextInput,
    ActivityIndicator,
    Alert,
    Modal,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import {
    getProfile,
    getAllAchievements,
    getUserAchievements,
    getActivities,
    updateBodyStats,
    updateUsername,
    requestAccountDeletion,
    confirmAccountDeletion,
} from '../../services/api';
import HexBackground from '../../components/HexBackground';

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
    const router = useRouter();
    const { logoutUser } = useAuth();
    const insets = useSafeAreaInsets();

    const [profile, setProfile] = useState(null);
    const [achievements, setAchievements] = useState([]);
    const [activities, setActivities] = useState([]);
    const [followersCount, setFollowersCount] = useState(0);
    const [followingCount, setFollowingCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('activities');

    // ========== LOAD PROFILE ==========
    useFocusEffect(
      useCallback(() => {
        const loadProfile = async () => {
            try {
                const [profileRes, allRes, userRes, activitiesRes] = await Promise.all([
                    getProfile(),
                    getAllAchievements(),
                    getUserAchievements(),
                    getActivities(),
                ]);
                const profileData = profileRes.data.profile;
                setProfile(profileData);
                setActivities(activitiesRes.data.activities || []);
                setFollowersCount(profileData.followers ?? 0);
                setFollowingCount(profileData.following ?? 0);

                // Merge achievements
                const allList = allRes.data.achievements || [];
                const userList = userRes.data.achievements || [];
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
            } catch (err) {
                console.error('Profile load error:', err);
            } finally {
                setLoading(false);
            }
        };
        loadProfile();
      }, [])
    );

    const stats = profile?.stats || {};

    return (
        <View style={styles.container}>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#10b981" />
                </View>
            ) : !profile ? (
                <View style={styles.loadingContainer}>
                    <Text style={{ color: '#f87171', fontSize: 16, fontWeight: '700' }}>
                        Profile not found
                    </Text>
                </View>
            ) : (
            <>
            <HexBackground />
            <ScrollView style={styles.scrollView} contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16 }]}>

                {/* ===== PROFILE HEADER ===== */}
                <View style={styles.headerCard}>
                    <View style={styles.headerTop}>
                        <View style={styles.headerUser}>
                            <View style={styles.avatarLarge}>
                                <Text style={styles.avatarLargeText}>
                                    {profile.username?.[0]?.toUpperCase() ?? '?'}
                                </Text>
                            </View>
                            <View>
                                <Text style={styles.usernameText}>{profile.username}</Text>
                                <Text style={styles.memberSince}>
                                    Member since {new Date(profile.createdAt).toLocaleDateString('en-US', {
                                        month: 'long', year: 'numeric',
                                    })}
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Stats grid */}
                    <View style={styles.statsGrid}>
                        <StatItem label="Followers" value={followersCount} />
                        <StatItem label="Following" value={followingCount} />
                        <StatItem label="Hexagons" value={stats.totalHexagonsCaptured ?? 0} color="#10b981" />
                        <StatItem label="Miles" value={(stats.totalDistance ?? 0).toFixed(1)} color="#60a5fa" />
                        <StatItem label="Activities" value={(stats.totalWalks ?? 0) + (stats.totalRuns ?? 0)} color="#a78bfa" />
                        <StatItem label="Stolen" value={stats.totalStolenTerritories ?? 0} color="#f87171" />
                    </View>
                </View>

                {/* ===== TABS ===== */}
                <View style={styles.tabBar}>
                    {['activities', 'achievements', 'settings'].map(tab => (
                        <TouchableOpacity
                            key={tab}
                            onPress={() => setActiveTab(tab)}
                            style={[styles.tab, activeTab === tab && styles.tabActive]}
                        >
                            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {activeTab === 'activities' && (
                    <ActivitiesTab activities={activities} />
                )}

                {activeTab === 'achievements' && (
                    <AchievementsTab achievements={achievements} />
                )}

                {activeTab === 'settings' && (
                    <SettingsTab
                        profile={profile}
                        setProfile={setProfile}
                        logoutUser={logoutUser}
                        router={router}
                    />
                )}

                <View style={{ height: 20 }} />
            </ScrollView>
            </>
            )}
        </View>
    );
}

// ========== STAT ITEM ==========
function StatItem({ label, value, color = '#ffffff' }) {
    return (
        <View style={styles.statItem}>
            <Text style={[styles.statItemValue, { color }]}>{value}</Text>
            <Text style={styles.statItemLabel}>{label}</Text>
        </View>
    );
}

// ========== ACTIVITIES TAB ==========
function ActivitiesTab({ activities }) {
    if (activities.length === 0) {
        return (
            <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No activities yet</Text>
                <Text style={styles.emptyText}>Get outside and start capturing territory!</Text>
            </View>
        );
    }

    return (
        <View>
            {activities.map(activity => {
                const isWalk = activity.activityType === 'walk';
                const hexCount = Array.isArray(activity.capturedHexagons)
                    ? activity.capturedHexagons.length
                    : (activity.capturedHexagons ?? 0);
                const formatDuration = (s) => {
                    if (!s) return '0m';
                    const h = Math.floor(s / 3600);
                    const m = Math.floor((s % 3600) / 60);
                    return h > 0 ? `${h}h ${m}m` : `${m}m`;
                };

                return (
                    <View key={activity._id} style={styles.activityRow}>
                        <View style={[styles.activityIcon, {
                            backgroundColor: isWalk ? 'rgba(59,130,246,0.2)' : 'rgba(16,185,129,0.2)'
                        }]}>
                            <Text>{isWalk ? '🚶' : '🏃'}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.activityType}>{activity.activityType?.toLowerCase()}</Text>
                            <Text style={styles.activityStats}>
                                {(activity.distance ?? 0).toFixed(2)}mi · {formatDuration(activity.duration)} · {hexCount} hex
                            </Text>
                        </View>
                        <Text style={styles.activityTime}>{timeAgo(activity.createdAt)}</Text>
                    </View>
                );
            })}
        </View>
    );
}

// ========== ACHIEVEMENTS TAB ==========
function AchievementsTab({ achievements }) {
    const rarityColors = {
        COMMON: '#9ca3af', UNCOMMON: '#4ade80', RARE: '#60a5fa',
        EPIC: '#a78bfa', LEGENDARY: '#facc15',
    };

    if (achievements.length === 0) {
        return (
            <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No achievements yet</Text>
                <Text style={styles.emptyText}>Log activities to unlock achievements!</Text>
            </View>
        );
    }

    return (
        <View>
            {achievements.map((a, index) => (
                <View
                    key={a._id ?? index}
                    style={[
                        styles.achievementRow,
                        a.isUnlocked ? styles.achievementUnlocked : styles.achievementLocked,
                    ]}
                >
                    <Text style={styles.achievementIcon}>{a.isUnlocked ? '🏆' : '🔒'}</Text>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.achievementName, !a.isUnlocked && { color: '#6b7280' }]}>
                            {a.name ?? 'Achievement'}
                        </Text>
                        <Text style={[styles.achievementDesc, !a.isUnlocked && { color: '#4b5563' }]}>
                            {a.description ?? ''}
                        </Text>
                        {a.isUnlocked && a.unlockedAt && (
                            <Text style={styles.achievementUnlockedAt}>
                                Unlocked {timeAgo(a.unlockedAt)}
                            </Text>
                        )}
                    </View>
                    {a.rarity && (
                        <Text style={[styles.achievementRarity, {
                            color: a.isUnlocked ? (rarityColors[a.rarity] || '#10b981') : '#4b5563'
                        }]}>
                            {a.rarity}
                        </Text>
                    )}
                </View>
            ))}
        </View>
    );
}

// ========== SETTINGS TAB ==========
function SettingsTab({ profile, setProfile, logoutUser, router }) {
    const [weight, setWeight] = useState(String(profile.weight ?? ''));
    const [age, setAge] = useState(String(profile.age ?? ''));
    const [sex, setSex] = useState(profile.sex ?? '');
    const [heightFeet, setHeightFeet] = useState(String(profile.heightFeet ?? ''));
    const [heightInches, setHeightInches] = useState(String(profile.heightInches ?? ''));
    const [stepLength, setStepLength] = useState(String(profile.stepLength ?? ''));
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState('');
    const [saveError, setSaveError] = useState('');

    const [newUsername, setNewUsername] = useState('');
    const [usernameLoading, setUsernameLoading] = useState(false);
    const [usernameMsg, setUsernameMsg] = useState('');
    const [usernameError, setUsernameError] = useState('');

    const [stepLengthManual, setStepLengthManual] = useState(false);
    const [showSexTooltip, setShowSexTooltip] = useState(false);
    const [showStepTooltip, setShowStepTooltip] = useState(false);

    // Auto-estimate step length from height
    useEffect(() => {
        if (heightFeet && heightInches !== '' && !stepLengthManual) {
            const totalInches = (Number(heightFeet) * 12) + Number(heightInches);
            if (totalInches > 0) {
                setStepLength(String(Math.round(totalInches * 0.413)));
            }
        }
    }, [heightFeet, heightInches]);

    const handleSaveBodyStats = async () => {
        setSaving(true);
        setSaveMsg('');
        setSaveError('');
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
            setSaveMsg('Saved!');
            setTimeout(() => setSaveMsg(''), 3000);
        } catch (err) {
            setSaveError(err.response?.data?.message || 'Failed to save.');
        } finally {
            setSaving(false);
        }
    };

    const handleChangeUsername = async () => {
        if (!newUsername.trim()) return;
        setUsernameLoading(true);
        setUsernameMsg('');
        setUsernameError('');
        try {
            const res = await updateUsername({ newUsername: newUsername.trim() });
            setProfile(res.data.profile);
            setNewUsername('');
            setUsernameMsg('Username changed!');
            setTimeout(() => setUsernameMsg(''), 3000);
        } catch (err) {
            setUsernameError(err.response?.data?.message || 'Failed to change username.');
        } finally {
            setUsernameLoading(false);
        }
    };

// Delete account state
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteCode, setDeleteCode] = useState('');
    const [deleteStep, setDeleteStep] = useState(1); // 1 = confirm, 2 = enter code
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteError, setDeleteError] = useState('');

    const handleDeleteRequest = async () => {
        setDeleteLoading(true);
        setDeleteError('');
        try {
            await requestAccountDeletion();
            setDeleteStep(2);
        } catch (err) {
            setDeleteError('Failed to send deletion code.');
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleDeleteConfirm = async () => {
        if (!deleteCode.trim() || deleteCode.trim().length !== 6) {
            setDeleteError('Please enter the 6-digit code.');
            return;
        }
        setDeleteLoading(true);
        setDeleteError('');
        try {
            await confirmAccountDeletion({ code: deleteCode.trim() });
            Alert.alert('Account Deleted', 'Your account has been permanently deleted.');
            await logoutUser();
            router.replace('/login');
        } catch (err) {
            setDeleteError(err.response?.data?.message || 'Invalid or expired code.');
        } finally {
            setDeleteLoading(false);
        }
    };

    const inputStyle = {
        backgroundColor: '#1f2937',
        borderWidth: 1,
        borderColor: '#374151',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '700',
    };

    return (
        <View>
            {/* ===== BODY STATS ===== */}
            <View style={styles.settingsCard}>
                <Text style={styles.settingsTitle}>BODY STATS</Text>
                <Text style={styles.settingsSubtitle}>Optional — improves calorie and distance accuracy</Text>

                <Text style={styles.inputLabel}>Weight (lbs)</Text>
                <TextInput style={inputStyle} value={weight} onChangeText={setWeight} placeholder="154" placeholderTextColor="#4b5563" keyboardType="numeric" />

                <Text style={[styles.inputLabel, { marginTop: 12 }]}>Age</Text>
                <TextInput style={inputStyle} value={age} onChangeText={setAge} placeholder="25" placeholderTextColor="#4b5563" keyboardType="numeric" />

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, marginBottom: 6 }}>
                    <Text style={styles.inputLabel}>Sex</Text>
                    <TouchableOpacity
                        onPress={() => { setShowSexTooltip(prev => !prev); setShowStepTooltip(false); }}
                        style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: '#374151', alignItems: 'center', justifyContent: 'center' }}
                    >
                        <Text style={{ color: '#9ca3af', fontSize: 10, fontWeight: '900' }}>i</Text>
                    </TouchableOpacity>
                </View>
                {showSexTooltip && (
                    <View style={{ backgroundColor: '#1f2937', borderWidth: 1, borderColor: '#374151', borderRadius: 10, padding: 10, marginBottom: 8 }}>
                        <Text style={{ color: '#9ca3af', fontSize: 11, fontWeight: '700', lineHeight: 16 }}>
                            Biological sex affects metabolic rate, which impacts calorie burn calculations by ~10-15%. This is optional and only used for accuracy.
                        </Text>
                    </View>
                )}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                    {['male', 'female', 'prefer_not_to_say'].map(option => (
                        <TouchableOpacity
                            key={option}
                            onPress={() => setSex(option)}
                            style={[styles.sexButton, sex === option && styles.sexButtonActive]}
                        >
                            <Text style={[styles.sexButtonText, sex === option && styles.sexButtonTextActive]}>
                                {option === 'prefer_not_to_say' ? 'N/A' : option.charAt(0).toUpperCase() + option.slice(1)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <Text style={[styles.inputLabel, { marginTop: 12 }]}>Height</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                        <TextInput style={inputStyle} value={heightFeet} onChangeText={setHeightFeet} placeholder="5" placeholderTextColor="#4b5563" keyboardType="numeric" />
                        <Text style={styles.unitLabel}>ft</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <TextInput style={inputStyle} value={heightInches} onChangeText={setHeightInches} placeholder="10" placeholderTextColor="#4b5563" keyboardType="numeric" />
                        <Text style={styles.unitLabel}>in</Text>
                    </View>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, marginBottom: 6 }}>
                    <Text style={styles.inputLabel}>
                        Step Length (inches)
                        {heightFeet && heightInches !== '' && !stepLengthManual && (
                            <Text style={{ color: '#10b981' }}> auto-estimated</Text>
                        )}
                    </Text>
                    <TouchableOpacity
                        onPress={() => { setShowStepTooltip(prev => !prev); setShowSexTooltip(false); }}
                        style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: '#374151', alignItems: 'center', justifyContent: 'center' }}
                    >
                        <Text style={{ color: '#9ca3af', fontSize: 10, fontWeight: '900' }}>i</Text>
                    </TouchableOpacity>
                </View>
                {showStepTooltip && (
                    <View style={{ backgroundColor: '#1f2937', borderWidth: 1, borderColor: '#374151', borderRadius: 10, padding: 10, marginBottom: 8 }}>
                        <Text style={{ color: '#9ca3af', fontSize: 11, fontWeight: '700', lineHeight: 16 }}>
                            The auto-estimate is approximate (~5/10 accuracy). For a precise measurement: walk 10 normal steps, measure the total distance in inches, and divide by 10.
                        </Text>
                    </View>
                )}
                <TextInput
                    style={inputStyle}
                    value={stepLength}
                    onChangeText={(t) => { setStepLength(t); setStepLengthManual(t !== ''); }}
                    placeholder="24"
                    placeholderTextColor="#4b5563"
                    keyboardType="numeric"
                />

                {saveError !== '' && <Text style={styles.errorMsg}>{saveError}</Text>}
                {saveMsg !== '' && <Text style={styles.successMsg}>{saveMsg}</Text>}

                <TouchableOpacity
                    onPress={handleSaveBodyStats}
                    disabled={saving}
                    style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                >
                    <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save Body Stats'}</Text>
                </TouchableOpacity>
            </View>

            {/* ===== USERNAME CHANGE ===== */}
            <View style={styles.settingsCard}>
                <Text style={styles.settingsTitle}>CHANGE USERNAME</Text>
                {profile.canChangeUsername ? (
                    <>
                        <Text style={styles.settingsSubtitle}>Current: {profile.username}</Text>
                        <TextInput
                            style={[inputStyle, { marginTop: 8 }]}
                            value={newUsername}
                            onChangeText={(t) => { setNewUsername(t); setUsernameError(''); }}
                            placeholder="New username"
                            placeholderTextColor="#4b5563"
                            maxLength={20}
                            autoCapitalize="none"
                        />
                        {usernameError !== '' && <Text style={styles.errorMsg}>{usernameError}</Text>}
                        {usernameMsg !== '' && <Text style={styles.successMsg}>{usernameMsg}</Text>}
                        <TouchableOpacity
                            onPress={handleChangeUsername}
                            disabled={usernameLoading || !newUsername.trim()}
                            style={[styles.saveButton, (usernameLoading || !newUsername.trim()) && styles.saveButtonDisabled]}
                        >
                            <Text style={styles.saveButtonText}>
                                {usernameLoading ? 'Changing...' : 'Change Username'}
                            </Text>
                        </TouchableOpacity>
                    </>
                ) : (
                    <>
                        <Text style={styles.settingsSubtitle}>Capture 100 hexagons to unlock</Text>
                        <View style={styles.progressBar}>
                            <View style={[styles.progressFill, {
                                width: `${Math.min(100, ((profile.stats?.totalHexagonsCaptured ?? 0) / 100) * 100)}%`
                            }]} />
                        </View>
                        <Text style={styles.progressText}>
                            {profile.stats?.totalHexagonsCaptured ?? 0} / 100
                        </Text>
                    </>
                )}
            </View>

            {/* ===== DANGER ZONE ===== */}
            <View style={[styles.settingsCard, { borderColor: 'rgba(239, 68, 68, 0.3)' }]}>
                <Text style={[styles.settingsTitle, { color: '#f87171' }]}>DANGER ZONE</Text>
                <TouchableOpacity onPress={() => { setShowDeleteModal(true); setDeleteStep(1); setDeleteCode(''); setDeleteError(''); }} style={styles.deleteButton}>
                    <Text style={styles.deleteButtonText}>Delete Account</Text>
                </TouchableOpacity>
            </View>

            {/* ===== DELETE ACCOUNT MODAL (true full-screen overlay via RN Modal) ===== */}
            <Modal
                visible={showDeleteModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowDeleteModal(false)}
            >
                <View style={{
                    flex: 1,
                    backgroundColor: 'rgba(3,7,18,0.9)',
                    justifyContent: 'center',
                    paddingHorizontal: 20,
                }}>
                    <View style={{
                        backgroundColor: '#111827', borderRadius: 20, padding: 24,
                        borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
                    }}>
                        {deleteStep === 1 ? (
                            <>
                                <Text style={{ color: '#f87171', fontSize: 18, fontWeight: '900', marginBottom: 8 }}>
                                    Delete Account
                                </Text>
                                <Text style={{ color: '#9ca3af', fontSize: 13, fontWeight: '700', marginBottom: 16 }}>
                                    This will permanently delete your account and all data. A 6-digit confirmation code will be sent to your email.
                                </Text>
                                {deleteError !== '' && (
                                    <Text style={{ color: '#f87171', fontSize: 12, fontWeight: '700', marginBottom: 12 }}>{deleteError}</Text>
                                )}
                                <TouchableOpacity
                                    onPress={handleDeleteRequest}
                                    disabled={deleteLoading}
                                    style={{ backgroundColor: '#ef4444', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 10 }}
                                >
                                    <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '900' }}>
                                        {deleteLoading ? 'Sending...' : 'Send Confirmation Code'}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setShowDeleteModal(false)} style={{ alignItems: 'center', paddingVertical: 10 }}>
                                    <Text style={{ color: '#9ca3af', fontSize: 14, fontWeight: '700' }}>Cancel</Text>
                                </TouchableOpacity>
                            </>
                        ) : (
                            <>
                                <Text style={{ color: '#f87171', fontSize: 18, fontWeight: '900', marginBottom: 8 }}>
                                    Enter Confirmation Code
                                </Text>
                                <Text style={{ color: '#9ca3af', fontSize: 13, fontWeight: '700', marginBottom: 16 }}>
                                    Check your email for the 6-digit code.
                                </Text>
                                <TextInput
                                    style={{
                                        backgroundColor: '#1f2937', borderWidth: 1, borderColor: '#374151',
                                        borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
                                        color: '#ffffff', fontSize: 24, fontWeight: '900',
                                        textAlign: 'center', letterSpacing: 8, marginBottom: 16,
                                    }}
                                    value={deleteCode}
                                    onChangeText={(t) => { setDeleteCode(t); setDeleteError(''); }}
                                    placeholder="000000"
                                    placeholderTextColor="#4b5563"
                                    keyboardType="number-pad"
                                    maxLength={6}
                                    autoFocus={true}
                                />
                                {deleteError !== '' && (
                                    <Text style={{ color: '#f87171', fontSize: 12, fontWeight: '700', marginBottom: 12 }}>{deleteError}</Text>
                                )}
                                <TouchableOpacity
                                    onPress={handleDeleteConfirm}
                                    disabled={deleteLoading}
                                    style={{ backgroundColor: '#ef4444', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 10 }}
                                >
                                    <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '900' }}>
                                        {deleteLoading ? 'Deleting...' : 'Permanently Delete Account'}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setShowDeleteModal(false)} style={{ alignItems: 'center', paddingVertical: 10 }}>
                                    <Text style={{ color: '#9ca3af', fontSize: 14, fontWeight: '700' }}>Cancel</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </View>
            </Modal>

            {/* ===== LOGOUT ===== */}
            <TouchableOpacity
                onPress={async () => { await logoutUser(); router.replace('/login'); }}
                style={styles.logoutButton}
            >
                <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
        </View>
    );
}

// ========== STYLES ==========
const styles = {
    container: { flex: 1, backgroundColor: '#030712' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', zIndex: 1 },
    scrollView: { flex: 1, zIndex: 1 },
    scrollContent: { paddingHorizontal: 16, paddingBottom: 20 },

    // Header
    headerCard: { backgroundColor: '#111827', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#1f2937', marginBottom: 16 },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    headerUser: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    avatarLarge: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#1f2937', borderWidth: 1, borderColor: '#374151', alignItems: 'center', justifyContent: 'center' },
    avatarLargeText: { color: '#10b981', fontSize: 20, fontWeight: '900' },
    usernameText: { color: '#ffffff', fontSize: 18, fontWeight: '900' },
    memberSince: { color: '#9ca3af', fontSize: 12, fontWeight: '700', marginTop: 2 },
    followButton: { backgroundColor: '#10b981', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
    followButtonFollowing: { backgroundColor: '#1f2937' },
    followButtonText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
    followButtonTextFollowing: { color: '#9ca3af' },

    // Stats grid
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#1f2937' },
    statItem: { width: '33.33%', alignItems: 'center', marginBottom: 12 },
    statItemValue: { fontSize: 18, fontWeight: '900' },
    statItemLabel: { color: '#9ca3af', fontSize: 10, fontWeight: '700', marginTop: 2 },

    // Tabs
    tabBar: { flexDirection: 'row', backgroundColor: '#111827', borderRadius: 12, padding: 4, borderWidth: 1, borderColor: '#1f2937', marginBottom: 16, gap: 4 },
    tab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
    tabActive: { backgroundColor: '#10b981' },
    tabText: { color: '#6b7280', fontSize: 13, fontWeight: '700' },
    tabTextActive: { color: '#ffffff' },

    // Empty states
    emptyState: { alignItems: 'center', paddingVertical: 32 },
    emptyTitle: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
    emptyText: { color: '#9ca3af', fontSize: 12, fontWeight: '700', marginTop: 4 },

    // Activity row
    activityRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#111827', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#1f2937', marginBottom: 8 },
    activityIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    activityType: { color: '#ffffff', fontSize: 13, fontWeight: '700', textTransform: 'capitalize' },
    activityStats: { color: '#9ca3af', fontSize: 11, fontWeight: '700', marginTop: 2 },
    activityTime: { color: '#6b7280', fontSize: 11, fontWeight: '700' },

    // Achievement row
    achievementRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, padding: 12, marginBottom: 8 },
    achievementUnlocked: { backgroundColor: 'rgba(16,185,129,0.1)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)' },
    achievementLocked: { backgroundColor: '#111827', borderWidth: 1, borderColor: '#1f2937', opacity: 0.6 },
    achievementIcon: { fontSize: 20 },
    achievementName: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
    achievementDesc: { color: '#9ca3af', fontSize: 11, fontWeight: '700', marginTop: 2 },
    achievementUnlockedAt: { color: '#10b981', fontSize: 11, fontWeight: '700', marginTop: 4 },
    achievementRarity: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },

    // Settings
    settingsCard: { backgroundColor: '#111827', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#1f2937', marginBottom: 16 },
    settingsTitle: { color: '#9ca3af', fontSize: 11, fontWeight: '900', letterSpacing: 1, marginBottom: 4 },
    settingsSubtitle: { color: '#6b7280', fontSize: 12, fontWeight: '700', marginBottom: 16 },
    inputLabel: { color: '#9ca3af', fontSize: 12, fontWeight: '700', marginBottom: 6 },
    unitLabel: { color: '#6b7280', fontSize: 11, fontWeight: '700', textAlign: 'right', marginTop: 4 },
    sexButton: { flex: 1, backgroundColor: '#1f2937', borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#374151' },
    sexButtonActive: { borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)' },
    sexButtonText: { color: '#6b7280', fontSize: 13, fontWeight: '700' },
    sexButtonTextActive: { color: '#10b981' },
    saveButton: { backgroundColor: '#10b981', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 16 },
    saveButtonDisabled: { backgroundColor: '#1f2937' },
    saveButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '900' },
    errorMsg: { color: '#f87171', fontSize: 12, fontWeight: '700', marginTop: 8 },
    successMsg: { color: '#10b981', fontSize: 12, fontWeight: '700', marginTop: 8 },
    progressBar: { height: 8, backgroundColor: '#1f2937', borderRadius: 4, marginTop: 12, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: '#10b981', borderRadius: 4 },
    progressText: { color: '#6b7280', fontSize: 11, fontWeight: '700', textAlign: 'right', marginTop: 4 },
    deleteButton: { backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 8 },
    deleteButtonText: { color: '#f87171', fontSize: 14, fontWeight: '700' },
    logoutButton: { backgroundColor: '#1f2937', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
    logoutText: { color: '#9ca3af', fontSize: 14, fontWeight: '900' },
};
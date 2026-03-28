// ========== API SERVICE (REACT NATIVE) ==========
// Central place for all backend communication.
// Nearly identical to the web version — same endpoints, same shapes.
// Only difference: token storage uses expo-secure-store instead of localStorage.

import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// TODO: Switch to your Render URL for production builds
const BASE_URL = 'https://territory-app-29b7.onrender.com';

// ========== AXIOS INSTANCE ==========
const api = axios.create({ baseURL: BASE_URL });

// Attach JWT token to every request if available
api.interceptors.request.use(async (config) => {
    const token = await SecureStore.getItemAsync('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// ========== AUTH ==========
export const signup = (data) => api.post('/api/auth/signup', data);
export const login = (data) => api.post('/api/auth/login', data);
export const resendVerification = (data) => api.post('/api/auth/resend-verification', data);

// ========== ACTIVITIES ==========
export const createActivity = (data) => api.post('/api/activities', data);
export const getActivities = () => api.get('/api/activities');
export const getFeed = () => api.get('/api/activities/feed');
export const getActivity = (id) => api.get(`/api/activities/${id}`);
export const deleteActivity = (id) => api.delete(`/api/activities/${id}`);
export const addComment = (id, data) => api.post(`/api/activities/${id}/comment`, data);
export const addKudos = (id) => api.post(`/api/activities/${id}/kudos`);
export const removeKudos = (id) => api.delete(`/api/activities/${id}/kudos`);

// ========== USER ==========
export const getProfile = () => api.get('/api/user/profile');
export const updateBodyStats = (data) => api.put('/api/user/body-stats', data);
export const updateProfile = (data) => api.put('/api/user/profile', data);
export const updateUsername = (data) => api.put('/api/user/username', data);
export const getUserTerritories = () => api.get('/api/user/territories');
export const getTerritories = () => api.get('/api/user/territories');
export const requestAccountDeletion = () => api.post('/api/user/account/delete-request');
export const confirmAccountDeletion = (data) => api.delete('/api/user/account/confirm', { data });

// ========== USERS (public profiles) ==========
export const getUserById = (id) => api.get(`/api/users/${id}`);
export const getNearbyHexagons = (lat, lng, rings) => api.get(`/api/user/nearby-hexagons?latitude=${lat}&longitude=${lng}&rings=${rings || 4}`);

// ========== SOCIAL ==========
export const followUser = (id) => api.post(`/api/users/${id}/follow`);
export const unfollowUser = (id) => api.delete(`/api/users/${id}/follow`);
export const getFollowers = (id) => api.get(`/api/users/${id}/followers`);
export const getFollowing = (id) => api.get(`/api/users/${id}/following`);

// ========== ACHIEVEMENTS ==========
export const getAllAchievements = () => api.get('/api/achievements');
export const getUserAchievements = () => api.get('/api/achievements/user');

// ========== LEADERBOARD ==========
export const getHexagonLeaderboard = () => api.get('/api/leaderboard/hexagons');
export const getDistanceLeaderboard = () => api.get('/api/leaderboard/distance');
export const getActivityLeaderboard = () => api.get('/api/leaderboard/activity');

// ========== NOTIFICATIONS ==========
export const getNotifications = () => api.get('/api/notifications');
export const getUnreadCount = () => api.get('/api/notifications/unread-count');
export const markAsRead = (id) => api.put(`/api/notifications/${id}/read`);
export const markAllRead = () => api.put('/api/notifications/read-all');
export const deleteNotification = (id) => api.delete(`/api/notifications/${id}`);

export default api;
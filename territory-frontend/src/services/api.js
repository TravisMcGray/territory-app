// ========== API SERVICE ==========
// Central place for all backend communication.
// Every component imports from here - never write fetch() calls directly in components.

import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// ========== AXIOS INSTANCE ==========
// Attach auth token automatically to every request that needs it.
const api = axios.create({
    baseURL: BASE_URL,
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// ========== AUTH ==========
export const signup = (data) => api.post('/api/auth/signup', data);
export const login = (data) => api.post('/api/auth/login', data);

// ========== ACTIVITIES ==========
export const createActivity = (data) => api.post('/api/activities', data);
export const getActivities = () => api.get('/api/activities');
export const getFeed = () => api.get('/api/activities/feed');
export const getActivity = (id) => api.get(`/api/activities/${id}`);
export const deleteActivity = (id) => api.delete(`/api/activities/${id}`);
export const addComment = (id, data) => api.post(`/api/activities/${id}/comment`, data);
export const addKudos = (id) => api.post(`/api/activities/${id}/kudos`);
export const removeKudos = (id) => api.delete(`/api/activities/${id}/kudos`);

// ========== USERS ==========
export const getProfile = () => api.get('/api/user/profile');
export const updateUsername = (data) => api.put('/api/user/username', data);
export const getUserAchievements = () => api.get('/api/user/achievements');
export const getUserTerritories = () => api.get('/api/user/territories');
export const getUserById = (id) => api.get(`/api/users/${id}`);
export const getTerritories = () => api.get('/api/user/territories')

// ========== SOCIAL ==========
export const followUser = (id) => api.post(`/api/users/${id}/follow`);
export const unfollowUser = (id) => api.delete(`/api/users/${id}/follow`);
export const getFollowers = (id) => api.get(`/api/users/${id}/followers`);
export const getFollowing = (id) => api.get(`/api/users/${id}/following`);

// ========== LEADERBOARD ==========
export const getHexagonLeaderboard = () => api.get('/api/leaderboard/hexagons');
export const getDistanceLeaderboard = () => api.get('/api/leaderboard/distance');
export const getActivityLeaderboard = () => api.get('/api/leaderboard/activity');

// ========== ACHIEVEMENTS ==========
export const getAchievements = () => api.get('/api/achievements');

// ========== NOTIFICATIONS ==========
export const getNotifications = () => api.get('/api/notifications');
export const getUnreadCount = () => api.get('/api/notifications/unread-count');
export const markAsRead = (id) => api.put(`/api/notifications/${id}/read`);
export const markAllRead = () => api.put('/api/notifications/read-all');
export const deleteNotification = (id) => api.delete(`/api/notifications/${id}`);

// ========== SEGMENTS ==========
export const createSegment = (data) => api.post('/api/segments', data);
export const getSegments = () => api.get('/api/segments');
export const getSegment = (id) => api.get(`/api/segments/${id}`);
export const attemptSegment = (id, data) => api.post(`/api/segments/${id}/attempt`, data);
export const getSegmentLeaderboard = (id) => api.get(`/api/segments/${id}/leaderboard`);

// ========== ROUTES ==========
export const createRoute = (data) => api.post('/api/routes', data);
export const getRoutes = () => api.get('/api/routes');
export const getNearbyRoutes = (params) => api.get('/api/routes/nearby', { params });
export const getRoute = (id) => api.get(`/api/routes/${id}`);
export const attemptRoute = (id, data) => api.post(`/api/routes/${id}/attempt`, data);
export const getRouteLeaderboard = (id) => api.get(`/api/routes/${id}/leaderboard`);

export default api;
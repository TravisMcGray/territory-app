// ========== TAB NAVIGATION LAYOUT ==========
// Bottom tab bar with four tabs: Dashboard, Feed, Leaderboard, Profile.
// Matches the web app's Navbar links.
// Uses custom dark styling to match the HexCapture design system.

import { Tabs } from 'expo-router';
import Svg, { Polygon, Polyline, Circle, Line, G } from 'react-native-svg';

// ========== TAB ICONS ==========
// Custom hex-themed icons matching the web app's visual language.

function DashboardIcon({ color, size }) {
    return (
        <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
            <Polygon
                points="2,14 8,3 20,3 26,14 20,25 8,25"
                stroke={color}
                strokeWidth="2"
                fill="none"
            />
            <Polygon
                points="8,14 11,8.5 17,8.5 20,14 17,19.5 11,19.5"
                stroke={color}
                strokeWidth="1.5"
                fill="none"
            />
        </Svg>
    );
}

function FeedIcon({ color, size }) {
    return (
        <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
            <Polyline
                points="2,14 6,14 9,6 13,22 17,10 20,14 26,14"
                stroke={color}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
            />
        </Svg>
    );
}

function LeaderboardIcon({ color, size }) {
    return (
        <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
            <Polygon
                points="2,14 8,3 20,3 26,14 20,25 8,25"
                stroke={color}
                strokeWidth="2"
                fill="none"
            />
            <Line x1="10" y1="18" x2="10" y2="12" stroke={color} strokeWidth="2" strokeLinecap="round" />
            <Line x1="14" y1="18" x2="14" y2="8" stroke={color} strokeWidth="2" strokeLinecap="round" />
            <Line x1="18" y1="18" x2="18" y2="14" stroke={color} strokeWidth="2" strokeLinecap="round" />
        </Svg>
    );
}

function ProfileIcon({ color, size }) {
    return (
        <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
            <Polygon
                points="2,14 8,3 20,3 26,14 20,25 8,25"
                stroke={color}
                strokeWidth="2"
                fill="none"
            />
            <Circle cx="14" cy="11" r="3" stroke={color} strokeWidth="1.5" fill="none" />
            <Line x1="9" y1="20" x2="19" y2="20" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        </Svg>
    );
}

// ========== TAB LAYOUT ==========
export default function TabLayout() {
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: '#111827',
                    borderTopColor: '#1f2937',
                    borderTopWidth: 1,
                    height: 100,
                    paddingBottom: 28,
                    paddingTop: 8,
                },
                tabBarActiveTintColor: '#10b981',
                tabBarInactiveTintColor: '#6b7280',
                tabBarLabelStyle: {
                    fontSize: 11,
                    fontWeight: '700',
                },
            }}
        >
            <Tabs.Screen
                name="dashboard"
                options={{
                    title: 'Home',
                    tabBarIcon: ({ color }) => <DashboardIcon color={color} size={24} />,
                }}
            />
            <Tabs.Screen
                name="feed"
                options={{
                    title: 'Feed',
                    tabBarIcon: ({ color }) => <FeedIcon color={color} size={24} />,
                }}
            />
            <Tabs.Screen
                name="leaderboard"
                options={{
                    title: 'Ranks',
                    tabBarIcon: ({ color }) => <LeaderboardIcon color={color} size={24} />,
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Profile',
                    tabBarIcon: ({ color }) => <ProfileIcon color={color} size={24} />,
                }}
            />
        </Tabs>
    );
}
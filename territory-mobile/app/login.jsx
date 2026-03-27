// ========== LOGIN SCREEN ==========
// Same auth flow as web Login.jsx:
// 1. User enters email + password
// 2. Calls POST /api/auth/login
// 3. On success: stores token via AuthContext → redirects to dashboard
// 4. Handles EMAIL_NOT_VERIFIED with resend option
//
// UI adapted for mobile: no HexBackground, uses React Native components.

import { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { login as loginAPI, resendVerification } from '../services/api';

export default function Login() {
    const router = useRouter();
    const { loginUser } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showResend, setShowResend] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);

    // ========== LOGIN HANDLER ==========
    const handleLogin = async () => {
        if (!email.trim() || !password.trim()) {
            setError('Email and password are required');
            return;
        }

        setLoading(true);
        setError('');
        setShowResend(false);

        try {
            const res = await loginAPI({ email: email.trim().toLowerCase(), password });
            await loginUser(res.data.token);
            // AuthGate in _layout.jsx will redirect to dashboard
        } catch (err) {
            const code = err.response?.data?.code;
            const message = err.response?.data?.message || 'Login failed. Please try again.';

            if (code === 'EMAIL_NOT_VERIFIED') {
                setShowResend(true);
            }

            setError(message);
        } finally {
            setLoading(false);
        }
    };

    // ========== RESEND VERIFICATION ==========
    const handleResend = async () => {
        setResendLoading(true);
        try {
            await resendVerification({ email: email.trim().toLowerCase() });
            Alert.alert('Email Sent', 'Check your inbox for the verification link.');
        } catch (err) {
            Alert.alert('Error', 'Failed to resend verification email.');
        } finally {
            setResendLoading(false);
        }
    };

    // ========== RENDER ==========
    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
            >
                {/* ===== LOGO ===== */}
                <View style={styles.logoContainer}>
                    <Text style={styles.logoText}>
                        Hex<Text style={styles.logoAccent}>Capture</Text>
                    </Text>
                    <Text style={styles.tagline}>Capture territory. Own the map.</Text>
                </View>

                {/* ===== FORM ===== */}
                <View style={styles.formContainer}>
                    <Text style={styles.formTitle}>Log in</Text>

                    {/* Error message */}
                    {error !== '' && (
                        <View style={styles.errorContainer}>
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    )}

                    {/* Resend verification button */}
                    {showResend && (
                        <TouchableOpacity
                            onPress={handleResend}
                            disabled={resendLoading}
                            style={styles.resendButton}
                        >
                            <Text style={styles.resendText}>
                                {resendLoading ? 'Sending...' : 'Resend verification email'}
                            </Text>
                        </TouchableOpacity>
                    )}

                    {/* Email input */}
                    <TextInput
                        style={styles.input}
                        placeholder="Email"
                        placeholderTextColor="#6b7280"
                        value={email}
                        onChangeText={(text) => { setEmail(text); setError(''); }}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                    />

                    {/* Password input */}
                    <TextInput
                        style={styles.input}
                        placeholder="Password"
                        placeholderTextColor="#6b7280"
                        value={password}
                        onChangeText={(text) => { setPassword(text); setError(''); }}
                        secureTextEntry
                    />

                    {/* Login button */}
                    <TouchableOpacity
                        onPress={handleLogin}
                        disabled={loading}
                        style={[styles.loginButton, loading && styles.loginButtonDisabled]}
                    >
                        <Text style={styles.loginButtonText}>
                            {loading ? 'Logging in...' : 'Log In'}
                        </Text>
                    </TouchableOpacity>

                    {/* Sign up link */}
                    <TouchableOpacity
                        onPress={() => router.push('/signup')}
                        style={styles.signupLink}
                    >
                        <Text style={styles.signupText}>
                            Don't have an account? <Text style={styles.signupAccent}>Sign up</Text>
                        </Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

// ========== STYLES ==========
// React Native uses StyleSheet instead of Tailwind.
// Same visual language as the web app — dark background, emerald accents.
const styles = {
    container: {
        flex: 1,
        backgroundColor: '#030712',
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
        paddingVertical: 48,
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 48,
    },
    logoText: {
        fontSize: 36,
        fontWeight: '900',
        color: '#ffffff',
    },
    logoAccent: {
        color: '#10b981',
    },
    tagline: {
        color: '#9ca3af',
        fontSize: 14,
        fontWeight: '700',
        marginTop: 8,
    },
    formContainer: {
        backgroundColor: '#111827',
        borderRadius: 20,
        padding: 24,
        borderWidth: 1,
        borderColor: '#1f2937',
    },
    formTitle: {
        color: '#ffffff',
        fontSize: 20,
        fontWeight: '900',
        marginBottom: 20,
    },
    errorContainer: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.3)',
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
    },
    errorText: {
        color: '#f87171',
        fontSize: 13,
        fontWeight: '700',
    },
    resendButton: {
        marginBottom: 16,
    },
    resendText: {
        color: '#10b981',
        fontSize: 13,
        fontWeight: '700',
        textAlign: 'center',
    },
    input: {
        backgroundColor: '#1f2937',
        borderWidth: 1,
        borderColor: '#374151',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '700',
        marginBottom: 12,
    },
    loginButton: {
        backgroundColor: '#10b981',
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 8,
    },
    loginButtonDisabled: {
        backgroundColor: '#1f2937',
    },
    loginButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '900',
    },
    signupLink: {
        marginTop: 20,
        alignItems: 'center',
    },
    signupText: {
        color: '#9ca3af',
        fontSize: 14,
        fontWeight: '700',
    },
    signupAccent: {
        color: '#10b981',
    },
};
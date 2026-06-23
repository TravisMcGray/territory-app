// ========== SIGNUP SCREEN ==========
// Same auth flow as web Login.jsx signup mode:
// 1. User enters username + email + password
// 2. Calls POST /api/auth/signup
// 3. On success: shows "check your email" verification screen
// 4. User verifies via email link, then goes back to login
//
// Includes resend verification with 60s cooldown (matches web behavior).

import { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { signup as signupAPI, resendVerification } from '../services/api';
import HexBackground from '../components/HexBackground';

export default function Signup() {
    const router = useRouter();

    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Post-signup verification state
    const [awaitingVerification, setAwaitingVerification] = useState(false);
    const [verificationEmail, setVerificationEmail] = useState('');

    // Resend cooldown
    const [resendLoading, setResendLoading] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const [resendSuccess, setResendSuccess] = useState(false);

    // ========== RESEND COOLDOWN TIMER ==========
    useEffect(() => {
        if (resendCooldown <= 0) return;
        const timer = setTimeout(() => setResendCooldown(prev => prev - 1), 1000);
        return () => clearTimeout(timer);
    }, [resendCooldown]);

    // ========== SIGNUP HANDLER ==========
    const handleSignup = async () => {
        if (!username.trim() || !email.trim() || !password.trim()) {
            setError('All fields are required');
            return;
        }

        setLoading(true);
        setError('');

        try {
            await signupAPI({
                username: username.trim(),
                email: email.trim().toLowerCase(),
                password,
            });
            // Success: show verification pending screen
            setVerificationEmail(email.trim().toLowerCase());
            setAwaitingVerification(true);
        } catch (err) {
            const message = err.response?.data?.message || 'Signup failed. Please try again.';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    // ========== RESEND VERIFICATION ==========
    const handleResend = async () => {
        if (resendCooldown > 0 || resendLoading) return;
        setResendLoading(true);
        setResendSuccess(false);
        try {
            await resendVerification({ email: verificationEmail });
            setResendSuccess(true);
            setResendCooldown(60);
        } catch (err) {
            // Generic success: don't reveal if email exists
            setResendSuccess(true);
            setResendCooldown(60);
        } finally {
            setResendLoading(false);
        }
    };

    // ========== POST-SIGNUP VERIFICATION SCREEN ==========
    if (awaitingVerification) {
        return (
            <View style={styles.container}>
                <HexBackground />
                <View style={styles.verificationContent}>
                    <Text style={styles.verificationEmoji}>📬</Text>
                    <Text style={styles.verificationTitle}>Check your email</Text>
                    <Text style={styles.verificationSubtitle}>
                        We sent a verification link to
                    </Text>
                    <Text style={styles.verificationEmail}>{verificationEmail}</Text>

                    {/* Instructions card */}
                    <View style={styles.instructionsCard}>
                        <Text style={styles.instructionsTitle}>What to do next:</Text>
                        <Text style={styles.instructionStep}>1. Open the email from HexCapture</Text>
                        <Text style={styles.instructionStep}>
                            2. Tap the <Text style={styles.instructionAccent}>Verify Email</Text> button
                        </Text>
                        <Text style={styles.instructionStep}>3. Come back here and log in</Text>
                        <Text style={styles.instructionNote}>
                            Link expires in 24 hours. Check your spam folder if you don't see it.
                        </Text>
                    </View>

                    {/* Resend button */}
                    {resendSuccess ? (
                        <Text style={styles.resendSuccessText}>✓ New verification email sent</Text>
                    ) : (
                        <TouchableOpacity
                            onPress={handleResend}
                            disabled={resendLoading || resendCooldown > 0}
                        >
                            <Text style={[
                                styles.resendText,
                                (resendLoading || resendCooldown > 0) && styles.resendTextDisabled,
                            ]}>
                                {resendLoading
                                    ? 'Sending...'
                                    : resendCooldown > 0
                                    ? `Resend in ${resendCooldown}s`
                                    : "Didn't receive it? Resend"}
                            </Text>
                        </TouchableOpacity>
                    )}

                    {/* Back to login */}
                    <TouchableOpacity
                        onPress={() => router.replace('/login')}
                        style={styles.backToLogin}
                    >
                        <Text style={styles.backToLoginText}>← Back to login</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    // ========== SIGNUP FORM ==========
    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <HexBackground />
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
                    <Text style={styles.formTitle}>Create account</Text>

                    {/* Error message */}
                    {error !== '' && (
                        <View style={styles.errorContainer}>
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    )}

                    {/* Username input */}
                    <TextInput
                        style={styles.input}
                        placeholder="Username"
                        placeholderTextColor="#6b7280"
                        value={username}
                        onChangeText={(text) => { setUsername(text); setError(''); }}
                        autoCapitalize="none"
                        autoCorrect={false}
                        maxLength={20}
                    />

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

                    {/* Username rules hint */}
                    <Text style={styles.hintText}>
                        Username: letters and numbers only, 3-20 characters, must start with a letter
                    </Text>

                    {/* Signup button */}
                    <TouchableOpacity
                        onPress={handleSignup}
                        disabled={loading}
                        style={[styles.signupButton, loading && styles.signupButtonDisabled]}
                    >
                        <Text style={styles.signupButtonText}>
                            {loading ? 'Creating account...' : 'Create Account'}
                        </Text>
                    </TouchableOpacity>

                    {/* Login link */}
                    <TouchableOpacity
                        onPress={() => router.replace('/login')}
                        style={styles.loginLink}
                    >
                        <Text style={styles.loginLinkText}>
                            Already have an account? <Text style={styles.loginLinkAccent}>Log in</Text>
                        </Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

// ========== STYLES ==========
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
    hintText: {
        color: '#6b7280',
        fontSize: 11,
        fontWeight: '600',
        marginBottom: 16,
    },
    signupButton: {
        backgroundColor: '#10b981',
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 4,
    },
    signupButtonDisabled: {
        backgroundColor: '#1f2937',
    },
    signupButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '900',
    },
    loginLink: {
        marginTop: 20,
        alignItems: 'center',
    },
    loginLinkText: {
        color: '#9ca3af',
        fontSize: 14,
        fontWeight: '700',
    },
    loginLinkAccent: {
        color: '#10b981',
    },

    // ===== VERIFICATION SCREEN STYLES =====
    verificationContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    verificationEmoji: {
        fontSize: 64,
        marginBottom: 24,
    },
    verificationTitle: {
        fontSize: 28,
        fontWeight: '900',
        color: '#ffffff',
        marginBottom: 8,
    },
    verificationSubtitle: {
        color: '#9ca3af',
        fontSize: 14,
        fontWeight: '700',
    },
    verificationEmail: {
        color: '#10b981',
        fontSize: 16,
        fontWeight: '900',
        marginTop: 4,
        marginBottom: 24,
    },
    instructionsCard: {
        backgroundColor: '#111827',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: '#1f2937',
        width: '100%',
        marginBottom: 24,
    },
    instructionsTitle: {
        color: '#d1d5db',
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 12,
    },
    instructionStep: {
        color: '#9ca3af',
        fontSize: 14,
        marginBottom: 8,
    },
    instructionAccent: {
        color: '#10b981',
        fontWeight: '700',
    },
    instructionNote: {
        color: '#6b7280',
        fontSize: 12,
        marginTop: 8,
    },
    resendSuccessText: {
        color: '#10b981',
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 16,
    },
    resendText: {
        color: '#9ca3af',
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 16,
    },
    resendTextDisabled: {
        color: '#4b5563',
    },
    backToLogin: {
        marginTop: 8,
    },
    backToLoginText: {
        color: '#10b981',
        fontSize: 14,
        fontWeight: '700',
    },
};
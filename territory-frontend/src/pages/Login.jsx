// ========== LOGIN PAGE ==========
// Handles login, signup, and email verification states.
//
// States:
// 1. Normal — login/signup toggle
// 2. Post-signup — "check your email" screen
// 3. Verified — shows success banner when redirected back from email link
// 4. EMAIL_NOT_VERIFIED login error — shows resend button inline

import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { login, signup, resendVerification } from '../services/api';
import { useAuth } from '../context/AuthContext';
import HexBackground from '../components/HexBackground';

export default function Login() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { loginUser } = useAuth();

    const [isSignup, setIsSignup] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Post-signup state — show "check your email" screen
    const [awaitingVerification, setAwaitingVerification] = useState(false);
    const [verificationEmail, setVerificationEmail] = useState('');

    // Resend cooldown — prevents spam
    const [resendLoading, setResendLoading] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const [resendSuccess, setResendSuccess] = useState(false);

    // Unverified login — show resend inline on login form
    const [showResendOnLogin, setShowResendOnLogin] = useState(false);
    const [loginEmail, setLoginEmail] = useState('');

    const [form, setForm] = useState({ username: '', email: '', password: '' });

    // ========== CHECK REDIRECT FLAGS ==========
    // Backend redirects to /login?verified=true after successful email verification
    const verifiedParam = searchParams.get('verified');

    // ========== RESEND COOLDOWN TIMER ==========
    useEffect(() => {
        if (resendCooldown <= 0) return;
        const timer = setTimeout(() => setResendCooldown(prev => prev - 1), 1000);
        return () => clearTimeout(timer);
    }, [resendCooldown]);

    // ========== HANDLERS ==========
    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
        if (e.target.name === 'email') setLoginEmail(e.target.value);
        setError('');
        setShowResendOnLogin(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setShowResendOnLogin(false);

        try {
            if (isSignup) {
                await signup({
                    username: form.username,
                    email: form.email,
                    password: form.password,
                });
                // Don't navigate — show verification pending screen instead
                setVerificationEmail(form.email);
                setAwaitingVerification(true);
            } else {
                const res = await login({ email: form.email, password: form.password });
                loginUser(res.data.token, { _id: res.data.userId });
                navigate('/dashboard');
            }
        } catch (err) {
            const code = err.response?.data?.code;
            const message = err.response?.data?.message || 'Something went wrong';

            if (code === 'EMAIL_NOT_VERIFIED') {
                setError(message);
                setShowResendOnLogin(true);
                setLoginEmail(form.email);
            } else {
                setError(message);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async (emailToResend) => {
        if (resendCooldown > 0 || resendLoading) return;
        setResendLoading(true);
        setResendSuccess(false);
        try {
            await resendVerification({ email: emailToResend });
            setResendSuccess(true);
            setResendCooldown(60); // 60 second cooldown
        } catch (err) {
            // Generic message — don't reveal if email exists
            setResendSuccess(true);
            setResendCooldown(60);
        } finally {
            setResendLoading(false);
        }
    };

    // ========== POST-SIGNUP VERIFICATION SCREEN ==========
    if (awaitingVerification) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4 relative">
                <HexBackground />
                <div className="w-full max-w-md relative z-10 text-center">
                    <div className="text-6xl mb-6">📬</div>
                    <h1 className="text-3xl font-black text-white mb-2">Check your email</h1>
                    <p className="text-gray-400 font-bold text-sm mb-2">
                        We sent a verification link to
                    </p>
                    <p className="text-emerald-400 font-black text-base mb-6">
                        {verificationEmail}
                    </p>
                    <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 mb-6 text-left space-y-3">
                        <p className="text-gray-300 text-sm font-bold">What to do next:</p>
                        <p className="text-gray-400 text-sm">1. Open the email from TerritoryCapture</p>
                        <p className="text-gray-400 text-sm">2. Click the <span className="text-emerald-400 font-bold">Verify Email</span> button</p>
                        <p className="text-gray-400 text-sm">3. Come back here and log in</p>
                        <p className="text-gray-500 text-xs mt-2">Link expires in 24 hours. Check your spam folder if you don't see it.</p>
                    </div>

                    {/* Resend button */}
                    {resendSuccess ? (
                        <p className="text-emerald-400 text-sm font-bold mb-4">
                            ✓ New verification email sent
                        </p>
                    ) : (
                        <button
                            type="button"
                            onClick={() => handleResend(verificationEmail)}
                            disabled={resendLoading || resendCooldown > 0}
                            className="text-gray-400 hover:text-white text-sm font-bold transition-colors disabled:text-gray-600 mb-4 block mx-auto"
                        >
                            {resendLoading
                                ? 'Sending...'
                                : resendCooldown > 0
                                ? `Resend in ${resendCooldown}s`
                                : "Didn't receive it? Resend"}
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={() => {
                            setAwaitingVerification(false);
                            setIsSignup(false);
                            setForm({ username: '', email: '', password: '' });
                        }}
                        className="text-emerald-400 hover:text-emerald-300 text-sm font-bold transition-colors"
                    >
                        ← Back to login
                    </button>
                </div>
            </div>
        );
    }

    // ========== MAIN LOGIN/SIGNUP FORM ==========
    return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4 relative">
            <HexBackground />
            <div className="w-full max-w-md relative z-10">

                {/* Logo */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-black text-white tracking-tight">
                        Territory<span className="text-emerald-400">Capture</span>
                    </h1>
                    <p className="font-bold text-gray-400 mt-2 text-sm">
                        Claim the world one hexagon at a time
                    </p>
                </div>

                {/* Email verified success banner */}
                {verifiedParam === 'true' && (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 mb-4 text-center">
                        <p className="text-emerald-400 font-bold text-sm">
                            ✓ Email verified! You can now log in.
                        </p>
                    </div>
                )}
                {verifiedParam === 'invalid' && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4 text-center">
                        <p className="text-red-400 font-bold text-sm">
                            Verification link is invalid or expired. Sign in and request a new one.
                        </p>
                    </div>
                )}

                {/* Card */}
                <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800">

                    {/* Toggle */}
                    <div className="flex bg-gray-800 rounded-xl p-1 mb-6">
                        <button
                            type="button"
                            onClick={() => { setIsSignup(false); setError(''); setShowResendOnLogin(false); }}
                            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                                !isSignup ? 'bg-emerald-500 text-white' : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            Login
                        </button>
                        <button
                            type="button"
                            onClick={() => { setIsSignup(true); setError(''); setShowResendOnLogin(false); }}
                            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                                isSignup ? 'bg-emerald-500 text-white' : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            Sign Up
                        </button>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {isSignup && (
                            <div>
                                <label className="text-gray-400 text-sm block mb-1">Username</label>
                                <input
                                    name="username"
                                    value={form.username}
                                    onChange={handleChange}
                                    placeholder="coolrunner99"
                                    required
                                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition-colors"
                                />
                            </div>
                        )}

                        <div>
                            <label className="text-gray-400 text-sm block mb-1">Email</label>
                            <input
                                name="email"
                                type="email"
                                value={form.email}
                                onChange={handleChange}
                                placeholder="you@example.com"
                                required
                                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition-colors"
                            />
                        </div>

                        <div>
                            <label className="text-gray-400 text-sm block mb-1">Password</label>
                            <input
                                name="password"
                                type="password"
                                value={form.password}
                                onChange={handleChange}
                                placeholder="••••••••"
                                required
                                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition-colors"
                            />
                        </div>

                        {/* Error message */}
                        {error && (
                            <div className="space-y-2">
                                <p className="text-red-400 text-sm text-center">{error}</p>

                                {/* Resend button — only shown on EMAIL_NOT_VERIFIED */}
                                {showResendOnLogin && (
                                    <div className="text-center">
                                        {resendSuccess ? (
                                            <p className="text-emerald-400 text-xs font-bold">
                                                ✓ Verification email sent
                                            </p>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => handleResend(loginEmail)}
                                                disabled={resendLoading || resendCooldown > 0}
                                                className="text-emerald-400 hover:text-emerald-300 text-xs font-bold transition-colors disabled:text-gray-600"
                                            >
                                                {resendLoading
                                                    ? 'Sending...'
                                                    : resendCooldown > 0
                                                    ? `Resend in ${resendCooldown}s`
                                                    : 'Resend verification email'}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {!isSignup && (
                            <div className="text-right">
                                <Link
                                    to="/reset-password"
                                    className="font-bold text-gray-500 hover:text-emerald-400 text-xs transition-colors"
                                >
                                    Forgot password?
                                </Link>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-800 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors mt-2"
                        >
                            {loading
                                ? 'Loading...'
                                : isSignup
                                ? 'Create Account'
                                : 'Login'}
                        </button>
                    </form>
                </div>

                <p className="font-bold text-center text-gray-400 text-xs mt-6">
                    Territory Capture — built by Travis McGray
                </p>
            </div>
        </div>
    );
}
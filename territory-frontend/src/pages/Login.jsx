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

    const [awaitingVerification, setAwaitingVerification] = useState(false);
    const [verificationEmail, setVerificationEmail] = useState('');

    const [resendLoading, setResendLoading] = useState(false);
    const [resendCooldown, setResendCooldown] = useState(0);
    const [resendSuccess, setResendSuccess] = useState(false);

    const [showResendOnLogin, setShowResendOnLogin] = useState(false);
    const [loginEmail, setLoginEmail] = useState('');

    const [form, setForm] = useState({ username: '', email: '', password: '' });

    const verifiedParam = searchParams.get('verified');

    useEffect(() => {
        if (resendCooldown <= 0) return;
        const timer = setTimeout(() => setResendCooldown(prev => prev - 1), 1000);
        return () => clearTimeout(timer);
    }, [resendCooldown]);

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
                await signup({ username: form.username, email: form.email, password: form.password });
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
            setResendCooldown(60);
        } catch {
            setResendSuccess(true);
            setResendCooldown(60);
        } finally {
            setResendLoading(false);
        }
    };

    // ========== POST-SIGNUP VERIFICATION SCREEN ==========
    if (awaitingVerification) {
        return (
            <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4 relative">
                <HexBackground />
                <div className="w-full max-w-md relative z-10 text-center">
                    <div className="text-6xl mb-6">📬</div>
                    <h1 className="text-3xl font-black text-slate-900 mb-2">Check your email</h1>
                    <p className="text-slate-500 font-bold text-sm mb-2">
                        We sent a verification link to
                    </p>
                    <p className="text-emerald-600 font-black text-base mb-6">{verificationEmail}</p>

                    <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm mb-6 text-left space-y-3">
                        <p className="text-slate-700 text-sm font-bold">What to do next:</p>
                        <p className="text-slate-500 text-sm">1. Open the email from HexCapture</p>
                        <p className="text-slate-500 text-sm">2. Click the <span className="text-emerald-600 font-bold">Verify Email</span> button</p>
                        <p className="text-slate-500 text-sm">3. Come back here and log in</p>
                        <p className="text-slate-400 text-xs mt-2">Link expires in 24 hours. Check your spam folder if you don't see it.</p>
                    </div>

                    {resendSuccess ? (
                        <p className="text-emerald-600 text-sm font-bold mb-4">✓ New verification email sent</p>
                    ) : (
                        <button type="button" onClick={() => handleResend(verificationEmail)}
                            disabled={resendLoading || resendCooldown > 0}
                            className="text-slate-400 hover:text-slate-700 text-sm font-bold transition-colors disabled:text-slate-300 mb-4 block mx-auto">
                            {resendLoading ? 'Sending...' : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Didn't receive it? Resend"}
                        </button>
                    )}

                    <button type="button"
                        onClick={() => { setAwaitingVerification(false); setIsSignup(false); setForm({ username: '', email: '', password: '' }); }}
                        className="text-emerald-600 hover:text-emerald-500 text-sm font-bold transition-colors">
                        ← Back to login
                    </button>
                </div>
            </div>
        );
    }

    // ========== MAIN LOGIN/SIGNUP FORM ==========
    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4 relative">
            <HexBackground />
            <div className="w-full max-w-md relative z-10">

                {/* Logo */}
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight">
                        Hex<span className="text-emerald-500">Capture</span>
                    </h1>
                    <p className="font-bold text-slate-700 mt-2 text-sm">
                        Claim the world one hexagon at a time
                    </p>
                </div>

                {/* Verified banner */}
                {verifiedParam === 'true' && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4 text-center">
                        <p className="text-emerald-600 font-bold text-sm">✓ Email verified! You can now log in.</p>
                    </div>
                )}
                {verifiedParam === 'invalid' && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-center">
                        <p className="text-red-500 font-bold text-sm">
                            Verification link is invalid or expired. Sign in and request a new one.
                        </p>
                    </div>
                )}

                {/* Card */}
                <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-md">

                    {/* Toggle */}
                    <div className="flex bg-slate-100 rounded-xl p-1 mb-6">
                        <button type="button"
                            onClick={() => { setIsSignup(false); setError(''); setShowResendOnLogin(false); }}
                            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                                !isSignup ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-700'
                            }`}>
                            Login
                        </button>
                        <button type="button"
                            onClick={() => { setIsSignup(true); setError(''); setShowResendOnLogin(false); }}
                            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                                isSignup ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-700'
                            }`}>
                            Sign Up
                        </button>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {isSignup && (
                            <div>
                                <label className="text-slate-600 text-sm font-bold block mb-1">Username</label>
                                <input name="username" value={form.username} onChange={handleChange}
                                    placeholder="coolrunner99" required
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-colors"/>
                            </div>
                        )}

                        <div>
                            <label className="text-slate-600 text-sm font-bold block mb-1">Email</label>
                            <input name="email" type="email" value={form.email} onChange={handleChange}
                                placeholder="you@example.com" required
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-colors"/>
                        </div>

                        <div>
                            <label className="text-slate-600 text-sm font-bold block mb-1">Password</label>
                            <input name="password" type="password" value={form.password} onChange={handleChange}
                                placeholder="••••••••" required
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-colors"/>
                        </div>

                        {error && (
                            <div className="space-y-2">
                                <p className="text-red-500 text-sm text-center">{error}</p>
                                {showResendOnLogin && (
                                    <div className="text-center">
                                        {resendSuccess ? (
                                            <p className="text-emerald-600 text-xs font-bold">✓ Verification email sent</p>
                                        ) : (
                                            <button type="button" onClick={() => handleResend(loginEmail)}
                                                disabled={resendLoading || resendCooldown > 0}
                                                className="text-emerald-600 hover:text-emerald-500 text-xs font-bold transition-colors disabled:text-slate-300">
                                                {resendLoading ? 'Sending...' : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend verification email'}
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {!isSignup && (
                            <div className="text-right">
                                <Link to="/reset-password"
                                    className="font-bold text-slate-400 hover:text-emerald-600 text-xs transition-colors">
                                    Forgot password?
                                </Link>
                            </div>
                        )}

                        <button type="submit" disabled={loading}
                            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-300 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors mt-2">
                            {loading ? 'Loading...' : isSignup ? 'Create Account' : 'Login'}
                        </button>
                    </form>
                </div>

                <p className="font-bold text-center text-slate-600 text-xs mt-6">
                    HexCapture — built by Travis McGray
                </p>
            </div>
        </div>
    );
}

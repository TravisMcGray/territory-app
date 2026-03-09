// ========== RESET PASSWORD PAGE ==========
// Handles the password reset flow.
// Reads ?token= from URL and submits to POST /api/user/reset-password.
// Also includes the forgot password form for requesting a reset email.

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import api from '../services/api';

export default function ResetPassword() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();

    // ========== FORGOT PASSWORD STATE ==========
    const [email, setEmail] = useState('');
    const [forgotLoading, setForgotLoading] = useState(false);
    const [forgotSuccess, setForgotSuccess] = useState(false);
    const [forgotError, setForgotError] = useState('');

    // ========== RESET PASSWORD STATE ==========
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [resetLoading, setResetLoading] = useState(false);
    const [resetSuccess, setResetSuccess] = useState(false);
    const [resetError, setResetError] = useState('');

    // ========== FORGOT PASSWORD HANDLER ==========
    const handleForgotSubmit = async (e) => {
        e.preventDefault();
        setForgotError('');
        setForgotLoading(true);

        try {
            await api.post('/api/user/forgot-password', { email });
            setForgotSuccess(true);
        } catch (err) {
            const code = err.response?.data?.code;
            const message = err.response?.data?.message;
            setForgotError(message || 'Something went wrong. Please try again.');
        } finally {
            setForgotLoading(false);
        }
    };

    // ========== RESET PASSWORD HANDLER ==========
    const handleResetSubmit = async (e) => {
        e.preventDefault();
        setResetError('');

        if (password !== confirmPassword) {
            setResetError('Passwords do not match.');
            return;
        }

        if (password.length < 8) {
            setResetError('Password must be at least 8 characters.');
            return;
        }

        setResetLoading(true);

        try {
            await api.post('/api/user/reset-password', { token, password });
            setResetSuccess(true);
            setTimeout(() => navigate('/login'), 3000);
        } catch (err) {
            const code = err.response?.data?.code;
            const message = err.response?.data?.message;

            if (code === 'VALIDATION_ERROR') {
                setResetError(message || 'Password does not meet requirements.');
            } else if (err.response?.status === 400) {
                setResetError('This reset link is invalid or has expired. Please request a new one.');
            } else {
                setResetError(message || 'Something went wrong. Please try again.');
            }
        } finally {
            setResetLoading(false);
        }
    };

    // ========== RENDER — RESET FORM (token present) ==========
    if (token) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
                <div className="w-full max-w-md">

                    {/* Header */}
                    <div className="mb-8 text-center">
                        <h1 className="text-3xl font-bold text-white font-['Oxanium'] tracking-wide mb-2">
                            New Password
                        </h1>
                        <p className="text-gray-400 text-sm">
                            Choose a strong password for your account.
                        </p>
                    </div>

                    {/* Success state */}
                    {resetSuccess ? (
                        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-6 text-center">
                            <div className="text-emerald-400 text-4xl mb-3">✓</div>
                            <p className="text-emerald-400 font-semibold mb-1">Password updated!</p>
                            <p className="text-gray-400 text-sm">Redirecting you to login...</p>
                        </div>
                    ) : (
                        <form onSubmit={handleResetSubmit} className="space-y-4">

                            {/* Error */}
                            {resetError && (
                                <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                                    <p className="text-red-400 text-sm">{resetError}</p>
                                </div>
                            )}

                            {/* New password */}
                            <div>
                                <label className="block text-gray-400 text-sm mb-1.5">
                                    New Password
                                </label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    placeholder="Min. 8 characters"
                                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition-colors"
                                />
                            </div>

                            {/* Confirm password */}
                            <div>
                                <label className="block text-gray-400 text-sm mb-1.5">
                                    Confirm Password
                                </label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    placeholder="Repeat your new password"
                                    className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition-colors"
                                />
                            </div>

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={resetLoading}
                                className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-900 disabled:text-emerald-600 text-gray-950 font-bold py-3 rounded-xl transition-colors font-['Oxanium'] tracking-wide mt-2"
                            >
                                {resetLoading ? 'Updating...' : 'Update Password'}
                            </button>

                            {/* Back to login */}
                            <p className="text-center text-gray-500 text-sm pt-2">
                                <Link to="/login" className="text-emerald-400 hover:text-emerald-300 transition-colors">
                                    Back to login
                                </Link>
                            </p>
                        </form>
                    )}
                </div>
            </div>
        );
    }

    // ========== RENDER — FORGOT PASSWORD FORM (no token) ==========
    return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
            <div className="w-full max-w-md">

                {/* Header */}
                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-bold text-white font-['Oxanium'] tracking-wide mb-2">
                        Forgot Password
                    </h1>
                    <p className="text-gray-400 text-sm">
                        Enter your email and we'll send you a reset link.
                    </p>
                </div>

                {/* Success state */}
                {forgotSuccess ? (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-6 text-center">
                        <div className="text-emerald-400 text-4xl mb-3">✓</div>
                        <p className="text-emerald-400 font-semibold mb-1">Check your inbox</p>
                        <p className="text-gray-400 text-sm">
                            If an account exists with that email, a reset link is on its way.
                        </p>
                        <Link
                            to="/login"
                            className="inline-block mt-4 text-emerald-400 hover:text-emerald-300 text-sm transition-colors"
                        >
                            Back to login
                        </Link>
                    </div>
                ) : (
                    <form onSubmit={handleForgotSubmit} className="space-y-4">

                        {/* Error */}
                        {forgotError && (
                            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                                <p className="text-red-400 text-sm">{forgotError}</p>
                            </div>
                        )}

                        {/* Email */}
                        <div>
                            <label className="block text-gray-400 text-sm mb-1.5">
                                Email Address
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                placeholder="you@example.com"
                                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 transition-colors"
                            />
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={forgotLoading}
                            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-900 disabled:text-emerald-600 text-gray-950 font-bold py-3 rounded-xl transition-colors font-['Oxanium'] tracking-wide mt-2"
                        >
                            {forgotLoading ? 'Sending...' : 'Send Reset Link'}
                        </button>

                        {/* Back to login */}
                        <p className="text-center text-gray-500 text-sm pt-2">
                            Remembered it?{' '}
                            <Link to="/login" className="text-emerald-400 hover:text-emerald-300 transition-colors">
                                Back to login
                            </Link>
                        </p>
                    </form>
                )}
            </div>
        </div>
    );
}
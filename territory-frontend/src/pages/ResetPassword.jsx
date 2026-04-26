import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import api from '../services/api';
import HexBackground from '../components/HexBackground';

export default function ResetPassword() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();

    const [email, setEmail] = useState('');
    const [forgotLoading, setForgotLoading] = useState(false);
    const [forgotSuccess, setForgotSuccess] = useState(false);
    const [forgotError, setForgotError] = useState('');

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [resetLoading, setResetLoading] = useState(false);
    const [resetSuccess, setResetSuccess] = useState(false);
    const [resetError, setResetError] = useState('');

    const handleForgotSubmit = async (e) => {
        e.preventDefault();
        setForgotError('');
        setForgotLoading(true);
        try {
            await api.post('/api/user/forgot-password', { email });
            setForgotSuccess(true);
        } catch (err) {
            setForgotError(err.response?.data?.message || 'Something went wrong. Please try again.');
        } finally {
            setForgotLoading(false);
        }
    };

    const handleResetSubmit = async (e) => {
        e.preventDefault();
        setResetError('');
        if (password !== confirmPassword) { setResetError('Passwords do not match.'); return; }
        if (password.length < 8) { setResetError('Password must be at least 8 characters.'); return; }
        setResetLoading(true);
        try {
            await api.post('/api/user/reset-password', { token, password });
            setResetSuccess(true);
            setTimeout(() => navigate('/login'), 3000);
        } catch (err) {
            const status = err.response?.status;
            const message = err.response?.data?.message;
            if (status === 400) setResetError('This reset link is invalid or has expired. Please request a new one.');
            else setResetError(message || 'Something went wrong. Please try again.');
        } finally {
            setResetLoading(false);
        }
    };

    const inputClass = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-colors";

    // ========== RESET FORM (token present — came from email link) ==========
    if (token) {
        return (
            <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4 relative">
                <HexBackground />
                <div className="w-full max-w-md relative z-10">

                    <div className="text-center mb-8">
                        <h1 className="text-4xl font-black text-slate-900 tracking-tight">
                            Hex<span className="text-emerald-500">Capture</span>
                        </h1>
                        <p className="font-bold text-slate-700 mt-2 text-sm">Choose a new password</p>
                    </div>

                    {resetSuccess ? (
                        <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-md text-center">
                            <div className="text-emerald-500 text-5xl mb-4">✓</div>
                            <p className="text-slate-900 font-black text-lg mb-1">Password updated!</p>
                            <p className="text-slate-500 text-sm">Redirecting you to login...</p>
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-md">
                            {resetError && (
                                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
                                    <p className="text-red-500 text-sm">{resetError}</p>
                                </div>
                            )}
                            <form onSubmit={handleResetSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-slate-600 text-sm font-bold mb-1.5">New Password</label>
                                    <input type="password" value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        required placeholder="Min. 8 characters" className={inputClass}/>
                                </div>
                                <div>
                                    <label className="block text-slate-600 text-sm font-bold mb-1.5">Confirm Password</label>
                                    <input type="password" value={confirmPassword}
                                        onChange={e => setConfirmPassword(e.target.value)}
                                        required placeholder="Repeat your new password" className={inputClass}/>
                                </div>
                                <button type="submit" disabled={resetLoading}
                                    className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-300 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors mt-2">
                                    {resetLoading ? 'Updating...' : 'Update Password'}
                                </button>
                                <p className="text-center text-slate-400 text-sm pt-1">
                                    <Link to="/login" className="text-emerald-600 hover:text-emerald-500 font-bold transition-colors">
                                        Back to login
                                    </Link>
                                </p>
                            </form>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ========== FORGOT PASSWORD FORM (no token — entered from login page) ==========
    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4 relative">
            <HexBackground />
            <div className="w-full max-w-md relative z-10">

                <div className="text-center mb-8">
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight">
                        Hex<span className="text-emerald-500">Capture</span>
                    </h1>
                    <p className="font-bold text-slate-700 mt-2 text-sm">
                        Enter your email and we'll send you a reset link
                    </p>
                </div>

                {forgotSuccess ? (
                    <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-md text-center">
                        <div className="text-emerald-500 text-5xl mb-4">✓</div>
                        <p className="text-slate-900 font-black text-lg mb-1">Check your inbox</p>
                        <p className="text-slate-500 text-sm mb-6">
                            If an account exists with that email, a reset link is on its way.
                        </p>
                        <Link to="/login"
                            className="inline-block text-emerald-600 hover:text-emerald-500 font-bold text-sm transition-colors">
                            ← Back to login
                        </Link>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-md">
                        {forgotError && (
                            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
                                <p className="text-red-500 text-sm">{forgotError}</p>
                            </div>
                        )}
                        <form onSubmit={handleForgotSubmit} className="space-y-4">
                            <div>
                                <label className="block text-slate-600 text-sm font-bold mb-1.5">Email Address</label>
                                <input type="email" value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    required placeholder="you@example.com" className={inputClass}/>
                            </div>
                            <button type="submit" disabled={forgotLoading}
                                className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-300 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors mt-2">
                                {forgotLoading ? 'Sending...' : 'Send Reset Link'}
                            </button>
                            <p className="text-center text-slate-500 text-sm pt-1">
                                Remembered it?{' '}
                                <Link to="/login" className="text-emerald-600 hover:text-emerald-500 font-bold transition-colors">
                                    Back to login
                                </Link>
                            </p>
                        </form>
                    </div>
                )}

                <p className="font-bold text-center text-slate-600 text-xs mt-6">
                    HexCapture — built by Travis McGray
                </p>
            </div>
        </div>
    );
}

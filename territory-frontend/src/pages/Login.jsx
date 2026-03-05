// ========== LOGIN PAGE ==========
// Handles both login and signup in one page with a toggle.
// Keeps it simple - one page for auth instead of two separate routes.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, signup } from '../services/api';
import { useAuth } from '../context/AuthContext';
import HexBackground from '../components/HexBackground';

export default function Login() {
    const navigate = useNavigate();
    const { loginUser } = useAuth();

    const [isSignup, setIsSignup] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [form, setForm] = useState({
        username: '',
        email: '',
        password: '',
    });

    // ========== HANDLERS ==========
    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
        setError('');
    };

const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
        const payload = isSignup
            ? { username: form.username, email: form.email, password: form.password }
            : { email: form.email, password: form.password };

        const res = isSignup ? await signup(payload) : await login(payload);
        loginUser(res.data.token, { _id: res.data.userId, username: res.data.username });
        navigate('/dashboard');
    } catch (err) {
        const message = typeof err.response?.data === 'string'
            ? err.response.data
            : err.response?.data?.message || 'Something went wrong';
        setError(message);
    } finally {
        setLoading(false);
    }
};

    // ========== RENDER ==========
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

                {/* Card */}
                <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800">
                    {/* Toggle */}
                    <div className="flex bg-gray-800 rounded-xl p-1 mb-6">
                        <button
                            type="button"
                            onClick={() => setIsSignup(false)}
                            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                                !isSignup
                                    ? 'bg-emerald-500 text-white'
                                    : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            Login
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsSignup(true)}
                            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                                isSignup
                                    ? 'bg-emerald-500 text-white'
                                    : 'text-gray-400 hover:text-white'
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

                        {error && (
                            <p className="text-red-400 text-sm text-center">{error}</p>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-800 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors mt-2"
                        >
                            {loading ? 'Loading...' : isSignup ? 'Create Account' : 'Login'}
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
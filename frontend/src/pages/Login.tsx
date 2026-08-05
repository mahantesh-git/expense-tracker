import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import api from '../utils/api';

const Login = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data } = await api.post('/auth/login', { username, password });
      login(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'var(--bg-base)' }}>

      {/* ── Left Brand Panel (desktop only) ── */}
      <div
        className="hidden lg:flex flex-col justify-between w-[44%] p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #1a0810 0%, #0c0809 50%, #140d0e 100%)' }}
      >
        {/* Animated glow orbs */}
        <div
          className="absolute top-1/4 -left-16 w-64 h-64 rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)',
            opacity: 0.12,
            animation: 'loginGlow 4s ease-in-out infinite',
          }}
        />
        <div
          className="absolute bottom-1/3 right-0 w-48 h-48 rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, var(--accent) 0%, transparent 70%)',
            opacity: 0.08,
            animation: 'loginGlow 6s ease-in-out infinite reverse',
          }}
        />

        {/* Logo */}
        <div className="flex items-center gap-3 relative z-10">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg"
            style={{
              background: 'linear-gradient(135deg, var(--accent) 0%, #a02840 100%)',
              boxShadow: '0 0 24px var(--accent-dim)',
            }}
          >
            ₹
          </div>
          <span className="font-semibold text-base tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Expense Tracker
          </span>
        </div>

        {/* Center headline */}
        <div className="relative z-10 space-y-5">
          <div
            className="inline-block px-3 py-1 rounded-full text-xs font-semibold tracking-widest uppercase"
            style={{ background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid rgba(224,61,82,0.3)' }}
          >
            Private Access
          </div>
          <h1 className="text-4xl font-bold leading-tight" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Track expenses.<br />
            <span style={{ color: 'var(--accent)' }}>Stay balanced.</span>
          </h1>
          <p className="text-sm leading-relaxed max-w-xs" style={{ color: 'var(--text-secondary)' }}>
            A unified workspace to manage shared expenses, approve requests, and settle balances across your team.
          </p>
        </div>

        {/* Bottom tagline */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="h-px flex-1" style={{ background: 'var(--border)' }} />
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Secure · Private · Fast</p>
          <div className="h-px flex-1" style={{ background: 'var(--border)' }} />
        </div>
      </div>

      {/* ── Right Form Panel ── */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12">

        {/* Mobile logo */}
        <div className="flex items-center gap-3 mb-10 lg:hidden">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-base"
            style={{ background: 'linear-gradient(135deg, var(--accent) 0%, #a02840 100%)' }}
          >
            ₹
          </div>
          <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Expense Tracker</span>
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              Welcome back
            </h2>
            <p className="text-sm mt-1.5" style={{ color: 'var(--text-secondary)' }}>
              Sign in to your account to continue
            </p>
          </div>

          {error && (
            <div
              className="mb-5 p-3 rounded-lg text-sm flex items-start gap-2.5"
              style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', color: 'var(--color-danger)' }}
            >
              <span className="mt-0.5 shrink-0">⚠</span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Username"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              required
              autoComplete="username"
            />

            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                className="absolute right-3 bottom-2 text-xs transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>

            <Button
              type="submit"
              className="w-full mt-2"
              size="lg"
              loading={loading}
              disabled={loading}
            >
              Sign In
            </Button>
          </form>

          <p className="mt-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
            Access restricted to authorized users only.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;

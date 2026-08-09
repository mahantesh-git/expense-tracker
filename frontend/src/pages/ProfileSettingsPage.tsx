import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import {
  Settings, CheckCircle2, AlertCircle, Loader2,
  Trash2, User, Lock, CreditCard, Eye, EyeOff,
} from 'lucide-react';

const UPI_REGEX = /^[a-zA-Z0-9._-]+@[a-zA-Z]{3,}$/;

// ─── Reusable Section Card ────────────────────────────────────
const SectionCard = ({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) => (
  <div className="rounded-2xl p-5 space-y-4"
    style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
    <div className="flex items-center gap-3 pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: 'var(--accent-dim)' }}>
        <Icon size={15} style={{ color: 'var(--accent)' }} />
      </div>
      <div>
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>
      </div>
    </div>
    {children}
  </div>
);

// ─── Feedback line ────────────────────────────────────────────
const Feedback = ({ error, success }: { error?: string; success?: string }) => {
  if (error) return (
    <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: '#f87171' }}>
      <AlertCircle size={11} /> {error}
    </p>
  );
  if (success) return (
    <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: '#22c55e' }}>
      <CheckCircle2 size={11} /> {success}
    </p>
  );
  return null;
};

const ProfileSettingsPage = () => {
  const { user } = useAuth();

  // ── UPI ──────────────────────────────────────────
  const [upiId, setUpiId] = useState('');
  const [savedUpiId, setSavedUpiId] = useState<string | null>(null);
  const [upiSaving, setUpiSaving] = useState(false);
  const [upiError, setUpiError] = useState('');
  const [upiSuccess, setUpiSuccess] = useState('');

  // ── Username ─────────────────────────────────────
  const [username, setUsername] = useState('');
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [usernameSuccess, setUsernameSuccess] = useState('');

  // ── Password ─────────────────────────────────────
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/auth/me')
      .then(res => {
        setSavedUpiId(res.data.upiId || null);
        setUpiId(res.data.upiId || '');
        setUsername(res.data.username || '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const flash = (
    set: React.Dispatch<React.SetStateAction<string>>,
    msg: string,
    duration = 3000
  ) => { set(msg); setTimeout(() => set(''), duration); };

  // ── Save UPI ─────────────────────────────────────
  const saveUpi = async () => {
    if (upiId && !UPI_REGEX.test(upiId.trim())) {
      setUpiError('Invalid UPI ID format. Example: name@okaxis');
      return;
    }
    setUpiSaving(true); setUpiError('');
    try {
      const res = await api.patch('/auth/profile', { upiId: upiId.trim() || null });
      setSavedUpiId(res.data.upiId || null);
      flash(setUpiSuccess, 'UPI ID saved successfully.');
    } catch (e: any) {
      setUpiError(e?.response?.data?.message || 'Failed to save.');
    } finally { setUpiSaving(false); }
  };

  const clearUpi = async () => {
    setUpiSaving(true); setUpiError('');
    try {
      await api.patch('/auth/profile', { upiId: null });
      setSavedUpiId(null); setUpiId('');
      flash(setUpiSuccess, 'UPI ID removed.');
    } catch (e: any) {
      setUpiError(e?.response?.data?.message || 'Failed to remove.');
    } finally { setUpiSaving(false); }
  };

  // ── Save Username ─────────────────────────────────
  const saveUsername = async () => {
    const trimmed = username.trim();
    if (trimmed.length < 3) { setUsernameError('Username must be at least 3 characters.'); return; }
    if (!/^[a-zA-Z0-9._-]+$/.test(trimmed)) {
      setUsernameError('Only letters, numbers, dots, underscores and hyphens allowed.');
      return;
    }
    setUsernameSaving(true); setUsernameError('');
    try {
      await api.patch('/auth/profile', { username: trimmed });
      flash(setUsernameSuccess, 'Username updated. Please re-login to see changes.');
    } catch (e: any) {
      setUsernameError(e?.response?.data?.message || 'Failed to update username.');
    } finally { setUsernameSaving(false); }
  };

  // ── Change Password ───────────────────────────────
  const changePassword = async () => {
    if (!currentPwd) { setPwdError('Enter your current password.'); return; }
    if (newPwd.length < 6) { setPwdError('New password must be at least 6 characters.'); return; }
    if (newPwd !== confirmPwd) { setPwdError('New passwords do not match.'); return; }
    if (newPwd === currentPwd) { setPwdError('New password must be different from current.'); return; }
    setPwdSaving(true); setPwdError('');
    try {
      await api.post('/auth/change-password', { currentPassword: currentPwd, newPassword: newPwd });
      setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
      flash(setPwdSuccess, 'Password changed successfully.');
    } catch (e: any) {
      setPwdError(e?.response?.data?.message || 'Failed to change password.');
    } finally { setPwdSaving(false); }
  };

  const inputStyle = (hasError?: boolean) => ({
    background: 'var(--bg-raised)',
    border: `1px solid ${hasError ? '#f87171' : 'var(--border)'}`,
    color: 'var(--text-primary)',
  });

  const btnStyle = (disabled?: boolean) => ({
    background: disabled ? 'var(--bg-hover)' : 'var(--accent)',
    color: disabled ? 'var(--text-muted)' : '#fff',
    opacity: disabled ? 0.6 : 1,
  });

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 size={22} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-5 w-full page-enter">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'var(--accent-dim)' }}>
          <Settings size={20} style={{ color: 'var(--accent)' }} />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
            Profile Settings
          </h1>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>@{user?.username}</p>
        </div>
      </div>

      {/* ── Username ────────────────────────────── */}
      <SectionCard icon={User} title="Username" subtitle="Change your display name and login username">
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
              New username
            </label>
            <input
              type="text"
              value={username}
              onChange={e => { setUsername(e.target.value); setUsernameError(''); setUsernameSuccess(''); }}
              placeholder="e.g. john_doe"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
              style={inputStyle(!!usernameError)}
            />
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Letters, numbers, dots, underscores and hyphens only
            </p>
            <Feedback error={usernameError} success={usernameSuccess} />
          </div>
          <button
            onClick={saveUsername}
            disabled={usernameSaving || !username.trim() || username.trim() === user?.username}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all"
            style={btnStyle(usernameSaving || !username.trim() || username.trim() === user?.username)}
          >
            {usernameSaving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            {usernameSaving ? 'Saving…' : 'Update Username'}
          </button>
        </div>
      </SectionCard>

      {/* ── Password ────────────────────────────── */}
      <SectionCard icon={Lock} title="Password" subtitle="Change your account password">
        <div className="space-y-3">
          {/* Current password */}
          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
              Current password
            </label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPwd}
                onChange={e => { setCurrentPwd(e.target.value); setPwdError(''); setPwdSuccess(''); }}
                placeholder="Enter current password"
                className="w-full px-4 py-3 pr-10 rounded-xl text-sm outline-none transition-all"
                style={inputStyle(!!pwdError && !currentPwd)}
              />
              <button
                onClick={() => setShowCurrent(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-muted)' }}
              >
                {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* New password */}
          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
              New password
            </label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPwd}
                onChange={e => { setNewPwd(e.target.value); setPwdError(''); setPwdSuccess(''); }}
                placeholder="Min 6 characters"
                className="w-full px-4 py-3 pr-10 rounded-xl text-sm outline-none transition-all"
                style={inputStyle(!!pwdError && newPwd.length > 0 && newPwd.length < 6)}
              />
              <button
                onClick={() => setShowNew(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-muted)' }}
              >
                {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {/* Password strength hint */}
            {newPwd.length > 0 && (
              <div className="flex gap-1 mt-1.5">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="flex-1 h-1 rounded-full transition-all"
                    style={{
                      background: newPwd.length >= i * 3
                        ? i <= 1 ? '#f87171' : i === 2 ? '#f59e0b' : i === 3 ? '#84cc16' : '#22c55e'
                        : 'var(--border)',
                    }} />
                ))}
              </div>
            )}
          </div>

          {/* Confirm new password */}
          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
              Confirm new password
            </label>
            <input
              type="password"
              value={confirmPwd}
              onChange={e => { setConfirmPwd(e.target.value); setPwdError(''); setPwdSuccess(''); }}
              placeholder="Re-enter new password"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
              style={inputStyle(!!confirmPwd && confirmPwd !== newPwd)}
            />
            {confirmPwd && confirmPwd !== newPwd && (
              <p className="text-xs mt-1" style={{ color: '#f87171' }}>Passwords don't match</p>
            )}
          </div>

          <Feedback error={pwdError} success={pwdSuccess} />

          <button
            onClick={changePassword}
            disabled={pwdSaving || !currentPwd || !newPwd || newPwd !== confirmPwd}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all"
            style={btnStyle(pwdSaving || !currentPwd || !newPwd || newPwd !== confirmPwd)}
          >
            {pwdSaving ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
            {pwdSaving ? 'Changing…' : 'Change Password'}
          </button>
        </div>
      </SectionCard>

      {/* ── UPI ID ──────────────────────────────── */}
      <SectionCard icon={CreditCard} title="UPI ID" subtitle="Used when others pay you via the Pay Now button">
        <div className="space-y-3">
          {savedUpiId && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm"
              style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
              <CheckCircle2 size={13} color="#22c55e" />
              <span className="font-mono font-medium flex-1" style={{ color: 'var(--text-primary)' }}>
                {savedUpiId}
              </span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Current</span>
            </div>
          )}

          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
              {savedUpiId ? 'Update UPI ID' : 'Add UPI ID'}
            </label>
            <input
              type="text"
              value={upiId}
              onChange={e => { setUpiId(e.target.value); setUpiError(''); setUpiSuccess(''); }}
              placeholder="e.g. yourname@okaxis"
              className="w-full px-4 py-3 rounded-xl text-sm font-mono outline-none transition-all"
              style={inputStyle(!!upiError)}
            />
            {upiId && !UPI_REGEX.test(upiId) && (
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Format: <span className="font-mono">name@bankname</span> (e.g. ram@okaxis, 9999999999@paytm)
              </p>
            )}
            <Feedback error={upiError} success={upiSuccess} />
          </div>

          <div className="flex gap-2">
            <button
              onClick={saveUpi}
              disabled={upiSaving || upiId === savedUpiId}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all"
              style={btnStyle(upiSaving || upiId === savedUpiId)}
            >
              {upiSaving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              {upiSaving ? 'Saving…' : 'Save UPI ID'}
            </button>
            {savedUpiId && (
              <button
                onClick={clearUpi}
                disabled={upiSaving}
                className="px-3 py-2.5 rounded-xl text-sm flex items-center gap-1.5 transition-colors"
                style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}
                title="Remove UPI ID"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
      </SectionCard>
    </div>
  );
};

export default ProfileSettingsPage;

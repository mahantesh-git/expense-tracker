import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { NotificationDropdown } from './ui/NotificationDropdown';
import { Button } from './ui/Button';
import {
  LayoutDashboard,
  FileText,
  Scale,
  Activity,
  Users,
  BookOpen,
  ArrowLeft,
  Download,
} from 'lucide-react';

// ─── Logo mark ────────────────────────────────────────────
const LogoMark = () => (
  <div className="flex items-center gap-2.5 shrink-0">
    <img
      src="/favicon.svg"
      alt="Expense Tracker Logo"
      className="w-8 h-8 rounded-lg shrink-0"
      style={{ boxShadow: '0 0 12px rgba(220,20,60,0.4)' }}
    />
    <span className="font-semibold text-sm tracking-tight hidden sm:block" style={{ color: 'var(--text-primary)' }}>
      Expense Tracker
    </span>
  </div>
);

// ─── Avatar ───────────────────────────────────────────────
const avatarColors = [
  'var(--avatar-0)', 'var(--avatar-1)', 'var(--avatar-2)', 'var(--avatar-3)',
  'var(--avatar-4)', 'var(--avatar-5)', 'var(--avatar-6)', 'var(--avatar-7)',
];
export const getAvatarColor = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return avatarColors[Math.abs(hash) % avatarColors.length];
};

// ─── Client bottom nav tabs ────────────────────────────────
const CLIENT_TABS = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/client' },
  { label: 'Requests', icon: FileText, path: '/client/requests' },
  { label: 'Balances', icon: Scale, path: '/client/balances' },
  { label: 'Activity', icon: Activity, path: '/client/paid' },
];

// ─── Admin top nav links ──────────────────────────────────
const ADMIN_LINKS = [
  { label: 'Console', path: '/admin' },
  { label: 'Clients', path: '/admin/clients' },
  { label: 'Ledger', path: '/admin/ledger' },
];

// ─── Sub-route back detection ─────────────────────────────
const SUB_ROUTES = [
  '/admin/user/', '/admin/ledger', '/admin/clients',
  '/client/paid', '/client/charged', '/client/balances', '/client/requests', '/client/ledger',
];

// ─── Shell ────────────────────────────────────────────────
interface ShellProps {
  children: React.ReactNode;
}

export const Shell = ({ children }: ShellProps) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // PWA install prompt state
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);

  useEffect(() => {
    // Check if already installed
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    if (isStandalone) return; // already installed, no button needed

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault(); // stop automatic mini-infobar
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', () => {
      setShowInstallBtn(false);
      setDeferredPrompt(null);
    });

    // On iOS/Safari the event never fires, so show button anyway
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    if (isIOS || isSafari) setShowInstallBtn(true);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      (deferredPrompt as any).prompt();
      const { outcome } = await (deferredPrompt as any).userChoice;
      if (outcome === 'accepted') {
        setShowInstallBtn(false);
        setDeferredPrompt(null);
      }
    } else {
      // iOS/Safari fallback instructions
      alert(
        'To install this app:\n\n' +
        '• Android / Chrome/Edge: Tap the menu (⋮) → "Add to Home screen"\n' +
        '• iOS Safari: Tap Share (□↑) → "Add to Home Screen"\n' +
        '• Desktop Chrome/Edge: Click the install icon (⊕) in the address bar'
      );
    }
  };

  if (!user) return <>{children}</>;

  const isAdmin = user.role === 'admin';
  const isClient = user.role === 'client';

  // Detect sub-routes (show back button instead of full nav)
  const isSubRoute = SUB_ROUTES.some(r => location.pathname.startsWith(r) && location.pathname !== '/admin');

  const handleBack = () => {
    if (location.pathname.startsWith('/admin/user/')) navigate('/admin/clients');
    else if (isAdmin) navigate('/admin');
    else navigate('/client');
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>

      {/* ── Top Shell Nav ── */}
      <nav className="shell-nav">
        {/* Left: Logo + back or admin links */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {isSubRoute ? (
            <button
              onClick={handleBack}
              className="flex items-center gap-1.5 text-xs font-medium transition-colors"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
            >
              <ArrowLeft size={15} />
              <span className="hidden sm:inline">Back</span>
            </button>
          ) : null}

          <LogoMark />

          {/* Admin nav links — desktop */}
          {isAdmin && !isSubRoute && (
            <div className="hidden md:flex items-center gap-1 ml-2">
              {ADMIN_LINKS.map(link => {
                const isActive = link.path === '/admin'
                  ? location.pathname === '/admin'
                  : location.pathname.startsWith(link.path);
                return (
                  <button
                    key={link.path}
                    onClick={() => navigate(link.path)}
                    className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                    style={{
                      color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                      background: isActive ? 'var(--bg-hover)' : 'transparent',
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = 'var(--text-secondary)'; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = 'var(--text-muted)'; }}
                  >
                    {link.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Client nav links — desktop */}
          {isClient && (
            <div className="hidden md:flex items-center gap-1 ml-2">
              {CLIENT_TABS.map(tab => {
                const isActive = tab.path === '/client'
                  ? location.pathname === '/client'
                  : location.pathname.startsWith(tab.path);
                return (
                  <button
                    key={tab.path}
                    onClick={() => navigate(tab.path)}
                    className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                    style={{
                      color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                      background: isActive ? 'var(--bg-hover)' : 'transparent',
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = 'var(--text-secondary)'; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = 'var(--text-muted)'; }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Install + user pill + notifications + signout */}
        <div className="flex items-center gap-2 shrink-0">

          {/* PWA Install Button */}
          {showInstallBtn && (
            <button
              onClick={handleInstallClick}
              title="Install App to Home Screen"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0"
              style={{
                background: 'linear-gradient(135deg, rgba(220,20,60,0.18) 0%, rgba(160,40,64,0.12) 100%)',
                color: 'var(--accent)',
                border: '1px solid rgba(220,20,60,0.35)',
              }}
            >
              <Download size={13} />
              <span className="hidden sm:inline">Install App</span>
            </button>
          )}

          {/* User pill */}
          <div
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full"
            style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}
          >
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
              style={{ background: getAvatarColor(user.username ?? 'U') }}
            >
              {(user.username ?? 'U').charAt(0).toUpperCase()}
            </div>
            <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              {user.username}
            </span>
            {isAdmin && (
              <span
                className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide"
                style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
              >
                Admin
              </span>
            )}
          </div>

          <NotificationDropdown />

          <Button variant="ghost" size="sm" onClick={logout} className="text-xs hidden sm:inline-flex">
            Sign Out
          </Button>

        </div>
      </nav>

      {/* ── Page Content ── */}
      <div className={`shell-content ${isClient ? 'shell-content-client' : ''}`}>
        {children}
      </div>

      {/* ── Client Mobile Bottom Tab Bar ── */}
      {isClient && (
        <div className="shell-bottom md:hidden">
          {CLIENT_TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = tab.path === '/client'
              ? location.pathname === '/client'
              : location.pathname.startsWith(tab.path);
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className="flex-1 flex flex-col items-center justify-center gap-1 transition-all"
                style={{
                  color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  paddingBottom: 'env(safe-area-inset-bottom, 0)',
                }}
              >
                <Icon
                  size={20}
                  strokeWidth={isActive ? 2.5 : 1.75}
                  style={{
                    filter: isActive ? 'drop-shadow(0 0 6px var(--accent))' : 'none',
                    transition: 'filter 0.2s ease',
                  }}
                />
                <span
                  className="text-[9px] font-medium tracking-wide"
                  style={{ color: isActive ? 'var(--accent)' : 'var(--text-muted)' }}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Admin mobile bottom nav */}
      {isAdmin && (
        <div className="shell-bottom md:hidden">
          {ADMIN_LINKS.map(link => {
            const Icon = link.path === '/admin'
              ? LayoutDashboard
              : link.path.includes('clients')
                ? Users
                : BookOpen;
            const isActive = link.path === '/admin'
              ? location.pathname === '/admin'
              : location.pathname.startsWith(link.path);
            return (
              <button
                key={link.path}
                onClick={() => navigate(link.path)}
                className="flex-1 flex flex-col items-center justify-center gap-1 transition-all"
                style={{
                  color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  paddingBottom: 'env(safe-area-inset-bottom, 0)',
                }}
              >
                <Icon
                  size={20}
                  strokeWidth={isActive ? 2.5 : 1.75}
                  style={{
                    filter: isActive ? 'drop-shadow(0 0 6px var(--accent))' : 'none',
                    transition: 'filter 0.2s ease',
                  }}
                />
                <span
                  className="text-[9px] font-medium tracking-wide"
                  style={{ color: isActive ? 'var(--accent)' : 'var(--text-muted)' }}
                >
                  {link.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

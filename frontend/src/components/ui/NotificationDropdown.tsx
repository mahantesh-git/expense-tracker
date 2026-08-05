import { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import api from '../../utils/api';
import { useNavigate } from 'react-router-dom';

interface Notification {
  _id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  relatedRequestId?: string;
}

export const NotificationDropdown = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [toasts, setToasts] = useState<Notification[]>([]);
  const prevNotifIds = useRef<Set<string>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const fetchNotifications = async () => {
    try {
      const [notifsRes, countRes] = await Promise.all([
        api.get('/notifications'),
        api.get('/notifications/unread-count')
      ]);
      const fetched = notifsRes.data;
      setNotifications(fetched);
      setUnreadCount(countRes.data.count);

      // Check for new unread notifications to show as toast
      const newToasts: Notification[] = [];
      fetched.forEach((n: Notification) => {
        if (!n.read && !prevNotifIds.current.has(n._id)) {
          // If this is the very first fetch, we don't want to toast existing unread ones.
          // Only toast if prevNotifIds has been populated at least once.
          if (prevNotifIds.current.size > 0) {
            newToasts.push(n);
          }
        }
      });

      if (newToasts.length > 0) {
        setToasts(prev => [...prev, ...newToasts]);
        // Auto-remove toast after 5 seconds
        setTimeout(() => {
          setToasts(prev => prev.filter(t => !newToasts.find(nt => nt._id === t._id)));
        }, 5000);
      }

      // Update seen IDs
      prevNotifIds.current = new Set(fetched.map((n: Notification) => n._id));
    } catch (error) {
      console.error('Failed to fetch notifications', error);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Poll every 10 seconds for real-time feel
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAsRead = async (id: string) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read', error);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      handleMarkAsRead(notification._id);
    }
    setIsOpen(false);
    
    // Navigate based on type
    if (notification.type === 'request_submitted') {
      navigate('/admin'); // Admin will see it in pending requests
    } else if (notification.type === 'request_approved' || notification.type === 'request_rejected') {
      navigate('/client/requests'); // Client sees their requests
    }
  };

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="relative p-2 rounded-full hover:bg-zinc-800 transition-colors focus:outline-none"
        >
          <Bell size={20} className="text-zinc-300" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white border-2 border-[var(--bg-base)]">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {isOpen && (
          <>
            {/* Backdrop (both mobile and desktop) */}
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

            {/* Mobile: slide-up bottom sheet */}
            <div className="fixed inset-x-0 bottom-0 z-50 sm:hidden rounded-t-2xl overflow-hidden shadow-2xl"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border)' }} />
              </div>
              <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Notifications</h3>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-[11px] font-medium px-2 py-1 rounded-md transition-colors"
                    style={{ color: 'var(--accent)' }}
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-[60vh] overflow-y-auto overscroll-contain">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center mb-2" style={{ background: 'var(--bg-raised)' }}>
                      <Bell size={18} style={{ color: 'var(--text-muted)' }} />
                    </div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>All caught up</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No new notifications</p>
                  </div>
                ) : (
                  <div style={{ borderTop: '1px solid var(--border)' }}>
                    {notifications.map((notification) => (
                      <div
                        key={notification._id}
                        onClick={() => handleNotificationClick(notification)}
                        className="p-4 cursor-pointer transition-colors relative"
                        style={{
                          background: !notification.read ? 'rgba(var(--accent-rgb, 220,20,60),0.04)' : 'transparent',
                          borderBottom: '1px solid var(--border)',
                        }}
                      >
                        {!notification.read && (
                          <div className="absolute left-0 top-0 bottom-0 w-0.5" style={{ background: 'var(--accent)' }} />
                        )}
                        <div className="flex gap-3">
                          <div className="mt-0.5 shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                            style={{ background: !notification.read ? 'var(--accent-dim)' : 'var(--bg-raised)', color: !notification.read ? 'var(--accent)' : 'var(--text-muted)' }}>
                            <Bell size={14} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start gap-2 mb-1">
                              <span className="text-sm font-semibold truncate" style={{ color: !notification.read ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                                {notification.title}
                              </span>
                              <span className="text-[10px] shrink-0 mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                {new Date(notification.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                              </span>
                            </div>
                            <p className="text-xs line-clamp-2 leading-relaxed" style={{ color: !notification.read ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                              {notification.message}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {/* bottom padding for safe area */}
                <div className="h-6" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }} />
              </div>
            </div>

            {/* Desktop: dropdown */}
            <div className="hidden sm:block absolute right-0 mt-2 w-80 max-w-sm rounded-xl shadow-2xl overflow-hidden z-50"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Notifications</h3>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-[11px] font-medium px-2 py-1 rounded-md transition-colors"
                    style={{ color: 'var(--accent)' }}
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-[400px] overflow-y-auto overscroll-contain">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center mb-2" style={{ background: 'var(--bg-raised)' }}>
                      <Bell size={18} style={{ color: 'var(--text-muted)' }} />
                    </div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>All caught up</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No new notifications</p>
                  </div>
                ) : (
                  <div>
                    {notifications.map((notification) => (
                      <div
                        key={notification._id}
                        onClick={() => handleNotificationClick(notification)}
                        className="p-4 cursor-pointer transition-colors relative group"
                        style={{
                          background: !notification.read ? 'rgba(var(--accent-rgb, 220,20,60),0.04)' : 'transparent',
                          borderBottom: '1px solid var(--border)',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-raised)')}
                        onMouseLeave={e => (e.currentTarget.style.background = !notification.read ? 'rgba(var(--accent-rgb, 220,20,60),0.04)' : 'transparent')}
                      >
                        {!notification.read && (
                          <div className="absolute left-0 top-0 bottom-0 w-0.5" style={{ background: 'var(--accent)' }} />
                        )}
                        <div className="flex gap-3">
                          <div className="mt-0.5 shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                            style={{ background: !notification.read ? 'var(--accent-dim)' : 'var(--bg-raised)', color: !notification.read ? 'var(--accent)' : 'var(--text-muted)' }}>
                            <Bell size={14} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start gap-2 mb-1">
                              <span className="text-sm font-semibold truncate" style={{ color: !notification.read ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                                {notification.title}
                              </span>
                              <span className="text-[10px] shrink-0 mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                {new Date(notification.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                              </span>
                            </div>
                            <p className="text-xs line-clamp-2 leading-relaxed" style={{ color: !notification.read ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                              {notification.message}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* iPhone style Toasts */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none w-full max-w-sm px-4">
        {toasts.map(toast => (
          <div
            key={`toast-${toast._id}`}
            onClick={() => {
              // Clickable toast
              handleNotificationClick(toast);
              setToasts(prev => prev.filter(t => t._id !== toast._id));
            }}
            className="pointer-events-auto cursor-pointer bg-zinc-900/95 backdrop-blur-md border border-zinc-700/50 shadow-2xl rounded-2xl p-4 transform transition-all duration-500 animate-in slide-in-from-top-10 fade-in flex items-start gap-3"
          >
            <div className="bg-[var(--accent)]/20 p-2 rounded-full shrink-0">
              <Bell size={16} className="text-[var(--accent)]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-zinc-100">{toast.title}</p>
              <p className="text-xs text-zinc-300 mt-0.5 line-clamp-2">{toast.message}</p>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

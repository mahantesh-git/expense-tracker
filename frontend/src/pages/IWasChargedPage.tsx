import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

import { Button } from '../components/ui/Button';
import { NotificationDropdown } from '../components/ui/NotificationDropdown';
import api from '../utils/api';

const IWasChargedPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    api.get('/expenses').then(res => {
      setExpenses(
        res.data.filter((e: any) =>
          e.payer._id !== user?._id &&
          e.splits?.some((s: any) => s.user?._id === user?._id)
        )
      );
    });
  }, []);

  const toggle = (id: string) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const totalCharged = expenses.reduce((acc, e) => {
    const mySplit = e.splits?.find((s: any) => s.user?._id === user?._id);
    return acc + (mySplit?.amountOwed || 0);
  }, 0);

  return (
    <div className="p-4 md:p-6 space-y-5 w-full page-enter">
      <header className="flex items-center gap-4 pb-4 border-b border-zinc-800">
        <Button variant="ghost" size="sm" onClick={() => navigate('/client')}>← Back</Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">I Was Charged</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{expenses.length} bills I am a part of</p>
        </div>
        <div className="text-right flex items-center gap-4">
          <div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>My Share</p>
            <p className="text-xl font-semibold" style={{ color: 'var(--color-danger)' }}>₹{totalCharged.toFixed(2)}</p>
          </div>
          <NotificationDropdown />
        </div>
      </header>

      <div className="space-y-2">
        {expenses.length === 0 ? (
          <p className="text-sm py-4" style={{ color: 'var(--text-muted)' }}>No charges recorded yet.</p>
        ) : expenses.map(exp => {
          const isOpen = expanded[exp._id];
          const mySplit = exp.splits?.find((s: any) => s.user?._id === user?._id);

          return (
            <div key={exp._id} className="rounded-lg overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <button
                className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors"
                style={{ background: 'transparent' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-raised)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                onClick={() => toggle(exp._id)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`text-xs transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} style={{ color: 'var(--text-muted)', display: 'inline-block' }}>▶</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{exp.description}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{exp.payer.username}</span>
                      {' · '}
                      {new Date(exp.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-4 shrink-0">
                  <span className="text-xs hidden sm:block" style={{ color: 'var(--text-muted)' }}>bill ₹{exp.amount.toFixed(2)}</span>
                  <span className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>₹{mySplit?.amountOwed.toFixed(2)}</span>
                </div>
              </button>

              {isOpen && (
                <div className="accordion-open px-4 py-3" style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-raised)' }}>
                  <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Full bill breakdown</p>
                  <div className="space-y-2">
                    {exp.splits?.map((s: any, i: number) => {
                      const isMe = s.user?._id === user?._id;
                      return (
                        <div key={i} className={`flex justify-between items-center py-1 ${isMe ? 'pl-2' : ''}`}
                          style={isMe ? { borderLeft: '2px solid var(--accent)' } : {}}>
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold"
                              style={{ background: isMe ? 'var(--accent-dim)' : 'var(--bg-hover)', color: isMe ? 'var(--accent-hover)' : 'var(--text-secondary)' }}>
                              {s.user?.username?.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-xs" style={{ color: isMe ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: isMe ? 600 : 400 }}>
                              {isMe ? 'You' : s.user?.username}
                            </span>
                          </div>
                          <span className="text-xs font-medium" style={{ color: isMe ? 'var(--accent)' : 'var(--text-muted)' }}>
                            ₹{s.amountOwed.toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default IWasChargedPage;

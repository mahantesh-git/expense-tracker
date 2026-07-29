import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { NotificationDropdown } from '../components/ui/NotificationDropdown';
import AnimatedNumber from '../components/ui/AnimatedNumber';
import api from '../utils/api';

const BalancesPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    Promise.all([api.get('/expenses'), api.get('/settlements')]).then(([expRes, settRes]) => {
      setExpenses(expRes.data);
      setSettlements(settRes.data);
    });
  }, []);

  const toggle = (key: string) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  const balanceMap: Record<string, { username: string; net: number; transactions: { desc: string; amount: number; type: 'owes_you' | 'you_owe' }[] }> = {};

  expenses.forEach(exp => {
    if (exp.payer._id === user?._id) {
      exp.splits?.forEach((s: any) => {
        if (s.user?._id && s.user._id !== user?._id) {
          if (!balanceMap[s.user._id]) balanceMap[s.user._id] = { username: s.user.username, net: 0, transactions: [] };
          balanceMap[s.user._id].net += s.amountOwed;
          balanceMap[s.user._id].transactions.push({ desc: exp.description, amount: s.amountOwed, type: 'owes_you' });
        }
      });
    } else {
      const mySplit = exp.splits?.find((s: any) => s.user?._id === user?._id);
      if (mySplit) {
        const pid = exp.payer._id;
        if (!balanceMap[pid]) balanceMap[pid] = { username: exp.payer.username, net: 0, transactions: [] };
        balanceMap[pid].net -= mySplit.amountOwed;
        balanceMap[pid].transactions.push({ desc: exp.description, amount: mySplit.amountOwed, type: 'you_owe' });
      }
    }
  });

  settlements.forEach(sett => {
    if (sett.payer._id === user?._id && balanceMap[sett.receiver._id]) {
      balanceMap[sett.receiver._id].net += sett.amount;
    } else if (sett.receiver._id === user?._id && balanceMap[sett.payer._id]) {
      balanceMap[sett.payer._id].net -= sett.amount;
    }
  });

  const owedToYou = Object.entries(balanceMap).filter(([, b]) => b.net > 0.01);
  const youOwe = Object.entries(balanceMap).filter(([, b]) => b.net < -0.01);
  const settled = Object.entries(balanceMap).filter(([, b]) => Math.abs(b.net) <= 0.01);

  const PersonRow = ({ uid, b, isPositive, type }: { uid: string; b: any; isPositive: boolean; type: 'owes_you' | 'you_owe' }) => {
    const isOpen = expanded[uid];
    const relevant = b.transactions.filter((t: any) => t.type === type);
    const amtColor = isPositive ? 'var(--color-success)' : 'var(--accent)';

    return (
      <div className="rounded-lg overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <button
          className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors"
          style={{ background: 'transparent' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-raised)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          onClick={() => toggle(uid)}
        >
          <div className="flex items-center gap-3">
            <span className={`text-xs transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} style={{ color: 'var(--text-muted)', display: 'inline-block' }}>▶</span>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold" style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
              {b.username.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{b.username}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{relevant.length} {relevant.length === 1 ? 'transaction' : 'transactions'}</p>
            </div>
          </div>
          <span className="text-base font-semibold" style={{ color: amtColor }}>₹{Math.abs(b.net).toFixed(2)}</span>
        </button>

        {isOpen && (
          <div className="accordion-open px-4 py-3 space-y-2" style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-raised)' }}>
            {relevant.map((t: any, i: number) => (
              <div key={i} className="flex justify-between items-center">
                <p className="text-xs truncate mr-4" style={{ color: 'var(--text-secondary)' }}>{t.desc}</p>
                <p className="text-xs font-medium shrink-0" style={{ color: amtColor }}>₹{t.amount.toFixed(2)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-6 w-full page-enter">
      <header className="flex items-center gap-4 pb-4 border-b border-zinc-800">
        <Button variant="ghost" size="sm" onClick={() => navigate('/client')}>← Back</Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">Balances</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Who owes you vs who you owe</p>
        </div>
        <div className="text-right flex items-center gap-4">
          <NotificationDropdown />
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-lg" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Others Owe You</p>
          <p className="text-xl font-semibold mt-1" style={{ color: 'var(--color-success)' }}>
            <AnimatedNumber value={owedToYou.reduce((a, [, b]) => a + b.net, 0)} prefix="₹" />
          </p>
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{owedToYou.length} {owedToYou.length === 1 ? 'person' : 'people'}</p>
        </div>
        <div className="p-3 rounded-lg" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>You Owe Others</p>
          <p className="text-xl font-semibold mt-1" style={{ color: 'var(--accent)' }}>
            <AnimatedNumber value={youOwe.reduce((a, [, b]) => a + Math.abs(b.net), 0)} prefix="₹" />
          </p>
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{youOwe.length} {youOwe.length === 1 ? 'person' : 'people'}</p>
        </div>
      </div>

      {owedToYou.length > 0 && (
        <section>
          <p className="text-[10px] font-medium uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>They Owe You</p>
          <div className="space-y-2">
            {owedToYou.map(([uid, b]) => <PersonRow key={uid} uid={uid} b={b} isPositive={true} type="owes_you" />)}
          </div>
        </section>
      )}

      {youOwe.length > 0 && (
        <section>
          <p className="text-[10px] font-medium uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>You Owe Them</p>
          <div className="space-y-2">
            {youOwe.map(([uid, b]) => <PersonRow key={uid} uid={uid} b={b} isPositive={false} type="you_owe" />)}
          </div>
        </section>
      )}

      {settled.length > 0 && (
        <section>
          <p className="text-[10px] font-medium uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Settled</p>
          <div className="space-y-2">
            {settled.map(([uid, b]) => (
              <div key={uid} className="flex items-center justify-between px-4 py-3 rounded-lg opacity-40" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
                    {b.username.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{b.username}</span>
                </div>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>₹0.00 · Settled</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {owedToYou.length === 0 && youOwe.length === 0 && settled.length === 0 && (
        <p className="text-sm text-center py-10" style={{ color: 'var(--text-muted)' }}>No balances yet.</p>
      )}
    </div>
  );
};

export default BalancesPage;

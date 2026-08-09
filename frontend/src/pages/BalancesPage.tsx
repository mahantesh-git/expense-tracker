import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import AnimatedNumber from '../components/ui/AnimatedNumber';
import { getAvatarColor } from '../components/Shell';
import { UPIPayModal } from '../components/ui/UPIPayModal';
import api from '../utils/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Download, ChevronRight, CheckCircle2, CreditCard } from 'lucide-react';

const BalancesPage = () => {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [payModal, setPayModal] = useState<{ uid: string; name: string; amount: number } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [expRes, settRes] = await Promise.all([
        api.get('/expenses'),
        api.get('/settlements'),
      ]);
      setExpenses(expRes.data);
      setSettlements(settRes.data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  const exportToPDF = () => {
    const doc = new jsPDF('landscape');
    doc.text("My Balances Report", 14, 15);
    
    const tableData = Object.values(balanceMap).map(b => {
      const status = b.net > 0 ? 'Owes You' : b.net < 0 ? 'You Owe' : 'Settled';
      return [
        b.username,
        `Rs. ${Math.abs(b.net).toFixed(2)}`,
        status,
        b.transactions.length.toString()
      ];
    });

    autoTable(doc, {
      head: [['User', 'Net Balance', 'Status', 'Transactions']],
      body: tableData,
      startY: 20,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [40, 40, 40] }
    });

    doc.save(`balances-report-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const PersonRow = ({ uid, b, isPositive, type }: { uid: string; b: any; isPositive: boolean; type: 'owes_you' | 'you_owe' }) => {
    const isOpen = expanded[uid];
    const relevant = b.transactions.filter((t: any) => t.type === type);
    const amtColor = isPositive ? 'var(--color-success)' : 'var(--color-danger)';
    const avatarColor = getAvatarColor(b.username);

    return (
      <div className="rounded-xl overflow-hidden mb-3 card-hover" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <button
          className="w-full flex items-center justify-between p-4 text-left transition-colors"
          style={{ background: isOpen ? 'var(--bg-raised)' : 'transparent' }}
          onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = 'var(--bg-hover)'; }}
          onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = 'transparent'; }}
          onClick={() => toggle(uid)}
        >
          <div className="flex items-center gap-3">
            <div className="avatar-ring shrink-0" style={{ background: avatarColor, color: '#fff' }}>
              {b.username.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{b.username}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {relevant.length} {relevant.length === 1 ? 'transaction' : 'transactions'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold" style={{ color: amtColor, letterSpacing: '-0.02em' }}>
              ₹{Math.abs(b.net).toFixed(2)}
            </span>
            {/* Pay Now button — only for "you_owe" rows */}
            {type === 'you_owe' && (
              <button
                onClick={e => { e.stopPropagation(); setPayModal({ uid, name: b.username, amount: Math.abs(b.net) }); }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition-all"
                style={{ background: 'var(--accent)', color: '#fff' }}
                title={`Pay ₹${Math.abs(b.net).toFixed(2)} to ${b.username}`}
              >
                <CreditCard size={12} />
                <span className="hidden sm:inline">Pay Now</span>
              </button>
            )}
            <ChevronRight
              size={16}
              style={{ color: 'var(--text-muted)', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s ease' }}
            />
          </div>
        </button>

        {isOpen && (
          <div className="accordion-open p-4 space-y-3" style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-raised)' }}>
            {relevant.map((t: any, i: number) => (
              <div key={i} className="flex justify-between items-center bg-black/20 p-2.5 rounded-lg border border-white/5">
                <p className="text-sm font-medium mr-4 truncate" style={{ color: 'var(--text-secondary)' }}>{t.desc}</p>
                <p className="text-sm font-semibold shrink-0" style={{ color: amtColor }}>₹{t.amount.toFixed(2)}</p>
              </div>
            ))}
            {relevant.length === 0 && (
              <p className="text-xs text-center py-2" style={{ color: 'var(--text-muted)' }}>No direct transactions.</p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-6 w-full page-enter">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Balances</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            With {Object.keys(balanceMap).length} participants
          </p>
        </div>
        <Button onClick={exportToPDF} variant="secondary" size="sm" className="hidden sm:inline-flex gap-2">
          <Download size={14} /> Export PDF
        </Button>
        <button 
          onClick={exportToPDF}
          className="sm:hidden p-2 rounded-lg text-xs transition-colors"
          style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        >
          <Download size={14} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="stat-card p-4">
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Others Owe You</p>
          <p className="text-2xl font-bold tracking-tight" style={{ color: 'var(--color-success)', letterSpacing: '-0.03em' }}>
            <AnimatedNumber value={owedToYou.reduce((a, [, b]) => a + b.net, 0)} prefix="₹" />
          </p>
          <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
            {owedToYou.length} {owedToYou.length === 1 ? 'person' : 'people'}
          </p>
        </div>
        <div className="stat-card p-4">
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>You Owe Others</p>
          <p className="text-2xl font-bold tracking-tight" style={{ color: 'var(--color-danger)', letterSpacing: '-0.03em' }}>
            <AnimatedNumber value={youOwe.reduce((a, [, b]) => a + Math.abs(b.net), 0)} prefix="₹" />
          </p>
          <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
            {youOwe.length} {youOwe.length === 1 ? 'person' : 'people'}
          </p>
        </div>
      </div>

      {owedToYou.length > 0 && (
        <section className="mt-8">
          <p className="section-label mb-3">They Owe You</p>
          <div>
            {owedToYou.map(([uid, b]) => <PersonRow key={uid} uid={uid} b={b} isPositive={true} type="owes_you" />)}
          </div>
        </section>
      )}

      {youOwe.length > 0 && (
        <section className="mt-8">
          <p className="section-label mb-3">You Owe Them</p>
          <div>
            {youOwe.map(([uid, b]) => <PersonRow key={uid} uid={uid} b={b} isPositive={false} type="you_owe" />)}
          </div>
        </section>
      )}

      {settled.length > 0 && (
        <section className="mt-8">
          <p className="section-label mb-3">Settled</p>
          <div className="space-y-3">
            {settled.map(([uid, b]) => (
              <div key={uid} className="flex items-center justify-between p-4 rounded-xl opacity-60" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-3">
                  <div className="avatar-ring opacity-50" style={{ background: 'var(--bg-raised)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                    {b.username.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{b.username}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} style={{ color: 'var(--color-success)' }} />
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>₹0.00</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {owedToYou.length === 0 && youOwe.length === 0 && settled.length === 0 && (
        <div className="py-16 text-center">
          <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
            <CheckCircle2 size={24} style={{ color: 'var(--text-muted)' }} />
          </div>
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>No balances to show</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>You're all settled up with everyone.</p>
        </div>
      )}

      {/* UPI Pay Modal */}
      {payModal && (
        <UPIPayModal
          isOpen={true}
          onClose={() => setPayModal(null)}
          payeeId={payModal.uid}
          payeeName={payModal.name}
          amount={payModal.amount}
          onSuccess={() => { setPayModal(null); fetchData(); }}
        />
      )}
    </div>
  );
};

export default BalancesPage;

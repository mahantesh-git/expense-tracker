import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { NotificationDropdown } from '../components/ui/NotificationDropdown';
import AnimatedNumber from '../components/ui/AnimatedNumber';
import api from '../utils/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const IPaidPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    api.get('/expenses').then(res => {
      setExpenses(res.data.filter((e: any) => e.payer._id === user?._id));
    });
  }, []);

  const toggle = (id: string) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  const total = expenses.reduce((acc, e) => acc + e.amount, 0);

  const exportToPDF = () => {
    const doc = new jsPDF('landscape');
    doc.text("I Paid - Expense Report", 14, 15);
    
    const tableData = expenses.map(exp => {
      const otherSplits = exp.splits?.filter((s: any) => s.user?._id !== user?._id) || [];
      const totalOwedToYou = otherSplits.reduce((a: number, s: any) => a + s.amountOwed, 0);
      const splitDetails = otherSplits.map((s: any) => `${s.user?.username}: Rs. ${s.amountOwed.toFixed(2)}`).join(', ');

      return [
        new Date(exp.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
        exp.description,
        `Rs. ${exp.amount.toFixed(2)}`,
        `Rs. ${totalOwedToYou.toFixed(2)}`,
        splitDetails || 'No splits'
      ];
    });

    autoTable(doc, {
      head: [['Date', 'Description', 'Total Amount', 'Owed To You', 'Split Details']],
      body: tableData,
      startY: 20,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [40, 40, 40] }
    });

    doc.save(`i-paid-report-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="p-4 md:p-6 space-y-5 w-full page-enter">
      <header className="flex items-center gap-4 pb-4 border-b border-zinc-800">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>← Back</Button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">I Paid</h1>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{expenses.length} bills paid upfront</p>
        </div>
        <div className="text-right flex items-center gap-4">
          <Button onClick={exportToPDF} variant="secondary" size="sm" className="hidden sm:inline-flex">Export PDF</Button>
          <div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Total</p>
            <p className="text-xl font-semibold" style={{ color: 'var(--color-success)' }}>
              <AnimatedNumber value={total} prefix="₹" />
            </p>
          </div>
          <NotificationDropdown />
        </div>
      </header>

      <div className="space-y-2">
        {expenses.length === 0 ? (
          <p className="text-sm py-4" style={{ color: 'var(--text-muted)' }}>No payments recorded yet.</p>
        ) : expenses.map(exp => {
          const isOpen = expanded[exp._id];
          const otherSplits = exp.splits?.filter((s: any) => s.user?._id !== user?._id) || [];
          const totalOwedToYou = otherSplits.reduce((a: number, s: any) => a + s.amountOwed, 0);
          const hasSplits = otherSplits.length > 0;

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
                      {new Date(exp.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {hasSplits && <span className="ml-2" style={{ color: 'var(--text-muted)' }}>· {otherSplits.length} {otherSplits.length === 1 ? 'person' : 'people'} owe you</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-4 shrink-0">
                  {hasSplits && (
                    <span className="text-xs hidden sm:block" style={{ color: 'var(--color-success)' }}>+₹{totalOwedToYou.toFixed(2)} owed</span>
                  )}
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>₹{exp.amount.toFixed(2)}</span>
                </div>
              </button>

              {isOpen && (
                <div className="accordion-open px-4 py-3" style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-raised)' }}>
                  {hasSplits ? (
                    <div className="space-y-2">
                      <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Who owes you</p>
                      {otherSplits.map((s: any, i: number) => (
                        <div key={i} className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold" style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
                              {s.user?.username?.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{s.user?.username}</span>
                          </div>
                          <span className="text-xs font-medium" style={{ color: 'var(--color-success)' }}>₹{s.amountOwed.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Personal expense — no split</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default IPaidPage;

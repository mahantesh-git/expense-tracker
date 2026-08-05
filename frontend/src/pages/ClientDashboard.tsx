import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { SkeletonStats } from '../components/ui/Skeleton';
import AnimatedNumber from '../components/ui/AnimatedNumber';
import { getAvatarColor } from '../components/Shell';
import api from '../utils/api';
import {
  CreditCard,
  Receipt,
  HandCoins,
  ArrowDownLeft,
  ChevronRight,
  Plus,
  Minus,
  ArrowUpRight,
  CheckCircle2,
} from 'lucide-react';

// ─── Types ────────────────────────────────────
interface User { _id: string; username: string; }
interface SplitEntry { user: string; amountOwed: number; }

// ─── Helpers ──────────────────────────────────
const fmtCurrency = (n: number) => `₹${n.toFixed(2)}`;

// ─── Stat Card ───────────────────────────────
const StatCard = ({
  label,
  value,
  prefix,
  decimals,
  valueColor,
  icon: Icon,
  accent,
  subLabel,
  onClick,
}: {
  label: string;
  value: number;
  prefix?: string;
  decimals?: number;
  valueColor?: string;
  icon: React.ElementType;
  accent?: boolean;
  subLabel?: string;
  onClick?: () => void;
}) => (
  <div
    className={`${accent ? 'stat-card' : 'glass-panel card-hover'} p-4 ${onClick ? 'cursor-pointer' : ''}`}
    onClick={onClick}
  >
    <div className="flex items-start justify-between mb-2">
      <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</p>
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center"
        style={{ background: accent ? 'var(--accent-dim)' : 'var(--bg-hover)' }}
      >
        <Icon size={14} style={{ color: accent ? 'var(--accent)' : 'var(--text-secondary)' }} />
      </div>
    </div>
    <p className="text-2xl font-bold tracking-tight" style={{ color: valueColor ?? 'var(--text-primary)', letterSpacing: '-0.03em' }}>
      <AnimatedNumber value={value} prefix={prefix} decimals={decimals ?? 2} duration={600} />
    </p>
    {subLabel && (
      <p className="text-[11px] mt-1.5 flex items-center gap-1 transition-colors group-hover:text-zinc-200"
        style={{ color: 'var(--text-muted)' }}>
        {subLabel}
        {onClick && <ChevronRight size={11} />}
      </p>
    )}
  </div>
);

const ClientDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [expenses, setExpenses] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);


  const [items, setItems] = useState<{ name: string; amount: string }[]>([{ name: '', amount: '' }]);
  const [splitType, setSplitType] = useState<'equal' | 'custom'>('equal');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [formError, setFormError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // ─── Fetch ──────────────────────────────────
  const fetchData = useCallback(async (showSkeleton = false) => {
    if (showSkeleton) setDataLoading(true);
    try {
      const [expRes, settRes, usersRes] = await Promise.allSettled([
        api.get('/expenses'),
        api.get('/settlements'),
        api.get('/auth/peers'),
      ]);

      if (expRes.status === 'fulfilled')   setExpenses(expRes.value.data);
      if (settRes.status === 'fulfilled')  setSettlements(settRes.value.data);
      if (usersRes.status === 'fulfilled') {
        setAllUsers(usersRes.value.data.filter((u: any) => u._id !== user?._id));
      }
    } catch (error) {
      console.error('Failed to fetch data', error);
    } finally {
      setDataLoading(false);
    }
  }, [user?._id]);

  useEffect(() => {
    fetchData(expenses.length === 0);
    const interval = setInterval(() => fetchData(false), 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // ─── Split calculations ─────────────────────
  const buildSplits = (): SplitEntry[] => {
    if (selectedUsers.length === 0) return [];
    const total = Number(amount) || 0;
    if (splitType === 'equal') {
      const participants = [user!._id, ...selectedUsers];
      const perPerson = total / participants.length;
      return selectedUsers.map(uid => ({ user: uid, amountOwed: parseFloat(perPerson.toFixed(2)) }));
    } else {
      return selectedUsers.map(uid => ({
        user: uid,
        amountOwed: parseFloat(customAmounts[uid] || '0'),
      }));
    }
  };

  const amount = items.reduce((acc, it) => acc + (parseFloat(it.amount) || 0), 0).toFixed(2);
  const description = items
    .filter(it => it.name.trim())
    .map(it => `${it.name.trim()}-${parseFloat(it.amount || '0')}`)
    .join(' ');

  const addItem = () => setItems(prev => [...prev, { name: '', amount: '' }]);
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: 'name' | 'amount', value: string) =>
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));

  const equalSharePerPerson = selectedUsers.length > 0 && Number(amount) > 0
    ? Number(amount) / (selectedUsers.length + 1)
    : null;

  const customSplitTotal = selectedUsers.reduce((acc, uid) => acc + (parseFloat(customAmounts?.[uid] || '0')), 0);
  const customRemainingForSelf = Number(amount) - customSplitTotal;

  // ─── Submit ─────────────────────────────────
  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSubmitSuccess(false);

    if (selectedUsers.length === 0) { setFormError('Select at least one person to split with.'); return; }
    const splits = buildSplits();
    const total = Number(amount);
    if (total <= 0) { setFormError('Add at least one item with an amount.'); return; }
    const hasNames = items.some(it => it.name.trim());
    if (!hasNames) { setFormError('Enter a name for at least one item.'); return; }

    if (splitType === 'custom') {
      const othersTotal = splits.reduce((a, s) => a + s.amountOwed, 0);
      if (othersTotal > total + 0.01) {
        setFormError(`Others' shares (₹${othersTotal.toFixed(2)}) exceed the total (₹${total.toFixed(2)}). Reduce the amounts.`);
        return;
      }
      if (othersTotal < 0.01) { setFormError('Enter at least ₹0.01 for each participant.'); return; }
    }

    setLoading(true);
    try {
      await api.post('/expense-requests', { description, amount: total, splitType, splits });
      resetForm();
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 4000);
      fetchData();
    } catch (error: any) {
      setFormError(error?.response?.data?.message || 'Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setItems([{ name: '', amount: '' }]);
    setSplitType('equal');
    setSelectedUsers([]);
    setCustomAmounts({});
  };

  const toggleUser = (uid: string) => {
    setSelectedUsers(prev => prev.includes(uid) ? prev.filter(u => u !== uid) : [...prev, uid]);
  };

  // ─── Summary calculations ──────────────────
  const totalIPaid = expenses
    .filter(e => e.payer._id === user?._id)
    .reduce((acc, e) => acc + e.amount, 0);

  const totalIWasCharged = expenses
    .filter(e => e.payer._id !== user?._id && e.splits?.some((s: any) => s.user?._id === user?._id))
    .reduce((acc, e) => {
      const mySplit = e.splits?.find((s: any) => s.user?._id === user?._id);
      return acc + (mySplit?.amountOwed || 0);
    }, 0);

  const balanceMap: Record<string, number> = {};
  expenses.forEach(exp => {
    if (exp.payer._id === user?._id) {
      exp.splits?.forEach((s: any) => {
        if (s.user?._id && s.user._id !== user?._id) {
          balanceMap[s.user._id] = (balanceMap[s.user._id] || 0) + s.amountOwed;
        }
      });
    } else {
      const mySplit = exp.splits?.find((s: any) => s.user?._id === user?._id);
      if (mySplit) {
        balanceMap[exp.payer._id] = (balanceMap[exp.payer._id] || 0) - mySplit.amountOwed;
      }
    }
  });
  settlements.forEach(sett => {
    if (sett.payer._id === user?._id && balanceMap[sett.receiver._id] !== undefined) {
      balanceMap[sett.receiver._id] += sett.amount;
    } else if (sett.receiver._id === user?._id && balanceMap[sett.payer._id] !== undefined) {
      balanceMap[sett.payer._id] -= sett.amount;
    }
  });

  const owedToYouTotal = Object.values(balanceMap).filter(v => v > 0.01).reduce((a, b) => a + b, 0);
  const youOweTotal = Object.values(balanceMap).filter(v => v < -0.01).reduce((a, b) => a + Math.abs(b), 0);
  const iPaidCount = expenses.filter(e => e.payer._id === user?._id).length;
  const chargedCount = expenses.filter(e => e.payer._id !== user?._id && e.splits?.some((s: any) => s.user?._id === user?._id)).length;

  return (
    <div className="p-4 md:p-6 space-y-6 w-full page-enter">

      {/* Summary Cards */}
      {dataLoading ? <SkeletonStats count={4} /> : (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
          <div className="group" onClick={() => navigate('/client/paid')}>
            <StatCard
              label="I Paid"
              value={totalIPaid}
              prefix="₹"
              icon={CreditCard}
              accent
              subLabel={`${iPaidCount} transactions →`}
              onClick={() => navigate('/client/paid')}
            />
          </div>
          <div className="group" onClick={() => navigate('/client/charged')}>
            <StatCard
              label="I Was Charged"
              value={totalIWasCharged}
              prefix="₹"
              icon={Receipt}
              subLabel={`${chargedCount} transactions →`}
              onClick={() => navigate('/client/charged')}
            />
          </div>
          <div className="group" onClick={() => navigate('/client/balances')}>
            <StatCard
              label="Others Owe Me"
              value={owedToYouTotal}
              prefix="₹"
              icon={HandCoins}
              valueColor="var(--color-success)"
              subLabel="View balances →"
              onClick={() => navigate('/client/balances')}
            />
          </div>
          <div className="group" onClick={() => navigate('/client/balances')}>
            <StatCard
              label="I Owe Others"
              value={youOweTotal}
              prefix="₹"
              icon={ArrowDownLeft}
              valueColor="var(--color-danger)"
              subLabel="View balances →"
              onClick={() => navigate('/client/balances')}
            />
          </div>
        </div>
      )}

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        {/* ── Request Expense Form ─────────────── */}
        <Card>
          <div className="flex items-center gap-2 mb-1">
            <Plus size={16} style={{ color: 'var(--accent)' }} />
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Request an Expense</h2>
          </div>
          <p className="text-xs mb-5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            Submit for admin approval. Once approved it affects everyone's balances.
          </p>

          <form onSubmit={handleSubmitRequest} className="space-y-5">

            {/* Item List */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Items</label>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Total: <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>₹{Number(amount).toFixed(2)}</span>
                </span>
              </div>

              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder={`Item ${idx + 1} name`}
                      value={item.name}
                      onChange={e => updateItem(idx, 'name', e.target.value)}
                      className="input-field flex-1 placeholder:text-[var(--text-secondary)]"
                      style={{ color: 'var(--text-primary)' }}
                    />  
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--text-muted)' }}>₹</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={item.amount}
                        onChange={e => updateItem(idx, 'amount', e.target.value)}
                        className="input-field w-28 pl-6 placeholder:text-[var(--text-secondary)]"
                      />
                    </div>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors shrink-0"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--color-danger)'; e.currentTarget.style.background = 'rgba(248,113,113,0.1)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                      >
                        <Minus size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addItem}
                className="mt-3 w-full py-2.5 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2"
                style={{ color: 'var(--text-muted)', border: '1px dashed var(--border)' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--text-muted)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
              >
                <Plus size={14} /> Add Item
              </button>
            </div>

            {/* Split Type Toggle */}
            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Split Type</label>
              <div className="tab-pill w-fit">
                {(['equal', 'custom'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSplitType(t)}
                    className={`tab-pill-item ${splitType === t ? 'active' : ''}`}
                  >
                    {t === 'equal' ? '⚖ Equal' : '✏ Custom'}
                  </button>
                ))}
              </div>
            </div>

            {/* Participants */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Split with <span style={{ color: 'var(--text-muted)' }}>(select others)</span>
                </label>
                {allUsers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedUsers.length === allUsers.length) {
                        setSelectedUsers([]);
                        setCustomAmounts({});
                      } else {
                        setSelectedUsers(allUsers.map(u => u._id));
                      }
                    }}
                    className="text-[11px] font-medium underline underline-offset-2 transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                  >
                    {selectedUsers.length === allUsers.length ? 'Deselect All' : 'Select All'}
                  </button>
                )}
              </div>

              {allUsers.length === 0 ? (
                <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>No other users available.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {allUsers.map(u => {
                    const isSelected = selectedUsers.includes(u._id);
                    const avatarColor = getAvatarColor(u.username);
                    return (
                      <div key={u._id} className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleUser(u._id)}
                          className="flex-1 flex items-center gap-2.5 p-2.5 rounded-lg border text-left transition-all"
                          style={{
                            border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                            background: isSelected ? 'var(--accent-dim)' : 'var(--bg-raised)',
                          }}
                        >
                          {/* Colored avatar */}
                          <div
                            className="w-7 h-7 rounded-md flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                            style={{ background: avatarColor }}
                          >
                            {u.username.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{u.username}</span>

                          {/* Checkbox */}
                          <div
                            className="ml-auto w-4 h-4 rounded border flex items-center justify-center shrink-0"
                            style={{
                              background: isSelected ? 'var(--text-primary)' : 'transparent',
                              borderColor: isSelected ? 'var(--text-primary)' : 'var(--border)',
                            }}
                          >
                            {isSelected && <span className="text-[10px] leading-none" style={{ color: 'var(--bg-base)' }}>✓</span>}
                          </div>

                          {/* Equal share preview */}
                          {isSelected && splitType === 'equal' && equalSharePerPerson && (
                            <span className="text-[11px] ml-1 shrink-0" style={{ color: 'var(--text-muted)' }}>
                              {fmtCurrency(equalSharePerPerson)}
                            </span>
                          )}
                        </button>

                        {/* Custom amount */}
                        {isSelected && splitType === 'custom' && (
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="₹ amount"
                            value={customAmounts[u._id] || ''}
                            onChange={e => setCustomAmounts(prev => ({ ...prev, [u._id]: e.target.value }))}
                            className="input-field w-28 placeholder:text-[var(--text-secondary)]"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Split summaries */}
            {splitType === 'custom' && selectedUsers.length > 0 && amount && (
              <div
                className="text-xs p-2.5 rounded-lg"
                style={{
                  background: customSplitTotal > Number(amount) + 0.01 ? 'rgba(248,113,113,0.08)' : 'var(--bg-raised)',
                  border: `1px solid ${customSplitTotal > Number(amount) + 0.01 ? 'rgba(248,113,113,0.25)' : 'var(--border)'}`,
                  color: customSplitTotal > Number(amount) + 0.01 ? 'var(--color-danger)' : 'var(--text-secondary)',
                }}
              >
                {customSplitTotal > Number(amount) + 0.01 ? (
                  <span>⚠ Others' shares ({fmtCurrency(customSplitTotal)}) exceed the total — reduce amounts</span>
                ) : (
                  <span>
                    Others owe: <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{fmtCurrency(customSplitTotal)}</span>
                    {' · '}
                    Your share: <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{fmtCurrency(Math.max(0, customRemainingForSelf))}</span>
                  </span>
                )}
              </div>
            )}

            {splitType === 'equal' && selectedUsers.length > 0 && equalSharePerPerson && (
              <div
                className="text-xs p-2.5 rounded-lg"
                style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
              >
                Each person pays {fmtCurrency(equalSharePerPerson)} · {selectedUsers.length + 1} people total
              </div>
            )}

            {formError && (
              <div
                className="text-xs p-2.5 rounded-lg flex items-start gap-2"
                style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', color: 'var(--color-danger)' }}
              >
                ⚠ {formError}
              </div>
            )}

            {submitSuccess && (
              <div
                className="text-xs p-2.5 rounded-lg flex items-center gap-2 flash-success"
                style={{ border: '1px solid rgba(52,211,153,0.25)', color: 'var(--color-success)' }}
              >
                <CheckCircle2 size={13} /> Request submitted! Awaiting admin approval.
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full mt-2"
              loading={loading}
              disabled={loading || selectedUsers.length === 0}
            >
              Submit for Approval
            </Button>
          </form>
        </Card>

        <div className="space-y-4">
          {/* Recent Activity */}
          <div className="mt-2">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ArrowUpRight size={15} style={{ color: 'var(--text-muted)' }} />
                <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Recent Activity</h2>
              </div>
              <button
                onClick={() => navigate('/client/ledger')}
                className="text-xs flex items-center gap-1 transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                Full ledger <ChevronRight size={12} />
              </button>
            </div>

            <div className="space-y-2">
              {expenses.slice(0, 5).map(exp => {
                const isPayer = exp.payer._id === user?._id;
                const mySplit = exp.splits?.find((s: any) => s.user?._id === user?._id);
                const myAmount = isPayer ? exp.amount : mySplit?.amountOwed;
                return (
                  <div
                    key={exp._id}
                    className="flex items-center justify-between p-3 rounded-lg"
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
                  >
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{exp.description}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {isPayer ? 'You paid' : `Charged by ${exp.payer.username}`}
                        {' · '}
                        {new Date(exp.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                    <span
                      className="text-sm font-semibold"
                      style={{ color: isPayer ? 'var(--color-success)' : 'var(--color-danger)' }}
                    >
                      {isPayer ? '+' : '-'}{fmtCurrency(myAmount || 0)}
                    </span>
                  </div>
                );
              })}
              {expenses.length === 0 && (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No activity yet.</p>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ClientDashboard;

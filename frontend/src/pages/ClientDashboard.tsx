import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { NotificationDropdown } from '../components/ui/NotificationDropdown';
import { SkeletonStats, SkeletonRow } from '../components/ui/Skeleton';
import AnimatedNumber from '../components/ui/AnimatedNumber';
import api from '../utils/api';

// ─── Types ────────────────────────────────────
interface User { _id: string; username: string; }
interface SplitEntry { user: string; amountOwed: number; }

// ─── Helpers ──────────────────────────────────
const fmtCurrency = (n: number) => `₹${n.toFixed(2)}`;

const ClientDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // existing data
  const [expenses, setExpenses] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [requests, setRequests] = useState<any[]>([]);

  // form state
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
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
      const [expRes, settRes, usersRes, reqRes] = await Promise.allSettled([
        api.get('/expenses'),
        api.get('/settlements'),
        api.get('/auth/peers'),
        api.get('/expense-requests'),
      ]);

      if (expRes.status === 'fulfilled')   setExpenses(expRes.value.data);
      if (settRes.status === 'fulfilled')  setSettlements(settRes.value.data);
      if (usersRes.status === 'fulfilled') {
        setAllUsers(usersRes.value.data.filter((u: any) => u._id !== user?._id));
      }
      if (reqRes.status === 'fulfilled')   setRequests(reqRes.value.data);
    } catch (error) {
      console.error('Failed to fetch data', error);
    } finally {
      setDataLoading(false);
    }
  }, [user?._id]);

  useEffect(() => { 
    fetchData(true);
    const interval = setInterval(() => fetchData(false), 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // ─── Split calculations ─────────────────────
  const buildSplits = (): SplitEntry[] => {
    if (selectedUsers.length === 0) return [];
    const total = Number(amount) || 0;

    if (splitType === 'equal') {
      // Include self + selected users
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

  const equalSharePerPerson = selectedUsers.length > 0 && amount
    ? Number(amount) / (selectedUsers.length + 1)
    : null;

  const customSplitTotal = selectedUsers.reduce((acc, uid) => acc + (parseFloat(customAmounts[uid] || '0')), 0);
  const customRemainingForSelf = Number(amount) - customSplitTotal;

  // ─── Submit ─────────────────────────────────
  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSubmitSuccess(false);

    if (selectedUsers.length === 0) {
      setFormError('Select at least one person to split with.');
      return;
    }

    const splits = buildSplits();
    const total = Number(amount);


    if (splitType === 'custom') {
      const othersTotal = splits.reduce((a, s) => a + s.amountOwed, 0);
      // Only block if others' shares EXCEED the total; remainder is payer's own share
      if (othersTotal > total + 0.01) {
        setFormError(`Others' shares (₹${othersTotal.toFixed(2)}) exceed the total (₹${total.toFixed(2)}). Reduce the amounts.`);
        return;
      }
      if (othersTotal < 0.01) {
        setFormError('Enter at least ₹0.01 for each participant.');
        return;
      }
    }


    setLoading(true);
    try {
      await api.post('/expense-requests', {
        description,
        amount: total,
        splitType,
        splits,
      });
      // Reset form
      setDescription('');
      setAmount('');
      setSplitType('equal');
      setSelectedUsers([]);
      setCustomAmounts({});
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 4000);
      fetchData();
    } catch (error: any) {
      setFormError(error?.response?.data?.message || 'Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  // ─── Toggle participant ─────────────────────
  const toggleUser = (uid: string) => {
    setSelectedUsers(prev =>
      prev.includes(uid) ? prev.filter(u => u !== uid) : [...prev, uid]
    );
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
  const pendingRequestsCount = requests.filter(r => r.status === 'pending').length;

  return (
    <div className="p-4 md:p-6 space-y-6 w-full page-enter">
      <header className="flex justify-between items-center pb-4 border-b border-zinc-800">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Dashboard</h1>
          <p className="text-sm text-zinc-400 mt-1">{user?.username}</p>
        </div>
        <div className="flex items-center gap-3">
          <NotificationDropdown />
          <Button variant="ghost" size="sm" onClick={logout}>Sign Out</Button>
        </div>
      </header>

      {/* Summary Cards */}
      {dataLoading ? <SkeletonStats count={4} /> : (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div onClick={() => navigate('/client/paid')} className="cursor-pointer group">
          <Card className="hover:border-zinc-600 transition-colors">
            <p className="text-xs text-zinc-400 mb-1">I Paid</p>
            <p className="text-2xl font-semibold text-zinc-100">
              <AnimatedNumber value={totalIPaid} prefix="₹" />
            </p>
            <p className="text-[11px] text-zinc-500 mt-2 group-hover:text-zinc-300 transition-colors">{iPaidCount} transactions →</p>
          </Card>
        </div>

        <div onClick={() => navigate('/client/charged')} className="cursor-pointer group">
          <Card className="hover:border-zinc-600 transition-colors">
            <p className="text-xs text-zinc-400 mb-1">I Was Charged</p>
            <p className="text-2xl font-semibold text-zinc-100">
              <AnimatedNumber value={totalIWasCharged} prefix="₹" />
            </p>
            <p className="text-[11px] text-zinc-500 mt-2 group-hover:text-zinc-300 transition-colors">{chargedCount} transactions →</p>
          </Card>
        </div>

        <div onClick={() => navigate('/client/balances')} className="cursor-pointer group">
          <Card className="hover:border-zinc-600 transition-colors">
            <p className="text-xs text-zinc-400 mb-1">Others Owe Me</p>
            <p className="text-2xl font-semibold text-emerald-400">
              <AnimatedNumber value={owedToYouTotal} prefix="₹" />
            </p>
            <p className="text-[11px] text-zinc-500 mt-2 group-hover:text-zinc-300 transition-colors">View balances →</p>
          </Card>
        </div>

        <div onClick={() => navigate('/client/balances')} className="cursor-pointer group">
          <Card className="hover:border-zinc-600 transition-colors">
            <p className="text-xs text-zinc-400 mb-1">I Owe Others</p>
            <p className="text-2xl font-semibold text-red-400">
              <AnimatedNumber value={youOweTotal} prefix="₹" />
            </p>
            <p className="text-[11px] text-zinc-500 mt-2 group-hover:text-zinc-300 transition-colors">View balances →</p>
          </Card>
        </div>
      </div>
      )}

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        {/* ── Request Expense Form ─────────────── */}
        <Card>
          <h2 className="text-base font-medium mb-4">Request an Expense</h2>
          <p className="text-xs text-zinc-500 mb-4 leading-relaxed">
            Submit an expense for admin approval. Once approved, it will affect everyone's balances.
          </p>
          <form onSubmit={handleSubmitRequest} className="space-y-4">
            <Input
              label="Description"
              placeholder="e.g. Team lunch, Office supplies"
              value={description}
              onChange={e => setDescription(e.target.value)}
              required
            />
            <Input
              label="Total Amount (₹)"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              required
            />

            {/* Split Type Toggle */}
            <div>
              <label className="block text-xs text-zinc-400 mb-2">Split Type</label>
              <div className="flex rounded-lg overflow-hidden border border-zinc-700 w-fit">
                {(['equal', 'custom'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSplitType(t)}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      splitType === t
                        ? 'bg-zinc-100 text-zinc-900'
                        : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {t === 'equal' ? '⚖ Equal' : '✏ Custom'}
                  </button>
                ))}
              </div>
            </div>

            {/* Participants */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-zinc-400">
                  Split with <span className="text-zinc-500">(select others)</span>
                </label>
                {allUsers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedUsers.length === allUsers.length) {
                        // Deselect all
                        setSelectedUsers([]);
                        setCustomAmounts({});
                      } else {
                        // Select all
                        setSelectedUsers(allUsers.map(u => u._id));
                      }
                    }}
                    className="text-[11px] font-medium text-zinc-400 hover:text-zinc-100 transition-colors underline underline-offset-2"
                  >
                    {selectedUsers.length === allUsers.length ? 'Deselect All' : 'Select All'}
                  </button>
                )}
              </div>
              {allUsers.length === 0 ? (
                <p className="text-xs text-zinc-600 italic">No other users available.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {allUsers.map(u => {
                    const isSelected = selectedUsers.includes(u._id);
                    return (
                      <div key={u._id} className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => toggleUser(u._id)}
                          className={`flex-1 flex items-center gap-2 p-2.5 rounded-lg border text-left transition-all ${
                            isSelected
                              ? 'border-zinc-400 bg-zinc-800'
                              : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                            isSelected ? 'bg-zinc-100 border-zinc-100' : 'border-zinc-600'
                          }`}>
                            {isSelected && <span className="text-zinc-900 text-[10px] leading-none">✓</span>}
                          </div>
                          <span className="text-sm text-zinc-200">{u.username}</span>

                          {/* Equal share preview */}
                          {isSelected && splitType === 'equal' && equalSharePerPerson && (
                            <span className="ml-auto text-[11px] text-zinc-400">{fmtCurrency(equalSharePerPerson)}</span>
                          )}
                        </button>

                        {/* Custom amount input */}
                        {isSelected && splitType === 'custom' && (
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="₹ amount"
                            value={customAmounts[u._id] || ''}
                            onChange={e => setCustomAmounts(prev => ({ ...prev, [u._id]: e.target.value }))}
                            className="w-28 px-2 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-zinc-400"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Custom split summary */}
            {splitType === 'custom' && selectedUsers.length > 0 && amount && (
              <div className={`text-xs p-2.5 rounded-lg border ${
                customSplitTotal > Number(amount) + 0.01
                  ? 'bg-red-900/20 border-red-900/40 text-red-400'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-400'
              }`}>
                {customSplitTotal > Number(amount) + 0.01 ? (
                  <span>⚠ Others' shares ({fmtCurrency(customSplitTotal)}) exceed the total — reduce amounts</span>
                ) : (
                  <span>
                    Others owe: <span className="text-zinc-200 font-medium">{fmtCurrency(customSplitTotal)}</span>
                    {' · '}
                    Your share: <span className="text-zinc-200 font-medium">{fmtCurrency(Math.max(0, customRemainingForSelf))}</span>
                  </span>
                )}
              </div>
            )}


            {/* Equal split summary */}
            {splitType === 'equal' && selectedUsers.length > 0 && equalSharePerPerson && (
              <div className="text-xs p-2.5 rounded-lg border bg-zinc-800 border-zinc-700 text-zinc-400">
                Each person pays {fmtCurrency(equalSharePerPerson)} · {selectedUsers.length + 1} people total
              </div>
            )}

            {formError && (
              <div className="text-xs text-red-400 p-2.5 bg-red-900/20 rounded-lg border border-red-900/40">
                {formError}
              </div>
            )}

            {submitSuccess && (
              <div className="text-xs text-emerald-400 p-2.5 bg-emerald-900/20 rounded-lg border border-emerald-900/40 flex items-center gap-2">
                <span>✓</span> Request submitted! Awaiting admin approval.
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading || selectedUsers.length === 0}>
              {loading ? 'Submitting…' : 'Submit for Approval'}
            </Button>
          </form>
        </Card>

        {/* ── My Requests ─────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-medium">My Requests</h2>
            <button
              onClick={() => navigate('/client/requests')}
              className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              View all →
            </button>
          </div>

          {pendingRequestsCount > 0 && (
            <div
              onClick={() => navigate('/client/requests')}
              className="cursor-pointer flex items-center gap-3 p-3 rounded-lg bg-amber-400/10 border border-amber-400/30 hover:bg-amber-400/15 transition-colors"
            >
              <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
              <p className="text-sm text-amber-300 font-medium">
                {pendingRequestsCount} request{pendingRequestsCount > 1 ? 's' : ''} awaiting admin approval
              </p>
            </div>
          )}

          <div className="space-y-2">
            {requests.slice(0, 4).map(req => {
              const statusColors: Record<string, string> = {
                pending: 'text-amber-400',
                approved: 'text-emerald-400',
                rejected: 'text-red-400',
              };
              return (
                <div
                  key={req._id}
                  onClick={() => navigate('/client/requests')}
                  className="flex items-center justify-between p-3 bg-zinc-900 rounded-lg border border-zinc-800 cursor-pointer hover:border-zinc-600 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-100">{req.description}</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      {new Date(req.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      {' · '}
                      <span className={statusColors[req.status]}>
                        {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                      </span>
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-zinc-100">{fmtCurrency(req.amount)}</span>
                </div>
              );
            })}
            {requests.length === 0 && (
              <p className="text-zinc-500 text-sm">No requests submitted yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="text-base font-medium mb-3">Recent Activity</h2>
        <div className="space-y-2">
          {expenses.slice(0, 5).map(exp => {
            const isPayer = exp.payer._id === user?._id;
            const mySplit = exp.splits?.find((s: any) => s.user?._id === user?._id);
            const myAmount = isPayer ? exp.amount : mySplit?.amountOwed;
            return (
              <div key={exp._id} className="flex items-center justify-between p-3 bg-zinc-900 rounded-lg border border-zinc-800">
                <div>
                  <p className="text-sm font-medium text-zinc-100">{exp.description}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {isPayer ? 'You paid' : `Charged by ${exp.payer.username}`}
                    {' · '}
                    {new Date(exp.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
                <span className={`text-sm font-semibold ${isPayer ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isPayer ? '+' : '-'}{fmtCurrency(myAmount || 0)}
                </span>
              </div>
            );
          })}
          {expenses.length === 0 && <p className="text-zinc-500 text-sm">No activity yet.</p>}
        </div>
      </div>
    </div>
  );
};

export default ClientDashboard;

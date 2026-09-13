import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { SkeletonStats, SkeletonRow } from '../components/ui/Skeleton';
import api from '../utils/api';

const AdminUserDetail = () => {
  const { id } = useParams();
  const [users, setUsers] = useState<any[]>([]);
  const [targetUser, setTargetUser] = useState<any>(null);
  
  // Expense Form
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  
  // Split Logic
  const [splitMode, setSplitMode] = useState<'equal' | 'custom'>('equal');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [customSplits, setCustomSplits] = useState<Record<string, number>>({});
  
  const [loading, setLoading] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [balances, setBalances] = useState<any[]>([]); 
  const [expenses, setExpenses] = useState<any[]>([]);

  // Reset Password Modal
  const [showResetModal, setShowResetModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState('');
  const [resetError, setResetError] = useState('');
  const [reset_otp, setResetOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  // Status toggle
  const [statusLoading, setStatusLoading] = useState(false);

  const fetchData = async () => {
    try {
      const [usersRes, expRes, settRes] = await Promise.all([
        api.get('/auth/users'),
        api.get('/expenses'),
        api.get('/settlements')
      ]);
      
      const allUsers = usersRes.data;
      setUsers(allUsers);
      setTargetUser(allUsers.find((u: any) => u._id === id));
      
      const calcBalances: any = {};
      allUsers.forEach((u: any) => {
        if (u._id !== id && u.role !== 'admin') {
          calcBalances[u._id] = { user: u, amountOwedToTarget: 0, amountTargetOwes: 0 };
        }
      });

      expRes.data.forEach((exp: any) => {
        if (exp.payer._id === id) {
          exp.splits.forEach((split: any) => {
            if (split.user._id !== id && calcBalances[split.user._id]) {
              calcBalances[split.user._id].amountOwedToTarget += split.amountOwed;
            }
          });
        } else if (exp.splits.some((s: any) => s.user._id === id)) {
          const targetSplit = exp.splits.find((s: any) => s.user._id === id);
          if (targetSplit && calcBalances[exp.payer._id]) {
            calcBalances[exp.payer._id].amountTargetOwes += targetSplit.amountOwed;
          }
        }
      });

      settRes.data.forEach((sett: any) => {
        if (sett.payer._id === id && calcBalances[sett.receiver._id]) {
          calcBalances[sett.receiver._id].amountTargetOwes -= sett.amount;
        } else if (sett.receiver._id === id && calcBalances[sett.payer._id]) {
          calcBalances[sett.payer._id].amountOwedToTarget -= sett.amount;
        }
      });

      setBalances(Object.values(calcBalances));
      setExpenses(expRes.data);
      
    } catch (error) {
      console.error('Failed to fetch data', error);
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const numAmount = Number(amount);
      let splits = [];
      
      if (splitMode === 'equal') {
        const activeUsers = selectedUsers.length > 0 ? selectedUsers : [id!];
        const splitAmount = numAmount / activeUsers.length;
        splits = activeUsers.map(uid => ({ user: uid, amountOwed: splitAmount }));
      } else {
        splits = Object.entries(customSplits).map(([uid, amt]) => ({ user: uid, amountOwed: Number(amt) }));
      }

      await api.post('/expenses', {
        description,
        amount: numAmount,
        payer: id,
        splits
      });
      
      setDescription('');
      setAmount('');
      setSelectedUsers([]);
      setCustomSplits({});
      fetchData();
    } catch (error) {
      console.error('Error adding expense', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleUserSelection = (uid: string) => {
    if (selectedUsers.includes(uid)) {
      setSelectedUsers(selectedUsers.filter(u => u !== uid));
    } else {
      setSelectedUsers([...selectedUsers, uid]);
    }
  };

  const handleCustomSplitChange = (uid: string, val: string) => {
    setCustomSplits({ ...customSplits, [uid]: Number(val) });
  };

  const markSettlement = async (payerId: string, receiverId: string, amt: number, otherUserId: string, description: string) => {

    setResolvingId(otherUserId);
    try {
      await api.post('/settlements', { payer: payerId, receiver: receiverId, amount: amt, description });
      await fetchData();
    } catch (err) {
      console.error('Error marking settlement', err);
    } finally {
      setResolvingId(null);
    }
  };

  const otp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResetError('');
    try {
      await api.post(`/auth/reset-password-otp/${targetUser.email}`, {});
      setOtpSent(true);
    } catch (error: any) {
      setResetError(error?.response?.data?.message || 'Failed to send OTP. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    setResetSuccess('');
    if (newPassword !== confirmPassword) {
      setResetError('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      setResetError('Password must be at least 6 characters');
      return;
    }
    setResetLoading(true);
    try {
      await api.put(`/auth/reset-password/${id}`, { newPassword, otp: reset_otp, email: targetUser.email });
      setResetSuccess('Password has been reset successfully.');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setShowResetModal(false);
        setResetSuccess('');
      }, 1500);
    } catch (err: any) {
      setResetError(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setResetLoading(false);
    }
  };

  const handleToggleStatus = async () => {
    setStatusLoading(true);
    try {
      const res = await api.patch(`/auth/users/${id}/status`);
      // Update targetUser directly from the API response — no full refetch needed
      setTargetUser((prev: any) => ({ ...prev, isActive: res.data.isActive }));
    } catch (err) {
      console.error('Failed to toggle status', err);
    } finally {
      setStatusLoading(false);
    }
  };

  if (dataLoading) return (
    <div className="p-4 md:p-6 space-y-6 w-full">
      <div className="h-8 w-40 bg-zinc-800 rounded animate-pulse" />
      <SkeletonStats count={3} />
      <div className="space-y-3">
        {[1,2,3].map(i => <SkeletonRow key={i} />)}
      </div>
    </div>
  );

  const clients = users.filter(u => u.role !== 'admin' && u.isActive !== false);

  return (
    <div className="p-4 md:p-6 space-y-6 w-full page-enter">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>{targetUser.username}</h1>
            {targetUser.isActive === false && (
              <span className="px-2 py-0.5 text-xs font-medium bg-red-950/40 text-red-400 border border-red-900/60 rounded-full">Deactivated</span>
            )}
          </div>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Client Ledger &amp; Management</p>
        </div>
        <div className="flex gap-2">
          <Button variant={targetUser.isActive === false ? 'primary' : 'danger'} size="sm" onClick={handleToggleStatus} loading={statusLoading}>
            {targetUser.isActive === false ? 'Reactivate' : 'Deactivate'}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => { setShowResetModal(true); setResetError(''); setResetSuccess(''); setOtpSent(false); setResetOtp(''); setNewPassword(''); setConfirmPassword(''); }}>
            Reset Password
          </Button>
        </div>
      </div>

      {/* Reset Password Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">

            {/* Modal Header */}
            <div className="flex justify-between items-center px-6 py-5 border-b border-zinc-800">
              <div>
                <h2 className="text-base font-semibold text-zinc-100">Reset Password</h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Account: <span className="text-zinc-300 font-medium">{targetUser.username}</span>
                  <span className="mx-1.5 text-zinc-700">·</span>
                  <span className="text-zinc-400">{targetUser.email}</span>
                </p>
              </div>
              <button
                onClick={() => setShowResetModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-all text-lg leading-none"
              >
                ×
              </button>
            </div>

            {/* Step indicator */}
            <div className="flex border-b border-zinc-800">
              <div className={`flex-1 py-2.5 text-center text-xs font-medium transition-colors ${!otpSent ? 'text-white border-b-2 border-[var(--accent)]' : 'text-zinc-500'}`}>
                1 · Send OTP
              </div>
              <div className={`flex-1 py-2.5 text-center text-xs font-medium transition-colors ${otpSent ? 'text-white border-b-2 border-[var(--accent)]' : 'text-zinc-500'}`}>
                2 · Set Password
              </div>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Alerts */}
              {resetError && (
                <div className="flex items-start gap-2.5 p-3 bg-red-950/40 border border-red-900/60 rounded-xl text-red-300 text-sm">
                  <span className="shrink-0 mt-0.5">⚠</span>
                  <span>{resetError}</span>
                </div>
              )}
              {resetSuccess && (
                <div className="flex items-start gap-2.5 p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-emerald-300 text-sm">
                  <span className="shrink-0 mt-0.5">✓</span>
                  <span>{resetSuccess}</span>
                </div>
              )}

              {/* Step 1: Send OTP */}
              {!otpSent ? (
                <div className="space-y-4">
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    An OTP will be sent to <span className="text-zinc-200 font-medium">{targetUser.email}</span>. Ask the client to check their inbox.
                  </p>
                  <form onSubmit={otp} className="flex gap-3">
                    <Button type="submit" loading={loading} className="flex-1" variant="primary">
                      Send OTP to Client
                    </Button>
                    <Button type="button" variant="ghost" className="flex-1" onClick={() => setShowResetModal(false)}>
                      Cancel
                    </Button>
                  </form>
                </div>
              ) : (
                /* Step 2: Enter OTP + new password */
                <form onSubmit={handleResetPassword} className="space-y-3">
                  <Input
                    label="OTP (from client's email)"
                    type="text"
                    placeholder="Enter 6-digit OTP"
                    value={reset_otp}
                    onChange={(e) => setResetOtp(e.target.value)}
                    required
                  />
                  <Input
                    label="New Password"
                    type="password"
                    placeholder="Min. 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                  <Input
                    label="Confirm Password"
                    type="password"
                    placeholder="Repeat new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                  <div className="flex gap-3 pt-2">
                    <Button type="button" variant="ghost" className="flex-1" onClick={() => { setOtpSent(false); setResetError(''); }}>
                      ← Back
                    </Button>
                    <Button type="submit" className="flex-1" loading={resetLoading}>
                      {resetLoading ? 'Resetting…' : 'Reset Password'}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        <Card>
          <h2 className="text-lg font-medium mb-4">Record Expense</h2>
          <form onSubmit={handleAddExpense} className="space-y-4">
            <Input 
              label="Description" 
              placeholder="e.g. Flight Tickets"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
            <Input 
              label="Amount" 
              type="number"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />

            <div className="p-4 bg-zinc-950 rounded-md border border-zinc-800">
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm font-medium text-zinc-400">Split Method</span>
                <div className="flex bg-zinc-900 rounded-md p-1 border border-zinc-800">
                  <button type="button" onClick={() => setSplitMode('equal')} className={`px-3 py-1 text-xs rounded-sm transition-colors ${splitMode === 'equal' ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-400 hover:text-zinc-100'}`}>Equal</button>
                  <button type="button" onClick={() => setSplitMode('custom')} className={`px-3 py-1 text-xs rounded-sm transition-colors ${splitMode === 'custom' ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-400 hover:text-zinc-100'}`}>Custom</button>
                </div>
              </div>

              {splitMode === 'equal' ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-zinc-500">Select involved parties:</p>
                    <button
                      type="button"
                      onClick={() =>
                        selectedUsers.length === clients.length
                          ? setSelectedUsers([])
                          : setSelectedUsers(clients.map((c: any) => c._id))
                      }
                      className="text-xs text-zinc-400 hover:text-zinc-100 border border-zinc-700 hover:border-zinc-500 px-2 py-0.5 rounded transition-colors"
                    >
                      {selectedUsers.length === clients.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {clients.map(c => (
                      <button
                        key={c._id}
                        type="button"
                        onClick={() => toggleUserSelection(c._id)}
                        className={`px-3 py-1.5 rounded-md text-xs transition-colors border ${selectedUsers.includes(c._id) ? 'bg-zinc-100 border-zinc-100 text-zinc-900' : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}
                      >
                        {c.username}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-zinc-500 mb-2">Allocate amounts:</p>
                  {clients.map(c => (
                    <div key={c._id} className="flex items-center gap-3">
                      <span className="text-sm text-zinc-300 w-24 truncate">{c.username}</span>
                      <Input 
                        type="number" 
                        step="0.01" 
                        placeholder="0.00" 
                        className="!py-1"
                        value={customSplits[c._id] || ''}
                        onChange={(e) => handleCustomSplitChange(c._id, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              Commit Expense
            </Button>
          </form>
        </Card>

        <Card>
          <h2 className="text-lg font-medium mb-4">Outstanding Balances</h2>
          <div className="space-y-4">
            {balances.length === 0 && <p className="text-zinc-500 text-sm">No balances to resolve.</p>}
            
            {balances.map((bal, idx) => {
              const netAmount = bal.amountOwedToTarget - bal.amountTargetOwes;
              const owesTarget = netAmount > 0;
              const absAmount = Math.abs(netAmount).toFixed(2);

              return (
                <div key={idx} className="p-4 bg-zinc-950 rounded-md border border-zinc-800 flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-medium text-zinc-200">{bal.user.username}</h3>
                    {Math.abs(netAmount) < 0.01 ? (
                      <p className="text-xs mt-1 text-zinc-500">Settled (₹0.00)</p>
                    ) : (
                      <p className={`text-xs mt-1 ${owesTarget ? 'text-zinc-400' : 'text-red-400'}`}>
                        {owesTarget ? `Owes ${targetUser.username} ₹${absAmount}` : `${targetUser.username} owes them ₹${absAmount}`}
                      </p>
                    )}
                  </div>
                  
                  {Math.abs(netAmount) >= 0.01 && (
                    <Button 
                      size="sm" 
                      variant={owesTarget ? 'secondary' : 'danger'}
                      disabled={resolvingId === bal.user._id}
                      onClick={() => {
                        if (owesTarget) {
                          markSettlement(bal.user._id, targetUser._id, netAmount, bal.user._id, `Settled outstanding balance: ${bal.user.username} paid ${targetUser.username} ₹${absAmount}`);
                        } else {
                          markSettlement(targetUser._id, bal.user._id, Math.abs(netAmount), bal.user._id, `Settled outstanding balance: ${targetUser.username} paid ${bal.user.username} ₹${absAmount}`);
                        }
                      }}
                    >
                      {resolvingId === bal.user._id ? 'Resolving...' : 'Resolve'}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Expenses This User Paid For */}
        <Card>
          <h2 className="text-base font-medium mb-1">{targetUser.username} Paid</h2>
          <p className="text-xs text-zinc-500 mb-4">Bills this user paid upfront</p>
          <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
            {(() => {
              const paid = expenses.filter((e: any) => e.payer._id === id);
              if (paid.length === 0) return <p className="text-zinc-500 text-sm">No payments recorded.</p>;
              return paid.map((exp: any) => (
                <div key={exp._id} className="p-3 bg-zinc-950 rounded-lg border border-zinc-800">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-sm font-medium text-zinc-100">{exp.description}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">{new Date(exp.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </div>
                    <p className="text-sm font-semibold text-emerald-400">₹{exp.amount.toFixed(2)}</p>
                  </div>
                  {exp.splits?.filter((s: any) => s.user?._id !== id).length > 0 && (
                    <div className="border-t border-zinc-800 pt-2 space-y-1">
                      <p className="text-[10px] text-zinc-600 uppercase tracking-widest">Others owe them</p>
                      {exp.splits.filter((s: any) => s.user?._id !== id).map((s: any, i: number) => (
                        <div key={i} className="flex justify-between text-xs">
                          <span className="text-zinc-400">{s.user?.username}</span>
                          <span className="text-emerald-500">₹{s.amountOwed.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ));
            })()}
          </div>
        </Card>

        {/* Expenses This User Was Charged For */}
        <Card>
          <h2 className="text-base font-medium mb-1">{targetUser.username} Was Charged</h2>
          <p className="text-xs text-zinc-500 mb-4">Bills where they owe someone else</p>
          <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
            {(() => {
              const charged = expenses.filter((e: any) => e.payer._id !== id && e.splits?.some((s: any) => s.user?._id === id));
              if (charged.length === 0) return <p className="text-zinc-500 text-sm">No charges recorded.</p>;
              return charged.map((exp: any) => {
                const theirSplit = exp.splits?.find((s: any) => s.user?._id === id);
                return (
                  <div key={exp._id} className="p-3 bg-zinc-950 rounded-lg border border-zinc-800">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="text-sm font-medium text-zinc-100">{exp.description}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          Paid by <span className="text-zinc-300">{exp.payer?.username}</span> · {new Date(exp.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-red-400">₹{theirSplit?.amountOwed.toFixed(2)}</p>
                        <p className="text-[10px] text-red-500">their share</p>
                      </div>
                    </div>
                    <div className="border-t border-zinc-800 pt-2">
                      <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">Bill total: ₹{exp.amount.toFixed(2)}</p>
                      <div className="space-y-1">
                        {exp.splits?.map((s: any, i: number) => (
                          <div key={i} className="flex justify-between text-xs">
                            <span className={s.user?._id === id ? 'text-zinc-100 font-medium' : 'text-zinc-500'}>{s.user?._id === id ? targetUser.username : s.user?.username}</span>
                            <span className={s.user?._id === id ? 'text-red-400 font-medium' : 'text-zinc-500'}>₹{s.amountOwed.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AdminUserDetail;

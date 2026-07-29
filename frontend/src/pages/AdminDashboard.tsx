import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import api from '../utils/api';
import { useNavigate } from 'react-router-dom';
import { NotificationDropdown } from '../components/ui/NotificationDropdown';
import { SkeletonStats, SkeletonRow } from '../components/ui/Skeleton';
import AnimatedNumber from '../components/ui/AnimatedNumber';

// ─── Types ────────────────────────────────────
type RequestStatus = 'pending' | 'approved' | 'rejected';

const AdminDashboard = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [reqFilter, setReqFilter] = useState<'pending' | 'all'>('pending');

  const [newUsername, setNewUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [newEmail, setNewEmail] = useState('');

  // Per-request action state
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});
  const [rejectOpen, setRejectOpen] = useState<string | null>(null);

  const fetchData = useCallback(async (showSkeleton = false) => {
    if (showSkeleton) setDataLoading(true);
    try {
      const [usersRes, expRes, reqRes] = await Promise.all([
        api.get('/auth/users'),
        api.get('/expenses'),
        api.get('/expense-requests'),
      ]);
      setUsers(usersRes.data.filter((u: any) => u.role !== 'admin'));
      setExpenses(expRes.data);
      setRequests(reqRes.data);
    } catch (error) {
      console.error('Failed to fetch admin data', error);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => { 
    fetchData(true); // show skeleton on first load
    const interval = setInterval(() => fetchData(false), 10000); // silent refresh
    return () => clearInterval(interval);
  }, [fetchData]);

  // ─── Create client ───────────────────────────
  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/register', { username: newUsername, email: newEmail });
      setNewUsername('');
      setNewEmail('');
      fetchData();
    } catch (error) {
      console.error('Failed to create client', error);
    } finally {
      setLoading(false);
    }
  };

  // ─── Approve request ─────────────────────────
  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      await api.put(`/expense-requests/${id}/approve`);
      fetchData();
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Approval failed');
    } finally {
      setActionLoading(null);
    }
  };

  // ─── Reject request ──────────────────────────
  const handleReject = async (id: string) => {
    setActionLoading(id);
    try {
      await api.put(`/expense-requests/${id}/reject`, {
        adminNote: rejectNotes[id] || 'Rejected by admin',
      });
      setRejectOpen(null);
      setRejectNotes(prev => { const n = { ...prev }; delete n[id]; return n; });
      fetchData();
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Rejection failed');
    } finally {
      setActionLoading(null);
    }
  };

  // ─── Derived ─────────────────────────────────
  const totalSpentGlobal = expenses.reduce((acc, curr) => acc + curr.amount, 0);
  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const displayedRequests = reqFilter === 'pending'
    ? requests.filter(r => r.status === 'pending')
    : requests;

  const statusColors: Record<RequestStatus, string> = {
    pending:  'text-amber-400 bg-amber-400/10 border-amber-400/30',
    approved: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
    rejected: 'text-red-400 bg-red-400/10 border-red-400/30',
  };

  return (
    <div className="p-4 md:p-6 space-y-6 w-full page-enter">
      <header className="flex justify-between items-center pb-6 border-b border-zinc-800">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Admin Console</h1>
          <p className="text-sm text-zinc-400 mt-1">System Overview</p>
        </div>
        <div className="flex items-center gap-3">
          <NotificationDropdown />
          <Button variant="ghost" size="sm" onClick={logout}>Sign Out</Button>
        </div>
      </header>

      {/* ── Stats Row ─────────────────────────── */}
      {dataLoading ? <SkeletonStats count={3} /> : (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card>
          <p className="text-sm font-medium text-zinc-400 mb-1">Global Volume</p>
          <p className="text-3xl font-semibold text-zinc-100">
            <AnimatedNumber value={totalSpentGlobal} prefix="₹" />
          </p>
        </Card>
        <Card>
          <p className="text-sm font-medium text-zinc-400 mb-1">Active Clients</p>
          <p className="text-3xl font-semibold text-zinc-100">{users.length}</p>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <p className="text-sm font-medium text-zinc-400 mb-1">Pending Requests</p>
          <div className="flex items-center gap-3">
            <p className="text-3xl font-semibold text-amber-400">
              <AnimatedNumber value={pendingCount} decimals={0} duration={600} />
            </p>
            {pendingCount > 0 && (
              <span className="w-2.5 h-2.5 bg-amber-400 rounded-full animate-pulse" />
            )}
          </div>
        </Card>
      </div>
      )}

      {/* ── Pending Requests Panel ─────────────── */}
      <Card>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-medium">Expense Requests</h2>
            {pendingCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-400 text-xs font-semibold border border-amber-400/30">
                {pendingCount} pending
              </span>
            )}
          </div>
          {/* Filter toggle */}
          <div className="flex rounded-lg overflow-hidden border border-zinc-700">
            {(['pending', 'all'] as const).map(f => (
              <button
                key={f}
                onClick={() => setReqFilter(f)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  reqFilter === f
                    ? 'bg-zinc-100 text-zinc-900'
                    : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {f === 'pending' ? 'Pending' : 'All'}
              </button>
            ))}
          </div>
        </div>

        {dataLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <SkeletonRow key={i} />)}
          </div>
        ) : displayedRequests.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-3xl mb-3">✅</p>
            <p className="text-zinc-400 text-sm">
              {reqFilter === 'pending' ? 'No pending requests — all caught up!' : 'No expense requests yet.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayedRequests.map(req => (
              <div key={req._id} className="p-4 rounded-xl border border-zinc-800 bg-zinc-950 space-y-3">
                {/* Header row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-zinc-100">{req.description}</p>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${statusColors[req.status as RequestStatus]}`}>
                        {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      by <span className="text-zinc-300">{req.requestedBy?.username}</span>
                      {' · '}
                      {new Date(req.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {' · '}
                      {req.splitType === 'equal' ? 'Equal split' : 'Custom split'}
                    </p>
                  </div>
                  <p className="text-lg font-bold text-zinc-100 shrink-0">₹{req.amount.toFixed(2)}</p>
                </div>

                {/* Split breakdown */}
                {req.splits && req.splits.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {req.splits.map((s: any, idx: number) => (
                      <span key={idx} className="text-[11px] bg-zinc-800 px-2 py-1 rounded-md text-zinc-400">
                        {s.user?.username}: <span className="text-zinc-200 font-medium">₹{s.amountOwed.toFixed(2)}</span>
                      </span>
                    ))}
                  </div>
                )}

                {/* Admin note (if already actioned) */}
                {req.adminNote && req.status !== 'pending' && (
                  <div className={`p-2.5 rounded-lg border text-xs ${
                    req.status === 'rejected'
                      ? 'bg-red-900/20 border-red-900/40 text-red-300'
                      : 'bg-emerald-900/20 border-emerald-900/40 text-emerald-300'
                  }`}>
                    <span className="font-medium">Note: </span>{req.adminNote}
                  </div>
                )}

                {/* Action buttons — only for pending */}
                {req.status === 'pending' && (
                  <div className="space-y-2">
                    {rejectOpen === req._id ? (
                      <div className="flex gap-2">
                        <input
                          autoFocus
                          type="text"
                          placeholder="Rejection reason (optional)"
                          value={rejectNotes[req._id] || ''}
                          onChange={e => setRejectNotes(prev => ({ ...prev, [req._id]: e.target.value }))}
                          className="flex-1 px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-zinc-400 placeholder-zinc-600"
                        />
                        <Button
                          size="sm"
                          onClick={() => handleReject(req._id)}
                          disabled={actionLoading === req._id}
                          className="bg-red-600 hover:bg-red-500 text-white border-0 shrink-0"
                        >
                          {actionLoading === req._id ? '…' : 'Reject'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setRejectOpen(null)}
                          className="shrink-0"
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setRejectOpen(req._id)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
                        >
                          ✕ Reject
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleApprove(req._id)}
                          disabled={actionLoading === req._id}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white border-0"
                        >
                          {actionLoading === req._id ? 'Approving…' : '✓ Approve'}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── Bottom grid: Provision + Clients + Ledger ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        <div className="md:col-span-1 space-y-6">
          <Card>
            <h2 className="text-lg font-medium mb-4">Provision Account</h2>
            <form onSubmit={handleCreateClient} className="space-y-4">
              <Input
                label='Email'
                placeholder='client@email.com'
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                required
              />
              <Input
                label="Username (optional)"
                placeholder="client_name"
                value={newUsername}
                onChange={e => setNewUsername(e.target.value)}
              />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Creating…' : 'Create Client'}
              </Button>
            </form>
          </Card>
        </div>

        <div className="md:col-span-2 space-y-6">
          <Card>
            <h2 className="text-lg font-medium mb-4">Client Accounts</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {users.map(u => (
                <div
                  key={u._id}
                  className="p-4 bg-zinc-950 border border-zinc-800 hover:border-zinc-600 transition-colors rounded-md flex justify-between items-center cursor-pointer group"
                  onClick={() => navigate(`/admin/user/${u._id}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-zinc-800 rounded-md flex items-center justify-center text-sm font-medium text-zinc-300">
                      {u.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-zinc-100">{u.username}</h3>
                      <p className="text-xs text-zinc-500">Manage account</p>
                    </div>
                  </div>
                  <span className="text-zinc-500 group-hover:text-zinc-300 transition-colors">→</span>
                </div>
              ))}
              {users.length === 0 && (
                <p className="text-zinc-500 text-sm">No clients provisioned.</p>
              )}
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-medium mb-4">System Ledger</h2>
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {expenses.length === 0 ? (
                <p className="text-zinc-500 text-sm">No transactions recorded.</p>
              ) : (
                expenses.map(expense => (
                  <div key={expense._id} className="p-4 bg-zinc-950 rounded-md border border-zinc-800 flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium text-zinc-200">{expense.description}</p>
                      <p className="text-xs text-zinc-500 mt-1">
                        Paid by <span className="text-zinc-300">{expense.payer?.username}</span>
                      </p>
                      {expense.splits && expense.splits.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {expense.splits.map((s: any, idx: number) => (
                            <span key={idx} className="text-[10px] bg-zinc-800 px-2 py-0.5 rounded text-zinc-400">
                              {s.user?.username}: ₹{s.amountOwed.toFixed(2)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="text-sm font-medium text-zinc-100">
                      ₹{expense.amount.toFixed(2)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;

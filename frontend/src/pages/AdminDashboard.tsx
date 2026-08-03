import  { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
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
  const [requests, setRequests] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);

  // Filter / search / pagination state
  const [reqFilter, setReqFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [payerFilter, setPayerFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 5;

  const [dataLoading, setDataLoading] = useState(true);

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
    fetchData(requests.length === 0); // show skeleton only on first visit; silent refresh on back-nav
    const interval = setInterval(() => fetchData(false), 10000); // silent refresh
    return () => clearInterval(interval);
  }, [fetchData]);


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
  const totalSpentGlobal = expenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  const pendingCount = requests.filter(r => r.status === 'pending').length;

  // Unique payers for dropdown
  const uniquePayers = Array.from(
    new Map(requests.map(r => [r.requestedBy?._id, r.requestedBy?.username])).entries()
  ).filter(([id]) => id);

  // Apply all filters
  const filteredRequests = requests.filter(r => {
    if (reqFilter !== 'all' && r.status !== reqFilter) return false;
    if (payerFilter !== 'all' && r.requestedBy?._id !== payerFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        r.description?.toLowerCase().includes(q) ||
        r.requestedBy?.username?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / PAGE_SIZE));
  const paginatedRequests = filteredRequests.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Reset to page 1 when filters change — handled inline via key or effect
  const handleFilterChange = (newFilter: typeof reqFilter) => {
    setReqFilter(newFilter);
    setCurrentPage(1);
  };
  const handlePayerChange = (val: string) => {
    setPayerFilter(val);
    setCurrentPage(1);
  };
  const handleSearch = (val: string) => {
    setSearchQuery(val);
    setCurrentPage(1);
  };

  const statusColors: Record<RequestStatus, string> = {
    pending:  'text-amber-400 bg-amber-400/10 border-amber-400/30',
    approved: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
    rejected: 'text-red-400 bg-red-400/10 border-red-400/30',
  };

  return (
    <div className="p-4 md:p-6 space-y-6 w-full page-enter">
      <header className="flex flex-col md:flex-row md:justify-between md:items-center pb-6 border-b border-zinc-800 gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Admin Console</h1>
          <p className="text-sm text-zinc-400 mt-1">System Overview</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" size="sm" onClick={() => navigate('/admin/clients')}>Client Accounts</Button>
          <Button variant="secondary" size="sm" onClick={() => navigate('/admin/ledger')}>System Ledger</Button>
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
        </div>

        {/* ── Search + Filters ── */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <input
            type="text"
            placeholder="Search by description or requester…"
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
          />
          <select
            value={payerFilter}
            onChange={e => handlePayerChange(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-600 cursor-pointer"
          >
            <option value="all">All Requesters</option>
            {uniquePayers.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </div>

        {/* ── Status Tabs ── */}
        <div className="flex p-1 rounded-xl bg-zinc-900 border border-zinc-800 w-fit gap-1 mb-4">
          {(['pending', 'approved', 'rejected', 'all'] as const).map(f => (
            <button
              key={f}
              onClick={() => handleFilterChange(f)}
              className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all ${
                reqFilter === f
                  ? 'bg-zinc-700 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* ── Results count ── */}
        {!dataLoading && (
          <p className="text-xs text-zinc-500 mb-3">
            Showing {Math.min((currentPage - 1) * PAGE_SIZE + 1, filteredRequests.length || 0)}–{Math.min(currentPage * PAGE_SIZE, filteredRequests.length)} of {filteredRequests.length} requests
          </p>
        )}


        {dataLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <SkeletonRow key={i} />)}
          </div>
        ) : paginatedRequests.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-3xl mb-3">✅</p>
            <p className="text-zinc-400 text-sm">
              {reqFilter === 'pending' ? 'No pending requests — all caught up!' : 'No requests match your filters.'}
            </p>
          </div>
        ) : (
          <>
            {/* Scrollable list */}
            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
              {paginatedRequests.map(req => (
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

            {/* ── Pagination ── */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-zinc-800 mt-4">
                <p className="text-xs text-zinc-500">
                  Page {currentPage} of {totalPages}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost" size="sm" className="px-3"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    ← Prev
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(pg => (
                    <button
                      key={pg}
                      onClick={() => setCurrentPage(pg)}
                      className={`w-7 h-7 rounded-lg text-xs font-medium transition-all ${
                        pg === currentPage
                          ? 'bg-zinc-700 text-white'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                      }`}
                    >
                      {pg}
                    </button>
                  ))}
                  <Button
                    variant="ghost" size="sm" className="px-3"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next →
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

    </div>
  );
};

export default AdminDashboard;

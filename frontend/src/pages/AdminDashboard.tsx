import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import api from '../utils/api';
import { SkeletonStats, SkeletonRow } from '../components/ui/Skeleton';
import AnimatedNumber from '../components/ui/AnimatedNumber';
import { getAvatarColor } from '../components/Shell';
import {
  TrendingUp,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  CircleDot,
  CreditCard,
  AlertTriangle,
} from 'lucide-react';

// ─── Types ────────────────────────────────────
type RequestStatus = 'pending' | 'approved' | 'rejected';

// ─── Stat Card ───────────────────────────────
const StatCard = ({
  label,
  value,
  prefix,
  decimals,
  icon: Icon,
  valueColor,
  accent,
  suffix,
}: {
  label: string;
  value: number;
  prefix?: string;
  decimals?: number;
  icon: React.ElementType;
  valueColor?: string;
  accent?: boolean;
  suffix?: React.ReactNode;
}) => (
  <div className={accent ? 'stat-card p-5' : 'glass-panel p-5 card-hover'}>
    <div className="flex items-start justify-between mb-3">
      <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</p>
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center"
        style={{ background: accent ? 'var(--accent-dim)' : 'var(--bg-hover)' }}
      >
        <Icon size={14} style={{ color: accent ? 'var(--accent)' : 'var(--text-secondary)' }} />
      </div>
    </div>
    <div className="flex items-end gap-2">
      <p className="text-3xl font-bold tracking-tight" style={{ color: valueColor ?? 'var(--text-primary)', letterSpacing: '-0.03em' }}>
        <AnimatedNumber value={value} prefix={prefix} decimals={decimals ?? 2} duration={600} />
      </p>
      {suffix}
    </div>
  </div>
);

// ─── Status badge ─────────────────────────────
const StatusBadge = ({ status }: { status: RequestStatus }) => {
  const map: Record<RequestStatus, { cls: string; icon: string; label: string }> = {
    pending:  { cls: 'badge badge-pending',  icon: '⏳', label: 'Pending'  },
    approved: { cls: 'badge badge-approved', icon: '✓',  label: 'Approved' },
    rejected: { cls: 'badge badge-rejected', icon: '✕',  label: 'Rejected' },
  };
  const { cls, icon, label } = map[status];
  return <span className={cls}>{icon} {label}</span>;
};

const AdminDashboard = () => {
  const { logout } = useAuth();

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

  const [paymentClaims, setPaymentClaims] = useState<any[]>([]);
  const [claimFilter, setClaimFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [claimActionLoading, setClaimActionLoading] = useState<string | null>(null);
  const [claimRejectNote, setClaimRejectNote] = useState<Record<string, string>>({});
  const [claimRejectOpen, setClaimRejectOpen] = useState<string | null>(null);

  const fetchData = useCallback(async (showSkeleton = false) => {
    if (showSkeleton) setDataLoading(true);
    try {
      const [usersRes, expRes, reqRes, claimsRes] = await Promise.all([
        api.get('/auth/users'),
        api.get('/expenses'),
        api.get('/expense-requests'),
        api.get('/payments/claims'),
      ]);
      setUsers(usersRes.data.filter((u: any) => u.role !== 'admin'));
      setExpenses(expRes.data);
      setRequests(reqRes.data);
      setPaymentClaims(claimsRes.data);
    } catch (error) {
      console.error('Failed to fetch admin data', error);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(requests.length === 0);
    const interval = setInterval(() => fetchData(false), 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // ─── Payment claim handlers ───────────────────
  const handleClaimApprove = async (id: string) => {
    setClaimActionLoading(id);
    try {
      await api.patch(`/payments/claim/${id}/approve`);
      fetchData();
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Approval failed');
    } finally {
      setClaimActionLoading(null);
    }
  };

  const handleClaimReject = async (id: string) => {
    const note = claimRejectNote[id]?.trim();
    if (!note) { alert('Please enter a rejection reason.'); return; }
    setClaimActionLoading(id);
    try {
      await api.patch(`/payments/claim/${id}/reject`, { adminNote: note });
      setClaimRejectOpen(null);
      setClaimRejectNote(prev => { const n = { ...prev }; delete n[id]; return n; });
      fetchData();
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Rejection failed');
    } finally {
      setClaimActionLoading(null);
    }
  };


  // ─── Approve ─────────────────────────────────
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

  // ─── Reject ──────────────────────────────────
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

  const uniquePayers = Array.from(
    new Map(requests.map(r => [r.requestedBy?._id, r.requestedBy?.username])).entries()
  ).filter(([id]) => id);

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

  const handleFilterChange = (newFilter: typeof reqFilter) => {
    setReqFilter(newFilter);
    setCurrentPage(1);
  };

  return (
    <div className="p-4 md:p-6 space-y-6 w-full page-enter">

      {/* ── Stats Row ─────────────────────────── */}
      {dataLoading ? <SkeletonStats count={3} /> : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <StatCard
            label="Global Volume"
            value={totalSpentGlobal}
            prefix="₹"
            icon={TrendingUp}
            accent
          />
          <StatCard
            label="Active Clients"
            value={users.length}
            decimals={0}
            icon={Users}
          />
          <div className="col-span-2 sm:col-span-1">
            <StatCard
              label="Pending Requests"
              value={pendingCount}
              decimals={0}
              icon={Clock}
              valueColor={pendingCount > 0 ? 'var(--color-warning)' : 'var(--text-primary)'}
              suffix={pendingCount > 0 ? (
                <span className="w-2.5 h-2.5 bg-amber-400 rounded-full animate-pulse mb-1.5" />
              ) : undefined}
            />
          </div>
        </div>
      )}

      {/* ── Requests Panel ─────────────────────── */}
      <div className="glass-panel p-5">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Expense Requests</h2>
            {pendingCount > 0 && (
              <span
                className="badge badge-pending"
                style={{ animation: 'badgePop 0.3s cubic-bezier(0.22,1,0.36,1) both' }}
              >
                {pendingCount} pending
              </span>
            )}
          </div>
          <button
            onClick={logout}
            className="text-xs sm:hidden transition-colors"
            style={{ color: 'var(--text-muted)' }}
          >
            Sign Out
          </button>
        </div>

        {/* ── Search + Filters ── */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <input
            type="text"
            placeholder="Search by description or requester…"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="input-field flex-1"
          />
          <select
            value={payerFilter}
            onChange={e => { setPayerFilter(e.target.value); setCurrentPage(1); }}
            className="select-field"
          >
            <option value="all">All Requesters</option>
            {uniquePayers.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </select>
        </div>

        {/* ── Status Tabs ── */}
        <div className="tab-pill w-fit mb-4">
          {(['pending', 'approved', 'rejected', 'all'] as const).map(f => (
            <button
              key={f}
              onClick={() => handleFilterChange(f)}
              className={`tab-pill-item ${reqFilter === f ? 'active' : ''}`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Results count */}
        {!dataLoading && (
          <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
            Showing {Math.min((currentPage - 1) * PAGE_SIZE + 1, filteredRequests.length || 0)}–{Math.min(currentPage * PAGE_SIZE, filteredRequests.length)} of {filteredRequests.length} requests
          </p>
        )}

        {dataLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <SkeletonRow key={i} />)}
          </div>
        ) : paginatedRequests.length === 0 ? (
          <div className="py-14 text-center space-y-3">
            <div
              className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center"
              style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}
            >
              <CheckCircle2 size={24} style={{ color: 'var(--text-muted)' }} />
            </div>
            <p className="font-medium text-sm" style={{ color: 'var(--text-secondary)' }}>
              {reqFilter === 'pending' ? 'All caught up!' : 'No requests match your filters.'}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {reqFilter === 'pending' ? 'No pending requests at this time.' : 'Try adjusting your search or filter.'}
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
              {paginatedRequests.map(req => {
                const avatarColor = getAvatarColor(req.requestedBy?.username ?? 'U');
                return (
                  <div
                    key={req._id}
                    className="p-4 rounded-xl card-hover"
                    style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}
                  >
                    {/* Header row */}
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className="avatar-ring shrink-0" style={{ background: avatarColor, color: '#fff' }}>
                        {(req.requestedBy?.username ?? 'U').charAt(0).toUpperCase()}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {req.description}
                          </p>
                          <StatusBadge status={req.status as RequestStatus} />
                        </div>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          by <span style={{ color: 'var(--text-secondary)' }}>{req.requestedBy?.username}</span>
                          {' · '}
                          {new Date(req.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {' · '}
                          {req.splitType === 'equal' ? 'Equal split' : 'Custom split'}
                        </p>
                      </div>

                      <p className="text-lg font-bold shrink-0" style={{ color: 'var(--text-primary)' }}>
                        ₹{req.amount.toFixed(2)}
                      </p>
                    </div>

                    {/* Split breakdown */}
                    {req.splits && req.splits.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {req.splits.map((s: any, idx: number) => (
                          <span
                            key={idx}
                            className="text-[11px] px-2 py-1 rounded-md"
                            style={{ background: 'var(--accent-dim)', color: 'var(--text-secondary)', border: '1px solid rgba(224,61,82,0.2)' }}
                          >
                            {s.user?.username}: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>₹{s.amountOwed.toFixed(2)}</span>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Admin note */}
                    {req.adminNote && req.status !== 'pending' && (
                      <div
                        className="mt-3 p-2.5 rounded-lg text-xs"
                        style={{
                          background: req.status === 'rejected' ? 'rgba(248,113,113,0.08)' : 'rgba(52,211,153,0.08)',
                          border: `1px solid ${req.status === 'rejected' ? 'rgba(248,113,113,0.2)' : 'rgba(52,211,153,0.2)'}`,
                          color: req.status === 'rejected' ? 'var(--color-danger)' : 'var(--color-success)',
                        }}
                      >
                        <span className="font-medium">Note: </span>{req.adminNote}
                      </div>
                    )}

                    {/* Action buttons */}
                    {req.status === 'pending' && (
                      <div className="mt-3 space-y-2">
                        {rejectOpen === req._id ? (
                          <div className="flex gap-2">
                            <input
                              autoFocus
                              type="text"
                              placeholder="Rejection reason (optional)"
                              value={rejectNotes[req._id] || ''}
                              onChange={e => setRejectNotes(prev => ({ ...prev, [req._id]: e.target.value }))}
                              className="input-field flex-1"
                            />
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => handleReject(req._id)}
                              disabled={actionLoading === req._id}
                              className="shrink-0"
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
                              variant="danger"
                              onClick={() => setRejectOpen(req._id)}
                            >
                              <XCircle size={13} /> Reject
                            </Button>
                            <Button
                              size="sm"
                              variant="success"
                              onClick={() => handleApprove(req._id)}
                              disabled={actionLoading === req._id}
                            >
                              {actionLoading === req._id
                                ? <><CircleDot size={13} className="animate-spin" /> Approving…</>
                                : <><CheckCircle2 size={13} /> Approve</>
                              }
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 mt-4" style={{ borderTop: '1px solid var(--border)' }}>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
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
                      className="w-7 h-7 rounded-lg text-xs font-medium transition-all"
                      style={{
                        background: pg === currentPage ? 'var(--bg-hover)' : 'transparent',
                        color: pg === currentPage ? 'var(--text-primary)' : 'var(--text-muted)',
                      }}
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
      </div>
      {/* ─── Payment Claims Section ─── */}
      <div className="glass-panel p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-dim)' }}>
              <CreditCard size={14} style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Payment Claims</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {paymentClaims.filter(c => c.status === 'pending').length} pending review
              </p>
            </div>
          </div>
          {/* Filter tabs */}
          <div className="flex gap-1">
            {(['pending', 'approved', 'rejected', 'all'] as const).map(f => (
              <button key={f} onClick={() => setClaimFilter(f)}
                className="px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition-all"
                style={{
                  background: claimFilter === f ? 'var(--accent)' : 'var(--bg-raised)',
                  color: claimFilter === f ? '#fff' : 'var(--text-muted)',
                }}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {paymentClaims.filter(c => claimFilter === 'all' || c.status === claimFilter).length === 0 ? (
          <p className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>No payment claims found.</p>
        ) : (
          <div className="space-y-3">
            {paymentClaims
              .filter(c => claimFilter === 'all' || c.status === claimFilter)
              .map(claim => {
                const isOverdue = claim.status === 'pending' &&
                  Date.now() - new Date(claim.createdAt).getTime() > 7 * 24 * 60 * 60 * 1000;
                return (
                  <div key={claim._id} className="rounded-xl p-4 space-y-3"
                    style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
                    {/* Claim header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {claim.payer?.username}
                          </span>
                          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>→</span>
                          <span className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>
                            {claim.payee?.username}
                          </span>
                          {isOverdue && (
                            <span className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                              style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
                              <AlertTriangle size={9} /> Overdue 7d+
                            </span>
                          )}
                        </div>
                        <p className="text-xs mt-0.5 font-mono" style={{ color: 'var(--text-muted)' }}>
                          UTR: {claim.utrNumber}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {new Date(claim.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-lg font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
                          ₹{claim.amount.toFixed(2)}
                        </p>
                        <span className={`badge badge-${claim.status}`}>
                          {claim.status === 'pending' ? '⏳' : claim.status === 'approved' ? '✓' : '✕'} {claim.status}
                        </span>
                      </div>
                    </div>

                    {/* Admin note on rejection */}
                    {claim.status === 'rejected' && claim.adminNote && (
                      <p className="text-xs px-3 py-2 rounded-lg"
                        style={{ background: 'rgba(248,113,113,0.08)', color: '#f87171' }}>
                        Reason: {claim.adminNote}
                      </p>
                    )}

                    {/* Actions — pending only */}
                    {claim.status === 'pending' && (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <Button
                            size="sm" variant="primary"
                            className="flex-1 text-xs"
                            onClick={() => handleClaimApprove(claim._id)}
                            disabled={claimActionLoading === claim._id}
                          >
                            <CheckCircle2 size={13} /> Approve — Resolve Balance
                          </Button>
                          <Button
                            size="sm" variant="danger"
                            className="flex-1 text-xs"
                            onClick={() => setClaimRejectOpen(claimRejectOpen === claim._id ? null : claim._id)}
                            disabled={claimActionLoading === claim._id}
                          >
                            <XCircle size={13} /> Reject
                          </Button>
                        </div>
                        {claimRejectOpen === claim._id && (
                          <div className="space-y-2">
                            <textarea
                              rows={2}
                              placeholder="Rejection reason (required)…"
                              value={claimRejectNote[claim._id] || ''}
                              onChange={e => setClaimRejectNote(prev => ({ ...prev, [claim._id]: e.target.value }))}
                              className="w-full px-3 py-2 rounded-xl text-xs outline-none resize-none"
                              style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                            />
                            <Button
                              size="sm" variant="danger"
                              className="w-full text-xs"
                              onClick={() => handleClaimReject(claim._id)}
                              disabled={claimActionLoading === claim._id || !claimRejectNote[claim._id]?.trim()}
                            >
                              Confirm Rejection
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { NotificationDropdown } from '../components/ui/NotificationDropdown';
import { SkeletonRow } from '../components/ui/Skeleton';
import api from '../utils/api';

const statusConfig: Record<string, { label: string; dot: string; text: string; bg: string }> = {
  pending:  { label: 'Pending',  dot: 'bg-amber-400',  text: 'text-amber-400',  bg: 'bg-amber-400/10 border-amber-400/30' },
  approved: { label: 'Approved', dot: 'bg-emerald-400', text: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/30' },
  rejected: { label: 'Rejected', dot: 'bg-red-400',     text: 'text-red-400',    bg: 'bg-red-400/10 border-red-400/30' },
};

const ClientRequestsPage = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    try {
      const res = await api.get('/expense-requests');
      setRequests(res.data);
    } catch (error) {
      console.error('Failed to fetch requests', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { 
    fetchRequests(); 
    const interval = setInterval(fetchRequests, 10000); // Auto-refresh every 10s
    return () => clearInterval(interval);
  }, [fetchRequests]);

  const handleCancel = async (id: string) => {
    if (!confirm('Cancel this expense request?')) return;
    setCancellingId(id);
    try {
      await api.delete(`/expense-requests/${id}`);
      setRequests(prev => prev.filter(r => r._id !== id));
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Failed to cancel request');
    } finally {
      setCancellingId(null);
    }
  };

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter);

  const counts = {
    all: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
  };

  return (
    <div className="p-4 md:p-6 space-y-6 w-full page-enter">
      <header className="flex justify-between items-center pb-4 border-b border-zinc-800">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Expense Requests</h1>
          <p className="text-sm text-zinc-400 mt-1">Track your submitted requests</p>
        </div>
        <div className="flex items-center gap-3">
          <NotificationDropdown />
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>← Back</Button>
        </div>
      </header>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
              filter === f
                ? 'bg-zinc-100 text-zinc-900 border-zinc-100'
                : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-600 hover:text-zinc-200'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[11px] ${
              filter === f ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-800 text-zinc-500'
            }`}>
              {counts[f]}
            </span>
          </button>
        ))}
      </div>

      {/* Request List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <SkeletonRow key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <div className="text-center py-10">
            <p className="text-4xl mb-3">📋</p>
            <p className="text-zinc-400 text-sm">
              {filter === 'all' ? 'No expense requests yet.' : `No ${filter} requests.`}
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(req => {
            const cfg = statusConfig[req.status];
            return (
              <div key={req._id} className="p-4 bg-zinc-900 rounded-xl border border-zinc-800 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-zinc-100 truncate">{req.description}</p>
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${cfg.bg} ${cfg.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {new Date(req.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {' · '}
                      {req.splitType === 'equal' ? 'Equal split' : 'Custom split'}
                    </p>
                  </div>
                  <p className="text-lg font-bold text-zinc-100 shrink-0">₹{req.amount.toFixed(2)}</p>
                </div>

                {/* Split breakdown */}
                {req.splits && req.splits.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {req.splits.map((s: any, idx: number) => (
                      <span key={idx} className="text-[11px] bg-zinc-800 px-2 py-1 rounded-md text-zinc-400">
                        {s.user?.username}: <span className="text-zinc-200 font-medium">₹{s.amountOwed.toFixed(2)}</span>
                      </span>
                    ))}
                  </div>
                )}

                {/* Admin note on rejection */}
                {req.status === 'rejected' && req.adminNote && (
                  <div className="flex gap-2 p-2.5 rounded-lg bg-red-900/20 border border-red-900/40">
                    <span className="text-red-400 text-xs mt-0.5">⚠</span>
                    <div>
                      <p className="text-[11px] font-medium text-red-400">Admin Note</p>
                      <p className="text-xs text-red-300 mt-0.5">{req.adminNote}</p>
                    </div>
                  </div>
                )}

                {/* Cancel button for pending */}
                {req.status === 'pending' && (
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCancel(req._id)}
                      disabled={cancellingId === req._id}
                      className="text-red-400 hover:text-red-300 hover:bg-red-400/10 text-xs"
                    >
                      {cancellingId === req._id ? 'Cancelling…' : 'Cancel Request'}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ClientRequestsPage;

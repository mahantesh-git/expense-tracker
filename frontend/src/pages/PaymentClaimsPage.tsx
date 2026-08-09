import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { CheckCircle2, XCircle, Clock, Loader2, RotateCcw, Trash2 } from 'lucide-react';

const STATUS_BADGE = {
  pending:  { label: 'Pending Review', color: '#f59e0b',  bg: 'rgba(245,158,11,0.12)',  Icon: Clock },
  approved: { label: 'Approved',        color: '#22c55e',  bg: 'rgba(34,197,94,0.12)',   Icon: CheckCircle2 },
  rejected: { label: 'Rejected',        color: '#f87171',  bg: 'rgba(248,113,113,0.12)', Icon: XCircle },
};

const PaymentClaimsPage = () => {
  const navigate = useNavigate();
  const [claims, setClaims] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const fetchClaims = useCallback(async () => {
    try {
      const res = await api.get('/payments/claims');
      setClaims(res.data);
    } catch (_) {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchClaims(); }, [fetchClaims]);

  const handleCancel = async (id: string) => {
    if (!confirm('Cancel this pending claim?')) return;
    setCancelling(id);
    try {
      await api.delete(`/payments/claim/${id}`);
      setClaims(prev => prev.filter(c => c._id !== id));
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Failed to cancel.');
    } finally {
      setCancelling(null);
    }
  };

  const isOverdue = (createdAt: string) => {
    return Date.now() - new Date(createdAt).getTime() > 7 * 24 * 60 * 60 * 1000;
  };

  return (
    <div className="p-4 md:p-6 space-y-6 w-full page-enter">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
            My Payments
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Track your submitted payment claims
          </p>
        </div>
        <button
          onClick={() => navigate('/client/balances')}
          className="text-xs px-3 py-1.5 rounded-lg"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          + New Payment
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={22} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
        </div>
      ) : claims.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
            style={{ background: 'var(--bg-raised)' }}>
            <Clock size={24} style={{ color: 'var(--text-muted)' }} />
          </div>
          <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>No payment claims yet</p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Go to Balances and click <strong>Pay Now</strong> to make a payment
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {claims.map(claim => {
            const badge = STATUS_BADGE[claim.status as keyof typeof STATUS_BADGE];
            const BadgeIcon = badge.Icon;
            const overdue = claim.status === 'pending' && isOverdue(claim.createdAt);

            return (
              <div key={claim._id} className="rounded-2xl p-4 space-y-3"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                {/* Top row */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                      Paid to <span style={{ color: 'var(--accent)' }}>{claim.payee?.username}</span>
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      UTR: <span className="font-mono">{claim.utrNumber}</span>
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {new Date(claim.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
                      ₹{claim.amount.toFixed(2)}
                    </p>
                    {/* Status badge */}
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full mt-1"
                      style={{ background: badge.bg, color: badge.color }}>
                      <BadgeIcon size={10} />
                      {badge.label}
                    </span>
                    {overdue && (
                      <span className="block text-[10px] mt-0.5" style={{ color: '#f59e0b' }}>
                        ⚠️ Awaiting review for 7+ days
                      </span>
                    )}
                  </div>
                </div>

                {/* Admin note on rejection */}
                {claim.status === 'rejected' && claim.adminNote && (
                  <div className="rounded-xl px-3 py-2 text-xs"
                    style={{ background: 'rgba(248,113,113,0.08)', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)' }}>
                    <span className="font-semibold">Reason: </span>{claim.adminNote}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  {claim.status === 'pending' && (
                    <button
                      onClick={() => handleCancel(claim._id)}
                      disabled={cancelling === claim._id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors"
                      style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}
                    >
                      {cancelling === claim._id
                        ? <Loader2 size={12} className="animate-spin" />
                        : <Trash2 size={12} />}
                      Cancel Claim
                    </button>
                  )}
                  {claim.status === 'rejected' && (
                    <button
                      onClick={() => navigate('/client/balances')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
                      style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
                    >
                      <RotateCcw size={12} />
                      Re-submit Payment
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PaymentClaimsPage;

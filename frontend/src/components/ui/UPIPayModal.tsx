import { useState, useEffect } from 'react';
import QRCode from 'react-qr-code';
import { X, Smartphone, QrCode, CheckCircle2, AlertCircle, Loader2, ExternalLink } from 'lucide-react';
import api from '../../utils/api';

interface UPIPayModalProps {
  isOpen: boolean;
  onClose: () => void;
  payeeId: string;
  payeeName: string;
  amount: number;
  onSuccess?: () => void;
}

const UPI_REGEX = /^[a-zA-Z0-9._-]+@[a-zA-Z]{3,}$/;

export const UPIPayModal = ({ isOpen, onClose, payeeId, payeeName, amount, onSuccess }: UPIPayModalProps) => {
  const [payeeUpi, setPayeeUpi] = useState<string | null>(null);
  const [loadingUpi, setLoadingUpi] = useState(true);
  const [utrInput, setUtrInput] = useState('');
  const [utrError, setUtrError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isMobile] = useState(() => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));

  useEffect(() => {
    if (!isOpen || !payeeId) return;
    setLoadingUpi(true);
    setUtrInput('');
    setUtrError('');
    setSubmitError('');
    setSubmitted(false);

    api.get(`/payments/upi/${payeeId}`)
      .then(res => setPayeeUpi(res.data.upiId))
      .catch(() => setPayeeUpi(null))
      .finally(() => setLoadingUpi(false));
  }, [isOpen, payeeId]);

  if (!isOpen) return null;

  // Minimal P2P UPI link — no merchant params (mc, tid, tr) to avoid "not secure" warnings
  const upiLink = payeeUpi
    ? `upi://pay?pa=${encodeURIComponent(payeeUpi)}&pn=${encodeURIComponent(payeeName)}&am=${amount.toFixed(2)}&cu=INR`
    : null;

  const handleUtrChange = (val: string) => {
    setUtrInput(val);
    setUtrError('');
    setSubmitError('');
  };

  const handleSubmit = async () => {
    // Validate UTR
    if (!/^\d{12}$/.test(utrInput.trim())) {
      setUtrError('UTR must be exactly 12 digits.');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      await api.post('/payments/claim', {
        payeeId,
        amount,
        utrNumber: utrInput.trim(),
      });
      setSubmitted(true);
      onSuccess?.();
    } catch (err: any) {
      setSubmitError(err?.response?.data?.message || 'Failed to submit claim. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-6 relative"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.5)',
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
          style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div className="mb-5">
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Pay via UPI</p>
          <h2 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Pay {payeeName}
          </h2>
          <p className="text-3xl font-bold mt-1" style={{ color: 'var(--accent)', letterSpacing: '-0.04em' }}>
            ₹{amount.toFixed(2)}
          </p>
        </div>

        {submitted ? (
          /* ── Success State ── */
          <div className="text-center py-6">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: 'rgba(34,197,94,0.15)' }}>
              <CheckCircle2 size={28} color="#22c55e" />
            </div>
            <p className="font-semibold text-base mb-1" style={{ color: 'var(--text-primary)' }}>Claim Submitted!</p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Admin will review your payment claim and approve it shortly. You can track the status in <strong>My Payments</strong>.
            </p>
            <button
              onClick={onClose}
              className="mt-5 w-full py-2.5 rounded-xl font-semibold text-sm"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              Done
            </button>
          </div>
        ) : loadingUpi ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={22} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
          </div>
        ) : !payeeUpi || !UPI_REGEX.test(payeeUpi) ? (
          /* ── No UPI ID ── */
          <div className="text-center py-6 px-2">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
              style={{ background: 'var(--bg-raised)' }}>
              <AlertCircle size={26} style={{ color: 'var(--text-muted)' }} />
            </div>
            <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
              {payeeName} hasn't added a UPI ID yet
            </p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Ask them to go to <strong>Settings → UPI ID</strong> and add their UPI ID first.
            </p>
            <button onClick={onClose} className="mt-5 w-full py-2.5 rounded-xl font-semibold text-sm"
              style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
              Close
            </button>
          </div>
        ) : (
          /* ── Main Pay Flow ── */
          <div className="space-y-5">
            {/* UPI ID display */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm"
              style={{ background: 'var(--bg-raised)', color: 'var(--text-secondary)' }}>
              <span className="font-medium" style={{ color: 'var(--text-muted)' }}>Paying to:</span>
              <span className="font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>{payeeUpi}</span>
            </div>

            {/* Mobile: UPI deep-link button */}
            {isMobile && (
              <button
                onClick={() => { window.location.href = upiLink!; }}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold text-sm"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                <Smartphone size={16} />
                Open UPI App (GPay / PhonePe / Paytm)
                <ExternalLink size={13} />
              </button>
            )}

            {/* QR Code — always visible */}
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                <QrCode size={13} />
                {isMobile ? 'Or scan with another device' : 'Scan with your UPI app'}
              </div>
              <div className="p-3 rounded-2xl" style={{ background: '#fff' }}>
                <QRCode value={upiLink!} size={160} />
              </div>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>After paying, enter UTR below</span>
              <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            </div>

            {/* UTR Input */}
            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                UTR Number (12-digit reference from your UPI app)
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={12}
                value={utrInput}
                onChange={e => handleUtrChange(e.target.value.replace(/\D/g, ''))}
                placeholder="e.g. 123456789012"
                className="w-full px-4 py-3 rounded-xl text-sm font-mono outline-none transition-all"
                style={{
                  background: 'var(--bg-raised)',
                  border: `1px solid ${utrError ? 'var(--accent)' : 'var(--border)'}`,
                  color: 'var(--text-primary)',
                }}
              />
              {utrError && (
                <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: 'var(--accent)' }}>
                  <AlertCircle size={11} /> {utrError}
                </p>
              )}
              {submitError && (
                <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: '#f87171' }}>
                  <AlertCircle size={11} /> {submitError}
                </p>
              )}
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Find UTR in your UPI app → Transaction History → tap the payment
              </p>
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={submitting || utrInput.length !== 12}
              className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-opacity"
              style={{
                background: utrInput.length === 12 ? 'var(--accent)' : 'var(--bg-hover)',
                color: utrInput.length === 12 ? '#fff' : 'var(--text-muted)',
                opacity: submitting ? 0.7 : 1,
              }}
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              {submitting ? 'Submitting...' : "I've Paid — Submit UTR"}
            </button>

            <button onClick={onClose} className="w-full py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

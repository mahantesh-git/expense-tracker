import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { SkeletonTable } from '../components/ui/Skeleton';
import api from '../utils/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getAvatarColor } from '../components/Shell';
import { Download, Search, X, ArrowDown, ArrowUp } from 'lucide-react';

type LedgerEntry = {
  id: string;
  type: 'EXPENSE' | 'SETTLEMENT';
  date: Date;
  description: string;
  amount: number;
  payerName: string;
  details: string;
  raw: any;
};

type SortField = 'date' | 'amount' | 'payerName' | 'type';
type SortOrder = 'asc' | 'desc';

const AdminLedger = () => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<LedgerEntry | null>(null);

  // Pagination & Sorting State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'EXPENSE' | 'SETTLEMENT'>('ALL');
  const [payerFilter, setPayerFilter] = useState<string>('ALL');

  useEffect(() => {
    const fetchLedger = async () => {
      try {
        const [expRes, setRes] = await Promise.all([
          api.get('/expenses'),
          api.get('/settlements'),
        ]);

        const formattedExpenses: LedgerEntry[] = expRes.data.map((e: any) => {
          const splitNames = e.splits?.map((s: any) => s.user?.username).filter(Boolean).join(', ') || 'None';
          return {
            id: e._id,
            type: 'EXPENSE',
            date: new Date(e.date),
            description: e.description,
            amount: e.amount,
            payerName: e.payer?.username || 'Unknown',
            details: `Splits with: ${splitNames}`,
            raw: e,
          };
        });

        const formattedSettlements: LedgerEntry[] = setRes.data.map((s: any) => ({
          id: s._id,
          type: 'SETTLEMENT',
          date: new Date(s.date),
          description: 'Payment',
          amount: s.amount,
          payerName: s.payer?.username || 'Unknown',
          details: `To: ${s.receiver?.username || 'Unknown'}`,
          raw: s,
        }));

        setEntries([...formattedExpenses, ...formattedSettlements]);
      } catch (error) {
        console.error('Failed to fetch ledger data', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLedger();
  }, []);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc'); // default to desc on new field
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowDown size={12} className="opacity-0 group-hover:opacity-30 transition-opacity" />;
    return sortOrder === 'asc' ? <ArrowUp size={12} className="text-accent" style={{ color: 'var(--accent)' }} /> : <ArrowDown size={12} style={{ color: 'var(--accent)' }} />;
  };

  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      const matchesSearch = searchQuery === '' || 
        entry.description.toLowerCase().includes(searchQuery.toLowerCase()) || 
        entry.details.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = typeFilter === 'ALL' || entry.type === typeFilter;
      const matchesPayer = payerFilter === 'ALL' || entry.payerName === payerFilter;
      return matchesSearch && matchesType && matchesPayer;
    });
  }, [entries, searchQuery, typeFilter, payerFilter]);

  const sortedEntries = useMemo(() => {
    return [...filteredEntries].sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredEntries, sortField, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(sortedEntries.length / pageSize));
  const paginatedEntries = sortedEntries.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const exportToCSV = () => {
    let csvContent = "Date,Type,Description,Amount,Payer,Details\n";
    sortedEntries.forEach(row => {
      const date = row.date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      const escape = (str: string) => `"${str.replace(/"/g, '""')}"`;
      const rowString = [
        escape(date),
        row.type,
        escape(row.description),
        row.amount.toFixed(2),
        escape(row.payerName),
        escape(row.details)
      ].join(',');
      csvContent += rowString + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `ledger-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = () => {
    const doc = new jsPDF('landscape');
    doc.text("Account Ledger", 14, 15);
    const tableData = sortedEntries.map(row => [
      row.date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      row.type,
      row.description,
      `Rs. ${row.amount.toFixed(2)}`,
      row.payerName,
      row.details
    ]);
    autoTable(doc, {
      head: [['Date', 'Type', 'Description', 'Amount', 'Payer', 'Details']],
      body: tableData,
      startY: 20,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [40, 40, 40] }
    });
    doc.save(`ledger-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="p-4 md:p-6 space-y-6 w-full page-enter">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Ledger</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Unified transaction history
          </p>
        </div>
        <div className="flex items-center gap-2">
          {user?.role === 'admin' && (
            <>
              <Button onClick={exportToCSV} variant="secondary" size="sm">CSV</Button>
              <Button onClick={exportToPDF} variant="secondary" size="sm" className="gap-2">
                <Download size={14} /> PDF
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 rounded-xl flex flex-col sm:flex-row gap-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input 
            type="text" 
            placeholder="Search transactions…" 
            className="input-field pl-9"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
          />
        </div>
        <div className="flex gap-3">
          <select 
            className="select-field w-36"
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value as any); setCurrentPage(1); }}
          >
            <option value="ALL">All Types</option>
            <option value="EXPENSE">Expenses</option>
            <option value="SETTLEMENT">Settlements</option>
          </select>
          <select 
            className="select-field w-36"
            value={payerFilter}
            onChange={(e) => { setPayerFilter(e.target.value); setCurrentPage(1); }}
          >
            <option value="ALL">All Payers</option>
            {Array.from(new Set(entries.map(e => e.payerName))).sort().map(payer => (
              <option key={payer} value={payer}>{payer}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        {loading ? (
          <SkeletonTable rows={8} cols={6} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead style={{ background: 'var(--bg-raised)', borderBottom: '1px solid var(--border)' }}>
                <tr>
                  <th className="p-4 font-semibold text-xs tracking-wide uppercase group cursor-pointer" style={{ color: 'var(--text-secondary)' }} onClick={() => handleSort('date')}>
                    <div className="flex items-center gap-1">Date <SortIcon field="date" /></div>
                  </th>
                  <th className="p-4 font-semibold text-xs tracking-wide uppercase group cursor-pointer" style={{ color: 'var(--text-secondary)' }} onClick={() => handleSort('type')}>
                    <div className="flex items-center gap-1">Type <SortIcon field="type" /></div>
                  </th>
                  <th className="p-4 font-semibold text-xs tracking-wide uppercase" style={{ color: 'var(--text-secondary)' }}>
                    Description
                  </th>
                  <th className="p-4 font-semibold text-xs tracking-wide uppercase group cursor-pointer" style={{ color: 'var(--text-secondary)' }} onClick={() => handleSort('payerName')}>
                    <div className="flex items-center gap-1">Payer <SortIcon field="payerName" /></div>
                  </th>
                  <th className="p-4 font-semibold text-xs tracking-wide uppercase group cursor-pointer text-right" style={{ color: 'var(--text-secondary)' }} onClick={() => handleSort('amount')}>
                    <div className="flex items-center justify-end gap-1">Amount <SortIcon field="amount" /></div>
                  </th>
                  <th className="p-4 font-semibold text-xs tracking-wide uppercase hidden md:table-cell" style={{ color: 'var(--text-secondary)' }}>
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {paginatedEntries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                      No transactions found.
                    </td>
                  </tr>
                ) : (
                  paginatedEntries.map((entry) => (
                    <tr 
                      key={entry.id} 
                      className="cursor-pointer transition-colors"
                      style={{ background: 'transparent' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      onClick={() => setSelectedEntry(entry)}
                    >
                      <td className="p-4">
                        <span style={{ color: 'var(--text-primary)' }}>{entry.date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>{entry.date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                      </td>
                      <td className="p-4">
                        {entry.type === 'EXPENSE' ? (
                          <span className="badge badge-expense">Expense</span>
                        ) : (
                          <span className="badge badge-settle">Settlement</span>
                        )}
                      </td>
                      <td className="p-4 font-medium" style={{ color: 'var(--text-primary)' }}>{entry.description}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold shrink-0 text-white" style={{ background: getAvatarColor(entry.payerName) }}>
                            {entry.payerName.charAt(0).toUpperCase()}
                          </div>
                          <span style={{ color: 'var(--text-secondary)' }}>{entry.payerName}</span>
                        </div>
                      </td>
                      <td className="p-4 text-right font-semibold" style={{ color: 'var(--text-primary)' }}>
                        ₹{entry.amount.toFixed(2)}
                      </td>
                      <td className="p-4 text-xs truncate max-w-[200px] hidden md:table-cell" style={{ color: 'var(--text-muted)' }} title={entry.details}>
                        {entry.details}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {!loading && (
          <div className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4" style={{ background: 'var(--bg-raised)', borderTop: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              <span>Show</span>
              <select 
                className="select-field py-1 pl-2 pr-6"
                style={{ fontSize: '0.75rem' }}
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              <span className="hidden sm:inline">
                Showing {(currentPage - 1) * pageSize + (paginatedEntries.length > 0 ? 1 : 0)} to {Math.min(currentPage * pageSize, sortedEntries.length)} of {sortedEntries.length}
              </span>
            </div>
            
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                ← Prev
              </Button>
              <span className="text-xs font-medium px-2" style={{ color: 'var(--text-secondary)' }}>
                Page {currentPage} of {totalPages}
              </span>
              <Button variant="ghost" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                Next →
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {selectedEntry && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedEntry(null)}>
          <div className="glass-panel w-full max-w-2xl overflow-hidden p-0 page-enter" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-5 border-b border-zinc-800" style={{ borderBottomColor: 'var(--border)' }}>
              <h3 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Transaction Details</h3>
              <button 
                onClick={() => setSelectedEntry(null)} 
                className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-8 text-sm">
              <div className="space-y-5">
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Type</p>
                  <p className="font-semibold">{selectedEntry.type === 'EXPENSE' ? <span className="badge badge-expense text-sm">Expense</span> : <span className="badge badge-settle text-sm">Settlement</span>}</p>
                </div>
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Date & Time</p>
                  <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{selectedEntry.date.toLocaleString('en-IN')}</p>
                </div>
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Amount</p>
                  <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>₹{selectedEntry.amount.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Description</p>
                  <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{selectedEntry.description}</p>
                </div>
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Payer</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ background: getAvatarColor(selectedEntry.payerName) }}>
                      {selectedEntry.payerName.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>{selectedEntry.payerName}</span>
                  </div>
                </div>
              </div>
              
              <div className="sm:border-l sm:pl-8 pt-6 sm:pt-0 border-t sm:border-t-0" style={{ borderColor: 'var(--border)' }}>
                <h4 className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: 'var(--text-muted)' }}>
                  {selectedEntry.type === 'EXPENSE' ? 'Split Breakdown' : 'Settlement Details'}
                </h4>
                {selectedEntry.type === 'EXPENSE' ? (
                  <div className="space-y-3 p-4 rounded-xl max-h-[300px] overflow-y-auto" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
                    {selectedEntry.raw.splits?.map((s: any) => (
                      <div key={s.user?._id || Math.random()} className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold text-white shrink-0" style={{ background: getAvatarColor(s.user?.username || 'U') }}>
                            {(s.user?.username || 'U').charAt(0).toUpperCase()}
                          </div>
                          <span style={{ color: 'var(--text-secondary)' }}>{s.user?.username || 'Unknown'}</span>
                        </div>
                        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>₹{s.amountOwed.toFixed(2)}</span>
                      </div>
                    ))}
                    {(!selectedEntry.raw.splits || selectedEntry.raw.splits.length === 0) && (
                      <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>No split details available.</p>
                    )}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl space-y-2" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Receiver</p>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ background: getAvatarColor(selectedEntry.raw.receiver?.username || 'U') }}>
                        {(selectedEntry.raw.receiver?.username || 'U').charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{selectedEntry.raw.receiver?.username || 'Unknown'}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLedger;

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { SkeletonTable } from '../components/ui/Skeleton';
import api from '../utils/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  const navigate = useNavigate();
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

  const totalPages = Math.ceil(sortedEntries.length / pageSize);
  const paginatedEntries = sortedEntries.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const exportToCSV = () => {
    // CSV Header
    let csvContent = "Date,Type,Description,Amount,Payer,Details\n";
    
    // Rows
    sortedEntries.forEach(row => {
      const date = row.date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      
      // Escape fields that might contain commas
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

    // Download trigger
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `system-ledger-${new Date().toISOString().split('T')[0]}.csv`);
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

    doc.save(`system-ledger-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="w-full page-enter">
      <header className="flex justify-between items-center p-4 md:px-6 md:py-6 border-b border-zinc-800">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>← Back</Button>
          <div>
            <p className="text-sm text-zinc-400 mt-1">Unified transaction history</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {user?.role === 'admin' && (
            <>
              <Button onClick={exportToCSV} variant="secondary" size="sm" className="hidden sm:inline-flex">
                CSV
              </Button>
              <Button onClick={exportToPDF} variant="secondary" size="sm">
                Export PDF
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Filter and Search Bar */}
      <div className="px-4 py-4 md:px-6 flex flex-col sm:flex-row gap-4 bg-zinc-950 border-b border-zinc-800">
        <input 
          type="text" 
          placeholder="Search descriptions or details..." 
          className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(1);
          }}
        />
        <select 
          className="bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-700"
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value as any);
            setCurrentPage(1);
          }}
        >
          <option value="ALL">All Types</option>
          <option value="EXPENSE">Expenses</option>
          <option value="SETTLEMENT">Settlements</option>
        </select>
        <select 
          className="bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-700 max-w-[200px]"
          value={payerFilter}
          onChange={(e) => {
            setPayerFilter(e.target.value);
            setCurrentPage(1);
          }}
        >
          <option value="ALL">All Payers</option>
          {Array.from(new Set(entries.map(e => e.payerName))).sort().map(payer => (
            <option key={payer} value={payer}>{payer}</option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden bg-zinc-950">
        {loading ? (
          <SkeletonTable rows={8} cols={6} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
            <thead className="bg-zinc-900 border-b border-zinc-800 text-zinc-400">
              <tr>
                <th className="p-4 font-medium cursor-pointer hover:text-zinc-200 transition-colors" onClick={() => handleSort('date')}>
                  Date {sortField === 'date' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th className="p-4 font-medium cursor-pointer hover:text-zinc-200 transition-colors" onClick={() => handleSort('type')}>
                  Type {sortField === 'type' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th className="p-4 font-medium">Description</th>
                <th className="p-4 font-medium cursor-pointer hover:text-zinc-200 transition-colors" onClick={() => handleSort('payerName')}>
                  Payer {sortField === 'payerName' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th className="p-4 font-medium cursor-pointer hover:text-zinc-200 transition-colors text-right" onClick={() => handleSort('amount')}>
                  Amount {sortField === 'amount' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th className="p-4 font-medium hidden md:table-cell">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {paginatedEntries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-zinc-500">
                    No transactions found.
                  </td>
                </tr>
              ) : (
                paginatedEntries.map((entry) => (
                  <tr 
                    key={entry.id} 
                    className="hover:bg-zinc-800/20 transition-colors cursor-pointer"
                    onClick={() => setSelectedEntry(entry)}
                  >
                    <td className="p-4 whitespace-nowrap text-zinc-300">
                      {entry.date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      <span className="text-zinc-500 ml-2 text-xs">
                        {entry.date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-[10px] font-medium tracking-wide uppercase ${
                        entry.type === 'EXPENSE' ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20' : 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/20'
                      }`}>
                        {entry.type}
                      </span>
                    </td>
                    <td className="p-4 font-medium text-zinc-200">{entry.description}</td>
                    <td className="p-4 text-zinc-300">{entry.payerName}</td>
                    <td className="p-4 text-right font-semibold text-zinc-100">
                      ₹{entry.amount.toFixed(2)}
                    </td>
                    <td className="p-4 text-xs text-zinc-500 hidden md:table-cell truncate max-w-[200px]" title={entry.details}>
                      {entry.details}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        <div className="flex items-center justify-between p-4 border-t border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span>Show</span>
            <select 
              className="bg-zinc-800 border-none rounded p-1 text-zinc-200 focus:ring-1 focus:ring-zinc-600 outline-none cursor-pointer"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1); // Reset to first page
              }}
            >
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span>entries</span>
            <span className="ml-4 hidden sm:inline">
              Showing {(currentPage - 1) * pageSize + (paginatedEntries.length > 0 ? 1 : 0)} to {Math.min(currentPage * pageSize, sortedEntries.length)} of {sortedEntries.length}
            </span>
          </div>
          
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="sm" 
              className="px-2"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Prev
            </Button>
            <span className="text-xs text-zinc-400 px-2 font-medium">
              Page {currentPage} of {Math.max(1, totalPages)}
            </span>
            <Button 
              variant="ghost" 
              size="sm" 
              className="px-2"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
            >
              Next
            </Button>
          </div>
        </div>
        </>
        )}
      </div>

      {/* Details Modal */}
      {selectedEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedEntry(null)}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b border-zinc-800">
              <h3 className="font-semibold text-lg text-zinc-100">Transaction Details</h3>
              <button onClick={() => setSelectedEntry(null)} className="text-zinc-400 hover:text-white">&times;</button>
            </div>
            
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm text-zinc-300">
              {/* Left Column: Core Info */}
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Type</span>
                  <span className={`font-medium ${selectedEntry.type === 'EXPENSE' ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {selectedEntry.type}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Date</span>
                  <span className="font-medium text-white">{selectedEntry.date.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Amount</span>
                  <span className="font-semibold text-white">₹{selectedEntry.amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Payer</span>
                  <span className="font-medium text-white">{selectedEntry.payerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Description</span>
                  <span className="font-medium text-white text-right max-w-[200px] break-words">{selectedEntry.description}</span>
                </div>
              </div>
              
              {/* Right Column: Splits/Details */}
              <div className="sm:border-l sm:border-zinc-800 sm:pl-6 pt-4 sm:pt-0 border-t sm:border-t-0 border-zinc-800">
                <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                  {selectedEntry.type === 'EXPENSE' ? 'Split Details' : 'Settlement Details'}
                </h4>
                {selectedEntry.type === 'EXPENSE' ? (
                  <div className="space-y-2 bg-zinc-950/50 rounded-lg p-3 border border-zinc-800/50 max-h-[250px] overflow-y-auto">
                    {selectedEntry.raw.splits?.map((s: any) => (
                      <div key={s.user?._id || Math.random()} className="flex justify-between items-center">
                        <span className="text-zinc-400">{s.user?.username || 'Unknown'}</span>
                        <span className="font-mono text-zinc-200">₹{s.amountOwed.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2 bg-zinc-950/50 rounded-lg p-3 border border-zinc-800/50">
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-400">Receiver</span>
                      <span className="font-medium text-zinc-200">{selectedEntry.raw.receiver?.username || 'Unknown'}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-zinc-800 bg-zinc-950/50 flex justify-end">
              <Button variant="ghost" onClick={() => setSelectedEntry(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLedger;

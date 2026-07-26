import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import api from '../utils/api';

const ClientDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    try {
      const [expRes, settRes] = await Promise.all([
        api.get('/expenses'),
        api.get('/settlements')
      ]);
      setExpenses(expRes.data);
      setSettlements(settRes.data);
    } catch (error) {
      console.error('Failed to fetch data', error);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/expenses', {
        description,
        amount: Number(amount),
        payer: user?._id,
        splits: []
      });
      setDescription('');
      setAmount('');
      fetchData();
    } catch (error) {
      console.error('Error adding expense', error);
    } finally {
      setLoading(false);
    }
  };

  const totalIPaid = expenses
    .filter(e => e.payer._id === user?._id)
    .reduce((acc, e) => acc + e.amount, 0);

  const totalIWasCharged = expenses
    .filter(e => e.payer._id !== user?._id && e.splits?.some((s: any) => s.user?._id === user?._id))
    .reduce((acc, e) => {
      const mySplit = e.splits?.find((s: any) => s.user?._id === user?._id);
      return acc + (mySplit?.amountOwed || 0);
    }, 0);

  // Net balances
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

  return (
    <div className="p-4 md:p-6 space-y-6 w-full page-enter">
      <header className="flex justify-between items-center pb-4 border-b border-zinc-800">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Dashboard</h1>
          <p className="text-sm text-zinc-400 mt-1">{user?.username}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={logout}>Sign Out</Button>
      </header>

      {/* Clickable Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => navigate('/client/paid')}
          className="cursor-pointer group"
        >
          <Card className="hover:border-zinc-600 transition-colors">
            <p className="text-xs text-zinc-400 mb-1">I Paid</p>
            <p className="text-2xl font-semibold text-zinc-100">₹{totalIPaid.toFixed(2)}</p>
            <p className="text-[11px] text-zinc-500 mt-2 group-hover:text-zinc-300 transition-colors">{iPaidCount} transactions →</p>
          </Card>
        </div>

        <div
          onClick={() => navigate('/client/charged')}
          className="cursor-pointer group"
        >
          <Card className="hover:border-zinc-600 transition-colors">
            <p className="text-xs text-zinc-400 mb-1">I Was Charged</p>
            <p className="text-2xl font-semibold text-zinc-100">₹{totalIWasCharged.toFixed(2)}</p>
            <p className="text-[11px] text-zinc-500 mt-2 group-hover:text-zinc-300 transition-colors">{chargedCount} transactions →</p>
          </Card>
        </div>

        <div
          onClick={() => navigate('/client/balances')}
          className="cursor-pointer group"
        >
          <Card className="hover:border-zinc-600 transition-colors">
            <p className="text-xs text-zinc-400 mb-1">Others Owe Me</p>
            <p className="text-2xl font-semibold text-emerald-400">₹{owedToYouTotal.toFixed(2)}</p>
            <p className="text-[11px] text-zinc-500 mt-2 group-hover:text-zinc-300 transition-colors">View balances →</p>
          </Card>
        </div>

        <div
          onClick={() => navigate('/client/balances')}
          className="cursor-pointer group"
        >
          <Card className="hover:border-zinc-600 transition-colors">
            <p className="text-xs text-zinc-400 mb-1">I Owe Others</p>
            <p className="text-2xl font-semibold text-red-400">₹{youOweTotal.toFixed(2)}</p>
            <p className="text-[11px] text-zinc-500 mt-2 group-hover:text-zinc-300 transition-colors">View balances →</p>
          </Card>
        </div>
      </div>

      {/* Add Expense Form */}
      <div className="max-w-sm">
        <Card>
          <h2 className="text-base font-medium mb-4">Add Expense</h2>
          <form onSubmit={handleAddExpense} className="space-y-3">
            <Input label="Description" placeholder="e.g. Lunch" value={description}
              onChange={(e) => setDescription(e.target.value)} required />
            <Input label="Amount (₹)" type="number" step="0.01" placeholder="0.00"
              value={amount} onChange={(e) => setAmount(e.target.value)} required />
            <Button type="submit" className="w-full" disabled={loading}>Submit</Button>
          </form>
        </Card>
      </div>

      {/* Quick Recent Activity */}
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
                    {isPayer ? 'You paid' : `Charged by ${exp.payer.username}`} · {new Date(exp.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
                <span className={`text-sm font-semibold ${isPayer ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isPayer ? '+' : '-'}₹{myAmount?.toFixed(2) || '0.00'}
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

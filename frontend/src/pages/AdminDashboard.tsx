import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import api from '../utils/api';
import { useNavigate } from 'react-router-dom';

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    try {
      const [usersRes, expRes] = await Promise.all([
        api.get('/auth/users'),
        api.get('/expenses')
      ]);
      setUsers(usersRes.data.filter((u: any) => u.role !== 'admin'));
      setExpenses(expRes.data);
    } catch (error) {
      console.error('Failed to fetch admin data', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/register', { username: newUsername, password: newPassword });
      setNewUsername('');
      setNewPassword('');
      fetchData();
    } catch (error) {
      console.error('Failed to create client', error);
    } finally {
      setLoading(false);
    }
  };

  const totalSpentGlobal = expenses.reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="p-4 md:p-6 space-y-6 w-full page-enter">
      <header className="flex justify-between items-center pb-6 border-b border-zinc-800">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Admin Console</h1>
          <p className="text-sm text-zinc-400 mt-1">System Overview</p>
        </div>
        <Button variant="ghost" size="sm" onClick={logout}>
          Sign Out
        </Button>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <p className="text-sm font-medium text-zinc-400 mb-1">Global Volume</p>
          <p className="text-3xl font-semibold text-zinc-100">₹{totalSpentGlobal.toFixed(2)}</p>
        </Card>
        
        <Card>
          <p className="text-sm font-medium text-zinc-400 mb-1">Active Clients</p>
          <p className="text-3xl font-semibold text-zinc-100">{users.length}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        <div className="md:col-span-1 space-y-6">
          <Card>
            <h2 className="text-lg font-medium mb-4">Provision Account</h2>
            <form onSubmit={handleCreateClient} className="space-y-4">
              <Input 
                label="Username" 
                placeholder="client_name"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                required
              />
              <Input 
                label="Password" 
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <Button type="submit" className="w-full" disabled={loading}>
                Create Client
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
                      <p className="text-xs text-zinc-500 mt-1">Paid by <span className="text-zinc-300">{expense.payer?.username}</span></p>
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

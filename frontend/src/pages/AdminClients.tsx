import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { NotificationDropdown } from '../components/ui/NotificationDropdown';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const AdminClients = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [users, setUsers] = useState<any[]>([]);
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const fetchUsers = useCallback(async () => {
    const res = await api.get('/auth/users');
    setUsers(res.data.filter((u: any) => u.role !== 'admin'));
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/register', { username: newUsername, email: newEmail });
      setNewUsername('');
      setNewEmail('');
      fetchUsers();
    } catch (error) {
      console.error('Failed to create client', error);
    } finally {
      setLoading(false);
    }
  };

  const filtered = users.filter(u =>
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4 md:p-6 space-y-6 w-full page-enter">
      <header className="flex justify-between items-center pb-6 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>← Back</Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
            <p className="text-sm text-zinc-400 mt-1">{users.length} registered clients</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <NotificationDropdown />
          <Button variant="ghost" size="sm" onClick={logout}>Sign Out</Button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {/* Provision Form */}
        <div className="md:col-span-1">
          <Card>
            <h2 className="text-lg font-medium mb-4">Provision Account</h2>
            <form onSubmit={handleCreateClient} className="space-y-4">
              <Input
                label="Email"
                placeholder="client@email.com"
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

        {/* Clients List */}
        <div className="md:col-span-2">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium">All Clients</h2>
              <input
                type="text"
                placeholder="Search clients…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="px-3 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 focus:outline-none focus:border-zinc-400 placeholder-zinc-600"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filtered.map(u => (
                <div
                  key={u._id}
                  className="p-4 bg-zinc-950 border border-zinc-800 hover:border-zinc-600 transition-colors rounded-md flex justify-between items-center cursor-pointer group"
                  onClick={() => navigate(`/admin/user/${u._id}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-zinc-800 rounded-md flex items-center justify-center text-sm font-semibold text-zinc-300">
                      {u.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-zinc-100">{u.username}</h3>
                      <p className="text-xs text-zinc-500">{u.email || 'No email'}</p>
                    </div>
                  </div>
                  <span className="text-zinc-500 group-hover:text-zinc-300 transition-colors">→</span>
                </div>
              ))}
              {filtered.length === 0 && (
                <p className="text-zinc-500 text-sm col-span-2 py-4">
                  {search ? 'No clients match your search.' : 'No clients provisioned yet.'}
                </p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminClients;

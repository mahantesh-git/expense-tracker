import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { getAvatarColor } from '../components/Shell';
import api from '../utils/api';
import { Users, UserPlus, Search, ChevronRight } from 'lucide-react';

const AdminClients = () => {
  const navigate = useNavigate();

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Clients</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {users.length} registered clients
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {/* Provision Form */}
        <div className="md:col-span-1">
          <Card>
            <div className="flex items-center gap-2 mb-5">
              <UserPlus size={18} style={{ color: 'var(--accent)' }} />
              <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Provision Account</h2>
            </div>
            
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
              <Button type="submit" className="w-full mt-2" disabled={loading} size="lg">
                {loading ? 'Creating…' : 'Create Client'}
              </Button>
            </form>
          </Card>
        </div>

        {/* Clients List */}
        <div className="md:col-span-2">
          <div className="glass-panel p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
              <div className="flex items-center gap-2">
                <Users size={18} style={{ color: 'var(--text-muted)' }} />
                <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>All Clients</h2>
              </div>
              <div className="relative w-full sm:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search clients…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="input-field pl-9"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filtered.map(u => (
                <div
                  key={u._id}
                  className="p-4 rounded-xl flex justify-between items-center cursor-pointer card-hover"
                  style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)' }}
                  onClick={() => navigate(`/admin/user/${u._id}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className="avatar-ring shrink-0" style={{ background: getAvatarColor(u.username), color: '#fff' }}>
                      {u.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{u.username}</h3>
                      <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{u.email || 'No email'}</p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="shrink-0 transition-transform group-hover:translate-x-1" style={{ color: 'var(--text-muted)' }} />
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="col-span-2 py-10 text-center">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                    {search ? 'No clients match your search.' : 'No clients provisioned yet.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminClients;

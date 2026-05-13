import { useEffect, useState } from 'react';
import { listUsers, registerUser } from '../api/auth';
import type { User } from '../types';

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: '', email: '', password: '', role: 'admin' });
  const [error, setError] = useState('');

  const reload = () => listUsers().then(setUsers);
  useEffect(() => { reload(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await registerUser(form);
      setShowForm(false);
      setForm({ username: '', email: '', password: '', role: 'admin' });
      reload();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create user');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Users</h1>
        <button onClick={() => setShowForm(!showForm)} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          + New User
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border rounded-lg p-4 mb-6 max-w-lg space-y-3">
          {error && <div className="bg-red-100 text-red-700 p-2 rounded text-sm">{error}</div>}
          <input placeholder="Username *" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })}
            className="w-full border rounded px-3 py-2" required />
          <input placeholder="Email *" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full border rounded px-3 py-2" required />
          <input placeholder="Password *" type="password" value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full border rounded px-3 py-2" required />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="w-full border rounded px-3 py-2">
            <option value="admin">Admin</option>
            <option value="superadmin">Superadmin</option>
          </select>
          <div className="flex gap-2">
            <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded">Create</button>
            <button type="button" onClick={() => setShowForm(false)} className="bg-gray-300 px-4 py-2 rounded">Cancel</button>
          </div>
        </form>
      )}

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-4 py-3">Username</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{u.username}</td>
                <td className="px-4 py-3">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    u.role === 'superadmin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                  }`}>{u.role}</span>
                </td>
                <td className="px-4 py-3">{u.is_active ? 'Active' : 'Disabled'}</td>
                <td className="px-4 py-3 text-gray-500">{new Date(u.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import {deleteUser, listUsers, registerUser, updateUser} from '../api/auth';
import type { User } from '../types';

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: '', email: '', password: '', role: 'admin' });
  const [error, setError] = useState('');
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deltUser, setDeltUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ email: '', role: '', is_active: true, password: '' });
  const [editError, setEditError] = useState('');

  const reload = () => listUsers().then(setUsers);
  useEffect(() => { reload(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    try {
      await registerUser(form);
      setShowForm(false); setForm({ username: '', email: '', password: '', role: 'admin' }); reload();
    } catch (err: any) { setError(err.response?.data?.detail || 'Failed to create user'); }
  };

  const startEdit = (u: User) => {
    setEditUser(u);
    setDeltUser(u);
    setEditForm({ email: u.email, role: u.role, is_active: u.is_active, password: '' });
    setEditError('');
  };

  const saveEdit = async () => {
    if (!editUser) return;
    setEditError('');
    try {
      const payload: any = { email: editForm.email, role: editForm.role, is_active: editForm.is_active };
      if (editForm.password.trim()) payload.password = editForm.password;
      await updateUser(editUser.id, payload);
      setEditUser(null); reload();
    } catch (err: any) { setEditError(err.response?.data?.detail || 'Failed to update user'); }
  };
  const saveDelet = async () => {
    if (!deltUser) return;
    setEditError('');
    try {
      await deleteUser(deltUser.id);
      setDeltUser(null); reload();
    } catch (err: any) { setEditError(err.response?.data?.detail || 'Failed to update user'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Users</h1>
        <button onClick={() => setShowForm(!showForm)} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">+ New User</button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border rounded p-4 mb-6 max-w-lg space-y-3">
          {error && <div className="bg-red-100 text-red-700 p-2 rounded text-sm">{error}</div>}
          <input placeholder="Username *" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} className="w-full border rounded px-3 py-2" required />
          <input placeholder="Email *" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full border rounded px-3 py-2" required />
          <input placeholder="Password *" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="w-full border rounded px-3 py-2" required />
          <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="w-full border rounded px-3 py-2">
            <option value="admin">Admin</option><option value="superadmin">Superadmin</option>
          </select>
          <div className="flex gap-2">
            <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded text-sm">Create</button>
            <button type="button" onClick={() => setShowForm(false)} className="bg-gray-200 px-4 py-2 rounded text-sm">Cancel</button>
          </div>
        </form>
      )}

      {editUser && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setEditUser(null)}>
          <div className="bg-white rounded-lg p-6 w-full max-w-md space-y-3" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold">Edit: {editUser.username}</h2>
            {editError && <div className="bg-red-100 text-red-700 p-2 rounded text-sm">{editError}</div>}
            <label className="block text-sm font-medium">Email</label>
            <input value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" />
            <label className="block text-sm font-medium">New Password <span className="text-gray-400 font-normal">(leave empty to keep current)</span></label>
            <input type="password" placeholder="New password (min 6 chars)" value={editForm.password} onChange={e => setEditForm({ ...editForm, password: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" />
            <label className="block text-sm font-medium">Role</label>
            <select value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })} className="w-full border rounded px-3 py-2 text-sm">
              <option value="admin">Admin</option><option value="superadmin">Superadmin</option>
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editForm.is_active} onChange={e => setEditForm({ ...editForm, is_active: e.target.checked })} />
              Active
            </label>
            <div className="flex gap-2 pt-2">
              <button onClick={saveEdit} className="bg-green-600 text-white px-4 py-2 rounded text-sm">Save</button>
              <button onClick={saveDelet} className="bg-green-600 text-white px-4 py-2 rounded text-sm">delete</button>
              <button onClick={() => setEditUser(null)} className="bg-gray-200 px-4 py-2 rounded text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-4 py-3">Username</th><th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th><th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th><th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{u.username}</td>
                <td className="px-4 py-3">{u.email}</td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs ${u.role === 'superadmin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{u.role}</span></td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{u.is_active ? 'Active' : 'Disabled'}</span></td>
                <td className="px-4 py-3 text-gray-500">{new Date(u.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3"><button onClick={() => startEdit(u)} className="text-blue-600 text-xs hover:underline">edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

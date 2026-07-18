import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { Card, CardContent } from '../../components/ui/card.jsx';
import { Input } from '../../components/ui/input.jsx';
import { Button } from '../../components/ui/button.jsx';
import { Badge } from '../../components/ui/badge.jsx';

export default function AdminStaff() {
  const [staffList, setStaffList] = useState([]);
  const [form, setForm] = useState({ email: '', password: '', role: 'VERIFIER' });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editRole, setEditRole] = useState('VERIFIER');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');

  async function load() {
    try {
      const res = await api.get('/admin/staff');
      setStaffList(res.staff);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await api.post('/admin/staff', form);
      setForm({ email: '', password: '', role: 'VERIFIER' });
      setMessage(`Created ${res.staff.email} (${res.staff.role})`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(staff) {
    setBusy(true);
    try {
      await api.patch(`/admin/staff/${staff.id}`, { active: !staff.active });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function startEdit(staff) {
    setEditingId(staff.id);
    setEditRole(staff.role);
    setEditEmail(staff.email);
    setEditPassword('');
  }

  async function handleSaveEdit(staffId) {
    setBusy(true);
    setError('');
    try {
      const payload = { role: editRole, email: editEmail };
      if (editPassword) payload.password = editPassword;
      await api.patch(`/admin/staff/${staffId}`, payload);
      setEditingId(null);
      setEditPassword('');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="animate-in fade-in space-y-5 duration-300">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Staff</h1>
        <p className="text-sm text-gray-500">
          VERIFIER can review documents and update status; ADMIN can also manage sessions, document requirements, and other staff.
        </p>
      </div>

      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <Input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="Email"
              className="sm:col-span-2"
            />
            <Input
              required
              type="password"
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Temporary password (min 8 chars)"
            />
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm shadow-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
            >
              <option value="VERIFIER">Verifier</option>
              <option value="ADMIN">Admin</option>
            </select>
            <Button disabled={busy} className="sm:col-span-4">Create staff account</Button>
          </form>
        </CardContent>
      </Card>

      {message && <p className="rounded-md bg-green-50 p-3 text-sm text-green-700">{message}</p>}
      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</p>}

      {staffList.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-gray-500">All staff</h2>
          {staffList.map((s) => (
            <Card key={s.id}>
              <CardContent className="p-3 text-sm">
                {editingId === s.id ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <Input
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        placeholder="Email"
                      />
                      <Input
                        type="password"
                        minLength={8}
                        value={editPassword}
                        onChange={(e) => setEditPassword(e.target.value)}
                        placeholder="New password (leave blank to keep current)"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <select
                        value={editRole}
                        onChange={(e) => setEditRole(e.target.value)}
                        className="h-8 rounded-md border border-gray-300 bg-white px-2 text-sm"
                      >
                        <option value="VERIFIER">Verifier</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                      <div className="flex items-center gap-2">
                        <Button size="sm" disabled={busy} onClick={() => handleSaveEdit(s.id)}>Save</Button>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => setEditingId(null)}>Cancel</Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{s.email}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge variant={s.role === 'ADMIN' ? 'default' : 'gray'}>{s.role}</Badge>
                        {s.active === false && <Badge variant="red">inactive</Badge>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => startEdit(s)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => toggleActive(s)}>
                        {s.active === false ? 'Reactivate' : 'Deactivate'}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

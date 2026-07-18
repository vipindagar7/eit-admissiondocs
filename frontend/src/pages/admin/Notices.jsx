import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { Card, CardContent } from '../../components/ui/card.jsx';
import { Input } from '../../components/ui/input.jsx';
import { Button } from '../../components/ui/button.jsx';
import { Badge } from '../../components/ui/badge.jsx';

export default function AdminNotices() {
  const [notices, setNotices] = useState([]);
  const [form, setForm] = useState({ title: '', content: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);

  async function load() {
    const res = await api.get('/admin/notices');
    setNotices(res.notices);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/admin/notices', form);
      setForm({ title: '', content: '' });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(notice) {
    setBusy(true);
    try {
      await api.patch(`/admin/notices/${notice.id}`, { active: !notice.active });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(notice) {
    if (!confirm(`Delete notice "${notice.title}"?`)) return;
    setBusy(true);
    try {
      await api.delete(`/admin/notices/${notice.id}`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function startEdit(notice) {
    setEditingId(notice.id);
    setEditForm({ title: notice.title, content: notice.content });
  }

  async function handleSaveEdit(noticeId) {
    setBusy(true);
    setError('');
    try {
      await api.patch(`/admin/notices/${noticeId}`, editForm);
      setEditingId(null);
      setEditForm(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Notice Board</h1>
        <p className="text-sm text-gray-500">Announcements shown to students on their dashboard.</p>
      </div>

      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleCreate} className="space-y-3">
            <Input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Title (e.g. Document verification schedule)"
            />
            <textarea
              required
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="Notice content"
              rows={3}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
            />
            <Button disabled={busy}>Post notice</Button>
          </form>
        </CardContent>
      </Card>

      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</p>}

      <div className="space-y-2">
        {notices.map((n) => (
          <Card key={n.id}>
            <CardContent className="p-4">
              {editingId === n.id ? (
                <div className="space-y-3">
                  <Input
                    value={editForm.title}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    placeholder="Title"
                  />
                  <textarea
                    value={editForm.content}
                    onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                    rows={3}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
                  />
                  <div className="flex items-center gap-2">
                    <Button size="sm" disabled={busy} onClick={() => handleSaveEdit(n.id)}>Save</Button>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => { setEditingId(null); setEditForm(null); }}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">{n.title}</p>
                      {!n.active && <Badge variant="gray">Hidden</Badge>}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">{n.content}</p>
                    <p className="mt-1 text-xs text-gray-400">{new Date(n.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => startEdit(n)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => toggleActive(n)}>
                      {n.active ? 'Hide' : 'Show'}
                    </Button>
                    <Button size="sm" variant="destructive" disabled={busy} onClick={() => handleDelete(n)}>
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

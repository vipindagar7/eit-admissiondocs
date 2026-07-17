import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card.jsx';
import { Input } from '../../components/ui/input.jsx';
import { Button } from '../../components/ui/button.jsx';
import { Badge } from '../../components/ui/badge.jsx';

const MIME_OPTIONS = [
  { value: 'application/pdf', label: 'PDF' },
  { value: 'image/jpeg', label: 'JPG' },
  { value: 'image/png', label: 'PNG' },
];

export default function AdminDocumentTypes() {
  const [types, setTypes] = useState([]);
  const [form, setForm] = useState({ name: '', description: '', required: true, allowedMimeTypes: ['application/pdf'], maxSizeKB: 5120 });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await api.get('/admin/document-types');
    setTypes(res.documentTypes);
  }

  useEffect(() => {
    load();
  }, []);

  function toggleMime(value) {
    setForm((f) => ({
      ...f,
      allowedMimeTypes: f.allowedMimeTypes.includes(value)
        ? f.allowedMimeTypes.filter((v) => v !== value)
        : [...f.allowedMimeTypes, value],
    }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/admin/document-types', form);
      setForm({ name: '', description: '', required: true, allowedMimeTypes: ['application/pdf'], maxSizeKB: 5120 });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleRequired(dt) {
    setBusy(true);
    try {
      await api.patch(`/admin/document-types/${dt.id}`, { required: !dt.required });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(dt) {
    if (!confirm(`Delete "${dt.name}"? This only works if no student has uploaded one yet.`)) return;
    setBusy(true);
    setError('');
    try {
      await api.delete(`/admin/document-types/${dt.id}`);
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
        <h1 className="text-lg font-semibold text-gray-900">Documents</h1>
        <p className="text-sm text-gray-500">
          Define what students must submit — each item can be mandatory or optional, with its own accepted file types and size limit.
        </p>
      </div>

      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleCreate} className="space-y-3">
            <Input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Document name (e.g. 10th Marksheet)"
            />
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Description / instructions for students (optional)"
            />

            <div className="flex flex-wrap items-center gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.required} onChange={(e) => setForm({ ...form, required: e.target.checked })} />
                Mandatory
              </label>

              <span className="text-gray-300">|</span>

              {MIME_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-center gap-1">
                  <input type="checkbox" checked={form.allowedMimeTypes.includes(opt.value)} onChange={() => toggleMime(opt.value)} />
                  {opt.label}
                </label>
              ))}

              <span className="text-gray-300">|</span>

              <label className="flex items-center gap-2">
                Max
                <input
                  type="number"
                  min={1}
                  max={20480}
                  step={100}
                  value={form.maxSizeKB}
                  onChange={(e) => setForm({ ...form, maxSizeKB: Number(e.target.value) })}
                  className="h-8 w-24 rounded-md border border-gray-300 px-2"
                />
                KB
              </label>
            </div>

            <Button disabled={busy}>Add document requirement</Button>
          </form>
        </CardContent>
      </Card>

      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</p>}

      <div className="space-y-2">
        {types.map((dt) => (
          <Card key={dt.id}>
            <CardContent className="flex items-center justify-between p-4 text-sm">
              <div>
                <p className="font-medium text-gray-900">
                  {dt.name} {dt.required && <span className="text-red-500">*</span>}
                </p>
                {dt.description && <p className="text-xs text-gray-600">{dt.description}</p>}
                <p className="text-xs text-gray-500">{dt.allowedMimeTypes} · max {dt.maxSizeKB}KB</p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" disabled={busy} onClick={() => toggleRequired(dt)}>
                  {dt.required ? 'Make optional' : 'Make mandatory'}
                </Button>
                <Button size="sm" variant="destructive" disabled={busy} onClick={() => handleDelete(dt)}>
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

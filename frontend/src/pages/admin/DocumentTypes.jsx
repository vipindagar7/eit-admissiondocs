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
  const [dragIndex, setDragIndex] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);

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

  function startEdit(dt) {
    setEditingId(dt.id);
    setEditForm({
      name: dt.name,
      description: dt.description || '',
      required: dt.required,
      allowedMimeTypes: dt.allowedMimeTypes.split(',').map((s) => s.trim()),
      maxSizeKB: dt.maxSizeKB,
    });
  }

  function toggleEditMime(value) {
    setEditForm((f) => ({
      ...f,
      allowedMimeTypes: f.allowedMimeTypes.includes(value)
        ? f.allowedMimeTypes.filter((v) => v !== value)
        : [...f.allowedMimeTypes, value],
    }));
  }

  async function handleSaveEdit(dtId) {
    setBusy(true);
    setError('');
    try {
      await api.patch(`/admin/document-types/${dtId}`, editForm);
      setEditingId(null);
      setEditForm(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleTemplateUpload(dtId, file) {
    setBusy(true);
    setError('');
    const form = new FormData();
    form.append('file', file);
    try {
      await api.post(`/admin/document-types/${dtId}/template`, form);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleTemplateDownload(dtId, filename) {
    try {
      const { blob } = await api.download(`/admin/document-types/${dtId}/template`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'template';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  }

  function handleDragStart(index) {
    setDragIndex(index);
  }

  function handleDragOver(e, index) {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    setTypes((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(index, 0, moved);
      return next;
    });
    setDragIndex(index);
  }

  async function handleDragEnd() {
    if (dragIndex === null) return;
    setDragIndex(null);
    setBusy(true);
    setError('');
    try {
      await api.patch('/admin/document-types/reorder', { orderedIds: types.map((t) => t.id) });
    } catch (err) {
      setError(err.message);
      await load(); // re-sync with server if the save failed
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
        {types.map((dt, index) => (
          <Card
            key={dt.id}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className={dragIndex === index ? 'opacity-50' : ''}
          >
            <CardContent className="p-4 text-sm">
              {editingId === dt.id ? (
                <div className="space-y-3">
                  <Input
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    placeholder="Document name"
                  />
                  <Input
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    placeholder="Description / instructions (optional)"
                  />
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={editForm.required} onChange={(e) => setEditForm({ ...editForm, required: e.target.checked })} />
                      Mandatory
                    </label>
                    <span className="text-gray-300">|</span>
                    {MIME_OPTIONS.map((opt) => (
                      <label key={opt.value} className="flex items-center gap-1">
                        <input type="checkbox" checked={editForm.allowedMimeTypes.includes(opt.value)} onChange={() => toggleEditMime(opt.value)} />
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
                        value={editForm.maxSizeKB}
                        onChange={(e) => setEditForm({ ...editForm, maxSizeKB: Number(e.target.value) })}
                        className="h-8 w-24 rounded-md border border-gray-300 px-2"
                      />
                      KB
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" disabled={busy} onClick={() => handleSaveEdit(dt.id)}>Save</Button>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => { setEditingId(null); setEditForm(null); }}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 cursor-grab select-none text-gray-300 active:cursor-grabbing" title="Drag to reorder">
                      ⠿
                    </span>
                    <div>
                      <p className="font-medium text-gray-900">
                        {dt.name} {dt.required && <span className="text-red-500">*</span>}
                      </p>
                      {dt.description && <p className="text-xs text-gray-600">{dt.description}</p>}
                      <p className="text-xs text-gray-500">{dt.allowedMimeTypes} · max {dt.maxSizeKB}KB</p>
                      {dt.templateOriginalName && (
                        <p className="mt-1 text-xs text-brand-600">Template: {dt.templateOriginalName}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {dt.templateOriginalName && (
                      <Button size="sm" variant="outline" onClick={() => handleTemplateDownload(dt.id, dt.templateOriginalName)}>
                        Download template
                      </Button>
                    )}
                    <label className="inline-flex h-8 cursor-pointer items-center justify-center rounded-md border border-gray-300 bg-white px-3 text-xs font-medium hover:bg-gray-50">
                      {dt.templateOriginalName ? 'Replace template' : 'Upload template'}
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        className="hidden"
                        disabled={busy}
                        onChange={(e) => e.target.files[0] && handleTemplateUpload(dt.id, e.target.files[0])}
                      />
                    </label>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => startEdit(dt)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => toggleRequired(dt)}>
                      {dt.required ? 'Make optional' : 'Make mandatory'}
                    </Button>
                    <Button size="sm" variant="destructive" disabled={busy} onClick={() => handleDelete(dt)}>
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

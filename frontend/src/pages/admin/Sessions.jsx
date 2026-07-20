import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card.jsx';
import { Input } from '../../components/ui/input.jsx';
import { Button } from '../../components/ui/button.jsx';

export default function AdminSessions() {
  const [sessions, setSessions] = useState([]);
  const [serviceAccountEmail, setServiceAccountEmail] = useState('');
  const [form, setForm] = useState({ name: '', year: new Date().getFullYear(), batch: '', sheetId: '' });
  const [studentForms, setStudentForms] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [importResult, setImportResult] = useState(null);

  async function load() {
    const [sessionsRes, settingsRes] = await Promise.all([
      api.get('/admin/sessions'),
      api.get('/admin/settings'),
    ]);
    setSessions(sessionsRes.sessions);
    setServiceAccountEmail(settingsRes.serviceAccountEmail);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/admin/sessions', form);
      setForm({ name: '', year: new Date().getFullYear(), batch: '', sheetId: '' });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleImport(sessionId) {
    setBusy(true);
    setError('');
    setImportResult(null);
    try {
      const res = await api.post(`/admin/sessions/${sessionId}/import`);
      setImportResult({ sessionId, ...res.summary });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCsvImport(sessionId, file) {
    setBusy(true);
    setError('');
    setImportResult(null);
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await api.post(`/admin/sessions/${sessionId}/import-csv`, form);
      setImportResult({ sessionId, ...res.summary });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDownloadTemplate() {
    try {
      const { blob, filename } = await api.download('/admin/students/csv-template');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  }

  function studentFormFor(sessionId) {
    return studentForms[sessionId] || { admissionNo: '', name: '', phone: '', email: '', branch: '' };
  }

  function updateStudentForm(sessionId, patch) {
    setStudentForms((prev) => ({ ...prev, [sessionId]: { ...studentFormFor(sessionId), ...patch } }));
  }

  async function handleAddStudent(sessionId, e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const payload = studentFormFor(sessionId);
      await api.post(`/admin/sessions/${sessionId}/students`, {
        ...payload,
        email: payload.email || undefined,
        branch: payload.branch || undefined,
      });
      setStudentForms((prev) => ({ ...prev, [sessionId]: { admissionNo: '', name: '', phone: '', email: '', branch: '' } }));
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function updateSheetId(sessionId, sheetId) {
    setBusy(true);
    setError('');
    try {
      await api.patch(`/admin/sessions/${sessionId}`, { sheetId });
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
        <h1 className="text-lg font-semibold text-gray-900">Sessions</h1>
        <p className="text-sm text-gray-500">Each session is an isolated admission cycle with its own students and sheet.</p>
      </div>

      <Card className="border-brand-200 bg-brand-50/50">
        <CardContent className="p-4 text-sm">
          <p className="font-medium text-brand-700">Share every new sheet with this account:</p>
          <p className="mt-1 font-mono text-brand-600">{serviceAccountEmail || 'loading...'}</p>
          <p className="mt-1 text-gray-500">Give it Viewer access on the Google Sheet before importing.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Create a session</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-5">
            <Input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Session name (e.g. 2026-27 Admission)"
              className="sm:col-span-2"
            />
            <Input
              required
              type="number"
              value={form.year}
              onChange={(e) => setForm({ ...form, year: e.target.value })}
              placeholder="Year"
            />
            <Input
              value={form.batch}
              onChange={(e) => setForm({ ...form, batch: e.target.value })}
              placeholder="Batch (optional)"
            />
            <Input
              value={form.sheetId}
              onChange={(e) => setForm({ ...form, sheetId: e.target.value })}
              placeholder="Sheet ID (optional, add later)"
            />
            <Button disabled={busy} className="sm:col-span-5">Create session</Button>
          </form>
        </CardContent>
      </Card>

      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</p>}
      {importResult && (
        <div className="space-y-2">
          <p className="rounded-md bg-green-50 p-3 text-sm text-green-700">
            Import complete: {importResult.created} created, {importResult.skipped} skipped, {importResult.invalid} invalid rows.
          </p>
          {importResult.failures?.length > 0 && (
            <Card className="border-amber-200 bg-amber-50/40">
              <CardHeader>
                <CardTitle>Rows that need fixing</CardTitle>
                <CardDescription>
                  Fix these rows in your file and re-run the import — rows that already succeeded will just be skipped, not duplicated.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {importResult.failures.map((f, i) => (
                  <div key={i} className="rounded-md border border-amber-200 bg-white p-3 text-sm">
                    <p className="font-medium text-gray-900">Row {f.row}</p>
                    <p className="mt-0.5 text-amber-800">{f.reason}</p>
                    {f.raw && <p className="mt-0.5 truncate text-xs text-gray-500">Data: {f.raw}</p>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div className="space-y-3">
        {sessions.map((s) => (
          <Card key={s.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{s.name}</p>
                  <p className="text-xs text-gray-500">
                    {s.year} {s.batch && `· ${s.batch}`} · {s._count.students} students
                    {s.lastImportedAt && ` · last imported ${new Date(s.lastImportedAt).toLocaleString()}`}
                  </p>
                </div>
                <Button size="sm" disabled={busy || !s.sheetId} onClick={() => handleImport(s.id)}>
                  Start entry (import)
                </Button>
              </div>

              <Input
                defaultValue={s.sheetId || ''}
                onBlur={(e) => e.target.value !== s.sheetId && updateSheetId(s.id, e.target.value)}
                placeholder="Sheet ID"
                className="mt-3"
              />

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="inline-flex h-9 cursor-pointer items-center justify-center rounded-md border border-gray-300 bg-white px-3 text-sm font-medium hover:bg-gray-50">
                  Upload a CSV of students
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    disabled={busy}
                    onChange={(e) => e.target.files[0] && handleCsvImport(s.id, e.target.files[0])}
                  />
                </label>
                <Button type="button" variant="link" size="sm" onClick={handleDownloadTemplate}>
                  Download CSV template
                </Button>
              </div>

              <form onSubmit={(e) => handleAddStudent(s.id, e)} className="mt-3 grid grid-cols-1 gap-2 border-t border-gray-100 pt-3 sm:grid-cols-5">
                <Input
                  required
                  value={studentFormFor(s.id).admissionNo}
                  onChange={(e) => updateStudentForm(s.id, { admissionNo: e.target.value })}
                  placeholder="File No."
                />
                <Input
                  required
                  value={studentFormFor(s.id).name}
                  onChange={(e) => updateStudentForm(s.id, { name: e.target.value })}
                  placeholder="Name"
                />
                <Input
                  required
                  value={studentFormFor(s.id).phone}
                  onChange={(e) => updateStudentForm(s.id, { phone: e.target.value })}
                  placeholder="Phone"
                />
                <Input
                  value={studentFormFor(s.id).email}
                  onChange={(e) => updateStudentForm(s.id, { email: e.target.value })}
                  placeholder="Email (optional)"
                />
                <Button size="sm" disabled={busy}>Add student</Button>
              </form>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
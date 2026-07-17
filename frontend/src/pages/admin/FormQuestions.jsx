import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { Card, CardContent } from '../../components/ui/card.jsx';
import { Input } from '../../components/ui/input.jsx';
import { Button } from '../../components/ui/button.jsx';

export default function AdminFormQuestions() {
  const [questions, setQuestions] = useState([]);
  const [form, setForm] = useState({ label: '', description: '', required: true });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await api.get('/admin/form-questions');
    setQuestions(res.formQuestions);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/admin/form-questions', form);
      setForm({ label: '', description: '', required: true });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleRequired(q) {
    setBusy(true);
    try {
      await api.patch(`/admin/form-questions/${q.id}`, { required: !q.required });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(q) {
    if (!confirm(`Delete question "${q.label}"? Any answers students gave will be lost.`)) return;
    setBusy(true);
    try {
      await api.delete(`/admin/form-questions/${q.id}`);
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
        <h1 className="text-lg font-semibold text-gray-900">Questions</h1>
        <p className="text-sm text-gray-500">
          Text questions students answer on the form, separate from file uploads — e.g. category, Aadhar number, any medical condition.
        </p>
      </div>

      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleCreate} className="space-y-3">
            <Input
              required
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="Question (e.g. Category)"
            />
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Description / instructions for students (optional)"
            />
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.required} onChange={(e) => setForm({ ...form, required: e.target.checked })} />
                Mandatory
              </label>
              <Button disabled={busy}>Add question</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</p>}

      <div className="space-y-2">
        {questions.map((q) => (
          <Card key={q.id}>
            <CardContent className="flex items-center justify-between p-4 text-sm">
              <div>
                <p className="font-medium text-gray-900">
                  {q.label} {q.required && <span className="text-red-500">*</span>}
                </p>
                {q.description && <p className="text-xs text-gray-600">{q.description}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" disabled={busy} onClick={() => toggleRequired(q)}>
                  {q.required ? 'Make optional' : 'Make mandatory'}
                </Button>
                <Button size="sm" variant="destructive" disabled={busy} onClick={() => handleDelete(q)}>
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

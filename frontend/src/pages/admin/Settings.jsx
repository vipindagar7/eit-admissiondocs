import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card.jsx';
import { Input } from '../../components/ui/input.jsx';
import { Button } from '../../components/ui/button.jsx';

export default function AdminSettings() {
  const [fileNameFormat, setFileNameFormat] = useState('');
  const [idleLockMinutes, setIdleLockMinutes] = useState(5);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/admin/settings').then((res) => {
      setFileNameFormat(res.settings.fileNameFormat);
      setIdleLockMinutes(Number(res.settings.idleLockMinutes));
    });
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api.put('/admin/settings', { fileNameFormat, idleLockMinutes });
      setMessage('Settings saved.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="animate-in fade-in max-w-lg space-y-5 duration-300">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Settings</h1>
      </div>

      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleSave} className="space-y-6">
            <div>
              <label className="text-sm font-medium text-gray-700">Download filename format</label>
              <Input
                value={fileNameFormat}
                onChange={(e) => setFileNameFormat(e.target.value)}
                className="mt-1 font-mono"
              />
              <p className="mt-1 text-xs text-gray-500">
                Placeholders: {'{admissionNo} {name} {docType} {year} {session} {batch}'} — only affects the downloaded
                filename, not internal storage. Example: 1_vipin_10thmarksheet
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Idle auto-lock (minutes)</label>
              <Input
                type="number"
                min={1}
                max={120}
                value={idleLockMinutes}
                onChange={(e) => setIdleLockMinutes(e.target.value)}
                className="mt-1 w-32"
              />
              <p className="mt-1 text-xs text-gray-500">Staff/admin screens lock after this many minutes of inactivity.</p>
            </div>

            {message && <p className="rounded-md bg-green-50 p-3 text-sm text-green-700">{message}</p>}
            {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</p>}

            <Button disabled={busy}>Save settings</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

import { useState } from 'react';
import { api } from '../api/client.js';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/card.jsx';
import { Input } from './ui/input.jsx';
import { Button } from './ui/button.jsx';

export default function IdleLockOverlay({ onUnlock }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleUnlock(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.post('/admin/unlock', { password });
      setPassword('');
      onUnlock();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-700/95 backdrop-blur-sm">
      <Card className="w-full max-w-sm animate-in fade-in zoom-in-95 duration-300">
        <form onSubmit={handleUnlock}>
          <CardHeader>
            <CardTitle>Session locked</CardTitle>
            <CardDescription>You've been idle. Enter your password to continue — your work is still here.</CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
            />
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={busy} className="mt-4 w-full">
              {busy ? 'Checking...' : 'Unlock'}
            </Button>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}

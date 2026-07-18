import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { Card, CardContent } from '../../components/ui/card.jsx';
import { Button } from '../../components/ui/button.jsx';
import { Badge } from '../../components/ui/badge.jsx';
import { useOutletContext } from 'react-router-dom';

export default function AdminAccessRequests() {
  const { isAdmin } = useOutletContext();
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const res = await api.get('/admin/access-requests');
      setRequests(res.requests);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleResolved(reqItem) {
    setBusy(true);
    try {
      await api.patch(`/admin/access-requests/${reqItem.id}`, { resolved: !reqItem.resolved });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(reqItem) {
    if (!confirm(`Delete request from ${reqItem.name || reqItem.phone}?`)) return;
    setBusy(true);
    try {
      await api.delete(`/admin/access-requests/${reqItem.id}`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const pending = requests.filter((r) => !r.resolved);
  const resolved = requests.filter((r) => r.resolved);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Access Requests</h1>
        <p className="text-sm text-gray-500">
          Students whose number wasn't found at login, asking to be added. Add them via Sessions, then mark resolved here.
        </p>
      </div>

      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</p>}

      <div className="space-y-2">
        {pending.length === 0 && resolved.length === 0 && (
          <p className="text-sm text-gray-400">No requests yet.</p>
        )}
        {[...pending, ...resolved].map((r) => (
          <Card key={r.id}>
            <CardContent className="flex items-center justify-between p-4 text-sm">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900">{r.name || 'No name given'}</p>
                  {r.resolved && <Badge variant="green">Resolved</Badge>}
                </div>
                <p className="text-xs text-gray-500">{r.phone} · {new Date(r.createdAt).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" disabled={busy} onClick={() => toggleResolved(r)}>
                  {r.resolved ? 'Mark pending' : 'Mark resolved'}
                </Button>
                {isAdmin && (
                  <Button size="sm" variant="destructive" disabled={busy} onClick={() => handleDelete(r)}>
                    Delete
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

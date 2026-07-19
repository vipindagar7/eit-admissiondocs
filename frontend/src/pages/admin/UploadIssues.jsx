import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { Card, CardContent } from '../../components/ui/card.jsx';
import { Input } from '../../components/ui/input.jsx';

export default function AdminUploadIssues() {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const res = await api.get('/admin/upload-issues');
      setLogs(res.logs);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = logs.filter((log) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      log.student.name.toLowerCase().includes(q) ||
      (log.student.fileNo || log.student.admissionNo || '').toLowerCase().includes(q) ||
      log.student.phone.includes(q) ||
      log.documentTypeName.toLowerCase().includes(q)
    );
  });

  return (
    <div className="animate-in fade-in space-y-5 duration-300">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Upload Issues</h1>
        <p className="text-sm text-gray-500">
          Every failed upload attempt, across all students, logged automatically — see exactly what went wrong without asking them.
        </p>
      </div>

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by student name, file no, phone, or document..."
        className="max-w-sm"
      />

      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-gray-400">
            {logs.length === 0 ? 'No upload failures logged yet.' : 'No results match your search.'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((log) => (
            <Card key={log.id} className="border-amber-200 bg-amber-50/40">
              <CardContent className="p-4 text-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-gray-900">
                      {log.student.name}{' '}
                      <span className="font-normal text-gray-500">
                        · File No. {log.student.fileNo || log.student.admissionNo} · {log.student.phone}
                      </span>
                    </p>
                    <p className="mt-0.5 text-gray-700">
                      Tried to upload <span className="font-medium">{log.documentTypeName}</span>
                    </p>
                    <p className="mt-1 text-amber-800">{log.errorMessage}</p>
                    {log.attemptedFilename && (
                      <p className="mt-1 text-xs text-gray-500">
                        File: {log.attemptedFilename}
                        {log.attemptedMimeType && ` · ${log.attemptedMimeType}`}
                        {log.attemptedSizeBytes && ` · ${(log.attemptedSizeBytes / 1024).toFixed(0)} KB`}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-gray-400">{new Date(log.createdAt).toLocaleString()}</p>
                    <Link to={`/admin/students/${log.student.id}`} className="mt-1 inline-block text-sm text-brand-600 hover:underline">
                      View student
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

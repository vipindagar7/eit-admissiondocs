import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { api } from '../../api/client.js';
import { Card, CardContent } from '../../components/ui/card.jsx';
import { Input } from '../../components/ui/input.jsx';
import { Button } from '../../components/ui/button.jsx';
import { Badge } from '../../components/ui/badge.jsx';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui/table.jsx';

const STATUSES = ['PENDING', 'SUBMITTED', 'UNDER_REVIEW', 'RESUBMISSION_REQUIRED', 'VERIFIED', 'ADMITTED'];

const STATUS_VARIANT = {
  PENDING: 'gray',
  SUBMITTED: 'blue',
  UNDER_REVIEW: 'amber',
  RESUBMISSION_REQUIRED: 'red',
  VERIFIED: 'green',
  ADMITTED: 'emerald',
};

export default function AdminStudents() {
  const { isAdmin } = useOutletContext();
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [bulkStatus, setBulkStatus] = useState('SUBMITTED');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [zipBusy, setZipBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      const res = await api.get(`/admin/students?${params}`);
      setStudents(res.students);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [search, statusFilter]);

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === students.length ? new Set() : new Set(students.map((s) => s.id))));
  }

  async function bulkAction(action) {
    if (selected.size === 0) return;
    setBusy(true);
    setError('');
    try {
      const studentIds = Array.from(selected);
      if (action === 'status') {
        await api.post('/admin/students/bulk-status', { studentIds, status: bulkStatus });
      } else if (action === 'block') {
        await api.post('/admin/students/bulk-block', { studentIds, blocked: true, reason: 'Bulk block by admin' });
      } else if (action === 'unblock') {
        await api.post('/admin/students/bulk-block', { studentIds, blocked: false });
      }
      setSelected(new Set());
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleExport() {
    setError('');
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      const { blob } = await api.download(`/admin/students/export?${params}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'students_export.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDownloadZip() {
    setError('');
    setZipBusy(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      const { blob } = await api.download(`/admin/documents/export-zip?${params}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'student_documents.zip';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setZipBusy(false);
    }
  }

  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-1 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Students</h1>
          <p className="text-sm text-gray-500">{students.length} in current view</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            Export to Excel
          </Button>
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={handleDownloadZip} disabled={zipBusy}>
              {zipBusy ? 'Preparing ZIP...' : 'Download All Documents (ZIP)'}
            </Button>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, file no, phone..."
          className="w-64"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm shadow-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {selected.size > 0 && (
        <Card className="mt-4 animate-in fade-in slide-in-from-top-1 border-brand-200 bg-brand-50/50 duration-200">
          <CardContent className="flex flex-wrap items-center gap-3 p-3">
            <span className="text-sm font-medium">{selected.size} selected</span>
            <select
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value)}
              className="h-8 rounded-md border border-gray-300 bg-white px-2 text-sm"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <Button size="sm" disabled={busy} onClick={() => bulkAction('status')}>
              Set status
            </Button>
            {isAdmin && (
              <>
                <Button size="sm" variant="destructive" disabled={busy} onClick={() => bulkAction('block')}>
                  Block
                </Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => bulkAction('unblock')}>
                  Unblock
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {error && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</p>}

      <Card className="mt-4 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <input type="checkbox" checked={selected.size === students.length && students.length > 0} onChange={toggleAll} />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>File No.</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Docs</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="py-6 text-center text-gray-400">Loading...</TableCell></TableRow>
            ) : students.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="py-6 text-center text-gray-400">No students found</TableCell></TableRow>
            ) : (
              students.map((s) => (
                <TableRow key={s.id} className={s.blocked ? 'bg-red-50/40' : ''}>
                  <TableCell>
                    <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} />
                  </TableCell>
                  <TableCell className="font-medium text-gray-900">
                    {s.name} {s.blocked && <span className="ml-1 text-xs text-red-600">(blocked)</span>}
                  </TableCell>
                  <TableCell className="text-gray-500">{s.fileNo || s.admissionNo}</TableCell>
                  <TableCell className="text-gray-500">{s.phone}</TableCell>
                  <TableCell className="text-gray-500">{s._count.documents}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[s.status] || 'gray'}>{s.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Link to={`/admin/students/${s.id}`} className="text-sm font-medium text-brand-600 hover:underline">View</Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
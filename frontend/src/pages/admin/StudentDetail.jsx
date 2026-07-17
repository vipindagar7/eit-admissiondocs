import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate, useOutletContext } from 'react-router-dom';
import { api } from '../../api/client.js';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card.jsx';
import { Badge } from '../../components/ui/badge.jsx';
import { Button } from '../../components/ui/button.jsx';
import { Input } from '../../components/ui/input.jsx';
import PreviewModal from '../../components/PreviewModal.jsx';
import { cn } from '../../lib/utils.js';

const STATUSES = ['PENDING', 'SUBMITTED', 'UNDER_REVIEW', 'RESUBMISSION_REQUIRED', 'VERIFIED', 'ADMITTED'];

const STATUS_VARIANT = {
  PENDING: 'gray',
  SUBMITTED: 'blue',
  UNDER_REVIEW: 'amber',
  RESUBMISSION_REQUIRED: 'red',
  VERIFIED: 'green',
  ADMITTED: 'emerald',
};

const INFO_FIELDS = [
  { key: 'srNo', label: 'SR NO', type: 'number' },
  { key: 'fileNo', label: 'File No.' },
  { key: 'fatherName', label: 'Father Name' },
  { key: 'phone2', label: 'Contact No2' },
  { key: 'branch', label: 'Branch' },
  { key: 'preference1', label: 'Preference 1' },
  { key: 'preference2', label: 'Preference 2' },
  { key: 'preference3', label: 'Preference 3' },
  { key: 'stateQuota', label: 'State Quota' },
  { key: 'category', label: 'Category' },
  { key: 'religion', label: 'Religion' },
  { key: 'jeeRank', label: 'JEE Rank' },
  { key: 'cuetRank', label: 'CUET Rank' },
  { key: 'cetRank', label: 'CET Rank' },
  { key: 'ipuFormFilledStatus', label: 'IPU Form Filled Status' },
  { key: 'seatAllotmentStatus', label: 'Seat Allotment Status' },
  { key: 'allotmentRound', label: 'Allotment Round' },
  { key: 'seatAllotedCourse', label: 'Seat Alloted Course' },
  { key: 'admissionStatus', label: 'Admission Status' },
  { key: 'feeStatus', label: 'FEE Status' },
  { key: 'partAcademicFee', label: 'Part Academic Fee' },
];

export default function AdminStudentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useOutletContext();
  const [student, setStudent] = useState(null);
  const [documentTypes, setDocumentTypes] = useState([]);
  const [note, setNote] = useState('');
  const [infoForm, setInfoForm] = useState({});
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);

  async function load() {
    try {
      const [studentRes, typesRes] = await Promise.all([
        api.get(`/admin/students/${id}`),
        api.get('/admin/document-types'),
      ]);
      setStudent(studentRes.student);
      setDocumentTypes(typesRes.documentTypes);
      setInfoForm(Object.fromEntries(INFO_FIELDS.map((f) => [f.key, studentRes.student[f.key] ?? ''])));
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function handleDownload(documentId) {
    try {
      const { blob, filename } = await api.download(`/admin/documents/${documentId}/download`);
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

  async function handleDelete(documentId) {
    if (!confirm('Delete this document permanently?')) return;
    setBusy(true);
    try {
      await api.delete(`/admin/documents/${documentId}`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleReplace(documentId, file) {
    setBusy(true);
    const form = new FormData();
    form.append('file', file);
    try {
      await api.post(`/admin/documents/${documentId}/replace`, form);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleStatusChange(status) {
    setBusy(true);
    try {
      await api.patch(`/admin/students/${id}/status`, { status, note });
      setNote('');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleBlockToggle() {
    setBusy(true);
    try {
      await api.patch(`/admin/students/${id}/block`, {
        blocked: !student.blocked,
        reason: !student.blocked ? 'Blocked by admin' : undefined,
      });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteStudent() {
    if (!confirm(`Permanently delete ${student.name} and all their uploaded documents? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await api.delete(`/admin/students/${id}`);
      navigate('/admin/students');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  async function handleSaveInfo(e) {
    e.preventDefault();
    setBusy(true);
    setInfoMessage('');
    setError('');
    try {
      const payload = Object.fromEntries(Object.entries(infoForm).filter(([, v]) => v !== ''));
      await api.patch(`/admin/students/${id}/info`, payload);
      setInfoMessage('Saved.');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!student) return <div className="text-sm text-gray-400">{error || 'Loading...'}</div>;

  return (
    <div className="animate-in fade-in space-y-5 duration-300">
      <Link to="/admin/students" className="text-sm text-brand-600 hover:underline">&larr; Back to students</Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{student.name}</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            File No. {student.fileNo || student.admissionNo} · {student.phone} · {student.session?.name}
          </p>
          {student.blocked && (
            <p className="mt-1 text-sm text-red-600">Blocked{student.blockedReason ? `: ${student.blockedReason}` : ''}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button variant={student.blocked ? 'outline' : 'destructive'} size="sm" onClick={handleBlockToggle} disabled={busy}>
              {student.blocked ? 'Unblock' : 'Block'}
            </Button>
          )}
          {isAdmin && (
            <Button variant="destructive" size="sm" onClick={handleDeleteStudent} disabled={busy}>
              Delete Student
            </Button>
          )}
        </div>
      </div>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            {STATUSES.map((s) => (
              <button
                key={s}
                disabled={busy || s === student.status}
                onClick={() => handleStatusChange(s)}
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                  s === student.status ? 'bg-brand-600 text-white' : 'border border-gray-300 hover:bg-gray-50'
                )}
              >
                {s}
              </button>
            ))}
          </div>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note for this status change"
            className="mt-3"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(() => {
              const uploadedTypeIds = new Set(student.documents.map((d) => d.documentTypeId));
              const missingTypes = documentTypes.filter((dt) => !uploadedTypeIds.has(dt.id));
              return (
                <>
                  {student.documents.length === 0 && missingTypes.length === 0 && (
                    <p className="text-sm text-gray-400">No document requirements configured yet.</p>
                  )}
                  {student.documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50/40 p-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{doc.documentType.name}</p>
                        <p className="text-xs text-gray-500">
                          {doc.originalFilename} · {(doc.sizeBytes / 1024).toFixed(0)} KB · {new Date(doc.uploadedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setPreview({
                              src: api.previewUrl(`/admin/documents/${doc.id}/preview`),
                              mimeType: doc.mimeType,
                              filename: doc.originalFilename,
                            })
                          }
                        >
                          Preview
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleDownload(doc.id)}>Download</Button>
                        {isAdmin && (
                          <>
                            <label className="inline-flex h-8 cursor-pointer items-center justify-center rounded-md border border-gray-300 bg-white px-3 text-xs font-medium hover:bg-gray-50">
                              Replace
                              <input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png"
                                className="hidden"
                                disabled={busy}
                                onChange={(e) => e.target.files[0] && handleReplace(doc.id, e.target.files[0])}
                              />
                            </label>
                            <Button size="sm" variant="destructive" disabled={busy} onClick={() => handleDelete(doc.id)}>Delete</Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                  {missingTypes.map((dt) => (
                    <div key={dt.id} className="flex items-center justify-between rounded-lg border border-dashed border-gray-200 bg-gray-50 p-3">
                      <div>
                        <p className="text-sm font-medium text-gray-500">
                          {dt.name} {dt.required && <span className="text-red-500">*</span>}
                        </p>
                        <p className="text-xs text-gray-400">Not submitted yet</p>
                      </div>
                      <Badge variant="gray">Missing</Badge>
                    </div>
                  ))}
                </>
              );
            })()}
          </div>
        </CardContent>
      </Card>

      {student.answers && student.answers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Answers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {student.answers.map((a) => (
              <div key={a.id} className="rounded-lg border border-gray-200 p-3 text-sm">
                <p className="font-medium text-gray-700">{a.question.label}</p>
                <p className="mt-1 text-gray-600">{a.answerText || <span className="text-gray-400">No answer</span>}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Admission Details</CardTitle>
          <CardDescription>{isAdmin ? 'All optional — fill in whatever applies.' : 'Read-only — only admins can edit these.'}</CardDescription>
        </CardHeader>
        <CardContent>
          {isAdmin ? (
            <form onSubmit={handleSaveInfo} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {INFO_FIELDS.map((f) => (
                <div key={f.key}>
                  <label className="text-xs text-gray-500">{f.label}</label>
                  <Input
                    type={f.type || 'text'}
                    value={infoForm[f.key] ?? ''}
                    onChange={(e) => setInfoForm({ ...infoForm, [f.key]: e.target.value })}
                    className="mt-1"
                  />
                </div>
              ))}
              <div className="sm:col-span-3">
                {infoMessage && <p className="mb-2 text-sm text-green-700">{infoMessage}</p>}
                <Button disabled={busy}>Save admission details</Button>
              </div>
            </form>
          ) : (
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-3">
              {INFO_FIELDS.map((f) => (
                <div key={f.key} className="text-sm">
                  <dt className="text-xs text-gray-500">{f.label}</dt>
                  <dd className="font-medium text-gray-900">{student[f.key] || '—'}</dd>
                </div>
              ))}
            </dl>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Status History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1 text-sm text-gray-500">
            {student.statusLogs.map((log) => (
              <p key={log.id}>
                {new Date(log.changedAt).toLocaleString()} — {log.oldStatus} → {log.newStatus}
                {log.note ? ` (${log.note})` : ''}
              </p>
            ))}
          </div>
        </CardContent>
      </Card>

      {preview && (
        <PreviewModal
          src={preview.src}
          mimeType={preview.mimeType}
          filename={preview.filename}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}

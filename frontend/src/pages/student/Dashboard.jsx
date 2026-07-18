import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client.js';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card.jsx';
import { Badge } from '../../components/ui/badge.jsx';
import { Progress } from '../../components/ui/progress.jsx';
import { Button } from '../../components/ui/button.jsx';
import PreviewModal from '../../components/PreviewModal.jsx';
import Logo from '../../components/Logo.jsx';
import LogoWatermark from '../../components/LogoWatermark.jsx';
import { cn } from '../../lib/utils.js';

const STATUS_VARIANT = {
  PENDING: 'gray',
  SUBMITTED: 'blue',
  UNDER_REVIEW: 'amber',
  RESUBMISSION_REQUIRED: 'red',
  VERIFIED: 'green',
  ADMITTED: 'emerald',
};

const STATUS_LABELS = {
  PENDING: 'Pending',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under Review',
  RESUBMISSION_REQUIRED: 'Resubmission Required',
  VERIFIED: 'Verified',
  ADMITTED: 'Admitted',
};

const PREFERENCE_FIELDS = [
  { key: 'preference1', label: 'Preference 1' },
  { key: 'preference2', label: 'Preference 2' },
  { key: 'preference3', label: 'Preference 3' },
];

// Mandatory read-only fields shown to every student, straight from the
// admissions record — not editable here.
const MANDATORY_FIELDS = [
  { key: 'srNo', label: 'SR NO' },
  { key: 'fileNo', label: 'File No.' },
  { key: 'name', label: 'Student Name' },
  { key: 'fatherName', label: 'Father Name' },
  { key: 'phone', label: 'Contact No1' },
  { key: 'phone2', label: 'Contact No2' },
  { key: 'seatAllotedCourse', label: 'Course Allotted' },
];

function fadeIn(delayMs = 0) {
  return {
    className: cn(
      'animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both',
      // Glassmorphism: translucent + blurred background instead of solid white
      'border-white/50 bg-white/50 shadow-xl shadow-black/5 backdrop-blur-lg'
    ),
    style: { animationDelay: `${delayMs}ms` },
  };
}

export default function StudentDashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [preferences, setPreferences] = useState({ preference1: '', preference2: '', preference3: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploadingId, setUploadingId] = useState(null);
  const [savingQuestionId, setSavingQuestionId] = useState(null);
  const [savingPref, setSavingPref] = useState(null);
  const [showReview, setShowReview] = useState(false);
  const [preview, setPreview] = useState(null); // { src, mimeType, filename } | null
  const [notices, setNotices] = useState([]);

  async function load() {
    try {
      const [profileRes, docsRes, questionsRes, noticesRes] = await Promise.all([
        api.get('/student/profile'),
        api.get('/student/documents'),
        api.get('/student/questions'),
        api.get('/student/notices'),
      ]);
      setProfile(profileRes.student);
      setPreferences({
        preference1: profileRes.student.preference1 || '',
        preference2: profileRes.student.preference2 || '',
        preference3: profileRes.student.preference3 || '',
      });
      setDocuments(docsRes.documents);
      setQuestions(questionsRes.questions);
      setNotices(noticesRes.notices);
    } catch (err) {
      if (err.status === 401 || err.status === 403) navigate('/student/login');
      else setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleUpload(documentTypeId, file) {
    setUploadingId(documentTypeId);
    setError('');
    const form = new FormData();
    form.append('file', file);
    try {
      await api.post(`/student/documents/${documentTypeId}/upload`, form);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingId(null);
    }
  }

  async function handleTemplateDownload(documentTypeId, name) {
    try {
      const { blob, filename } = await api.download(`/student/documents/${documentTypeId}/template`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  }

  function updateAnswerLocally(questionId, answerText) {
    setQuestions((prev) => prev.map((q) => (q.questionId === questionId ? { ...q, answerText } : q)));
  }

  async function handleSaveAnswer(questionId, answerText) {
    setSavingQuestionId(questionId);
    setError('');
    try {
      await api.post(`/student/questions/${questionId}/answer`, { answerText });
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingQuestionId(null);
    }
  }

  async function handleSavePreference(key, value) {
    setSavingPref(key);
    setError('');
    try {
      await api.patch('/student/preferences', { [key]: value });
      setProfile((p) => ({ ...p, [key]: value }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingPref(null);
    }
  }

  async function handleLogout() {
    await api.post('/student/logout');
    navigate('/student/login');
  }

  const progress = useMemo(() => {
    const requiredDocs = documents.filter((d) => d.required);
    const docsDone = requiredDocs.filter((d) => d.uploaded).length;
    const requiredQuestions = questions.filter((q) => q.required);
    const questionsDone = requiredQuestions.filter((q) => q.answerText?.trim()).length;
    const prefsDone = PREFERENCE_FIELDS.filter((f) => preferences[f.key]?.trim()).length;
    const totalSteps = requiredDocs.length + requiredQuestions.length + 1;
    const doneSteps = docsDone + questionsDone + (prefsDone > 0 ? 1 : 0);
    return {
      docsDone,
      docsTotal: requiredDocs.length,
      percent: totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 0,
    };
  }, [documents, questions, preferences]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-gray-400">Loading your portal...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-brand-50">
      <LogoWatermark />
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-white/40 bg-white/60 backdrop-blur-lg">
        <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <Logo className="h-10 w-10 shrink-0 text-sm" />
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-brand-600">EIT Faridabad · Admissions</p>
                <h1 className="mt-1 text-xl font-semibold text-gray-900">{profile?.name}</h1>
                <p className="mt-0.5 text-sm text-gray-500">
                  File No. {profile?.fileNo || profile?.admissionNo} {profile?.branch && `· ${profile.branch}`}
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-gray-400 hover:text-red-600">
              Log out
            </Button>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <Badge variant={STATUS_VARIANT[profile?.status] || 'gray'}>{STATUS_LABELS[profile?.status] || profile?.status}</Badge>
            <Progress value={progress.percent} className="flex-1" />
            <span className="text-xs text-gray-400">{progress.percent}% complete</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6">
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</p>}

        {/* Notice board */}
        {notices.length > 0 && (
          <Card {...fadeIn(0)}>
            <CardHeader>
              <CardTitle>Notice Board</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {notices.map((n) => (
                <div key={n.id} className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                  <p className="text-sm font-medium text-gray-900">{n.title}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">{n.content}</p>
                  <p className="mt-1 text-xs text-gray-400">{new Date(n.createdAt).toLocaleDateString()}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Mandatory read-only details */}
        <Card {...fadeIn(25)}>
          <CardHeader>
            <CardTitle>Your Admission Details</CardTitle>
            <CardDescription>From your admission record — contact the office if anything here looks wrong.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              {MANDATORY_FIELDS.map((f) => (
                <div key={f.key} className="flex justify-between border-b border-gray-100 pb-2 text-sm">
                  <dt className="text-gray-500">{f.label}</dt>
                  <dd className="font-medium text-gray-900">{profile?.[f.key] || '—'}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        {/* Preferences (student's own choice) */}
        <Card {...fadeIn(75)}>
          <CardHeader>
            <CardTitle>Your Course Preferences</CardTitle>
            <CardDescription>Choose up to three, in order of preference — separate from the course allotted above.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {PREFERENCE_FIELDS.map((f) => (
                <div key={f.key}>
                  <label className="text-xs font-medium text-gray-500">{f.label}</label>
                  <input
                    value={preferences[f.key]}
                    onChange={(e) => setPreferences({ ...preferences, [f.key]: e.target.value })}
                    onBlur={(e) => handleSavePreference(f.key, e.target.value)}
                    placeholder="e.g. B.Tech CSE"
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm transition focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
                  />
                  {savingPref === f.key && <p className="mt-1 text-xs text-gray-400">Saving...</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Questions */}
        {questions.length > 0 && (
          <Card {...fadeIn(150)}>
            <CardHeader>
              <CardTitle>Additional Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {questions.map((q) => (
                  <div key={q.questionId}>
                    <label className="text-sm font-medium text-gray-900">
                      {q.label} {q.required && <span className="text-red-500">*</span>}
                    </label>
                    {q.description && <p className="mb-1 text-xs text-gray-500">{q.description}</p>}
                    <input
                      value={q.answerText}
                      onChange={(e) => updateAnswerLocally(q.questionId, e.target.value)}
                      onBlur={(e) => handleSaveAnswer(q.questionId, e.target.value)}
                      placeholder="Your answer"
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm transition focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
                    />
                    {savingQuestionId === q.questionId && <p className="mt-1 text-xs text-gray-400">Saving...</p>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Documents */}
        <Card {...fadeIn(225)}>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
            <CardDescription>{progress.docsDone} of {progress.docsTotal} required documents uploaded</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.documentTypeId}
                  className={`flex items-center justify-between rounded-lg border p-3 transition-colors ${
                    doc.uploaded ? 'border-green-200 bg-green-50/40' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs transition-colors ${
                        doc.uploaded ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-500'
                      }`}
                    >
                      {doc.uploaded ? '✓' : '·'}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {doc.name} {doc.required && <span className="text-red-500">*</span>}
                      </p>
                      {doc.description && <p className="text-xs text-gray-500">{doc.description}</p>}
                      <p className="text-xs text-gray-500">
                        {doc.uploaded ? `Uploaded ${new Date(doc.uploadedAt).toLocaleDateString()}` : 'Not uploaded yet'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {doc.hasTemplate && (
                      <button
                        onClick={() => handleTemplateDownload(doc.documentTypeId, doc.name)}
                        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                      >
                        Download template
                      </button>
                    )}
                    {doc.uploaded && (
                      <button
                        onClick={() =>
                          setPreview({
                            src: api.previewUrl(`/student/documents/${doc.documentTypeId}/preview`),
                            mimeType: doc.mimeType,
                            filename: doc.name,
                          })
                        }
                        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                      >
                        Preview
                      </button>
                    )}
                    <label
                      className={`inline-flex h-8 cursor-pointer items-center justify-center whitespace-nowrap rounded-md border border-brand-600 px-3 text-sm text-brand-600 transition-colors hover:bg-brand-50 ${
                        uploadingId === doc.documentTypeId ? 'pointer-events-none opacity-50' : ''
                      }`}
                    >
                      {uploadingId === doc.documentTypeId ? 'Uploading...' : doc.uploaded ? 'Replace' : 'Upload'}
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        className="hidden"
                        disabled={uploadingId === doc.documentTypeId}
                        onChange={(e) => e.target.files[0] && handleUpload(doc.documentTypeId, e.target.files[0])}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Review summary */}
        <Card {...fadeIn(300)}>
          <button onClick={() => setShowReview((v) => !v)} className="flex w-full items-center justify-between p-5 text-left">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Review What You've Submitted</h2>
              <p className="mt-0.5 text-sm text-gray-500">Double-check everything before your review by staff.</p>
            </div>
            <span className="text-gray-400 transition-transform" style={{ transform: showReview ? 'rotate(45deg)' : 'none' }}>
              +
            </span>
          </button>

          {showReview && (
            <div className="animate-in fade-in slide-in-from-top-1 space-y-4 border-t px-5 pb-5 pt-4 text-sm duration-300">
              <div>
                <p className="font-medium text-gray-700">Preferences</p>
                <ul className="mt-1 space-y-0.5 text-gray-600">
                  {PREFERENCE_FIELDS.map((f) => (
                    <li key={f.key}>
                      {f.label}: {preferences[f.key] || <span className="text-gray-400">Not set</span>}
                    </li>
                  ))}
                </ul>
              </div>

              {questions.length > 0 && (
                <div>
                  <p className="font-medium text-gray-700">Additional Information</p>
                  <ul className="mt-1 space-y-0.5 text-gray-600">
                    {questions.map((q) => (
                      <li key={q.questionId}>
                        {q.label}: {q.answerText || <span className="text-gray-400">Not answered</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <p className="font-medium text-gray-700">Documents</p>
                <ul className="mt-1 space-y-0.5 text-gray-600">
                  {documents.map((doc) => (
                    <li key={doc.documentTypeId}>
                      {doc.name}: {doc.uploaded ? `Uploaded ${new Date(doc.uploadedAt).toLocaleDateString()}` : <span className="text-gray-400">Not uploaded</span>}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </Card>
      </main>

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

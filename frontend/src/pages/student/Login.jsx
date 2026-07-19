import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client.js';
import Logo from '../../components/Logo.jsx';

export default function StudentLogin() {
  const navigate = useNavigate();
  const [step, setStep] = useState('phone'); // 'phone' | 'otp' | 'not_found' | 'request_form' | 'request_sent'
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [requestName, setRequestName] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  async function requestOtp(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await api.post('/student/request-otp', { phone });
      setMessage(res.message);
      setStep('otp');
      setResendCooldown(60);
    } catch (err) {
      if (err.status === 404) {
        setStep('not_found');
      } else {
        setError(err.message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    if (resendCooldown > 0) return;
    setError('');
    setResending(true);
    try {
      const res = await api.post('/student/request-otp', { phone });
      setMessage(res.message);
      setResendCooldown(60);
    } catch (err) {
      setError(err.message);
    } finally {
      setResending(false);
    }
  }

  async function verifyOtp(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.post('/student/verify-otp', { phone, otp });
      navigate('/student/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function submitAccessRequest(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.post('/student/access-requests', { phone, name: requestName || undefined });
      setStep('request_sent');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-sm">
        <Logo className="mb-4 h-12 w-12 text-lg" />
        <h1 className="text-xl font-semibold text-brand-600">Document Upload Portal</h1>
        <p className="mt-1 text-sm text-gray-500">EIT Faridabad — Admissions</p>

        {step === 'phone' && (
          <form onSubmit={requestOtp} className="mt-6 space-y-4">
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Registered mobile number"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-md bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {busy ? 'Sending...' : 'Send OTP'}
            </button>
          </form>
        )}

        {step === 'not_found' && (
          <div className="mt-6 space-y-4">
            <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
              This mobile number is not registered with us.
            </p>
            <button
              onClick={() => setStep('request_form')}
              className="w-full rounded-md bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Contact Admin
            </button>
            <button
              onClick={() => setStep('phone')}
              className="w-full text-sm text-gray-500 hover:text-brand-600"
            >
              Try a different number
            </button>
          </div>
        )}

        {step === 'request_form' && (
          <form onSubmit={submitAccessRequest} className="mt-6 space-y-4">
            <p className="text-sm text-gray-500">
              Let us know your number and name — the admissions office will review and add you.
            </p>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Mobile number"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
            />
            <input
              type="text"
              value={requestName}
              onChange={(e) => setRequestName(e.target.value)}
              placeholder="Your name (optional)"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-md bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {busy ? 'Sending...' : 'Submit request'}
            </button>
            <button
              type="button"
              onClick={() => setStep('not_found')}
              className="w-full text-sm text-gray-500 hover:text-brand-600"
            >
              Back
            </button>
          </form>
        )}

        {step === 'request_sent' && (
          <div className="mt-6 space-y-4">
            <p className="rounded-md bg-green-50 p-3 text-sm text-green-700">
              Request received. The admissions office will contact you once your number is added.
            </p>
            <button
              onClick={() => {
                setStep('phone');
                setPhone('');
                setRequestName('');
              }}
              className="w-full text-sm text-brand-600 hover:underline"
            >
              Back to login
            </button>
          </div>
        )}

        {step === 'otp' && (
          <form onSubmit={verifyOtp} className="mt-6 space-y-4">
            <p className="text-sm text-gray-500">{message}</p>
            <input
              type="text"
              required
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="Enter OTP"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm tracking-widest focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-md bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {busy ? 'Verifying...' : 'Verify & Continue'}
            </button>
            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => { setStep('phone'); setResendCooldown(0); }}
                className="text-gray-500 hover:text-brand-600"
              >
                Change number
              </button>
              <button
                type="button"
                onClick={handleResend}
                disabled={resending || resendCooldown > 0}
                className="text-brand-600 hover:underline disabled:opacity-50 disabled:no-underline"
              >
                {resending ? 'Sending...' : resendCooldown > 0 ? `Resend OTP (${resendCooldown}s)` : 'Resend OTP'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
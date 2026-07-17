import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client.js';
import Logo from '../../components/Logo.jsx';

export default function StudentLogin() {
  const navigate = useNavigate();
  const [step, setStep] = useState('phone'); // 'phone' | 'otp'
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);

  async function requestOtp(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await api.post('/student/request-otp', { phone });
      setMessage(res.message);
      setStep('otp');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    setError('');
    setResending(true);
    try {
      const res = await api.post('/student/request-otp', { phone });
      setMessage(res.message);
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

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-sm">
        <Logo className="mb-4 h-12 w-12 text-lg" />
        <h1 className="text-xl font-semibold text-brand-600">Document Upload Portal</h1>
        <p className="mt-1 text-sm text-gray-500">EIT Faridabad — Admissions</p>

        {step === 'phone' ? (
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
        ) : (
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
                onClick={() => setStep('phone')}
                className="text-gray-500 hover:text-brand-600"
              >
                Change number
              </button>
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="text-brand-600 hover:underline disabled:opacity-50"
              >
                {resending ? 'Sending...' : 'Resend OTP'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
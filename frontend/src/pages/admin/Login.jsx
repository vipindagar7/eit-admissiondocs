import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client.js';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/card.jsx';
import { Input } from '../../components/ui/input.jsx';
import { Button } from '../../components/ui/button.jsx';

export default function AdminLogin() {
  const navigate = useNavigate();
  const [step, setStep] = useState('password'); // 'password' | 'otp'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);

  async function submitPassword(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await api.post('/admin/login', { email, password });
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
      const res = await api.post('/admin/login', { email, password });
      setMessage(res.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setResending(false);
    }
  }

  async function submitOtp(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.post('/admin/login/verify-otp', { email, otp });
      navigate('/admin/students');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-sm animate-in fade-in zoom-in-95 duration-300">
        <CardHeader>
          <div className="mb-1 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 text-xs text-white">E</span>
            <CardTitle>Staff Login</CardTitle>
          </div>
          <CardDescription>EIT Document Portal — Admin</CardDescription>
        </CardHeader>
        <CardContent>
          {step === 'password' ? (
            <form onSubmit={submitPassword} className="space-y-4">
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
              <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? 'Checking...' : 'Continue'}
              </Button>
            </form>
          ) : (
            <form onSubmit={submitOtp} className="space-y-4">
              <p className="text-sm text-gray-500">{message}</p>
              <Input
                type="text"
                required
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Enter code from email"
                className="tracking-widest"
              />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" disabled={busy} className="w-full">
                {busy ? 'Verifying...' : 'Verify & Sign in'}
              </Button>
              <div className="flex items-center justify-between text-sm">
                <button type="button" onClick={() => setStep('password')} className="text-gray-500 hover:text-brand-600">
                  Back
                </button>
                <button type="button" onClick={handleResend} disabled={resending} className="text-brand-600 hover:underline disabled:opacity-50">
                  {resending ? 'Sending...' : 'Resend code'}
                </button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

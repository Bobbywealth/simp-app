import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { resendVerification } from '../api/auth';
import { useAuth } from '../store/auth';
import { Button } from '../components/Button';
import { SimpLogo } from '../components/SimpLogo';

export default function VerifyEmailPending() {
  const navigate = useNavigate();
  const { user, refresh } = useAuth();
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('Check your inbox and open the verification link.');
  const [error, setError] = useState<string | null>(null);

  async function check() {
    await refresh();
    const current = useAuth.getState().user;
    if (current?.emailVerified) navigate('/profile-setup', { replace: true });
    else setMessage('Your email is not verified yet. Open the link in your inbox, then check again.');
  }

  async function resend() {
    setSending(true);
    setError(null);
    try {
      await resendVerification();
      setMessage('A new verification link is on its way.');
    } catch (value) {
      setError((value as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-ink-950 px-6 text-center text-white">
      <div className="pointer-events-none absolute inset-0 bg-ink-radial" />
      <main className="relative z-10 w-full max-w-sm">
        <SimpLogo size={64} variant="emblem" />
        <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.24em] text-gold-300">Secure your account</p>
        <h1 className="display-heading mt-2 text-3xl font-light">Verify your email</h1>
        <p className="mt-4 text-sm text-white/60">We sent a secure link to <span className="text-white">{user?.email}</span>.</p>
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm text-white/65" role="status">{message}</div>
        {error && <p className="mt-3 text-xs text-red-300" role="alert">{error}</p>}
        <div className="mt-7 space-y-3">
          <Button onClick={() => void check()}>I verified my email</Button>
          <button type="button" disabled={sending} onClick={() => void resend()} className="w-full min-h-11 text-xs uppercase tracking-[0.18em] text-gold-300 disabled:opacity-40">{sending ? 'Sending…' : 'Resend email'}</button>
        </div>
      </main>
    </div>
  );
}

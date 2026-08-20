import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { verifyEmail } from '../api/auth';
import { SimpLogo } from '../components/SimpLogo';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your email…');

  useEffect(() => {
    if (!token) {
      setState('error');
      setMessage('This verification link is incomplete.');
      return;
    }
    verifyEmail(token)
      .then((result) => {
        setState('success');
        setMessage(result.message);
      })
      .catch((value) => {
        setState('error');
        setMessage((value as Error).message);
      });
  }, [token]);

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-ink-950 px-6 text-center text-white">
      <div className="pointer-events-none absolute inset-0 bg-ink-radial" />
      <main className="relative z-10 w-full max-w-sm">
        <SimpLogo size={64} variant="emblem" />
        <h1 className="display-heading mt-6 text-3xl font-light">Email verification</h1>
        {state === 'loading' && <div className="mx-auto mt-7 h-8 w-8 animate-spin rounded-full border-2 border-gold-400 border-t-transparent" />}
        <p className={`mt-6 text-sm leading-relaxed ${state === 'error' ? 'text-red-200' : state === 'success' ? 'text-green-100' : 'text-white/55'}`}>{message}</p>
        {state !== 'loading' && (
          <Link to={state === 'success' ? '/profile-setup' : '/login'} className="btn-gold mt-7 inline-block px-7 py-3 text-xs font-semibold uppercase tracking-[0.18em]">
            {state === 'success' ? 'Continue setup' : 'Return to sign in'}
          </Link>
        )}
      </main>
    </div>
  );
}

import { FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { resetPassword } from '../api/auth';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { SimpLogo } from '../components/SimpLogo';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) return setError('Passwords do not match.');
    setLoading(true);
    setError(null);
    try {
      await resetPassword(token, password);
      setSuccess(true);
    } catch (value) {
      setError((value as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-ink-950 px-6 text-white">
      <div className="pointer-events-none absolute inset-0 bg-ink-radial" />
      <main className="relative z-10 w-full max-w-sm text-center">
        <SimpLogo size={58} variant="emblem" />
        <h1 className="display-heading mt-5 text-3xl font-light">Choose a new password</h1>
        {!token ? (
          <p className="mt-5 text-sm text-red-200">This reset link is incomplete.</p>
        ) : success ? (
          <div className="mt-7 rounded-2xl border border-green-400/20 bg-green-500/10 p-5 text-sm text-green-100">Your password is updated. All previous sessions were signed out.</div>
        ) : (
          <form onSubmit={submit} className="mt-8 space-y-5 text-left">
            <Input label="New password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} helperText="10+ characters with uppercase, lowercase, and a number" required />
            <Input label="Confirm password" type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} required />
            {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
            <Button type="submit" loading={loading}>Update password</Button>
          </form>
        )}
        <Link to="/login" className="mt-6 inline-block text-xs uppercase tracking-[0.18em] text-gold-300">Sign in</Link>
      </main>
    </div>
  );
}

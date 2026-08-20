import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../api/auth';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { NavHeader } from '../components/NavHeader';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await forgotPassword(email);
      setMessage(result.message);
    } catch (value) {
      setError((value as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-ink-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-ink-radial" />
      <NavHeader title="Password help" alwaysCompact showBack />
      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-10">
        <h1 className="display-heading text-3xl font-light">Reset your password</h1>
        <div className="gold-divider mt-4 !mx-0" />
        <p className="mt-4 text-sm leading-relaxed text-white/60">Enter your account email. If it matches an account, we’ll send a secure link that expires in 30 minutes.</p>
        {message ? (
          <div className="mt-8 rounded-2xl border border-green-400/20 bg-green-500/10 p-5 text-sm text-green-100" role="status">{message}</div>
        ) : (
          <form onSubmit={submit} className="mt-8 space-y-5">
            <Input label="Email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
            <Button type="submit" loading={loading}>Send reset link</Button>
          </form>
        )}
        <Link to="/login" className="mt-6 text-center text-xs uppercase tracking-[0.18em] text-gold-300">Return to sign in</Link>
      </main>
    </div>
  );
}

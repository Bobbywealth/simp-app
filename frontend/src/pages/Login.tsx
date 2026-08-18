import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { SimpLogo } from '../components/SimpLogo';
import { login, me } from '../api/auth';
import { useAuth } from '../store/auth';

type FormValues = { email: string; password: string };

const LAST_EMAIL_KEY = 'simp_last_login_email';

export default function Login() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      email: localStorage.getItem(LAST_EMAIL_KEY) ?? '',
      password: '',
    },
  });

  useEffect(() => {
    // Re-hydrate the saved email on mount in case the form mounted with empty defaults
    const saved = localStorage.getItem(LAST_EMAIL_KEY);
    if (saved) setValue('email', saved);
  }, [setValue]);

  const onSubmit = async (data: FormValues) => {
    localStorage.setItem(LAST_EMAIL_KEY, data.email);
    setError(null);
    setSubmitting(true);
    try {
      await login(data);
      const meData = await me();
      setUser(meData);
      if (!meData.emailVerified) navigate('/verify-email-pending', { replace: true });
      else if (!meData.profile || !meData.onboardingCompletedAt) navigate('/profile-setup', { replace: true });
      else navigate('/home', { replace: true });
    } catch (e) {
      setError((e as Error).message || 'Log in failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-ink-950 text-white">
      <div className="absolute inset-0 bg-ink-radial pointer-events-none" />
      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col py-10"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="mb-6"
          >
            <SimpLogo size={88} variant="emblem" />
          </motion.div>
          <h1 className="display-heading text-3xl font-light">Welcome back</h1>
          <div className="gold-divider mt-4 !mx-0" />
          <p className="mt-4 text-sm text-white/70">Log in to continue your journey.</p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-10 space-y-5" noValidate>
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              {...register('email', { required: 'Email is required' })}
              error={errors.email?.message}
            />
            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              placeholder="********"
              {...register('password', { required: 'Password is required' })}
              error={errors.password?.message}
            />

            {error && (
              <p className="text-xs text-red-400" role="alert">
                {error}
              </p>
            )}

            <div className="text-right">
              <Link to="/forgot-password" className="text-xs text-gold-300 hover:text-gold-200">Forgot password?</Link>
            </div>
            <Button type="submit" loading={submitting} className="mt-3">
              Log in
            </Button>
          </form>
        </motion.div>

        <div className="pb-safe py-6 text-center text-sm text-white/60">
          New here?{' '}
          <Link to="/signup" className="text-gold-300 hover:text-gold-200">
            Create an account
          </Link>
        </div>

        {import.meta.env.DEV && (
        <div className="pb-safe mt-6 rounded-2xl border border-dashed border-white/10 bg-ink-900/40 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
            Test login
          </p>
          <p className="mt-2 text-xs text-white/60">
            Want to poke around? Use the seeded test user:
          </p>
          <button
            type="button"
            onClick={() => {
              setValue('email', 'kenji@simp-seed.demo');
              setValue('password', 'Demo123!');
            }}
            className="mt-3 w-full rounded-full border border-gold-400/30 bg-gold-400/10 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-gold-200 hover:bg-gold-400/20"
          >
            Use Kenji (test user)
          </button>
        </div>
        )}
      </main>
    </div>
  );
}

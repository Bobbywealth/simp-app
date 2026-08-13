import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { SimpLogo } from '../components/SimpLogo';
import { NavHeader } from '../components/NavHeader';
import { useSwipeBack } from '../hooks/useSwipeBack';
import { haptics } from '../lib/haptics';
import { login, me } from '../api/auth';
import { useAuth } from '../store/auth';

type FormValues = { email: string; password: string };

export default function Login() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  // iOS-style left-edge swipe-back to /welcome
  useSwipeBack(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: { email: '', password: '' } });

  const onSubmit = async (data: FormValues) => {
    setError(null);
    setSubmitting(true);
    try {
      await login(data);
      const meData = await me();
      setUser(meData);
      haptics.success();
      if (!meData.profile) navigate('/profile-setup', { replace: true });
      else navigate('/home', { replace: true });
    } catch (e) {
      haptics.heavy();
      setError((e as Error).message || 'Log in failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-ink-950 text-white">
      <div className="absolute inset-0 bg-ink-radial pointer-events-none" />
      <NavHeader title="Welcome back" alwaysCompact showBack />
      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col px-6 pt-2">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-1 flex-col justify-center py-10"
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

            <Button type="submit" loading={submitting} className="mt-6">
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
      </main>
    </div>
  );
}

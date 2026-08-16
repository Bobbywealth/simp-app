import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { NavHeader } from '../components/NavHeader';
import { useSwipeBack } from '../hooks/useSwipeBack';
import { haptics } from '../lib/haptics';
import { signup } from '../api/auth';
import { useAuth } from '../store/auth';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters'),
  displayName: z.string().min(2, 'At least 2 characters').max(40, 'Max 40 characters'),
});

type FormValues = z.infer<typeof schema>;

export default function Signup() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  useSwipeBack(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: { email: '', password: '', displayName: '' } });

  const onSubmit = async (data: FormValues) => {
    setError(null);
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Please check your inputs');
      return;
    }
    setSubmitting(true);
    try {
      await signup(parsed.data);
      // Force a refresh of the auth user state
      const me = await (await import('../api/auth')).me();
      setUser(me);
      haptics.success();
      navigate('/profile-setup', { replace: true });
    } catch (e) {
      haptics.heavy();
      setError((e as Error).message || 'Sign up failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-ink-950 text-white">
      <div className="absolute inset-0 bg-ink-radial pointer-events-none" />
      <NavHeader title="Create account" alwaysCompact showBack />
      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col px-6 pt-2">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-1 flex-col justify-center py-10"
        >
          <h1 className="display-heading text-3xl font-light">Create your account</h1>
          <div className="gold-divider mt-4 !mx-0" />
          <p className="mt-4 text-sm text-white/70">
            Welcome to SIMP. Set up your account to begin your journey.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-10 space-y-5" noValidate>
            <Input
              label="Display name"
              type="text"
              autoComplete="name"
              placeholder="How you'll appear"
              {...register('displayName')}
              error={errors.displayName?.message}
            />
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              {...register('email')}
              error={errors.email?.message}
            />
            <Input
              label="Password"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              {...register('password')}
              error={errors.password?.message}
            />

            {error && (
              <p className="text-xs text-red-400" role="alert">
                {error}
              </p>
            )}

            <Button type="submit" loading={submitting} className="mt-6">
              Create my account
            </Button>

            <p className="text-center text-xs text-white/50">
              By creating an account, you agree to our Terms and Privacy Policy.
            </p>
          </form>
        </motion.div>

        <div className="pb-safe py-6 text-center text-sm text-white/60">
          Already have an account?{' '}
          <Link to="/login" className="text-gold-300 hover:text-gold-200">
            Log in
          </Link>
        </div>
      </main>
    </div>
  );
}

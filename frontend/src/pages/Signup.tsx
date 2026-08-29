import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { NavHeader } from '../components/NavHeader';
import { PasswordStrengthMeter } from '../components/PasswordStrengthMeter';
import AppleSignInButton, { type AppleCredential } from '../components/AppleSignInButton';
import { useSwipeBack } from '../hooks/useSwipeBack';
import { haptics } from '../lib/haptics';
import { appleSignIn, me, signup } from '../api/auth';
import { useAuth } from '../store/auth';
import { track } from '../api/analytics';

const schema = z.object({
  email: z.string().trim().email('Enter a valid email'),
  password: z
    .string()
    .min(10, 'At least 10 characters')
    .regex(/[a-z]/, 'Add a lowercase letter')
    .regex(/[A-Z]/, 'Add an uppercase letter')
    .regex(/[0-9]/, 'Add a number'),
  displayName: z
    .string()
    .trim()
    .min(2, 'At least 2 characters')
    .max(40, 'Max 40 characters'),
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
    watch,
    setError: setFieldError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: { email: '', password: '', displayName: '' },
  });

  const watchedPassword = watch('password', '');

  const onSubmit = async (data: FormValues) => {
    setError(null);
    setSubmitting(true);
    void track('signup_started');
    try {
      await signup(data);
      const meData = await me();
      setUser(meData);
      haptics.success();
      void track('signup_completed');
      navigate('/verify-email-pending', { replace: true });
    } catch (e) {
      haptics.heavy();
      const err = e as Error & { fieldErrors?: Record<string, string[]>; code?: string };
      // Map server-side field errors back to per-input errors when possible
      if (err.fieldErrors) {
        for (const [field, messages] of Object.entries(err.fieldErrors)) {
          if (field in data && messages[0]) {
            setFieldError(field as keyof FormValues, { type: 'server', message: messages[0] });
          }
        }
      }
      const firstFieldError = err.fieldErrors ? Object.values(err.fieldErrors).flat()[0] : undefined;
      setError(firstFieldError ?? err.message ?? 'Sign up failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Sign up with Apple. The first-time-only user blob (name + email)
  // is forwarded to the backend so it can create the account with the
  // user's real name (Apple only sends it once).
  const handleAppleSuccess = async (cred: AppleCredential) => {
    setError(null);
    setSubmitting(true);
    void track('signup_started');
    try {
      const result = await appleSignIn({
        identityToken: cred.identityToken,
        fullName: cred.fullName,
        firstName: cred.firstName,
        lastName: cred.lastName,
        email: cred.email,
        rawUser: cred.rawUser,
      });
      const meData = await me();
      setUser(meData);
      haptics.success();
      void track('signup_completed');
      // New Apple users land straight in onboarding; existing users go
      // home (verify-email-pending is irrelevant for Apple since the
      // email comes back as verified from the JWT).
      if (result.isNewUser || !meData.profile || !meData.onboardingCompletedAt) {
        navigate('/profile-setup', { replace: true });
      } else {
        navigate('/home', { replace: true });
      }
    } catch (e) {
      haptics.heavy();
      setError((e as Error).message || 'Apple sign-up failed');
    } finally {
      setSubmitting(false);
    }
  };

  const appleClientId = import.meta.env.VITE_APPLE_CLIENT_ID;
  const showApple = Boolean(appleClientId);
  const appleClientIdValue = appleClientId ?? '';

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
              placeholder="10+ characters"
              {...register('password')}
              error={errors.password?.message}
            />
            {watchedPassword && <PasswordStrengthMeter password={watchedPassword} />}

            {error && (
              <p className="text-xs text-red-400" role="alert">
                {error}
              </p>
            )}

            <Button type="submit" loading={submitting} className="mt-6">
              Create my account
            </Button>

            <p className="text-center text-[11px] text-white/50">
              By continuing, you agree to our{' '}
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-gold-300 hover:text-gold-200 underline">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-gold-300 hover:text-gold-200 underline">
                Privacy Policy
              </a>
              .
            </p>
          </form>

          {showApple && (
            <div className="mt-6">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-[10px] uppercase tracking-[0.18em] text-white/40">or</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>
              <div className="mt-4">
                <AppleSignInButton
                  clientId={appleClientIdValue}
                  mode="sign-in"
                  onSuccess={handleAppleSuccess}
                  onError={(e) => setError((e as Error)?.message ?? 'Apple sign-up failed')}
                  disabled={submitting}
                />
              </div>
            </div>
          )}
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

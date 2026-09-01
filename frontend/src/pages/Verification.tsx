import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import SelfieCapture from '../components/SelfieCapture';
import {
  cancelVerificationSelfie,
  getVerificationStatus,
  submitVerificationSelfie,
  type VerificationPose,
  type VerificationStatus,
} from '../api/verification';
import NavHeader from '../components/NavHeader';

type SubmissionStep = 'intro' | 'capture' | 'submitting' | 'success' | 'error';

function formatCooldown(endsAtIso: string): string {
  const ends = new Date(endsAtIso).getTime();
  const diffMs = ends - Date.now();
  if (Number.isNaN(diffMs) || diffMs <= 0) return 'a moment';
  const hours = Math.floor(diffMs / 3_600_000);
  const minutes = Math.floor((diffMs % 3_600_000) / 60_000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${Math.max(1, minutes)}m`;
}

export default function Verification() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<VerificationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<SubmissionStep>('intro');
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const value = await getVerificationStatus();
      setStatus(value);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load verification status.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleStart = useCallback(() => {
    setError(null);
    setStep('capture');
  }, []);

  const handleComplete = useCallback(
    async (payload: {
      file: Blob;
      poseSequence: VerificationPose[];
      livenessHints: { framesCaptured: number; faceMovedBetweenFrames: boolean; capturedAt: string[] };
    }) => {
      setStep('submitting');
      setError(null);
      try {
        await submitVerificationSelfie(payload);
        setStep('success');
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Selfie submission failed.');
        setStep('error');
        await refresh();
      }
    },
    [refresh],
  );

  const handleCancelPending = useCallback(async () => {
    setError(null);
    try {
      await cancelVerificationSelfie();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to cancel the pending request.');
    }
  }, [refresh]);

  if (loading) {
    return (
      <div className="page-luxe flex min-h-screen items-center justify-center text-sm text-white/60">
        Loading verification status…
      </div>
    );
  }

  // Already verified: short-circuit with celebratory state.
  if (status?.isVerified) {
    return (
      <div className="page-luxe flex min-h-screen flex-col">
        <NavHeader title="Profile verification" />
        <main className="mx-auto w-full max-w-md space-y-6 px-4 py-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-gold/30 bg-gold/10 p-6 text-center"
          >
            <div className="text-4xl">✓</div>
            <p className="mt-3 text-sm font-medium uppercase tracking-[0.2em] text-gold">Verified</p>
            <p className="mt-3 text-xs text-white/70">
              Your profile shows a verified badge across discovery and matches.
            </p>
          </motion.div>
          <button
            type="button"
            onClick={() => navigate('/profile/view')}
            className="btn-gold-outline w-full py-3 text-xs uppercase tracking-[0.2em]"
          >
            Back to profile
          </button>
        </main>
      </div>
    );
  }

  // Pending selfie: show the existing selfie + cancel option instead of recapture.
  if (status?.pendingRequest) {
    return (
      <div className="page-luxe flex min-h-screen flex-col">
        <NavHeader title="Profile verification" />
        <main className="mx-auto w-full max-w-md space-y-6 px-4 py-6">
          <div className="rounded-3xl border border-white/[0.08] bg-black-700/70 p-5 text-center">
            <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-gold">Pending review</p>
            <p className="mt-3 text-sm text-white/80">
              Your selfie is in our moderator queue. Reviews typically complete within 24 hours.
            </p>
            {status.pendingRequest.selfieUrl && (
              <img
                src={status.pendingRequest.selfieUrl}
                alt="Submitted selfie"
                className="mx-auto mt-5 aspect-square w-48 rounded-2xl object-cover"
              />
            )}
            <p className="mt-4 text-[10px] uppercase tracking-[0.2em] text-white/40">
              Submitted {new Date(status.pendingRequest.createdAt).toLocaleString()}
            </p>
          </div>
          <button
            type="button"
            className="btn-gold-outline w-full py-3 text-[10px] uppercase tracking-[0.2em]"
            onClick={() => void handleCancelPending()}
          >
            Cancel and resubmit
          </button>
          <button
            type="button"
            onClick={() => navigate('/profile/view')}
            className="w-full py-2 text-[10px] uppercase tracking-[0.2em] text-white/40"
          >
            Back to profile
          </button>
        </main>
      </div>
    );
  }

  // Cooldown: previous rejection still within 24h window.
  if (status?.lastDecision?.status === 'REJECTED' && status.cooldownEndsAt && !status.canResubmit) {
    return (
      <div className="page-luxe flex min-h-screen flex-col">
        <NavHeader title="Profile verification" />
        <main className="mx-auto w-full max-w-md space-y-6 px-4 py-6">
          <div className="rounded-3xl border border-red-400/20 bg-red-500/10 p-5 text-center">
            <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-red-300">Review declined</p>
            <p className="mt-3 text-xs text-white/70">
              We couldn’t verify your previous submission. You can try again in{' '}
              <span className="text-white">{formatCooldown(status.cooldownEndsAt)}</span>.
            </p>
            {status.lastDecision.reviewNote && (
              <p className="mt-4 rounded-xl bg-black/30 p-5 text-left text-xs italic text-white/60">
                “{status.lastDecision.reviewNote}”
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => navigate('/profile/view')}
            className="btn-gold-outline w-full py-3 text-xs uppercase tracking-[0.2em]"
          >
            Back to profile
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="page-luxe flex min-h-screen flex-col">
      <NavHeader title="Profile verification" />
      <main className="mx-auto w-full max-w-md space-y-6 px-4 py-6">
        {error && (
          <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-xs text-red-100" role="alert">
            {error}
          </div>
        )}

        {step === 'intro' && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5"
          >
            <div className="rounded-3xl border border-white/[0.08] bg-black-700/60 p-5">
              <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-gold">Get verified</p>
              <h1 className="mt-3 text-2xl font-semibold leading-tight">Prove you look like your photos.</h1>
              <p className="mt-3 text-sm text-white/70">
                We’ll ask you to take three quick selfies following simple pose prompts. A human moderator compares your selfies against your existing profile photos and approves verified profiles within 24 hours.
              </p>
            </div>

            <ul className="space-y-3 rounded-3xl border border-white/[0.08] bg-white/[0.03] p-5 text-sm text-white/70">
              <li className="flex gap-3">
                <span className="text-gold">1.</span>
                Hold your phone in front of your face in a well-lit area.
              </li>
              <li className="flex gap-3">
                <span className="text-gold">2.</span>
                Follow three on-screen pose prompts: look straight, then turn left, then turn right.
              </li>
              <li className="flex gap-3">
                <span className="text-gold">3.</span>
                Review the captured selfie and submit it for moderator review.
              </li>
            </ul>

            <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">
              Selfies are processed for moderator review and permanently deleted afterwards. They are not used as persistent biometric data.
            </p>

            <button
              type="button"
              onClick={handleStart}
              className="btn-gold w-full py-3 text-xs uppercase tracking-[0.2em]"
              disabled={!status?.canResubmit}
            >
              {status?.canResubmit === false ? 'Try again later' : 'Begin verification'}
            </button>
          </motion.div>
        )}

        {step === 'capture' && (
          <SelfieCapture
            onComplete={(payload) => void handleComplete(payload)}
            onCancel={() => setStep('intro')}
            busy={step === 'submitting'}
          />
        )}

        {step === 'submitting' && (
          <div className="rounded-3xl border border-white/[0.08] bg-black-700/60 p-6 text-center text-sm text-white/70">
            Submitting your selfie…
          </div>
        )}

        {step === 'success' && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5 text-center"
          >
            <div className="rounded-3xl border border-gold/30 bg-gold/10 p-6">
              <div className="text-4xl">📨</div>
              <p className="mt-3 text-sm font-medium uppercase tracking-[0.2em] text-gold">Submitted</p>
              <p className="mt-3 text-xs text-white/70">
                Your selfie is in our moderator queue. You’ll see the verified badge on your profile within 24 hours once it’s approved.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/profile/view')}
              className="btn-gold-outline w-full py-3 text-xs uppercase tracking-[0.2em]"
            >
              Back to profile
            </button>
          </motion.div>
        )}

        {step === 'error' && (
          <div className="space-y-4 text-center">
            <div className="rounded-3xl border border-red-400/30 bg-red-500/10 p-5 text-xs text-red-100">
              We couldn’t submit your selfie. {error}
            </div>
            <button
              type="button"
              onClick={() => setStep('capture')}
              className="btn-gold-outline w-full py-3 text-xs uppercase tracking-[0.2em]"
            >
              Try again
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
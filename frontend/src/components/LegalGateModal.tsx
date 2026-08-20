import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  acceptLegal,
  confirmAge,
  getPrivacy,
  getTos,
  type LegalDocument,
} from '../api/legal';

interface LegalGateModalProps {
  /**
   * `missing` is the list of legal steps that the user still needs to
   * complete, as returned by the backend's 451 response on POST
   * /live/streams (or by GET /legal/status). The modal only shows the
   * steps in this list, so if the user already accepted everything we
   * render an empty / success state instead of re-prompting.
   */
  missing: Array<'age' | 'tos' | 'privacy'>;
  onComplete: () => void;
  onClose: () => void;
}

/**
 * Legal gate modal — shown before the first live stream (and on any
 * subsequent ToS / Privacy version bump).
 *
 * Flow:
 *   1. Fetch current status + the two documents.
 *   2. Render scrollable ToS and Privacy panels; require scroll-to-bottom
 *      AND an explicit "I agree" checkbox before allowing submission.
 *   3. On submit: POST age confirm + ToS accept + Privacy accept in parallel,
 *      then call `onComplete` so the caller can retry the original action
 *      (e.g. starting the stream).
 *
 * Each accept call is idempotent server-side (re-accepting the same
 * version just creates another TosAcceptance row, which is harmless).
 */
export function LegalGateModal({ missing, onComplete, onClose }: LegalGateModalProps) {
  const [tos, setTos] = useState<LegalDocument | null>(null);
  const [privacy, setPrivacy] = useState<LegalDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [tosScrolled, setTosScrolled] = useState(false);
  const [privacyScrolled, setPrivacyScrolled] = useState(false);
  const [ageChecked, setAgeChecked] = useState(false);
  const [tosChecked, setTosChecked] = useState(false);
  const [privacyChecked, setPrivacyChecked] = useState(false);

  const tosScrollRef = useRef<HTMLDivElement>(null);
  const privacyScrollRef = useRef<HTMLDivElement>(null);

  const needsAge = missing.includes('age');
  const needsTos = missing.includes('tos');
  const needsPrivacy = missing.includes('privacy');

  useEffect(() => {
    if (!needsTos && !needsPrivacy && !needsAge) {
      // Nothing to do — caller should not have opened this modal.
      onComplete();
      return;
    }
    void (async () => {
      try {
        const [t, p] = await Promise.all([
          needsTos ? getTos() : Promise.resolve(null),
          needsPrivacy ? getPrivacy() : Promise.resolve(null),
        ]);
        setTos(t);
        setPrivacy(p);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset scroll-to-bottom checkboxes when the doc loads so the user
  // can't just tap-agree without actually reading.
  useEffect(() => {
    if (tos) setTosScrolled(false);
  }, [tos]);
  useEffect(() => {
    if (privacy) setPrivacyScrolled(false);
  }, [privacy]);

  function onScroll(ref: React.RefObject<HTMLDivElement>, setScrolled: (b: boolean) => void) {
    const el = ref.current;
    if (!el) return;
    // Consider "read" if scrolled within 24px of the bottom OR the content
    // is shorter than the container (nothing to scroll).
    const reachedBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    if (reachedBottom) setScrolled(true);
  }

  function canSubmit(): boolean {
    if (needsAge && !ageChecked) return false;
    if (needsTos && (!tosScrolled || !tosChecked)) return false;
    if (needsPrivacy && (!privacyScrolled || !privacyChecked)) return false;
    return true;
  }

  async function handleSubmit() {
    if (!canSubmit() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const tasks: Promise<unknown>[] = [];
      if (needsAge) tasks.push(confirmAge());
      if (needsTos && tos) tasks.push(acceptLegal('tos', tos.version));
      if (needsPrivacy && privacy) tasks.push(acceptLegal('privacy', privacy.version));
      await Promise.all(tasks);
      onComplete();
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className="flex h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border-t border-gold-400/30 bg-ink-950 sm:rounded-3xl sm:border"
      >
        <div className="mx-auto mt-2 h-1 w-12 rounded-full bg-white/20 sm:hidden" />
        <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-300">
              Before you go live
            </p>
            <p className="mt-1 text-sm text-white/70">
              We need a few legal confirmations before you can broadcast.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-white/15 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-white/60 hover:border-white/30 hover:text-white"
            aria-label="Close"
          >
            Close
          </button>
        </header>

        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold-400 border-t-transparent" />
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
            {needsAge && (
              <section className="rounded-2xl border border-gold-400/30 bg-ink-900/60 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-300">
                  Step 1 — Age confirmation
                </p>
                <p className="mt-2 text-sm text-white/80">
                  SIMP is only for adults. Live streaming and dating features are not
                  available to anyone under 18 (or the age of majority in your
                  jurisdiction, whichever is older).
                </p>
                <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-ink-950/60 p-3 transition hover:border-gold-400/40">
                  <input
                    type="checkbox"
                    checked={ageChecked}
                    onChange={(e) => setAgeChecked(e.target.checked)}
                    className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-gold-400"
                  />
                  <span className="text-sm text-white">
                    I confirm that I am <strong className="text-gold-300">18 years of age or older</strong>.
                  </span>
                </label>
              </section>
            )}

            {needsTos && tos && (
              <section className="rounded-2xl border border-white/10 bg-ink-900/40 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-300">
                    Step {needsAge ? 2 : 1} — Terms of Service
                  </p>
                  <span className="text-[10px] text-white/40">v{tos.version}</span>
                </div>
                <p className="mt-2 text-sm text-white/70">{tos.summary}</p>
                <div
                  ref={tosScrollRef}
                  onScroll={() => onScroll(tosScrollRef, setTosScrolled)}
                  className="mt-3 h-48 overflow-y-auto rounded-xl border border-white/10 bg-ink-950/70 p-3 text-[11px] leading-relaxed text-white/70"
                >
                  <pre className="whitespace-pre-wrap font-sans">{tos.content}</pre>
                  {!tosScrolled && (
                    <p className="mt-3 text-center text-[10px] uppercase tracking-[0.2em] text-gold-300/70">
                      ↓ Scroll to read all ↓
                    </p>
                  )}
                </div>
                <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-ink-950/60 p-3 transition hover:border-gold-400/40">
                  <input
                    type="checkbox"
                    checked={tosChecked}
                    disabled={!tosScrolled}
                    onChange={(e) => setTosChecked(e.target.checked)}
                    className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-gold-400 disabled:cursor-not-allowed disabled:opacity-30"
                  />
                  <span
                    className={`text-sm ${
                      tosScrolled ? 'text-white' : 'text-white/40'
                    }`}
                  >
                    I have read and agree to the{' '}
                    <strong className="text-gold-300">Terms of Service</strong>.
                    {!tosScrolled && (
                      <span className="ml-1 text-[10px] uppercase tracking-[0.18em] text-white/30">
                        (scroll first)
                      </span>
                    )}
                  </span>
                </label>
              </section>
            )}

            {needsPrivacy && privacy && (
              <section className="rounded-2xl border border-white/10 bg-ink-900/40 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-300">
                    Step {needsAge && needsTos ? 3 : needsAge || needsTos ? 2 : 1} — Privacy Policy
                  </p>
                  <span className="text-[10px] text-white/40">v{privacy.version}</span>
                </div>
                <p className="mt-2 text-sm text-white/70">{privacy.summary}</p>
                <div
                  ref={privacyScrollRef}
                  onScroll={() => onScroll(privacyScrollRef, setPrivacyScrolled)}
                  className="mt-3 h-48 overflow-y-auto rounded-xl border border-white/10 bg-ink-950/70 p-3 text-[11px] leading-relaxed text-white/70"
                >
                  <pre className="whitespace-pre-wrap font-sans">{privacy.content}</pre>
                  {!privacyScrolled && (
                    <p className="mt-3 text-center text-[10px] uppercase tracking-[0.2em] text-gold-300/70">
                      ↓ Scroll to read all ↓
                    </p>
                  )}
                </div>
                <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-ink-950/60 p-3 transition hover:border-gold-400/40">
                  <input
                    type="checkbox"
                    checked={privacyChecked}
                    disabled={!privacyScrolled}
                    onChange={(e) => setPrivacyChecked(e.target.checked)}
                    className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-gold-400 disabled:cursor-not-allowed disabled:opacity-30"
                  />
                  <span
                    className={`text-sm ${
                      privacyScrolled ? 'text-white' : 'text-white/40'
                    }`}
                  >
                    I have read and agree to the{' '}
                    <strong className="text-gold-300">Privacy Policy</strong>.
                    {!privacyScrolled && (
                      <span className="ml-1 text-[10px] uppercase tracking-[0.18em] text-white/30">
                        (scroll first)
                      </span>
                    )}
                  </span>
                </label>
              </section>
            )}

            {error && (
              <p className="rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-xs text-red-300" role="alert">
                {error}
              </p>
            )}
          </div>
        )}

        <footer className="flex flex-col gap-2 border-t border-white/10 px-5 py-4 pb-safe">
          <button
            onClick={handleSubmit}
            disabled={!canSubmit() || submitting || loading}
            className="w-full rounded-full bg-gold-400 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-ink-950 transition hover:bg-gold-300 disabled:cursor-not-allowed disabled:opacity-30"
          >
            {submitting ? 'Confirming…' : 'Confirm & continue'}
          </button>
          <button
            onClick={onClose}
            className="w-full py-2 text-xs uppercase tracking-[0.2em] text-white/40 hover:text-white/60"
          >
            Cancel
          </button>
        </footer>
      </motion.div>
    </div>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { OnboardingLayout } from '../components/OnboardingLayout';

interface Slide {
  kicker: string;
  title: string[];
  body: string;
  visual: 'verified' | 'experiences' | 'live' | 'rules';
}

const slides: Slide[] = [
  {
    kicker: 'Verified',
    title: ['Real People.', 'Real Connections.'],
    body: 'Meet verified, high-quality members looking for meaningful connections and unforgettable experiences.',
    visual: 'verified',
  },
  {
    kicker: 'Curated',
    title: ['Experiences', 'Over Everything.'],
    body: 'From dinner dates to dream getaways, SIMP is built around creating moments that matter.',
    visual: 'experiences',
  },
  {
    kicker: 'Live',
    title: ['Live. Connect.', 'Be Seen.'],
    body: 'Go live, join live streams, and build your audience. Real interactions in real time.',
    visual: 'live',
  },
  {
    kicker: 'You',
    title: ['Your Experience.', 'Your Rules.'],
    body: "You're in control. Choose what you share, who you connect with, and how you want to be seen.",
    visual: 'rules',
  },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const total = slides.length;
  const slide = slides[step]!;

  const next = () => {
    if (step < total - 1) setStep(step + 1);
    else navigate('/signup');
  };

  return (
    <OnboardingLayout step={step} total={total} onNext={next} showSkip={step < total - 1}>
      <div className="relative flex min-h-[calc(100vh-100px)] flex-col px-6 pb-6 pt-safe">
        <AnimatePresence mode="wait">
          <motion.div
            key={slide.kicker}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="flex flex-1 flex-col"
          >
            <SlideVisual kind={slide.visual} />
            <div className="mt-6">
              <span className="text-[11px] font-semibold uppercase tracking-[0.4em] text-gold-300">
                {slide.kicker}
              </span>
              <h2 className="display-heading mt-3 text-3xl font-light leading-tight">
                {slide.title.map((line, i) => (
                  <span key={i} className="block">
                    {line}
                  </span>
                ))}
              </h2>
              <div className="gold-divider mt-5 !mx-0" />
              <p className="mt-5 text-sm leading-relaxed text-white/80">{slide.body}</p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </OnboardingLayout>
  );
}

function SlideVisual({ kind }: { kind: Slide['visual'] }) {
  if (kind === 'verified') {
    return (
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-3xl border border-gold-400/15 bg-gradient-to-b from-ink-700/60 via-ink-800 to-ink-950 shadow-soft">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(212,169,58,0.18),transparent_60%)]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="mx-auto flex size-20 items-center justify-center rounded-full border-2 border-gold-400/70 bg-black/40 shadow-glow">
              <svg viewBox="0 0 24 24" fill="none" className="size-10 text-gold-300" stroke="currentColor" strokeWidth="245">
                <path d="M12 2 L4 5 V11 C4 16 8 20 12 22 C16 20 20 16 20 11 V5 Z" strokeLinejoin="round" />
                <path d="M9 12 L11 14 L15 10" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.4em] text-gold-300">
              Verified members only
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (kind === 'experiences') {
    const items = [
      { label: 'DINNER', icon: '🍽' },
      { label: 'TRAVEL', icon: '✈' },
      { label: 'EVENTS', icon: '✦' },
      { label: 'VIP', icon: '◆' },
    ];
    return (
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-3xl border border-gold-400/15 bg-gradient-to-b from-ink-700/60 via-ink-800 to-ink-950 shadow-soft">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(212,169,58,0.18),transparent_55%)]" />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
          <div className="grid grid-cols-4 gap-4">
            {items.map((it) => (
              <div key={it.label} className="flex flex-col items-center gap-2">
                <div className="flex size-14 items-center justify-center rounded-full border border-gold-400/40 bg-black/40 text-2xl text-gold-300">
                  {it.icon}
                </div>
                <span className="text-[10px] font-semibold tracking-[0.2em] text-gold-300/90">{it.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (kind === 'live') {
    return (
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-3xl border border-gold-400/15 bg-gradient-to-b from-ink-700/60 via-ink-800 to-ink-950 shadow-soft">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(212,169,58,0.18),transparent_55%)]" />
        <div className="absolute inset-0 grid grid-cols-3 gap-1 p-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="rounded-md border border-gold-400/20 bg-gradient-to-br from-ink-700 to-ink-900"
            />
          ))}
        </div>
        <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-red-600/90 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white">
          <span className="size-1.5 rounded-full bg-white" />
          LIVE
        </div>
        <div className="absolute bottom-3 left-3 right-3 rounded-2xl border border-gold-400/20 bg-black/60 px-3 py-2 text-[11px] text-white/80">
          Real-time interactions. Build your audience.
        </div>
      </div>
    );
  }

  // rules
  return (
    <div className="relative aspect-[4/5] w-full overflow-hidden rounded-3xl border border-gold-400/15 bg-gradient-to-b from-ink-700/60 via-ink-800 to-ink-950 shadow-soft">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(212,169,58,0.18),transparent_55%)]" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8">
        <div className="w-full rounded-2xl border border-gold-400/30 bg-black/40 p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full border border-gold-400/40 bg-black/40 text-gold-300">
              <span className="text-base">★</span>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-300">Premium</p>
              <p className="text-[11px] text-white/60">Unlock exclusive features</p>
            </div>
          </div>
        </div>
        <div className="w-full rounded-2xl border border-gold-400/30 bg-black/40 p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full border border-gold-400/40 bg-black/40 text-gold-300">
              <span className="text-base">⚲</span>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold-300">
                Safe &amp; Secure
              </p>
              <p className="text-[11px] text-white/60">We protect our community</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

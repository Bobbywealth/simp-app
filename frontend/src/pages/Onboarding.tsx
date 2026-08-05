import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { OnboardingLayout } from '../components/OnboardingLayout';

interface Slide {
  kicker: string;
  title: string[];
  body: string;
  image: string;
  imageAlt: string;
  badge?: string;
}

const slides: Slide[] = [
  {
    kicker: 'Verified',
    title: ['Real People.', 'Real Connections.'],
    body: 'Meet verified, high-quality members looking for meaningful connections and unforgettable experiences.',
    image: '/onboarding/slide-1.jpg',
    imageAlt: 'View of a Parisian bridge at twilight with golden lampposts glowing in the dusk',
    badge: 'VERIFIED MEMBERS',
  },
  {
    kicker: 'Curated',
    title: ['Experiences', 'Over Everything.'],
    body: 'From dinner dates to dream getaways, SIMP is built around creating moments that matter.',
    image: '/onboarding/slide-2.jpg',
    imageAlt: 'Elegant table setting with crystal chandeliers, candles, and white roses',
  },
  {
    kicker: 'Live',
    title: ['Live. Connect.', 'Be Seen.'],
    body: 'Go live, join live streams, and build your audience. Real interactions in real time.',
    image: '/onboarding/slide-3.jpg',
    imageAlt: 'Crowd celebrating with confetti at a live event',
    badge: 'LIVE NOW',
  },
  {
    kicker: 'You',
    title: ['Your Experience.', 'Your Rules.'],
    body: "You're in control. Choose what you share, who you connect with, and how you want to be seen.",
    image: '/onboarding/slide-4.jpg',
    imageAlt: 'Confident portrait with dark luxe aesthetic',
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
            <SlideVisual slide={slide} />
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

function SlideVisual({ slide }: { slide: Slide }) {
  return (
    <div className="relative aspect-[4/5] w-full overflow-hidden rounded-3xl border border-gold-400/15 shadow-soft">
      {/* Real photo */}
      <img
        src={slide.image}
        alt={slide.imageAlt}
        loading="eager"
        className="absolute inset-0 size-full object-cover"
      />

      {/* Dark gradient overlay for legibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/40 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-br from-ink-950/60 via-transparent to-transparent" />

      {/* Gold rim */}
      <div
        aria-hidden
        className="absolute inset-0 rounded-3xl ring-1 ring-inset ring-gold-400/20"
      />

      {/* Optional badge (LIVE / VERIFIED) */}
      {slide.badge && (
        <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 backdrop-blur-sm">
          <span
            className={`size-1.5 rounded-full ${
              slide.badge === 'LIVE NOW' ? 'bg-red-500' : 'bg-gold-400'
            }`}
          />
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white">
            {slide.badge}
          </span>
        </div>
      )}
    </div>
  );
}

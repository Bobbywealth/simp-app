import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { OnboardingLayout } from '../components/OnboardingLayout';
import { useSwipeBack } from '../hooks/useSwipeBack';
import { haptics } from '../lib/haptics';

type TitleSegment = { text: string; gold?: boolean };
type TitleLine = TitleSegment[];

interface Slide {
  kicker: string;
  title: TitleLine[];
  body: string;
  visualType: 'connections' | 'livestream' | 'experiences' | 'rules' | 'moments' | 'luxury' | 'rewards';
}

const slides: Slide[] = [
  {
    kicker: 'Verified',
    title: [
      [{ text: 'REAL PEOPLE.' }],
      [{ text: 'REAL ' }, { text: 'CONNECTIONS.', gold: true }],
    ],
    body: 'Meet verified, high-quality members looking for meaningful connections and unforgettable experiences.',
    visualType: 'connections',
  },
  {
    kicker: 'Live',
    title: [
      [{ text: 'LIVE. CONNECT.' }],
      [{ text: 'BE ' }, { text: 'SEEN.', gold: true }],
    ],
    body: 'Go live, join live streams, and build your audience. Real interactions in real time.',
    visualType: 'livestream',
  },
  {
    kicker: 'Curated',
    title: [
      [{ text: 'EXPERIENCES' }],
      [{ text: 'OVER ' }, { text: 'EVERYTHING.', gold: true }],
    ],
    body: 'From dinner dates to dream getaways, SIMP is built around creating moments that matter.',
    visualType: 'experiences',
  },
  {
    kicker: 'You',
    title: [
      [{ text: 'YOUR EXPERIENCE.' }],
      [{ text: 'YOUR ' }, { text: 'RULES.', gold: true }],
    ],
    body: "You're in control. Choose what you share, who you connect with, and how you want to be seen.",
    visualType: 'rules',
  },
  {
    kicker: 'Moments',
    title: [
      [{ text: 'SHARE MOMENTS.' }],
      [{ text: 'BUILD ' }, { text: 'MEMORIES.', gold: true }],
    ],
    body: 'Post, live stream, and share your life. Find someone who wants to be part of it.',
    visualType: 'moments',
  },
  {
    kicker: 'Luxury',
    title: [
      [{ text: 'ACCESS A WORLD' }],
      [{ text: 'BEYOND ' }, { text: 'ORDINARY.', gold: true }],
    ],
    body: 'Exclusive events, VIP access, and luxury perks for members who live life to the fullest.',
    visualType: 'luxury',
  },
  {
    kicker: 'Rewards',
    title: [
      [{ text: 'JOIN A COMMUNITY' }],
      [{ text: 'THAT ' }, { text: 'REWARDS YOU.', gold: true }],
    ],
    body: 'Earn points, unlock levels, and enjoy exclusive benefits.',
    visualType: 'rewards',
  },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const total = slides.length;
  const slide = slides[step]!;
  useSwipeBack(true);

  const next = () => {
    haptics.light();
    if (step < total - 1) setStep(step + 1);
    else {
      haptics.medium();
      navigate('/signup');
    }
  };

  return (
    <OnboardingLayout step={step} total={total} onNext={next} showSkip={step < total - 1}>
      <div className="relative flex min-h-[calc(100vh-100px)] flex-col px-6 pb-6 pt-safe">
        <AnimatePresence mode="wait">
          <motion.div
            key={slide.visualType}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="flex flex-1 flex-col justify-between"
          >
            {/* Header Text (matches mockup placement at top) */}
            <div className="mb-6 pt-4">
              <span className="text-[11px] font-semibold uppercase tracking-[0.4em] text-gold-300">
                {slide.kicker}
              </span>
              <h2 className="display-heading mt-2 text-2xl font-semibold leading-tight tracking-[0.1em]">
                {slide.title.map((line, i) => (
                  <span key={i} className="block">
                    {line.map((seg, j) =>
                      seg.gold ? (
                        <span key={j} className="text-gold-gradient">{seg.text}</span>
                      ) : (
                        <span key={j} className="text-white">{seg.text}</span>
                      )
                    )}
                  </span>
                ))}
              </h2>
              <p className="mt-3 text-xs leading-relaxed text-white/70">{slide.body}</p>
            </div>

            {/* Main Visual Card */}
            <div className="flex-1 flex items-center justify-center min-h-[340px]">
              <SlideVisual type={slide.visualType} />
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </OnboardingLayout>
  );
}

function SlideVisual({ type }: { type: Slide['visualType'] }) {
  // Slide 1: REAL PEOPLE. REAL CONNECTIONS. (Couple with verified badge)
  if (type === 'connections') {
    return (
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-3xl border border-gold-400/15 shadow-soft bg-black">
        <img
          src="/onboarding/couple-night.jpg"
          alt="Couple on night city date"
          className="absolute inset-0 size-full object-cover opacity-90"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
        
        {/* Floating Verified Shield Badge */}
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        >
          <div className="flex size-14 items-center justify-center rounded-full border border-gold-400/50 bg-black/60 shadow-glow backdrop-blur-md">
            <svg viewBox="0 0 24 24" fill="none" className="size-6 text-gold-300" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M9 11l2 2 4-4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-gold-300 drop-shadow">
            VERIFIED MEMBERS ONLY
          </span>
        </motion.div>
      </div>
    );
  }

  // Slide 2: LIVE. CONNECT. BE SEEN. (Livestream phone frame with interactive chat)
  if (type === 'livestream') {
    return (
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-3xl border border-gold-400/15 shadow-soft bg-black">
        <img
          src="/onboarding/livestream-host.jpg"
          alt="Livestream host"
          className="absolute inset-0 size-full object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        
        {/* Red LIVE Badge */}
        <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-red-600/90 px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-white">
          <span className="size-1.5 rounded-full bg-white animate-pulse" />
          LIVE
          <span className="opacity-60 ml-1">🔴 2.4K</span>
        </div>

        {/* Floating hearts animation */}
        <div className="absolute right-6 bottom-32 flex flex-col gap-3 pointer-events-none">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              initial={{ y: 20, opacity: 0, scale: 0.5 }}
              animate={{ y: -60, opacity: [0, 1, 0], scale: [0.5, 1.2, 0.8] }}
              transition={{ duration: 2, repeat: Infinity, delay: i * 0.6, ease: 'easeOut' }}
              className="text-2xl text-red-500 filter drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]"
            >
              ❤️
            </motion.span>
          ))}
        </div>

        {/* Interactive Chat Bubbles */}
        <div className="absolute bottom-4 left-4 right-4 space-y-2.5">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-2 rounded-xl bg-black/45 px-3 py-2 backdrop-blur-md border border-white/5 max-w-[85%]"
          >
            <div className="size-6 rounded-full bg-gold-600 text-[10px] flex items-center justify-center font-bold">A</div>
            <div>
              <p className="text-[10px] font-semibold text-gold-300">Amara</p>
              <p className="text-xs text-white/90">You look amazing 🔥</p>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
            className="flex items-center gap-2 rounded-xl bg-black/45 px-3 py-2 backdrop-blur-md border border-white/5 max-w-[85%]"
          >
            <div className="size-6 rounded-full bg-purple-600 text-[10px] flex items-center justify-center font-bold">K</div>
            <div>
              <p className="text-[10px] font-semibold text-purple-300">Keisha</p>
              <p className="text-xs text-white/90">Love the vibes 💖</p>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.0 }}
            className="flex items-center gap-2 rounded-xl bg-black/45 px-3 py-2 backdrop-blur-md border border-white/5 max-w-[85%]"
          >
            <div className="size-6 rounded-full bg-blue-600 text-[10px] flex items-center justify-center font-bold">C</div>
            <div>
              <p className="text-[10px] font-semibold text-blue-300">Camila</p>
              <p className="text-xs text-white/90">Where are we going next? 👥</p>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // Slide 3: EXPERIENCES OVER EVERYTHING. (6-card grid with gold icons)
  if (type === 'experiences') {
    const cards = [
      { label: 'DINNER', icon: '🍽' },
      { label: 'TRAVEL', icon: '✈' },
      { label: 'EVENTS', icon: '🎟' },
      { label: 'NIGHTLIFE', icon: '🍸' },
      { label: 'ADVENTURES', icon: '🏔' },
      { label: 'VIP ACCESS', icon: '💎' },
    ];
    return (
      <div className="grid grid-cols-2 gap-4 w-full px-2">
        {cards.map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            whileHover={{ scale: 1.03, borderColor: 'rgba(212, 169, 58, 0.4)' }}
            className="flex flex-col items-center justify-center rounded-2xl border border-gold-400/10 bg-ink-900/60 p-5 shadow-soft backdrop-blur-sm"
          >
            <span className="text-3xl filter drop-shadow-[0_0_8px_rgba(212,169,58,0.2)]">{c.icon}</span>
            <span className="mt-3 text-[10px] font-bold uppercase tracking-[0.2em] text-gold-300">{c.label}</span>
          </motion.div>
        ))}
      </div>
    );
  }

  // Slide 4: YOUR EXPERIENCE. YOUR RULES. (Confident monochrome portrait of man)
  if (type === 'rules') {
    return (
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-3xl border border-gold-400/15 shadow-soft bg-black">
        <img
          src="/onboarding/man-suit.jpg"
          alt="Handsome man in suit portrait"
          className="absolute inset-0 size-full object-cover grayscale opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
        
        {/* Security Frosted Badges */}
        <div className="absolute bottom-6 left-6 right-6 space-y-2">
          <div className="flex items-center gap-3 rounded-xl bg-black/60 p-3.5 backdrop-blur-md border border-white/5">
            <svg viewBox="0 0 24 24" fill="none" className="size-4.5 text-gold-300" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-300">ADVANCED PRIVACY</p>
              <p className="text-[9px] text-white/50">You're in complete control</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-black/60 p-3.5 backdrop-blur-md border border-white/5">
            <svg viewBox="0 0 24 24" fill="none" className="size-4.5 text-gold-300" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-300">SAFE &amp; SECURE</p>
              <p className="text-[9px] text-white/50">We verify our premium community</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Slide 5: SHARE MOMENTS. BUILD MEMORIES. (4-photo collage grid with central + button)
  if (type === 'moments') {
    return (
      <div className="relative aspect-[4/5] w-full p-1 rounded-3xl border border-gold-400/15 shadow-soft bg-black">
        <div className="grid grid-cols-2 gap-1 h-full animate-fade-in">
          <div className="overflow-hidden rounded-tl-2xl rounded-bl-md">
            <img src="/onboarding/yacht.jpg" alt="Yacht sunset" className="size-full object-cover opacity-85" />
          </div>
          <div className="overflow-hidden rounded-tr-2xl rounded-br-md">
            <img src="/onboarding/dining.jpg" alt="Fine dining" className="size-full object-cover opacity-85" />
          </div>
          <div className="overflow-hidden rounded-bl-2xl rounded-tl-md">
            <img src="/onboarding/concert.jpg" alt="Concert crowd" className="size-full object-cover opacity-85" />
          </div>
          <div className="overflow-hidden rounded-br-2xl rounded-tr-md">
            <img src="/onboarding/getaway.jpg" alt="Luxury resort" className="size-full object-cover opacity-85" />
          </div>
        </div>

        {/* Central Gold Plus Button */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex size-14 items-center justify-center rounded-full border border-gold-400 bg-gold-gradient text-ink-950 shadow-glow hover:shadow-[0_0_32px_rgba(212,169,58,0.7)]"
        >
          <svg viewBox="0 0 24 24" fill="none" className="size-7" stroke="currentColor" strokeWidth="3">
            <line x1="12" y1="5" x2="12" y2="19" strokeLinecap="round" />
            <line x1="5" y1="12" x2="19" y2="12" strokeLinecap="round" />
          </svg>
        </motion.button>
      </div>
    );
  }

  // Slide 6: ACCESS A WORLD BEYOND ORDINARY. (Private jet and luxury jet)
  if (type === 'luxury') {
    return (
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-3xl border border-gold-400/15 shadow-soft bg-black">
        <img
          src="/onboarding/jet.jpg"
          alt="Private jet"
          className="absolute inset-0 size-full object-cover opacity-90"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
        
        {/* Floating Card: Exclusive Perks */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="absolute bottom-6 left-6 right-6 rounded-2xl border border-gold-400/25 bg-black/60 p-4.5 backdrop-blur-md"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">🥂</span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-300">EXCLUSIVE BENEFITS</p>
              <p className="text-[11px] text-white/70">Access fine dining, travel, and premium experiences.</p>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Slide 7: JOIN A COMMUNITY THAT REWARDS YOU. (Level progress ring)
  return (
    <div className="relative aspect-[4/5] w-full flex flex-col justify-between items-center rounded-3xl border border-gold-400/15 p-6 shadow-soft bg-gradient-to-b from-ink-900 to-black">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(212,169,58,0.1),transparent_50%)] pointer-events-none" />
      
      {/* Glowing Progress Circle */}
      <div className="relative size-44 flex items-center justify-center mt-6">
        <svg className="size-full -rotate-90">
          <circle
            cx="88"
            cy="84"
            r="70"
            className="stroke-white/5"
            strokeWidth="8"
            fill="transparent"
          />
          <motion.circle
            cx="88"
            cy="84"
            r="70"
            className="stroke-gold-400"
            strokeWidth="8"
            fill="transparent"
            strokeDasharray={440}
            initial={{ strokeDashoffset: 440 }}
            animate={{ strokeDashoffset: 440 - (440 * 0.8) }} // 80% filled
            transition={{ duration: 1.5, ease: 'easeOut' }}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-2">
          <span className="text-[10px] font-semibold tracking-[0.25em] text-gold-300/70 uppercase">LEVEL</span>
          <span className="text-4xl font-light tracking-tight text-white font-display">18</span>
        </div>
      </div>

      <div className="text-center">
        <span className="text-xs font-semibold tracking-widest text-gold-300">2,450 / 3,000 XP</span>
      </div>

      {/* Rewards Row */}
      <div className="grid grid-cols-4 gap-2 w-full pt-4 border-t border-white/5">
        {[
          { label: 'EARN POINTS', icon: '💎' },
          { label: 'LEVEL UP', icon: '🚀' },
          { label: 'UNLOCK PERKS', icon: '🎁' },
          { label: 'VIP STATUS', icon: '👑' },
        ].map((item) => (
          <div key={item.label} className="text-center flex flex-col items-center">
            <div className="flex size-10 items-center justify-center rounded-full border border-gold-400/20 bg-black/40 text-lg mb-1">
              {item.icon}
            </div>
            <span className="text-[8px] font-bold tracking-wider text-white/50">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

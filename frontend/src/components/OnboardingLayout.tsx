import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface Props {
  step: number; // 0-based
  total: number;
  children: ReactNode;
  nextLabel?: string;
  onNext?: () => void;
  nextDisabled?: boolean;
  showSkip?: boolean;
}

export function OnboardingLayout({
  step,
  total,
  children,
  nextLabel = 'NEXT',
  onNext,
  nextDisabled,
  showSkip = true,
}: Props) {
  const navigate = useNavigate();
  const dots = Array.from({ length: total }, (_, i) => i);
  const activeDot = step;

  return (
    <div className="relative flex h-full min-h-screen flex-col bg-ink-950 text-white">
      <div className="absolute inset-0 bg-ink-radial pointer-events-none" />
      <div className="relative flex-1 overflow-y-auto">
        {children}
      </div>
      <div className="relative pb-safe pt-6">
        <div className="flex items-center justify-between px-6 pb-6">
          {showSkip ? (
            <button
              type="button"
              onClick={() => navigate('/signup')}
              className="text-xs font-medium uppercase tracking-[0.2em] text-white/60 transition hover:text-white"
            >
              SKIP
            </button>
          ) : (
            <span />
          )}

          <div className="flex gap-2">
            {dots.map((i) => (
              <span
                key={i}
                className={`size-1.5 rounded-full transition ${
                  i === activeDot ? 'bg-gold-400' : 'bg-white/20'
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={onNext}
            disabled={nextDisabled}
            className={`text-xs font-semibold uppercase tracking-[0.2em] transition ${
              nextDisabled ? 'text-white/30' : 'text-gold-300 hover:text-gold-200'
            }`}
          >
            {nextLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

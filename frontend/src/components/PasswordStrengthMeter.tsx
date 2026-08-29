interface PasswordStrengthMeterProps {
  password: string;
}

const REQUIREMENTS = [
  { test: (p: string) => p.length >= 10, label: '10+ characters' },
  { test: (p: string) => /[a-z]/.test(p), label: 'Lowercase letter' },
  { test: (p: string) => /[A-Z]/.test(p), label: 'Uppercase letter' },
  { test: (p: string) => /[0-9]/.test(p), label: 'Number' },
];

export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  const score = REQUIREMENTS.filter((r) => r.test(password)).length;
  const pct = (score / REQUIREMENTS.length) * 100;

  const color =
    score <= 1 ? 'bg-red-400' : score <= 2 ? 'bg-amber-400' : score === 3 ? 'bg-gold-400' : 'bg-emerald-400';
  const label =
    score <= 1 ? 'Weak' : score <= 2 ? 'Fair' : score === 3 ? 'Good' : 'Strong';

  return (
    <div className="mt-2 space-y-2">
      <div className="flex h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {REQUIREMENTS.map((r, i) => (
            <span
              key={i}
              className={`text-[9px] uppercase tracking-wide ${
                r.test(password) ? 'text-emerald-300' : 'text-white/30'
              }`}
            >
              {r.label}
            </span>
          ))}
        </div>
        <span className={`text-[9px] font-semibold uppercase tracking-wider ${
          score <= 1 ? 'text-red-300' : score <= 2 ? 'text-amber-300' : score === 3 ? 'text-gold-300' : 'text-emerald-300'
        }`}>
          {label}
        </span>
      </div>
    </div>
  );
}

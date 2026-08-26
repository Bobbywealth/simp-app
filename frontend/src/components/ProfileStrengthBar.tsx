import type { ProfileCompletion } from '../types';

interface ProfileStrengthBarProps {
  completion?: ProfileCompletion;
  onEdit?: () => void;
}

/**
 * Slim profile-strength meter + next-action chips. Shows the user how
 * close they are to "complete" and what concrete step gets them there.
 */
export function ProfileStrengthBar({ completion, onEdit }: ProfileStrengthBarProps) {
  const percent = completion?.percent ?? 0;
  const isComplete = Boolean(completion?.complete);
  const missing = completion?.missing ?? [];
  const tone = isComplete ? 'complete' : percent >= 75 ? 'high' : percent >= 50 ? 'mid' : 'low';

  return (
    <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-transparent p-4 backdrop-blur">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-gold-300">
          Profile strength
        </p>
        <p className={`text-xs font-semibold ${
          tone === 'complete' ? 'text-emerald-300' : tone === 'high' ? 'text-gold-200' : tone === 'mid' ? 'text-gold-200/80' : 'text-white/60'
        }`}>{percent}%</p>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-all ${
            tone === 'complete' ? 'bg-emerald-400' : 'bg-gradient-to-r from-gold-400 to-gold-300'
          }`}
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {isComplete ? (
          <span className="rounded-full bg-emerald-500/12 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-emerald-200">
            Looking great
          </span>
        ) : (
          missing.slice(0, 3).map((item) => (
            <span
              key={item}
              className="rounded-full border border-gold-400/30 bg-gold-400/[0.06] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-gold-200"
            >
              {humanizeMissing(item)}
            </span>
          ))
        )}
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="ml-auto rounded-full border border-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55 hover:border-gold-400/40 hover:text-gold-200"
          >
            Edit
          </button>
        )}
      </div>
    </section>
  );
}

function humanizeMissing(item: string): string {
  switch (item) {
    case 'photos':
      return 'Add 2+ photos';
    case 'bio':
      return 'Write a bio';
    case 'prompts':
      return 'Add prompts';
    case 'interests':
      return 'Pick interests';
    case 'basics':
      return 'Fill basics';
    case 'photos_lt_2':
      return 'Add 2+ photos';
    default:
      return item.replace(/_/g, ' ');
  }
}

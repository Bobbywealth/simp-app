import type { ExperienceCategory, ExperienceStatus } from '../api/experiences';

export const EXPERIENCE_CATEGORY_OPTIONS: ReadonlyArray<{
  value: ExperienceCategory;
  label: string;
}> = [
  { value: 'DINNER', label: 'Dinner' },
  { value: 'DRINKS', label: 'Drinks' },
  { value: 'EVENT', label: 'Event' },
  { value: 'CONCERT', label: 'Concert' },
  { value: 'TRAVEL', label: 'Travel' },
  { value: 'SHOPPING', label: 'Shopping' },
  { value: 'ADVENTURE', label: 'Adventure' },
  { value: 'VIP', label: 'VIP' },
  { value: 'OTHER', label: 'Other' },
];

export const EXPERIENCE_CATEGORY_LABELS: Record<ExperienceCategory, string> = {
  DINNER: 'Dinner',
  DRINKS: 'Drinks',
  EVENT: 'Event',
  CONCERT: 'Concert',
  TRAVEL: 'Travel',
  SHOPPING: 'Shopping',
  ADVENTURE: 'Adventure',
  VIP: 'VIP',
  OTHER: 'Other',
};

/** "Sat, Oct 24 · 7:30 PM" */
export function formatExperienceDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const date = d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const time = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${date} · ${time}`;
}

export function formatExperiencePrice(
  priceCents: number | null | undefined,
  currency = 'USD',
): string | null {
  if (priceCents == null) return null;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: priceCents % 100 === 0 ? 0 : 2,
    }).format(priceCents / 100);
  } catch {
    return `$${(priceCents / 100).toFixed(2)}`;
  }
}

const STATUS_STYLES: Record<ExperienceStatus, string> = {
  OPEN: 'border-emerald-300/30 bg-emerald-300/10 text-emerald-200',
  FULL: 'border-sky-300/30 bg-sky-300/10 text-sky-200',
  CANCELLED: 'border-red-300/30 bg-red-300/10 text-red-200',
  COMPLETED: 'border-white/15 bg-white/5 text-white/50',
};

export function experienceStatusStyle(status: ExperienceStatus): string {
  return STATUS_STYLES[status];
}

export function experienceStatusLabel(status: ExperienceStatus): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

/** Gradient fallback backgrounds per category for cards without images. */
const CATEGORY_GRADIENTS: Record<ExperienceCategory, string> = {
  DINNER: 'from-amber-900/80 via-ink-900 to-ink-950',
  DRINKS: 'from-fuchsia-900/70 via-ink-900 to-ink-950',
  EVENT: 'from-indigo-900/70 via-ink-900 to-ink-950',
  CONCERT: 'from-purple-900/80 via-ink-900 to-ink-950',
  TRAVEL: 'from-sky-900/70 via-ink-900 to-ink-950',
  SHOPPING: 'from-rose-900/70 via-ink-900 to-ink-950',
  ADVENTURE: 'from-emerald-900/70 via-ink-900 to-ink-950',
  VIP: 'from-yellow-800/60 via-ink-900 to-ink-950',
  OTHER: 'from-ink-800 via-ink-900 to-ink-950',
};

export function categoryGradient(category: ExperienceCategory): string {
  return CATEGORY_GRADIENTS[category];
}

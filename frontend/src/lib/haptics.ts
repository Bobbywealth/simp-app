// iOS-style haptic feedback, with graceful fallback on unsupported devices.
// navigator.vibrate is supported on Android and Safari iOS 18+; on iOS earlier
// than 18 it silently no-ops. We wrap the call in a feature-detect + debounce
// so rapid taps don't double-fire.

export type HapticType = 'light' | 'medium' | 'heavy' | 'selection' | 'success';

const VIBE_PATTERNS: Record<Exclude<HapticType, 'selection' | 'success'>, number> = {
  light: 10,
  medium: 20,
  heavy: 30,
};

// Last-fired timestamp per type to debounce the same haptic
const lastFireAt = new Map<HapticType, number>();
const DEBOUNCE_MS = 80;

function isSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

function debounced(type: HapticType, fn: () => void) {
  const now = Date.now();
  const last = lastFireAt.get(type) ?? 0;
  if (now - last < DEBOUNCE_MS) return;
  lastFireAt.set(type, now);
  fn();
}

export function triggerHaptic(type: HapticType = 'light'): void {
  if (!isSupported()) return;
  debounced(type, () => {
    try {
      if (type === 'selection') {
        // Tiny selection tick
        navigator.vibrate?.(5);
      } else if (type === 'success') {
        // Two-pulse success pattern
        navigator.vibrate?.([0, 12, 60, 18]);
      } else {
        navigator.vibrate?.(VIBE_PATTERNS[type]);
      }
    } catch {
      // Silent no-op on any unexpected failure
    }
  });
}

// Convenience exports for the common cases
export const haptics = {
  light: () => triggerHaptic('light'),
  medium: () => triggerHaptic('medium'),
  heavy: () => triggerHaptic('heavy'),
  selection: () => triggerHaptic('selection'),
  success: () => triggerHaptic('success'),
};

import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from 'react';
import { haptics } from '../lib/haptics';

type Variant = 'gold' | 'gold-outline' | 'ghost';
type HapticOpt = 'light' | 'medium' | 'heavy' | 'none';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  /** Haptic feedback on press. Defaults to 'light'. Set to 'none' to disable. */
  haptic?: HapticOpt;
  children: ReactNode;
}

const variants: Record<Variant, string> = {
  gold: 'btn-gold',
  'gold-outline': 'btn-gold-outline',
  ghost: 'btn-ghost',
};

export function Button({
  variant = 'gold',
  loading,
  haptic = 'light',
  className = '',
  children,
  disabled,
  onClick,
  ...rest
}: Props) {
  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    if (!disabled && !loading && haptic !== 'none') {
      haptics[haptic]?.();
    }
    onClick?.(e);
  };

  return (
    <button
      {...rest}
      onClick={handleClick}
      disabled={disabled || loading}
      className={`${variants[variant]} ${disabled || loading ? 'opacity-60 pointer-events-none' : ''} ${className} w-full`}
    >
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          <span>Please wait</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}

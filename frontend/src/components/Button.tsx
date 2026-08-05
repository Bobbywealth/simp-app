import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'gold' | 'gold-outline' | 'ghost';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  children: ReactNode;
}

const variants: Record<Variant, string> = {
  gold: 'btn-gold',
  'gold-outline': 'btn-gold-outline',
  ghost: 'btn-ghost',
};

export function Button({ variant = 'gold', loading, className = '', children, disabled, ...rest }: Props) {
  return (
    <button
      {...rest}
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

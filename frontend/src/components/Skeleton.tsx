interface SkeletonProps {
  className?: string;
  /** Rounded shape: 'md' (default), 'lg', 'full' */
  rounded?: 'md' | 'lg' | 'full' | 'none';
  width?: number | string;
  height?: number | string;
}

const ROUNDED: Record<NonNullable<SkeletonProps['rounded']>, string> = {
  none: 'rounded-none',
  md: 'rounded-md',
  lg: 'rounded-lg',
  full: 'rounded-full',
};

/**
 * Rounded shimmer placeholder used during loads.
 * Uses a linear-gradient slide on a 1.4s loop.
 */
export function Skeleton({ className = '', rounded = 'md', width, height }: SkeletonProps) {
  const style: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    backgroundImage:
      'linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.04) 100%)',
    backgroundSize: '200% 100%',
    animation: 'simp-shimmer 1.4s ease-in-out infinite',
  };
  return (
    <div
      className={`block ${ROUNDED[rounded]} ${className}`}
      style={style}
      aria-hidden
    />
  );
}

/** Full-screen skeleton loader with a pulsing SimpLogo hint. */
export function SkeletonScreen({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-black text-white">
      <div className="flex flex-col items-center gap-6 px-6">
        <div
          className="size-16 rounded-full"
          style={{
            backgroundImage:
              'linear-gradient(90deg, rgba(212,169,58,0.0) 0%, rgba(212,169,58,0.4) 50%, rgba(212,169,58,0.0) 100%)',
            backgroundSize: '200% 100%',
            animation: 'simp-shimmer 1.6s ease-in-out infinite',
          }}
          aria-hidden
        />
        <Skeleton width={180} height={10} rounded="full" />
        <Skeleton width={120} height={8} rounded="full" />
        <span className="sr-only">{label}</span>
      </div>
    </div>
  );
}

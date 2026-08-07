type Variant = 'full' | 'emblem';

interface Props {
  size?: number;
  className?: string;
  variant?: Variant;
}

const ASSETS: Record<Variant, { src: string; alt: string }> = {
  full: {
    src: '/simp-logo.png',
    alt: 'SIMP — Superior · Intelligent · Male · Pleasers',
  },
  emblem: {
    src: '/simp-emblem.png',
    alt: 'SIMP',
  },
};

export function SimpLogo({ size = 220, className = '', variant = 'full' }: Props) {
  const { src, alt } = ASSETS[variant];
  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={`select-none drop-shadow-[0_0_32px_rgba(212,169,58,0.4)] ${className}`}
      draggable={false}
    />
  );
}

interface Props {
  size?: number;
  className?: string;
}

export function SimpLogo({ size = 220, className = '' }: Props) {
  return (
    <img
      src="/simp-logo.png"
      alt="SIMP — Superior · Intelligent · Male · Pleasers"
      width={size}
      height={size}
      className={`select-none drop-shadow-[0_0_32px_rgba(212,169,58,0.4)] ${className}`}
      draggable={false}
    />
  );
}

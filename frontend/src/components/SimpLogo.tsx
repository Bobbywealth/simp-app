interface Props {
  size?: number;
}

export function SimpLogo({ size = 220 }: Props) {
  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="select-none drop-shadow-[0_0_24px_rgba(212,169,58,0.25)]"
    >
      <defs>
        <linearGradient id="simp-gold" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#f6e6b8" />
          <stop offset="50%" stopColor="#d4a93a" />
          <stop offset="100%" stopColor="#a98320" />
        </linearGradient>
        <radialGradient id="simp-bg" cx="50%" cy="40%" r="70%">
          <stop offset="0%" stopColor="#1a1a1a" />
          <stop offset="100%" stopColor="#000000" />
        </radialGradient>
      </defs>
      <rect width="512" height="512" fill="url(#simp-bg)" />
      <g transform="translate(256 256)">
        <g transform="translate(0 -90)">
          <path
            d="M-70 0 L-40 -40 L-20 -10 L0 -50 L20 -10 L40 -40 L70 0 Z"
            fill="url(#simp-gold)"
          />
          <circle cx="-40" cy="-40" r="6" fill="#0a0a0a" />
          <circle cx="0" cy="-50" r="6" fill="#0a0a0a" />
          <circle cx="40" cy="-40" r="6" fill="#0a0a0a" />
        </g>
        <path
          d="M40 -60 C 10 -90, -50 -70, -50 -30 C -50 0, 0 5, 0 35 C 0 65, -55 75, -80 50"
          stroke="url(#simp-gold)"
          strokeWidth="22"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M-40 60 C -10 90, 50 70, 50 30 C 50 0, 0 -5, 0 -35 C 0 -65, 55 -75, 80 -50"
          stroke="url(#simp-gold)"
          strokeWidth="22"
          strokeLinecap="round"
          fill="none"
        />
      </g>
    </svg>
  );
}

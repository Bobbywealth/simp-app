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
      className="select-none drop-shadow-[0_0_32px_rgba(212,169,58,0.4)]"
    >
      <defs>
        <linearGradient id="simpGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f6e6b8" />
          <stop offset="40%" stopColor="#e8d598" />
          <stop offset="60%" stopColor="#d4a93a" />
          <stop offset="100%" stopColor="#a98320" />
        </linearGradient>
        <radialGradient id="simpBg" cx="50%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#2a2a2a" />
          <stop offset="100%" stopColor="#000000" />
        </radialGradient>
        <filter id="simpGlow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect width="512" height="512" fill="url(#simpBg)" />
      <g transform="translate(256 256)">
        {/* Crown */}
        <g transform="translate(0 -120)">
          <ellipse cx="0" cy="0" rx="95" ry="25" fill="url(#simpGold)" opacity="0.9" />
          {/* Center point */}
          <polygon points="0,-45 -12,-15 12,-15" fill="url(#simpGold)" filter="url(#simpGlow)" />
          {/* Side points */}
          <polygon points="-45,-35 -55,-10 -35,-10" fill="url(#simpGold)" />
          <polygon points="45,-35 35,-10 55,-10" fill="url(#simpGold)" />
          {/* Far points */}
          <polygon points="-75,-20 -85,5 -65,5" fill="url(#simpGold)" opacity="0.85" />
          <polygon points="75,-20 65,5 85,5" fill="url(#simpGold)" opacity="0.85" />
          {/* Jewels */}
          <circle cx="0" cy="-42" r="8" fill="url(#simpGold)" filter="url(#simpGlow)" />
          <circle cx="-45" cy="-32" r="6" fill="url(#simpGold)" />
          <circle cx="45" cy="-32" r="6" fill="url(#simpGold)" />
          <circle cx="-75" cy="-15" r="5" fill="url(#simpGold)" opacity="0.8" />
          <circle cx="75" cy="-15" r="5" fill="url(#simpGold)" opacity="0.8" />
          {/* Shine */}
          <ellipse cx="0" cy="0" rx="85" ry="20" fill="url(#simpGold)" opacity="0.3" />
        </g>
        {/* S Curves */}
        <g transform="translate(0 0)">
          <path
            d="M 50 -70 Q 80 -80 85 -50 Q 90 -30 60 -20 Q 30 -10 20 10"
            stroke="url(#simpGold)"
            strokeWidth="28"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            filter="url(#simpGlow)"
          />
          <path
            d="M -50 70 Q -80 80 -85 50 Q -90 30 -60 20 Q -30 10 -20 -10"
            stroke="url(#simpGold)"
            strokeWidth="28"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            filter="url(#simpGlow)"
          />
          <path
            d="M 45 -15 Q 0 -5 -45 15"
            stroke="url(#simpGold)"
            strokeWidth="20"
            strokeLinecap="round"
            fill="none"
            opacity="0.7"
          />
        </g>
      </g>
      {/* Outer glow */}
      <circle cx="256" cy="256" r="250" fill="none" stroke="url(#simpGold)" strokeWidth="1" opacity="0.3" />
    </svg>
  );
}

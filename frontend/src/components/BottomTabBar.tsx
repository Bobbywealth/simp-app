import { NavLink, useLocation } from 'react-router-dom';

interface Tab {
  to: string;
  label: string;
  icon: string;
}

const TABS: Tab[] = [
  { to: '/home', label: 'Home', icon: '⌂' },
  { to: '/discover', label: 'Discover', icon: '↗' },
  { to: '/live', label: 'Live', icon: '●' },
  { to: '/matches', label: 'Matches', icon: '♥' },
  { to: '/profile', label: 'Profile', icon: '◉' },
];

export function BottomTabBar() {
  const location = useLocation();
  // Hide on auth/onboarding/welcome
  if (['/welcome', '/onboarding', '/signup', '/login'].includes(location.pathname)) {
    return null;
  }

  return (
    <nav
      className="sticky bottom-0 left-0 right-0 z-30 border-t border-white/10 bg-ink-950/95 pb-safe backdrop-blur-md"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.25rem)' }}
    >
      <div className="mx-auto flex max-w-md items-stretch justify-around">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              `flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-medium uppercase tracking-[0.16em] transition active:scale-95 ${
                isActive ? 'text-gold-300' : 'text-white/55 hover:text-white/90'
              }`
            }
          >
            <span className="text-xl leading-none">{t.icon}</span>
            <span className="leading-none">{t.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

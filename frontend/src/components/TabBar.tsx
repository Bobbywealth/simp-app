import { useNavigate, useLocation } from 'react-router-dom';
import { haptics } from '../lib/haptics';

export interface TabItem {
  /** Unique key */
  key: string;
  /** Display label (used for sr-only and title attr) */
  label: string;
  /** Route to navigate to */
  to: string;
  /** SVG path data for the icon (24x24 viewBox). */
  iconPath: string;
}

interface Props {
  tabs: TabItem[];
  className?: string;
}

// TODO: mount <TabBar /> from the Home (or future shell) page once Discovery /
// Matches / Experiences / Profile routes exist. Built as a stub now so the
// surface is ready and iOS-feel baselines (frosted glass, gold active state,
// safe-area bottom padding) are locked in.
export function TabBar({ tabs, className = '' }: Props) {
  const navigate = useNavigate();
  const location = useLocation();

  if (tabs.length === 0 || tabs.length > 5) return null;

  const onTap = (to: string) => {
    haptics.selection();
    navigate(to);
  };

  return (
    <nav
      role="navigation"
      aria-label="Primary"
      className={`sticky bottom-0 z-40 w-full ${className}`}
    >
      <div
        className="border-t border-white/10 bg-black/55 backdrop-blur-xl"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 8px)' }}
      >
        <ul className="grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
          {tabs.map((tab) => {
            const active = location.pathname === tab.to;
            return (
              <li key={tab.key}>
                <button
                  type="button"
                  onClick={() => onTap(tab.to)}
                  aria-label={tab.label}
                  aria-current={active ? 'page' : undefined}
                  className="flex w-full flex-col items-center justify-center gap-0.5 py-2 transition active:scale-95"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className={`size-6 transition-colors ${
                      active ? 'text-gold-400' : 'text-white/55'
                    }`}
                    fill={active ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    strokeWidth={active ? 0 : 1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d={tab.iconPath} />
                  </svg>
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                      active ? 'text-gold-400' : 'text-white/55'
                    }`}
                  >
                    {tab.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

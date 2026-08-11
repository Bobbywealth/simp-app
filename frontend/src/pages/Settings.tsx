import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../store/auth';
import { listBlocks } from '../api/moderation';

export default function Settings() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [blocks, setBlocks] = useState<Array<{ blockedId: string; displayName: string; createdAt: string }>>([]);
  const [showBlocked, setShowBlocked] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (showBlocked) {
      void loadBlocks();
    }
  }, [showBlocked]);

  async function loadBlocks() {
    setLoading(true);
    try {
      const res = await listBlocks();
      setBlocks(res.blocks);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await logout();
    navigate('/welcome', { replace: true });
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-ink-950 text-white">
      <div className="absolute inset-0 bg-ink-radial pointer-events-none" />
      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col px-6 pt-6 pb-24">
        <header className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="text-xs font-medium uppercase tracking-[0.2em] text-white/60 hover:text-white"
          >
            ‹ Back
          </button>
          <h1 className="text-xs font-medium uppercase tracking-[0.3em] text-gold-300">
            Settings
          </h1>
          <span className="w-12" />
        </header>

        <div className="mt-8 space-y-3">
          <Row icon="✉" label="Email" value={user?.email ?? '—'} />
          <Row
            icon="◉"
            label="Profile"
            value="Edit your photos, prompts, bio"
            onClick={() => navigate('/profile/edit')}
          />
          <Row
            icon="🚫"
            label="Blocked users"
            value={showBlocked ? `${blocks.length} blocked` : 'Manage'}
            onClick={() => setShowBlocked((s) => !s)}
          />
          {showBlocked && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="overflow-hidden rounded-xl border border-white/10 bg-ink-900/60"
            >
              {loading ? (
                <p className="p-4 text-xs text-white/50">Loading…</p>
              ) : blocks.length === 0 ? (
                <p className="p-4 text-xs text-white/50">No blocked users.</p>
              ) : (
                <ul className="divide-y divide-white/10">
                  {blocks.map((b) => (
                    <li key={b.blockedId} className="flex items-center justify-between p-3">
                      <span className="text-sm text-white/90">{b.displayName}</span>
                      <span className="text-xs text-white/40">
                        {new Date(b.createdAt).toLocaleDateString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>
          )}

          <div className="my-4 border-t border-white/10" />

          <button
            onClick={handleLogout}
            className="w-full rounded-xl border border-red-400/30 bg-red-500/10 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-red-300 hover:bg-red-500/20"
          >
            Log out
          </button>

          <div className="mt-8 text-center text-[10px] uppercase tracking-[0.2em] text-white/30">
            SIMP v0.2.0
          </div>
        </div>
      </main>
    </div>
  );
}

function Row({
  icon,
  label,
  value,
  onClick,
}: {
  icon: string;
  label: string;
  value: string;
  onClick?: () => void;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl border border-white/10 bg-ink-900/60 p-4 text-left ${
        onClick ? 'hover:border-white/30' : ''
      }`}
    >
      <span className="text-xl">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/40">{label}</p>
        <p className="mt-0.5 truncate text-sm text-white/90">{value}</p>
      </div>
      {onClick && <span className="text-xs text-white/30">›</span>}
    </Tag>
  );
}

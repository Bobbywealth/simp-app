import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listBlocks, unblockUser } from '../api/moderation';

type BlockedUser = {
  blockedId: string;
  displayName: string;
  photoUrl?: string | null;
  createdAt: string;
};

export default function BlockedUsers() {
  const navigate = useNavigate();
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    listBlocks()
      .then((data) => setBlocked(data.blocks as BlockedUser[]))
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  async function handleUnblock(blockedId: string, displayName: string) {
    setBusy(blockedId);
    try {
      await unblockUser(blockedId);
      setBlocked((prev) => prev.filter((b) => b.blockedId !== blockedId));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-gold-400 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-ink-950 pb-28 text-white">
      <div className="pointer-events-none absolute inset-0 bg-ink-radial" />
      <header className="relative z-10 mx-auto flex w-full max-w-md items-center justify-between px-5 pb-5 pt-safe">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mt-4 min-h-11 text-xs uppercase tracking-[0.18em] text-white/50"
        >
          Back
        </button>
        <h1 className="mt-4 text-xs font-semibold uppercase tracking-[0.24em] text-gold-300">
          Blocked Users
        </h1>
        <span className="w-11" />
      </header>

      <main className="relative z-10 mx-auto w-full max-w-md space-y-6 px-4">
        {error && (
          <button
            type="button"
            onClick={() => setError(null)}
            className="w-full rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-left text-xs text-red-100"
            role="alert"
          >
            {error}
          </button>
        )}

        {blocked.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.08] bg-black/25 p-8 text-center backdrop-blur-sm">
            <p className="text-sm text-white/50">You have not blocked anyone.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {blocked.map((user) => (
              <div
                key={user.blockedId}
                className="flex items-center gap-4 rounded-2xl border border-white/[0.08] bg-black/25 p-4 backdrop-blur-sm"
              >
                {user.photoUrl ? (
                  <img
                    src={user.photoUrl}
                    alt={user.displayName}
                    className="h-12 w-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-lg text-white/40">
                    ?
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{user.displayName}</p>
                  <p className="text-xs text-white/40">
                    Blocked {formatRelative(user.createdAt)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy === user.blockedId}
                  onClick={() => void handleUnblock(user.blockedId, user.displayName)}
                  className="min-h-9 rounded-full border border-gold-400/40 px-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-gold-300 transition-opacity disabled:opacity-30"
                >
                  {busy === user.blockedId ? 'Unblocking...' : 'Unblock'}
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function formatRelative(value: string): string {
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 1_000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

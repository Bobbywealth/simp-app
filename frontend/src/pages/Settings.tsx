import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../store/auth';
import { listBlocks } from '../api/moderation';
import { deleteMyAccount, exportMyData } from '../api/account';

export default function Settings() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [blocks, setBlocks] = useState<Array<{ blockedId: string; displayName: string; createdAt: string }>>([]);
  const [showBlocked, setShowBlocked] = useState(false);
  const [loading, setLoading] = useState(false);

  // Account deletion + data export state (both required by Apple /
  // Google Play Store; surfaced in the Privacy section below).
  const [showDelete, setShowDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

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

  async function handleExport() {
    setExporting(true);
    try {
      const blob = await exportMyData();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `simp-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setDeleteError((e as Error).message);
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    setDeleteError(null);
    if (deleteConfirm !== 'DELETE') {
      setDeleteError('Type DELETE exactly to confirm.');
      return;
    }
    if (deletePassword.length < 1) {
      setDeleteError('Enter your password.');
      return;
    }
    setDeleting(true);
    try {
      await deleteMyAccount(deletePassword, 'DELETE');
      await logout();
      navigate('/welcome', { replace: true });
    } catch (e) {
      setDeleteError((e as Error).message);
      setDeleting(false);
    }
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

          {/* Privacy / Data section — required by App Store + Play Store
              for GDPR / CCPA compliance. Includes data export and
              account deletion. */}
          <div className="my-4 border-t border-white/10" />
          <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30">
            Privacy &amp; Data
          </p>

          <Row
            icon="⬇"
            label="Download my data"
            value={exporting ? 'Preparing…' : 'JSON export of everything we have'}
            onClick={exporting ? undefined : handleExport}
          />

          <Row
            icon="📄"
            label="Privacy Policy"
            value="View in browser"
            onClick={() => window.open('/legal/privacy', '_blank', 'noopener')}
          />

          <Row
            icon="📑"
            label="Terms of Service"
            value="View in browser"
            onClick={() => window.open('/legal/tos', '_blank', 'noopener')}
          />

          {/* Danger zone — hard account deletion. App Store 5.1.1(v)
              and Play Store Account Deletion policy both require this
              to be reachable from the in-app settings screen. */}
          <div className="my-4 border-t border-red-400/20" />
          <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-red-300/70">
            Danger zone
          </p>

          {!showDelete ? (
            <button
              onClick={() => setShowDelete(true)}
              className="w-full rounded-xl border border-red-400/30 bg-red-500/10 py-3 text-left text-sm font-semibold uppercase tracking-[0.18em] text-red-300 hover:bg-red-500/20"
            >
              <span className="block px-4">Delete account</span>
              <span className="mt-1 block px-4 text-[10px] font-normal normal-case tracking-normal text-red-300/60">
                Permanently delete your SIMP account and all data
              </span>
            </button>
          ) : (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="overflow-hidden rounded-xl border border-red-400/40 bg-red-500/10 p-4"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-300">
                Confirm account deletion
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-red-200/80">
                This permanently deletes your profile, photos, swipes, matches, messages, and
                live stream history. This cannot be undone.
              </p>
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Your password"
                autoComplete="current-password"
                className="mt-3 w-full rounded-lg border border-white/10 bg-ink-950 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-red-400/60 focus:outline-none"
              />
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder='Type "DELETE" to confirm'
                autoComplete="off"
                className="mt-2 w-full rounded-lg border border-white/10 bg-ink-950 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-red-400/60 focus:outline-none"
              />
              {deleteError && (
                <p className="mt-2 text-xs text-red-300" role="alert">
                  {deleteError}
                </p>
              )}
              <div className="mt-4 flex flex-col gap-2">
                <button
                  onClick={handleDelete}
                  disabled={deleting || deleteConfirm !== 'DELETE'}
                  className="w-full rounded-full bg-red-500 py-3 text-sm font-bold uppercase tracking-[0.18em] text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  {deleting ? 'Deleting…' : 'Delete my account forever'}
                </button>
                <button
                  onClick={() => {
                    setShowDelete(false);
                    setDeletePassword('');
                    setDeleteConfirm('');
                    setDeleteError(null);
                  }}
                  className="w-full py-2 text-xs uppercase tracking-[0.2em] text-white/40 hover:text-white/60"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}

          <button
            onClick={handleLogout}
            className="mt-4 w-full rounded-xl border border-white/15 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-white/70 hover:border-white/30 hover:text-white"
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

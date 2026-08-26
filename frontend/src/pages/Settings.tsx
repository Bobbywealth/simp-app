import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { changePassword, listSessions, logoutAll, revokeSession, type Session } from '../api/auth';
import { deleteMyAccount, exportMyData } from '../api/account';
import { listBlocks, unblockUser } from '../api/moderation';
import {
  getNotificationPreferences,
  registerPushToken,
  updateNotificationPreferences,
  type NotificationPreferences,
} from '../api/notifications';
import {
  getDiscoveryPreferences,
  getMyProfile,
  requestProfileVerification,
  updateDiscoveryPreferences,
} from '../api/users';
import type { DiscoveryPreferences, Profile } from '../types';
import { API_BASE_URL } from '../api/client';
import { getDeviceContext, requestApproximateLocation, requestNativePushPermission } from '../capacitor';
import { useAuth } from '../store/auth';

const DEFAULT_DISCOVERY: DiscoveryPreferences = {
  minAge: 18,
  maxAge: 99,
  maxDistanceKm: null,
  verifiedOnly: false,
  interestSlugs: [],
};
const DEFAULT_NOTIFICATIONS: NotificationPreferences = {
  matches: true,
  messages: true,
  likes: true,
  live: true,
  security: true,
  marketing: false,
};

type BlockedUser = { blockedId: string; displayName: string; photoUrl?: string | null; createdAt: string };

export default function Settings() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const isStaff = user?.role === 'MODERATOR' || user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const [profile, setProfile] = useState<Profile | null>(null);
  const [discovery, setDiscovery] = useState(DEFAULT_DISCOVERY);
  const [notifications, setNotifications] = useState(DEFAULT_NOTIFICATIONS);
  const [blocks, setBlocks] = useState<BlockedUser[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      getMyProfile(),
      getDiscoveryPreferences(),
      getNotificationPreferences(),
      listBlocks(),
      listSessions(),
    ])
      .then(([profileValue, discoveryValue, notificationValue, blockValue, sessionValue]) => {
        setProfile(profileValue);
        setDiscovery(discoveryValue);
        setNotifications(notificationValue);
        setBlocks(blockValue.blocks);
        setSessions(sessionValue.sessions);
      })
      .catch((value) => setError((value as Error).message))
      .finally(() => setLoading(false));
  }, []);

  const run = async (key: string, action: () => Promise<unknown>, message: string) => {
    setBusy(key);
    setError(null);
    setStatus(null);
    try {
      await action();
      setStatus(message);
    } catch (value) {
      setError((value as Error).message);
      throw value;
    } finally {
      setBusy(null);
    }
  };

  async function savePassword() {
    await run(
      'password',
      async () => {
        await changePassword({ currentPassword, newPassword, confirmPassword, revokeOtherSessions: true });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setSessions((await listSessions()).sessions);
      },
      'Password changed. Other sessions were signed out.',
    ).catch(() => undefined);
  }

  async function enablePush() {
    await run(
      'push',
      async () => {
        const device = await getDeviceContext();
        const result = await requestNativePushPermission({
          onToken: async (token) => { await registerPushToken({ token, ...device }); },
          onRoute: (route) => navigate(route),
        });
        if (result === 'unsupported') throw new Error('Push notifications are available in the installed iOS and Android app.');
        if (result === 'denied') throw new Error('Permission was denied. Enable notifications in system settings.');
      },
      'Push notifications enabled.',
    ).catch(() => undefined);
  }

  async function saveNotifications(next: NotificationPreferences) {
    setNotifications(next);
    try {
      setNotifications(await updateNotificationPreferences(next));
    } catch (value) {
      setError((value as Error).message);
    }
  }

  async function saveDiscovery() {
    await run(
      'discovery',
      async () => setDiscovery(await updateDiscoveryPreferences(discovery)),
      'Discovery preferences saved.',
    ).catch(() => undefined);
  }

  async function requestVerification() {
    await run(
      'verification',
      async () => {
        await requestProfileVerification();
        setProfile(await getMyProfile());
      },
      'Verification request submitted for moderator review.',
    ).catch(() => undefined);
  }

  async function exportData() {
    await run(
      'export',
      async () => {
        const blob = await exportMyData();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `simp-data-export-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      },
      'Your export was downloaded.',
    ).catch(() => undefined);
  }

  async function deleteAccount() {
    if (deleteConfirm !== 'DELETE') return setError('Type DELETE exactly to confirm.');
    await run(
      'delete',
      async () => {
        await deleteMyAccount(deletePassword, 'DELETE');
        await logout().catch(() => undefined);
        navigate('/welcome', { replace: true });
      },
      '',
    ).catch(() => undefined);
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-ink-950"><div className="h-10 w-10 animate-spin rounded-full border-2 border-gold-400 border-t-transparent" /></div>;
  }

  return (
    <div className="relative min-h-screen bg-ink-950 pb-28 text-white">
      <div className="pointer-events-none absolute inset-0 bg-ink-radial" />
      <header className="relative z-10 mx-auto flex w-full max-w-md items-center justify-between px-5 pb-5 pt-safe">
        <button type="button" onClick={() => navigate(-1)} className="mt-4 min-h-11 text-xs uppercase tracking-[0.18em] text-white/50">Back</button>
        <h1 className="mt-4 text-xs font-semibold uppercase tracking-[0.24em] text-gold-300">Settings</h1>
        <span className="w-11" />
      </header>

      <main className="relative z-10 mx-auto w-full max-w-md space-y-6 px-4">
        {status && <button type="button" onClick={() => setStatus(null)} className="w-full rounded-xl border border-green-400/20 bg-green-500/10 px-4 py-3 text-left text-xs text-green-100" role="status">{status}</button>}
        {error && <button type="button" onClick={() => setError(null)} className="w-full rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-left text-xs text-red-100" role="alert">{error}</button>}

        <SettingsSection title="Account">
          <StaticRow label="Email" value={user?.email ?? 'Unavailable'} />
          <button type="button" onClick={() => navigate('/profile/edit')} className="settings-row">Edit profile <span>›</span></button>
          <div className="border-t border-white/[0.06] p-4">
            <p className="text-sm font-medium">Profile verification</p>
            <p className="mt-1 text-xs text-white/40">Status: {profile?.verificationStatus?.replace(/_/g, ' ').toLowerCase() ?? 'not requested'}</p>
            {profile?.verificationStatus !== 'APPROVED' && profile?.verificationStatus !== 'PENDING' && (
              <button type="button" disabled={busy === 'verification'} onClick={() => void requestVerification()} className="btn-gold-outline mt-3 px-4 py-2 text-[10px] uppercase tracking-[0.15em]">Request review</button>
            )}
          </div>
          <details className="border-t border-white/[0.06] p-4">
            <summary className="cursor-pointer text-sm font-medium">Change password</summary>
            <div className="mt-4 space-y-3">
              <input className="input-luxe w-full" type="password" autoComplete="current-password" placeholder="Current password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
              <input className="input-luxe w-full" type="password" autoComplete="new-password" placeholder="New password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
              <input className="input-luxe w-full" type="password" autoComplete="new-password" placeholder="Confirm new password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
              <p className="text-[10px] text-white/35">10+ characters with uppercase, lowercase, and a number. Other devices will be signed out.</p>
              <button type="button" onClick={() => void savePassword()} disabled={busy === 'password' || !currentPassword || !newPassword || !confirmPassword} className="btn-gold w-full py-3 text-xs uppercase tracking-[0.16em] disabled:opacity-30">Update password</button>
            </div>
          </details>
          <details className="border-t border-white/[0.06] p-4">
            <summary className="cursor-pointer text-sm font-medium">Active sessions <span className="text-white/35">({sessions.length})</span></summary>
            <div className="mt-3 space-y-2">{sessions.map((session) => {
              const isCurrent = session.current;
              const otherCount = sessions.filter((s) => !s.current).length;
              return (
                <div key={session.id} className="flex items-center gap-3 rounded-xl bg-white/[0.035] p-3">
                  <span aria-hidden="true" className="text-base">{session.platform === 'IOS' ? '📱' : session.platform === 'ANDROID' ? '🤖' : '💻'}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm">{session.deviceName ?? session.platform}</p>
                      {isCurrent && <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-300">This device</span>}
                    </div>
                    <p className="text-[10px] text-white/35">{isCurrent ? 'Active now' : `Last active ${formatRelative(session.lastUsedAt)}`}</p>
                  </div>
                  {!isCurrent && (
                    <button
                      type="button"
                      onClick={() => void run(`session:${session.id}`, async () => {
                        await revokeSession(session.id);
                        setSessions((items) => items.filter((item) => item.id !== session.id));
                      }, 'Session revoked.').catch(() => undefined)}
                      className="text-[10px] uppercase text-red-300"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              );
            })}</div>
            {sessions.filter((s) => !s.current).length > 0 && (
              <button
                type="button"
                onClick={() => void run('logoutOtherDevices', async () => {
                  const others = sessions.filter((s) => !s.current);
                  await Promise.all(others.map((s) => revokeSession(s.id)));
                  setSessions((items) => items.filter((item) => item.current));
                  return undefined;
                }, `${sessions.filter((s) => !s.current).length} other session${sessions.filter((s) => !s.current).length === 1 ? '' : 's'} signed out.`).catch(() => undefined)}
                className="mt-3 min-h-11 w-full rounded-xl border border-amber-400/30 bg-amber-500/10 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-amber-200"
              >
                Sign out other devices ({sessions.filter((s) => !s.current).length})
              </button>
            )}
            <button type="button" onClick={() => void run('logoutAll', async () => { await logoutAll(); await logout(); navigate('/login', { replace: true }); }, '').catch(() => undefined)} className="mt-2 min-h-11 w-full text-xs uppercase tracking-[0.15em] text-red-300">Sign out everywhere</button>
          </details>
        </SettingsSection>

        <SettingsSection title="Discovery">
          <div className="space-y-5 p-4">
            <div><div className="flex justify-between text-xs"><span>Age range</span><span className="text-gold-200">{discovery.minAge}–{discovery.maxAge === 99 ? '99+' : discovery.maxAge}</span></div><input type="range" min="18" max="98" value={discovery.minAge} onChange={(event) => setDiscovery((value) => ({ ...value, minAge: Math.min(Number(event.target.value), value.maxAge) }))} className="mt-2 w-full accent-gold-400" /><input type="range" min="19" max="99" value={discovery.maxAge} onChange={(event) => setDiscovery((value) => ({ ...value, maxAge: Math.max(Number(event.target.value), value.minAge) }))} className="mt-2 w-full accent-gold-400" /></div>
            <label className="block text-xs">Maximum distance<select value={discovery.maxDistanceKm ?? ''} onChange={(event) => setDiscovery((value) => ({ ...value, maxDistanceKm: event.target.value ? Number(event.target.value) : null }))} className="input-luxe mt-2 w-full"><option value="">Any distance</option><option value="25">25 km</option><option value="50">50 km</option><option value="100">100 km</option><option value="250">250 km</option></select></label>
            <Toggle label="Verified profiles only" checked={discovery.verifiedOnly} onChange={(checked) => setDiscovery((value) => ({ ...value, verifiedOnly: checked }))} />
            <button type="button" onClick={() => void run('location', async () => { const location = await requestApproximateLocation(); setDiscovery(await updateDiscoveryPreferences({ ...discovery, locationLat: location.latitude, locationLng: location.longitude } as DiscoveryPreferences & { locationLat: number; locationLng: number })); }, 'Approximate location updated. Exact coordinates are never shown.').catch(() => undefined)} className="btn-gold-outline w-full py-3 text-xs uppercase tracking-[0.16em]">Update approximate location</button>
            <button type="button" disabled={busy === 'discovery'} onClick={() => void saveDiscovery()} className="btn-gold w-full py-3 text-xs uppercase tracking-[0.16em]">Save discovery settings</button>
          </div>
        </SettingsSection>

        <SettingsSection title="Notifications">
          <div className="divide-y divide-white/[0.06]">{(['matches', 'messages', 'likes', 'live', 'marketing'] as const).map((key) => <div key={key} className="p-4"><Toggle label={key.charAt(0).toUpperCase() + key.slice(1)} checked={notifications[key]} onChange={(checked) => void saveNotifications({ ...notifications, [key]: checked })} /></div>)}</div>
          <div className="border-t border-white/[0.06] p-4"><button type="button" disabled={busy === 'push'} onClick={() => void enablePush()} className="btn-gold-outline w-full py-3 text-xs uppercase tracking-[0.16em]">Enable device push</button></div>
        </SettingsSection>

        <SettingsSection title="Safety">
          <details className="p-4"><summary className="cursor-pointer text-sm font-medium">Blocked people <span className="text-white/35">({blocks.length})</span></summary><div className="mt-3 space-y-2">{blocks.length === 0 ? <p className="text-xs text-white/35">You have not blocked anyone.</p> : blocks.map((blocked) => <div key={blocked.blockedId} className="flex items-center gap-3 rounded-xl bg-white/[0.035] p-3">{blocked.photoUrl && <img src={blocked.photoUrl} alt="" className="h-9 w-9 rounded-full object-cover" />}<span className="min-w-0 flex-1 truncate text-sm">{blocked.displayName}</span><button type="button" onClick={() => void run(`unblock:${blocked.blockedId}`, async () => { await unblockUser(blocked.blockedId); setBlocks((items) => items.filter((item) => item.blockedId !== blocked.blockedId)); }, `${blocked.displayName} was unblocked.`).catch(() => undefined)} className="text-[10px] uppercase text-gold-300">Unblock</button></div>)}</div></details>
          <button type="button" onClick={() => window.open(`${API_BASE_URL}/support`, '_blank', 'noopener')} className="settings-row border-t border-white/[0.06]">Safety help and support <span>›</span></button>
        </SettingsSection>

        <SettingsSection title="Privacy and data">
          <button type="button" disabled={busy === 'export'} onClick={() => void exportData()} className="settings-row">{busy === 'export' ? 'Preparing export…' : 'Download my data'} <span>›</span></button>
          <button type="button" onClick={() => window.open(`${API_BASE_URL}/privacy`, '_blank', 'noopener')} className="settings-row border-t border-white/[0.06]">Privacy Policy <span>›</span></button>
          <button type="button" onClick={() => window.open(`${API_BASE_URL}/terms`, '_blank', 'noopener')} className="settings-row border-t border-white/[0.06]">Terms of Service <span>›</span></button>
        </SettingsSection>

        <SettingsSection title="Subscription">
          <StaticRow label="Current plan" value={user?.entitlement.tier.replace(/_/g, ' ') ?? 'FREE'} />
          {import.meta.env.VITE_BILLING_ENABLED === 'true' && <button type="button" onClick={() => navigate('/premium')} className="settings-row border-t border-white/[0.06]">Manage or restore purchases <span>›</span></button>}
        </SettingsSection>

        {isStaff && (
          <SettingsSection title="Admin">
            <button type="button" onClick={() => navigate('/admin')} className="settings-row">
              Open admin console <span>›</span>
            </button>
          </SettingsSection>
        )}

        <SettingsSection title="App">
          <StaticRow label="Version" value={import.meta.env.VITE_APP_VERSION ?? '0.3.0-rc.1'} />
          <button type="button" onClick={() => navigate('/licenses')} className="settings-row border-t border-white/[0.06]">Open-source licenses <span>›</span></button>
        </SettingsSection>

        <button type="button" onClick={() => void logout().then(() => navigate('/login', { replace: true }))} className="w-full rounded-2xl border border-white/10 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-white/60">Log out</button>
        <div className="border-t border-red-400/20 pt-5">
          {!showDelete ? <button type="button" onClick={() => setShowDelete(true)} className="w-full rounded-2xl border border-red-400/25 bg-red-500/[0.06] py-4 text-xs font-semibold uppercase tracking-[0.16em] text-red-300">Delete account</button> : <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl border border-red-400/30 bg-red-500/[0.07] p-4"><h2 className="text-sm font-semibold text-red-200">Permanently delete your account</h2><p className="mt-2 text-xs leading-relaxed text-red-100/60">This removes your profile, photos, matches, messages, and account data. Safety reports are retained only in anonymized form.</p><input type="password" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} className="input-luxe mt-4 w-full" placeholder="Current password" /><input value={deleteConfirm} onChange={(event) => setDeleteConfirm(event.target.value)} className="input-luxe mt-2 w-full" placeholder="Type DELETE" /><button type="button" disabled={busy === 'delete' || deleteConfirm !== 'DELETE'} onClick={() => void deleteAccount()} className="mt-4 w-full rounded-full bg-red-500 py-3 text-xs font-bold uppercase tracking-[0.16em] disabled:opacity-30">Delete forever</button><button type="button" onClick={() => setShowDelete(false)} className="mt-2 min-h-11 w-full text-xs uppercase text-white/40">Cancel</button></motion.div>}
        </div>
      </main>
    </div>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h2 className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-gold-300/75">{title}</h2><div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-black/25 backdrop-blur-sm">{children}</div></section>;
}
function StaticRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-3 p-4"><span className="text-sm text-white/75">{label}</span><span className="max-w-[60%] truncate text-sm text-white/40">{value}</span></div>;
}
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex min-h-11 items-center justify-between gap-4"><span className="text-sm text-white/75">{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 accent-gold-400" /></label>;
}

/**
 * Compact human-readable "X ago" string for the active-sessions list.
 * Inlined here (rather than in Notifications.tsx where a similar
 * helper exists) because Settings doesn't depend on Notifications.
 */
function formatRelative(value: string): string {
  const seconds = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 1_000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

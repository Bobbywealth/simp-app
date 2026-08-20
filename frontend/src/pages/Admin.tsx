import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  endAdminLiveStream,
  getAdminModerationHistory,
  getAdminStats,
  getBackendHealth,
  listAdminLiveStreams,
  listAdminReports,
  listAdminUsers,
  listAdminVerifications,
  reviewAdminVerification,
  updateAdminReport,
  updateAdminUserRole,
  updateAdminUserStatus,
  type AdminHealth,
  type AdminModerationHistoryRow,
  type AdminReportRow,
  type AdminStats,
  type AdminUserRow,
  type AdminVerificationRow,
} from '../api/admin';
import type { LiveStream } from '../api/live';
import { useAuth } from '../store/auth';

const STAFF_ROLES = ['MODERATOR', 'ADMIN', 'SUPER_ADMIN'] as const;
const USER_STATUS_OPTIONS = ['ALL', 'ACTIVE', 'SUSPENDED', 'BANNED', 'DELETED'] as const;
const USER_ROLE_OPTIONS = ['USER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN'] as const;
const REPORT_STATUS_OPTIONS = ['ALL', 'OPEN', 'REVIEWING', 'ACTIONED', 'DISMISSED'] as const;
const VERIFICATION_STATUS_OPTIONS = ['PENDING', 'APPROVED', 'REJECTED'] as const;
const TABS = ['overview', 'users', 'reports', 'verifications', 'live', 'health'] as const;

type Tab = (typeof TABS)[number];
type UserStatusFilter = (typeof USER_STATUS_OPTIONS)[number];
type ReportStatusFilter = (typeof REPORT_STATUS_OPTIONS)[number];
type VerificationStatusFilter = (typeof VERIFICATION_STATUS_OPTIONS)[number];
type StaffRole = (typeof STAFF_ROLES)[number];

type EditableUserStatus = Exclude<AdminUserRow['status'], 'DELETED'>;

type UserDraft = {
  status: EditableUserStatus;
  role: AdminUserRow['role'];
  reason: string;
};

export default function Admin() {
  const navigate = useNavigate();
  const { user, ready } = useAuth();
  const isAllowed = !!user && STAFF_ROLES.includes(user.role as StaffRole);

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [health, setHealth] = useState<AdminHealth | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [reports, setReports] = useState<AdminReportRow[]>([]);
  const [verifications, setVerifications] = useState<AdminVerificationRow[]>([]);
  const [liveStreams, setLiveStreams] = useState<LiveStream[]>([]);
  const [userQuery, setUserQuery] = useState('');
  const [userStatus, setUserStatus] = useState<UserStatusFilter>('ALL');
  const [reportStatus, setReportStatus] = useState<ReportStatusFilter>('OPEN');
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatusFilter>('PENDING');
  const [userDrafts, setUserDrafts] = useState<Record<string, UserDraft>>({});
  const [reportNotes, setReportNotes] = useState<Record<string, string>>({});
  const [verificationNotes, setVerificationNotes] = useState<Record<string, string>>({});
  const [historyByUser, setHistoryByUser] = useState<Record<string, AdminModerationHistoryRow[]>>({});
  const [historyBusy, setHistoryBusy] = useState<string | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !user || !isAllowed) return;
    void refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user, isAllowed]);

  if (!ready || loading) return <LoadingState />;
  if (!user || !isAllowed) return <Navigate to="/home" replace />;

  async function refreshAll() {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, healthRes, usersRes, reportsRes, verificationsRes, liveRes] = await Promise.all([
        getAdminStats(),
        getBackendHealth(),
        listAdminUsers({ limit: 25, query: userQuery.trim() || undefined, status: userStatus === 'ALL' ? undefined : userStatus }),
        listAdminReports({ limit: 25, status: reportStatus === 'ALL' ? undefined : reportStatus }),
        listAdminVerifications(verificationStatus),
        listAdminLiveStreams(),
      ]);

      setStats(statsRes);
      setHealth(healthRes);
      setUsers(usersRes.users);
      setReports(reportsRes.reports);
      setVerifications(verificationsRes.requests);
      setLiveStreams(liveRes.streams);

      setUserDrafts((current) => {
        const next = { ...current };
        for (const row of usersRes.users) next[row.id] ??= { status: row.status === 'DELETED' ? 'ACTIVE' : row.status, role: row.role, reason: 'Updated from admin console.' };
        return next;
      });
      setReportNotes((current) => {
        const next = { ...current };
        for (const row of reportsRes.reports) next[row.id] ??= 'Reviewed from admin console.';
        return next;
      });
      setVerificationNotes((current) => {
        const next = { ...current };
        for (const row of verificationsRes.requests) next[row.id] ??= 'Reviewed from admin console.';
        return next;
      });
    } catch (value) {
      setError((value as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function refreshUsers() {
    setBusy('users');
    setError(null);
    try {
      const result = await listAdminUsers({ limit: 25, query: userQuery.trim() || undefined, status: userStatus === 'ALL' ? undefined : userStatus });
      setUsers(result.users);
      setUserDrafts((current) => {
        const next = { ...current };
        for (const row of result.users) next[row.id] ??= { status: row.status === 'DELETED' ? 'ACTIVE' : row.status, role: row.role, reason: 'Updated from admin console.' };
        return next;
      });
    } catch (value) {
      setError((value as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function refreshReports() {
    setBusy('reports');
    setError(null);
    try {
      const result = await listAdminReports({ limit: 25, status: reportStatus === 'ALL' ? undefined : reportStatus });
      setReports(result.reports);
      setReportNotes((current) => {
        const next = { ...current };
        for (const row of result.reports) next[row.id] ??= 'Reviewed from admin console.';
        return next;
      });
    } catch (value) {
      setError((value as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function refreshVerifications() {
    setBusy('verifications');
    setError(null);
    try {
      const result = await listAdminVerifications(verificationStatus);
      setVerifications(result.requests);
      setVerificationNotes((current) => {
        const next = { ...current };
        for (const row of result.requests) next[row.id] ??= 'Reviewed from admin console.';
        return next;
      });
    } catch (value) {
      setError((value as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function refreshLive() {
    setBusy('live');
    setError(null);
    try {
      const result = await listAdminLiveStreams();
      setLiveStreams(result.streams);
    } catch (value) {
      setError((value as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function refreshHealth() {
    setBusy('health');
    setError(null);
    try {
      setHealth(await getBackendHealth());
    } catch (value) {
      setError((value as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function refreshStats() {
    try {
      setStats(await getAdminStats());
    } catch (value) {
      setError((value as Error).message);
    }
  }

  async function saveUserStatus(row: AdminUserRow) {
    const draft = userDrafts[row.id] ?? { status: row.status === 'DELETED' ? 'ACTIVE' : row.status, role: row.role, reason: 'Updated from admin console.' };
    setBusy(`user-status:${row.id}`);
    setError(null);
    try {
      await updateAdminUserStatus(row.id, { status: draft.status, reason: draft.reason.trim() || 'Updated from admin console.' });
      await refreshUsers();
      await refreshStats();
    } catch (value) {
      setError((value as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function saveUserRole(row: AdminUserRow) {
    const draft = userDrafts[row.id] ?? { status: row.status === 'DELETED' ? 'ACTIVE' : row.status, role: row.role, reason: 'Updated from admin console.' };
    setBusy(`user-role:${row.id}`);
    setError(null);
    try {
      await updateAdminUserRole(row.id, { role: draft.role, reason: draft.reason.trim() || 'Updated from admin console.' });
      await refreshUsers();
      await refreshStats();
    } catch (value) {
      setError((value as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function saveReport(row: AdminReportRow, nextStatus: Exclude<AdminReportRow['status'], 'OPEN'>) {
    setBusy(`report:${row.id}`);
    setError(null);
    try {
      await updateAdminReport(row.id, { status: nextStatus, moderatorNotes: reportNotes[row.id]?.trim() || 'Reviewed from admin console.' });
      await refreshReports();
      await refreshStats();
    } catch (value) {
      setError((value as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function reviewVerification(row: AdminVerificationRow, nextStatus: 'APPROVED' | 'REJECTED') {
    setBusy(`verification:${row.id}`);
    setError(null);
    try {
      await reviewAdminVerification(row.id, { status: nextStatus, reviewNote: verificationNotes[row.id]?.trim() || 'Reviewed from admin console.' });
      await refreshVerifications();
      await refreshStats();
    } catch (value) {
      setError((value as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function endStream(stream: LiveStream) {
    const reason = window.prompt('Reason for ending this stream', 'Admin moderation')?.trim() || 'Admin moderation';
    setBusy(`stream:${stream.id}`);
    setError(null);
    try {
      await endAdminLiveStream(stream.id, reason);
      await refreshLive();
      await refreshStats();
    } catch (value) {
      setError((value as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function loadHistory(userId: string) {
    setHistoryBusy(userId);
    setError(null);
    try {
      const result = await getAdminModerationHistory(userId);
      setHistoryByUser((current) => ({ ...current, [userId]: result.actions }));
      setExpandedUserId(userId);
    } catch (value) {
      setError((value as Error).message);
    } finally {
      setHistoryBusy(null);
    }
  }

  return (
    <div className="min-h-screen bg-ink-950 pb-16 text-white">
      <div className="pointer-events-none absolute inset-0 bg-ink-radial" />
      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-safe pt-safe sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-white/[0.08] py-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <button type="button" onClick={() => navigate('/settings')} className="text-xs uppercase tracking-[0.18em] text-white/45">Back to settings</button>
            <h1 className="mt-2 display-heading text-3xl font-light text-gold-200">Admin console</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/55">Review production health, users, reports, verifications, and live rooms from one place.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.16em] text-white/60">
            <Pill>{user.role}</Pill>
            <Pill>{stats ? `${stats.pendingVerification} pending verifications` : 'Stats loading'}</Pill>
            <Pill>{health?.status ?? 'health loading'}</Pill>
          </div>
        </header>

        {error && <button type="button" onClick={() => setError(null)} className="mt-5 w-full rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-left text-xs text-red-100" role="alert">{error}</button>}

        <div className="mt-6 flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition ${activeTab === tab ? 'border-gold-400/40 bg-gold-400/15 text-gold-100' : 'border-white/10 bg-white/[0.03] text-white/55 hover:text-white'}`}>
              {tab}
            </button>
          ))}
        </div>

        <main className="mt-6 space-y-6">
          {activeTab === 'overview' && (
            <>
              <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
                <MetricCard label="Users" value={stats?.users ?? '—'} />
                <MetricCard label="Matches" value={stats?.activeMatches ?? '—'} />
                <MetricCard label="Messages" value={stats?.messages ?? '—'} />
                <MetricCard label="Live streams" value={stats?.liveStreams ?? '—'} />
                <MetricCard label="Open reports" value={stats?.openReports ?? '—'} />
                <MetricCard label="Pending verification" value={stats?.pendingVerification ?? '—'} />
              </section>

              <Panel title="Production health" action={<button type="button" onClick={() => void refreshHealth()} className="text-xs uppercase tracking-[0.16em] text-gold-300">Refresh</button>}>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-3 text-sm text-white/65">
                    <p>Status: <span className="text-gold-200">{health?.status ?? 'unknown'}</span></p>
                    <p>Database: <span className={health?.database ? 'text-green-300' : 'text-red-300'}>{health?.database ? 'connected' : 'not ready'}</span></p>
                    <div>
                      <p className="mb-2 text-xs uppercase tracking-[0.16em] text-white/35">Degraded features</p>
                      <div className="flex flex-wrap gap-2">{(health?.degradedFeatures?.length ? health.degradedFeatures : ['none']).map((item) => <Pill key={item}>{item}</Pill>)}</div>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {health?.integrations && Object.entries(health.integrations).map(([key, value]) => (
                      <div key={key} className="rounded-2xl border border-white/[0.08] bg-black/30 p-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-white/35">{formatIntegrationLabel(key)}</p>
                        <p className={`mt-2 text-sm font-semibold ${value ? 'text-green-300' : 'text-amber-200'}`}>{value ? 'Ready' : 'Missing'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </Panel>
            </>
          )}

          {activeTab === 'users' && (
            <Panel title="Users" action={<button type="button" onClick={() => void refreshUsers()} className="text-xs uppercase tracking-[0.16em] text-gold-300">Refresh</button>}>
              <div className="grid gap-3 md:grid-cols-3">
                <input value={userQuery} onChange={(event) => setUserQuery(event.target.value)} className="input-luxe" placeholder="Search email or display name" />
                <select value={userStatus} onChange={(event) => setUserStatus(event.target.value as UserStatusFilter)} className="input-luxe">
                  {USER_STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option === 'ALL' ? 'Any status' : option}</option>)}
                </select>
                <button type="button" onClick={() => void refreshUsers()} className="btn-gold px-5 py-3 text-xs uppercase tracking-[0.16em]">Apply filters</button>
              </div>
              <div className="mt-5 space-y-3">
                {users.map((row) => {
                  const draft = userDrafts[row.id] ?? { status: row.status === 'DELETED' ? 'ACTIVE' : row.status, role: row.role, reason: 'Updated from admin console.' };
                  const history = historyByUser[row.id] ?? [];
                  const expanded = expandedUserId === row.id;
                  const locked = row.status === 'DELETED';
                  return (
                    <div key={row.id} className="rounded-3xl border border-white/[0.08] bg-black/30 p-4">
                      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr_1fr_auto] lg:items-start">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold text-white">{row.profile?.displayName ?? row.email}</h3>
                            <Pill>{row.role}</Pill>
                            <Pill>{row.status}</Pill>
                            {row.emailVerified ? <Pill>verified</Pill> : <Pill>unverified</Pill>}
                          </div>
                          <p className="mt-1 text-xs text-white/45">{row.email}</p>
                          <p className="mt-1 text-xs text-white/35">Joined {formatDate(row.createdAt)} · Photos {row._count.photos} · Reports {row._count.reportsReceived}</p>
                        </div>
                        <label className="block text-xs uppercase tracking-[0.14em] text-white/35">
                          Status
                          <select value={draft.status} onChange={(event) => setUserDrafts((current) => ({ ...current, [row.id]: { ...draft, status: event.target.value as EditableUserStatus } }))} disabled={locked} className="input-luxe mt-2 w-full disabled:opacity-40">
                            {USER_STATUS_OPTIONS.filter((option): option is Exclude<UserStatusFilter, 'ALL'> => option !== 'ALL').map((option) => <option key={option} value={option}>{option}</option>)}
                          </select>
                        </label>
                        <label className="block text-xs uppercase tracking-[0.14em] text-white/35">
                          Role
                          <select value={draft.role} onChange={(event) => setUserDrafts((current) => ({ ...current, [row.id]: { ...draft, role: event.target.value as AdminUserRow['role'] } }))} disabled={locked} className="input-luxe mt-2 w-full disabled:opacity-40">
                            {USER_ROLE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                          </select>
                        </label>
                        <div className="flex flex-wrap gap-2 lg:justify-end">
                          <button type="button" onClick={() => void saveUserStatus(row)} disabled={locked || busy === `user-status:${row.id}` || busy === `user-role:${row.id}`} className="btn-gold-outline px-4 py-3 text-xs uppercase tracking-[0.14em] disabled:opacity-30">Save status</button>
                          <button type="button" onClick={() => void saveUserRole(row)} disabled={locked || busy === `user-status:${row.id}` || busy === `user-role:${row.id}`} className="btn-gold px-4 py-3 text-xs uppercase tracking-[0.14em] disabled:opacity-30">Save role</button>
                        </div>
                      </div>
                      {locked && <p className="mt-3 text-xs text-amber-200">Deleted users are locked from admin edits.</p>}
                      <label className="mt-4 block text-xs uppercase tracking-[0.14em] text-white/35">
                        Reason
                        <input value={draft.reason} onChange={(event) => setUserDrafts((current) => ({ ...current, [row.id]: { ...draft, reason: event.target.value } }))} className="input-luxe mt-2 w-full" placeholder="Reason for moderation action" />
                      </label>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button type="button" onClick={() => void loadHistory(row.id)} disabled={historyBusy === row.id} className="rounded-full border border-white/10 px-4 py-2 text-xs uppercase tracking-[0.14em] text-white/65 disabled:opacity-30">{historyBusy === row.id ? 'Loading history…' : 'Moderation history'}</button>
                        <button type="button" onClick={() => setExpandedUserId(expanded ? null : row.id)} className="rounded-full border border-white/10 px-4 py-2 text-xs uppercase tracking-[0.14em] text-white/65">{expanded ? 'Hide history' : 'Show history'}</button>
                      </div>
                      {expanded && (
                        <div className="mt-4 space-y-2 rounded-2xl border border-white/[0.08] bg-black/40 p-4 text-sm text-white/70">
                          {history.length === 0 ? <p className="text-xs text-white/40">No moderation history loaded yet.</p> : history.map((item) => <div key={item.id} className="border-b border-white/[0.06] pb-2 last:border-b-0 last:pb-0"><p className="text-xs uppercase tracking-[0.14em] text-gold-200">{item.action}</p><p className="mt-1 text-xs text-white/55">{item.reason}</p><p className="mt-1 text-[10px] text-white/35">{formatDate(item.createdAt)}</p></div>)}
                        </div>
                      )}
                    </div>
                  );
                })}
                {users.length === 0 && <EmptyState label="No users matched those filters." />}
              </div>
            </Panel>
          )}

          {activeTab === 'reports' && (
            <Panel title="Reports" action={<button type="button" onClick={() => void refreshReports()} className="text-xs uppercase tracking-[0.16em] text-gold-300">Refresh</button>}>
              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <select value={reportStatus} onChange={(event) => setReportStatus(event.target.value as ReportStatusFilter)} className="input-luxe">
                  {REPORT_STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option === 'ALL' ? 'Any status' : option}</option>)}
                </select>
                <button type="button" onClick={() => void refreshReports()} className="btn-gold-outline px-5 py-3 text-xs uppercase tracking-[0.16em]">Apply filters</button>
              </div>
              <div className="mt-5 space-y-3">
                {reports.map((row) => {
                  const note = reportNotes[row.id] ?? 'Reviewed from admin console.';
                  return (
                    <div key={row.id} className="rounded-3xl border border-white/[0.08] bg-black/30 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-white">{row.category}</h3>
                        <Pill>{row.status}</Pill>
                        {row.stream && <Pill>live</Pill>}
                      </div>
                      <p className="mt-2 text-sm text-white/70">{row.reason}</p>
                      {row.details && <p className="mt-2 text-xs text-white/45">{row.details}</p>}
                      <p className="mt-2 text-xs text-white/35">Reporter: {row.reporter.profile?.displayName ?? row.reporter.id} · Reported: {row.reported.profile?.displayName ?? row.reported.id}</p>
                      <label className="mt-4 block text-xs uppercase tracking-[0.14em] text-white/35">
                        Moderator note
                        <textarea value={note} onChange={(event) => setReportNotes((current) => ({ ...current, [row.id]: event.target.value }))} className="input-luxe mt-2 min-h-24 w-full resize-y" />
                      </label>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button type="button" onClick={() => void saveReport(row, 'REVIEWING')} disabled={busy === `report:${row.id}`} className="btn-gold-outline px-4 py-3 text-xs uppercase tracking-[0.14em] disabled:opacity-30">Mark reviewing</button>
                        <button type="button" onClick={() => void saveReport(row, 'ACTIONED')} disabled={busy === `report:${row.id}`} className="btn-gold px-4 py-3 text-xs uppercase tracking-[0.14em] disabled:opacity-30">Actioned</button>
                        <button type="button" onClick={() => void saveReport(row, 'DISMISSED')} disabled={busy === `report:${row.id}`} className="rounded-full border border-white/10 px-4 py-3 text-xs uppercase tracking-[0.14em] text-white/60 disabled:opacity-30">Dismiss</button>
                      </div>
                    </div>
                  );
                })}
                {reports.length === 0 && <EmptyState label="No reports found." />}
              </div>
            </Panel>
          )}

          {activeTab === 'verifications' && (
            <Panel title="Verifications" action={<button type="button" onClick={() => void refreshVerifications()} className="text-xs uppercase tracking-[0.16em] text-gold-300">Refresh</button>}>
              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <select value={verificationStatus} onChange={(event) => setVerificationStatus(event.target.value as VerificationStatusFilter)} className="input-luxe">
                  {VERIFICATION_STATUS_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
                <button type="button" onClick={() => void refreshVerifications()} className="btn-gold-outline px-5 py-3 text-xs uppercase tracking-[0.16em]">Apply filters</button>
              </div>
              <div className="mt-5 space-y-3">
                {verifications.map((row) => {
                  const note = verificationNotes[row.id] ?? 'Reviewed from admin console.';
                  return (
                    <div key={row.id} className="rounded-3xl border border-white/[0.08] bg-black/30 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-white">{row.user.profile?.displayName ?? row.user.email}</h3>
                        <Pill>{row.status}</Pill>
                      </div>
                      <p className="mt-2 text-xs text-white/45">{row.user.email}</p>
                      <p className="mt-1 text-xs text-white/35">Requested {formatDate(row.createdAt)}</p>
                      <label className="mt-4 block text-xs uppercase tracking-[0.14em] text-white/35">
                        Review note
                        <textarea value={note} onChange={(event) => setVerificationNotes((current) => ({ ...current, [row.id]: event.target.value }))} className="input-luxe mt-2 min-h-24 w-full resize-y" />
                      </label>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button type="button" onClick={() => void reviewVerification(row, 'APPROVED')} disabled={busy === `verification:${row.id}`} className="btn-gold px-4 py-3 text-xs uppercase tracking-[0.14em] disabled:opacity-30">Approve</button>
                        <button type="button" onClick={() => void reviewVerification(row, 'REJECTED')} disabled={busy === `verification:${row.id}`} className="rounded-full border border-red-400/30 bg-red-500/10 px-4 py-3 text-xs uppercase tracking-[0.14em] text-red-200 disabled:opacity-30">Reject</button>
                      </div>
                    </div>
                  );
                })}
                {verifications.length === 0 && <EmptyState label="No verification requests matched that filter." />}
              </div>
            </Panel>
          )}

          {activeTab === 'live' && (
            <Panel title="Live" action={<button type="button" onClick={() => void refreshLive()} className="text-xs uppercase tracking-[0.16em] text-gold-300">Refresh</button>}>
              <div className="space-y-3">
                {liveStreams.map((stream) => (
                  <div key={stream.id} className="rounded-3xl border border-white/[0.08] bg-black/30 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-white">{stream.title}</h3>
                      <Pill>{stream.viewerCount} viewers</Pill>
                      <Pill>{stream.heartCount} hearts</Pill>
                    </div>
                    <p className="mt-2 text-xs text-white/45">Broadcaster: {stream.broadcaster?.displayName ?? 'Unknown'}</p>
                    <p className="mt-1 text-xs text-white/35">Started {formatDate(stream.startedAt)}</p>
                    <button type="button" onClick={() => void endStream(stream)} disabled={busy === `stream:${stream.id}`} className="mt-4 rounded-full border border-red-400/30 bg-red-500/10 px-4 py-3 text-xs uppercase tracking-[0.14em] text-red-200 disabled:opacity-30">End stream</button>
                  </div>
                ))}
                {liveStreams.length === 0 && <EmptyState label="No live streams are active." />}
              </div>
            </Panel>
          )}

          {activeTab === 'health' && (
            <Panel title="Production health" action={<button type="button" onClick={() => void refreshHealth()} className="text-xs uppercase tracking-[0.16em] text-gold-300">Refresh</button>}>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-3xl border border-white/[0.08] bg-black/30 p-5">
                  <p className="text-xs uppercase tracking-[0.16em] text-white/35">Overall status</p>
                  <p className="mt-2 text-2xl font-light text-gold-200">{health?.status ?? 'unknown'}</p>
                  <p className="mt-3 text-sm text-white/65">Database: {health?.database ? 'connected' : 'not ready'}</p>
                  <div className="mt-4 flex flex-wrap gap-2">{(health?.degradedFeatures?.length ? health.degradedFeatures : ['none']).map((item) => <Pill key={item}>{item}</Pill>)}</div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {health?.integrations && Object.entries(health.integrations).map(([key, value]) => (
                    <div key={key} className="rounded-3xl border border-white/[0.08] bg-black/30 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-white/35">{formatIntegrationLabel(key)}</p>
                      <p className={`mt-2 text-sm font-semibold ${value ? 'text-green-300' : 'text-amber-200'}`}>{value ? 'Ready' : 'Missing'}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
          )}
        </main>
      </div>
    </div>
  );
}

function LoadingState() {
  return <div className="flex min-h-screen items-center justify-center bg-ink-950 text-white"><div className="h-10 w-10 animate-spin rounded-full border-2 border-gold-400 border-t-transparent" /></div>;
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <section className="overflow-hidden rounded-3xl border border-white/[0.08] bg-black/35 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm"><div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4"><h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-300/80">{title}</h2>{action}</div><div className="p-5">{children}</div></section>;
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-white/60">{children}</span>;
}

function EmptyState({ label }: { label: string }) {
  return <div className="rounded-3xl border border-dashed border-white/[0.08] bg-black/20 px-5 py-8 text-center text-sm text-white/40">{label}</div>;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function formatIntegrationLabel(key: string) {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase()).trim();
}

function MetricCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-3xl border border-white/[0.08] bg-black/30 p-5">
      <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">{label}</p>
      <p className="mt-3 text-3xl font-light text-gold-200">{value}</p>
    </div>
  );
}

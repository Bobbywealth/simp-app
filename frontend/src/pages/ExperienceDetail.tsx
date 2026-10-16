import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  approveRequest,
  cancelExperience,
  cancelMyRequest,
  declineRequest,
  getExperience,
  getExperienceRequests,
  removeGuest,
  requestToJoin,
  type ExperienceDetail as ExperienceDetailType,
  type ExperienceRequestItem,
} from '../api/experiences';
import {
  EXPERIENCE_CATEGORY_LABELS,
  categoryGradient,
  experienceStatusLabel,
  experienceStatusStyle,
  formatExperienceDate,
  formatExperiencePrice,
} from '../lib/experiences';
import { REPORT_REASONS, reportExperience, type ReportReason } from '../api/moderation';
import { Button } from '../components/Button';
import { Textarea } from '../components/Input';
import { SimpLogo } from '../components/SimpLogo';
import { getRealtimeSocket } from '../lib/realtime';

export default function ExperienceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<ExperienceDetailType | null>(null);
  const [requests, setRequests] = useState<ExperienceRequestItem[]>([]);
  const [requestsError, setRequestsError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showNoteForm, setShowNoteForm] = useState(false);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actingRequestId, setActingRequestId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [liveMessage, setLiveMessage] = useState('');

  const load = useCallback(async (silent = false) => {
    if (!id) return;
    if (!silent) setLoading(true);
    setError(null);
    setRequestsError(false);
    try {
      const res = await getExperience(id);
      setDetail(res);
      if (res.isHost) {
        try {
          const reqs = await getExperienceRequests(id);
          setRequests(reqs.requests);
        } catch {
          // Requests failing shouldn't block the detail view, but show it distinctly from "no requests".
          setRequestsError(true);
        }
      }
    } catch {
      if (!silent) setError('Could not load this experience. It may have been removed.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Live updates: silent refresh so the page doesn't flash the loading skeleton.
  useEffect(() => {
    if (!id) return;
    const socket = getRealtimeSocket();
    const onChange = (payload: { experienceId?: string }) => {
      if (payload.experienceId && payload.experienceId !== id) return;
      void load(true);
    };
    const announce = (message: string) => (payload: { experienceId?: string }) => {
      if (payload.experienceId && payload.experienceId !== id) return;
      setLiveMessage(message);
      void load(true);
    };
    socket.on('experience:request', announce('A new join request arrived.'));
    socket.on('experience:approved', announce('Your request was approved.'));
    socket.on('experience:declined', announce('Your request was declined.'));
    socket.on('experience:cancelled', announce('This experience was cancelled.'));
    socket.on('experience:removed', announce('You were removed from this experience.'));
    socket.on('experience:guest-left', announce('A guest left this experience.'));
    return () => {
      socket.off('experience:request');
      socket.off('experience:approved');
      socket.off('experience:declined');
      socket.off('experience:cancelled');
      socket.off('experience:removed');
      socket.off('experience:guest-left');
    };
  }, [id, load]);

  async function handleRequestToJoin() {
    if (!id) return;
    setSubmitting(true);
    setActionError(null);
    try {
      await requestToJoin(id, note.trim() || undefined);
      setNote('');
      setShowNoteForm(false);
      await load();
    } catch {
      setActionError('Could not send your request. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleWithdrawRequest() {
    if (!id) return;
    setSubmitting(true);
    setActionError(null);
    try {
      await cancelMyRequest(id);
      await load();
    } catch {
      setActionError('Could not withdraw your request. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApprove(requestId: string) {
    if (!id) return;
    setActingRequestId(requestId);
    setActionError(null);
    try {
      const res = await approveRequest(id, requestId);
      setRequests((prev) => prev.map((r) => (r.id === requestId ? res.request : r)));
      setDetail((prev) =>
        prev
          ? { ...prev, approvedCount: res.approvedCount, status: res.experienceStatus }
          : prev,
      );
    } catch {
      setActionError('Could not approve that request. Try again.');
    } finally {
      setActingRequestId(null);
    }
  }

  async function handleDecline(requestId: string) {
    if (!id) return;
    setActingRequestId(requestId);
    setActionError(null);
    try {
      const res = await declineRequest(id, requestId);
      setRequests((prev) => prev.map((r) => (r.id === requestId ? res.request : r)));
    } catch {
      setActionError('Could not decline that request. Try again.');
    } finally {
      setActingRequestId(null);
    }
  }

  async function handleRemoveGuest(requestId: string) {
    if (!id) return;
    setActingRequestId(requestId);
    setActionError(null);
    try {
      const res = await removeGuest(id, requestId);
      setRequests((prev) => prev.map((r) => (r.id === requestId ? res.request : r)));
      // Refresh the detail to pick up the reopened status if it was FULL.
      void load(true);
    } catch {
      setActionError('Could not remove that guest. Try again.');
    } finally {
      setActingRequestId(null);
    }
  }

  async function handleCancelExperience() {
    if (!id) return;
    if (!window.confirm('Cancel this experience? Approved guests will be notified.')) return;
    setCancelling(true);
    setActionError(null);
    try {
      await cancelExperience(id);
      await load();
    } catch {
      setActionError('Could not cancel the experience. Try again.');
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-ink-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-ink-radial" />
      <p aria-live="polite" className="sr-only">{liveMessage}</p>

      <header className="relative z-10 flex items-center justify-between px-6 pt-safe pt-6">
        <button
          onClick={() => {
            // Deep-link entry has no history — fall back instead of exiting the app.
            if (window.history.length > 2) navigate(-1);
            else navigate('/experiences');
          }}
          className="text-xs font-medium uppercase tracking-[0.2em] text-white/60 hover:text-white"
        >
          ‹ Back
        </button>
        <h1 className="text-xs font-medium uppercase tracking-[0.3em] text-gold-300">
          Experience
        </h1>
        <div className="w-12" />
      </header>

      <main className="relative z-10 px-6 pt-6 pb-28">
        {loading && (
          <div className="animate-pulse">
            <div className="aspect-[16/10] rounded-2xl bg-ink-800" />
            <div className="mt-4 h-6 w-2/3 rounded bg-ink-800" />
            <div className="mt-2 h-4 w-1/2 rounded bg-ink-800" />
          </div>
        )}

        {error && !loading && (
          <div className="mt-12 flex flex-col items-center gap-4 text-center">
            <SimpLogo size={48} variant="emblem" />
            <p className="text-sm text-white/60">{error}</p>
            <button
              onClick={() => navigate('/experiences')}
              className="btn-gold-outline px-6 py-2.5 text-xs uppercase tracking-[0.18em]"
            >
              Browse experiences
            </button>
          </div>
        )}

        {detail && !loading && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-white/10">
              {detail.imageUrl ? (
                <img
                  src={detail.imageUrl}
                  alt={detail.title}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : null}
              <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${categoryGradient(detail.category)} ${detail.imageUrl ? 'absolute inset-0 -z-10' : ''}`}>
                <span className="text-sm font-semibold uppercase tracking-[0.3em] text-gold-200/70">
                  {EXPERIENCE_CATEGORY_LABELS[detail.category]}
                </span>
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute left-3 top-3 flex gap-2">
                <span className="rounded-full border border-gold-300/40 bg-black/60 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-gold-200 backdrop-blur">
                  {EXPERIENCE_CATEGORY_LABELS[detail.category]}
                </span>
                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] backdrop-blur ${experienceStatusStyle(detail.status)}`}>
                  {experienceStatusLabel(detail.status)}
                </span>
              </div>
            </div>

            <h2 className="display-heading mt-5 text-3xl font-light leading-tight">{detail.title}</h2>

            <div className="mt-3 space-y-1.5 text-sm text-white/65">
              <p>📍 {detail.city}</p>
              <p>🗓 {formatExperienceDate(detail.startsAt)}</p>
              {formatExperiencePrice(detail.priceCents, detail.currency) && (
                <p className="font-semibold text-gold-200">
                  {formatExperiencePrice(detail.priceCents, detail.currency)} per person
                </p>
              )}
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold uppercase tracking-[0.16em] text-gold-200">Spots</span>
                <span className="font-extrabold text-white">
                  {detail.capacity ? `${detail.approvedCount}/${detail.capacity}` : `${detail.approvedCount} joined`}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full bg-gold-gradient transition-all duration-500"
                  style={{ width: `${detail.capacity && detail.capacity > 0 ? Math.min(100, (detail.approvedCount / detail.capacity) * 100) : 0}%` }}
                />
              </div>
            </div>

            {detail.description && (
              <p className="mt-5 whitespace-pre-line text-sm leading-relaxed text-white/75">
                {detail.description}
              </p>
            )}

            {detail.venue && (
              <div className="mt-4 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <span className="text-gold-200">📍</span>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Meeting spot</p>
                  <p className="mt-1 text-sm text-white/85">{detail.venue}</p>
                </div>
              </div>
            )}

            {detail.logistics && (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Good to know</p>
                <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-white/75">{detail.logistics}</p>
              </div>
            )}

            <div className="mt-6 flex items-center gap-3 rounded-2xl border border-gold-300/20 bg-white/[0.03] p-4">
              {detail.host.photoUrl ? (
                <img
                  src={detail.host.photoUrl}
                  alt={detail.host.displayName ?? 'Host'}
                  className="h-12 w-12 rounded-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : null}
              <span className={`flex h-12 w-12 items-center justify-center rounded-full bg-ink-700 text-lg text-white/60 ${detail.host.photoUrl ? '-ml-12' : ''}`}>
                {((detail.host.displayName ?? '').charAt(0) || '?').toUpperCase()}
                </span>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold-200">Hosted by</p>
                <p className="truncate text-sm font-semibold text-white">
                  {detail.host.displayName}
                  {detail.host.age ? `, ${detail.host.age}` : ''}
                </p>
              </div>
            </div>

            {actionError && (
              <p className="mt-4 rounded-xl border border-red-300/30 bg-red-300/10 px-4 py-3 text-xs text-red-200" role="alert">
                {actionError}
              </p>
            )}

            {detail.isHost ? (
              <HostControls
                detail={detail}
                requests={requests}
                requestsError={requestsError}
                actingRequestId={actingRequestId}
                cancelling={cancelling}
                onApprove={handleApprove}
                onDecline={handleDecline}
                onRemove={handleRemoveGuest}
                onCancel={handleCancelExperience}
              />
            ) : (
              <GuestControls
                detail={detail}
                showNoteForm={showNoteForm}
                note={note}
                submitting={submitting}
                onOpenForm={() => setShowNoteForm(true)}
                onCloseForm={() => { setShowNoteForm(false); setNote(''); }}
                onNoteChange={setNote}
                onSubmit={handleRequestToJoin}
                onWithdraw={handleWithdrawRequest}
              />
            )}
            {!detail.isHost && (
              <ReportExperienceButton experienceId={detail.id} />
            )}
          </motion.div>
        )}
      </main>
    </div>
  );
}

function HostControls({
  detail,
  requests,
  requestsError,
  actingRequestId,
  cancelling,
  onApprove,
  onDecline,
  onRemove,
  onCancel,
}: {
  detail: ExperienceDetailType;
  requests: ExperienceRequestItem[];
  requestsError: boolean;
  actingRequestId: string | null;
  cancelling: boolean;
  onApprove: (requestId: string) => void;
  onDecline: (requestId: string) => void;
  onRemove: (requestId: string) => void;
  onCancel: () => void;
}) {
  const pending = requests.filter((r) => r.status === 'PENDING');
  const decided = requests.filter((r) => r.status !== 'PENDING');
  const active = detail.status === 'OPEN' || detail.status === 'FULL';

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-[0.24em] text-gold-200">
          Join requests
        </h3>
        {pending.length > 0 && (
          <span className="rounded-full bg-gold-400 px-2.5 py-0.5 text-[10px] font-bold text-ink-950">
            {pending.length} pending
          </span>
        )}
      </div>

      {requestsError ? (
        <p className="mt-3 text-sm text-red-300/80">
          Couldn't load requests. Pull to refresh or try again.
        </p>
      ) : (
        requests.length === 0 && (
          <p className="mt-3 text-sm text-white/50">
            No requests yet. Share your experience to fill the seats.
          </p>
        )
      )}

      <div className="mt-3 space-y-3">
        {pending.map((req) => (
          <div key={req.id} className="rounded-2xl border border-gold-300/25 bg-white/[0.03] p-4">
            <div className="flex items-center gap-3">
              {req.requester.photoUrl ? (
                <img
                  src={req.requester.photoUrl}
                  alt={req.requester.displayName ?? 'Guest'}
                  className="h-10 w-10 rounded-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : null}
              <span className={`flex h-10 w-10 items-center justify-center rounded-full bg-ink-700 text-sm text-white/60 ${req.requester.photoUrl ? '-ml-10' : ''}`}>
                {((req.requester.displayName ?? '').charAt(0) || '?').toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">
                  {req.requester.displayName}
                  {req.requester.age ? `, ${req.requester.age}` : ''}
                </p>
                <p className="text-[11px] text-white/45">
                  {new Date(req.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
              </div>
            </div>
            {req.note && (
              <p className="mt-3 rounded-xl bg-black/40 p-3 text-sm italic leading-relaxed text-white/75">
                “{req.note}”
              </p>
            )}
            {active && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={() => onDecline(req.id)}
                  disabled={actingRequestId === req.id}
                  className="rounded-full border border-white/15 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-white/60 transition hover:border-white/30 hover:text-white disabled:opacity-50"
                >
                  {actingRequestId === req.id ? '…' : 'Decline'}
                </button>
                <button
                  onClick={() => onApprove(req.id)}
                  disabled={actingRequestId === req.id}
                  className="rounded-full bg-gold-400 py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-ink-950 transition hover:bg-gold-300 disabled:opacity-50"
                >
                  {actingRequestId === req.id ? '…' : 'Approve'}
                </button>
              </div>
            )}
          </div>
        ))}
        {decided.map((req) => (
          <div key={req.id} className="flex items-center justify-between rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
            <span className="truncate text-sm text-white/60">{req.requester.displayName}</span>
            <div className="flex items-center gap-3">
              <span className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${req.status === 'APPROVED' ? 'text-emerald-300' : 'text-white/40'}`}>
                {req.status.charAt(0) + req.status.slice(1).toLowerCase()}
              </span>
              {req.status === 'APPROVED' && (
                <button
                  onClick={() => onRemove(req.id)}
                  disabled={actingRequestId === req.id}
                  className="text-[10px] font-semibold uppercase tracking-[0.16em] text-red-300/70 hover:text-red-200 disabled:opacity-50"
                >
                  {actingRequestId === req.id ? 'Removing…' : 'Remove'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {active && (
        <button
          onClick={onCancel}
          disabled={cancelling}
          className="mt-6 w-full rounded-full border border-red-300/30 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-red-200 transition hover:bg-red-300/10 disabled:opacity-50"
        >
          {cancelling ? 'Cancelling…' : 'Cancel experience'}
        </button>
      )}
    </div>
  );
}

function GuestControls({
  detail,
  showNoteForm,
  note,
  submitting,
  onOpenForm,
  onCloseForm,
  onNoteChange,
  onSubmit,
  onWithdraw,
}: {
  detail: ExperienceDetailType;
  showNoteForm: boolean;
  note: string;
  submitting: boolean;
  onOpenForm: () => void;
  onCloseForm: () => void;
  onNoteChange: (note: string) => void;
  onSubmit: () => void;
  onWithdraw: () => void;
}) {
  const closed = detail.status === 'CANCELLED' || detail.status === 'COMPLETED';
  const full = detail.status === 'FULL';

  if (closed) {
    return (
      <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center">
        <p className="text-sm text-white/55">
          This experience is {detail.status === 'CANCELLED' ? 'cancelled' : 'over'}.
        </p>
      </div>
    );
  }

  if (detail.myRequest?.status === 'APPROVED') {
    return (
      <div className="mt-8 rounded-2xl border border-emerald-300/25 bg-emerald-300/[0.07] p-5 text-center">
        <p className="text-lg">🎉</p>
        <p className="display-heading mt-1 text-xl font-light text-white">You&apos;re in!</p>
        <p className="mt-1 text-sm text-white/60">
          The host approved your spot. See you {formatExperienceDate(detail.startsAt)}.
        </p>
        <button
          onClick={onWithdraw}
          disabled={submitting}
          className="mt-4 text-xs uppercase tracking-[0.16em] text-white/45 underline-offset-4 hover:text-white/70 hover:underline disabled:opacity-50"
        >
          {submitting ? 'Working…' : 'Give up my spot'}
        </button>
      </div>
    );
  }

  if (detail.myRequest?.status === 'PENDING') {
    return (
      <div className="mt-8 rounded-2xl border border-gold-300/25 bg-gold-300/[0.07] p-5 text-center">
        <p className="display-heading text-xl font-light text-white">Request pending</p>
        <p className="mt-1 text-sm text-white/60">
          The host is reviewing your request. We&apos;ll let you know.
        </p>
        <button
          onClick={onWithdraw}
          disabled={submitting}
          className="mt-4 text-xs uppercase tracking-[0.16em] text-white/45 underline-offset-4 hover:text-white/70 hover:underline disabled:opacity-50"
        >
          {submitting ? 'Working…' : 'Withdraw request'}
        </button>
      </div>
    );
  }

  if (detail.myRequest?.status === 'DECLINED') {
    return (
      <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center">
        <p className="display-heading text-xl font-light text-white">Not this time</p>
        <p className="mt-1 text-sm text-white/60">
          The host didn't approve your request. There are plenty more experiences to explore.
        </p>
      </div>
    );
  }

  if (detail.myRequest?.status === 'CANCELLED') {
    return (
      <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center">
        <p className="display-heading text-xl font-light text-white">Request ended</p>
        <p className="mt-1 text-sm text-white/60">
          This request is no longer active. You can send a new request to join.
        </p>
        <Button onClick={onOpenForm} className="mt-4">
          Request to join
        </Button>
      </div>
    );
  }

  if (full) {
    return (
      <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center">
        <p className="text-sm text-white/55">This experience is full.</p>
      </div>
    );
  }

  if (!showNoteForm) {
    return (
      <div className="mt-8">
        <Button onClick={onOpenForm} className="py-4 text-xs font-bold uppercase tracking-[0.2em]">
          Request to join
        </Button>
        <p className="mt-3 text-center text-[11px] text-white/45">
          The host reviews every request personally.
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-8 rounded-2xl border border-gold-300/25 bg-white/[0.03] p-5"
    >
      <Textarea
        label="Make your case"
        value={note}
        onChange={(e) => onNoteChange(e.target.value.slice(0, 500))}
        placeholder="Convince them why you'd be great company…"
        maxLength={500}
        rows={4}
      />
      <p className="mt-1 text-right text-[11px] text-white/40">{note.length}/500</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={onCloseForm}
          disabled={submitting}
          className="rounded-full border border-white/15 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-white/60 transition hover:border-white/30 hover:text-white disabled:opacity-50"
        >
          Cancel
        </button>
        <Button onClick={onSubmit} loading={submitting} className="py-3 text-xs font-bold uppercase tracking-[0.16em]">
          Send request
        </Button>
      </div>
    </motion.div>
  );
}

function ReportExperienceButton({ experienceId }: { experienceId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!reason) return;
    setSubmitting(true);
    setError(null);
    try {
      await reportExperience(experienceId, reason, details.trim() || undefined);
      setDone(true);
      setOpen(false);
    } catch {
      setError('Could not submit your report. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <p className="mt-6 text-center text-xs text-white/40">
        Thanks — our team will review this experience.
      </p>
    );
  }

  return (
    <div className="mt-6 text-center">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="text-xs text-white/35 underline decoration-white/20 underline-offset-4 hover:text-white/60"
        >
          Report this experience
        </button>
      ) : (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left">
          <p className="text-sm font-semibold text-white">Report this experience</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {REPORT_REASONS.map((r) => (
              <button
                key={r}
                onClick={() => setReason(r)}
                className={`rounded-xl border px-3 py-2 text-xs ${reason === r ? 'border-gold-300/50 bg-gold-300/10 text-gold-200' : 'border-white/10 text-white/60 hover:border-white/25'}`}
              >
                {r}
              </button>
            ))}
          </div>
          <Textarea
            label="Details (optional)"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="What happened?"
            maxLength={1000}
            rows={3}
          />
          {error && <p className="mt-2 text-xs text-red-300" role="alert">{error}</p>}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              onClick={() => { setOpen(false); setReason(''); setDetails(''); }}
              className="rounded-full border border-white/15 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-white/60"
            >
              Cancel
            </button>
            <Button onClick={submit} loading={submitting} disabled={!reason} className="py-2.5 text-xs">
              Submit report
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}

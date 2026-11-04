import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  getExperience,
  getPlanChat,
  sendPlanChat,
  type PlanChatMessage,
} from '../api/experiences';
import { getRealtimeSocket } from '../lib/realtime';

const POLL_MS = 10_000;

/** Group chat for a plan: the host and everyone the host approved. */
export default function PlanChat() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [title, setTitle] = useState('Plan chat');
  const [messages, setMessages] = useState<PlanChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [composer, setComposer] = useState('');
  const [sending, setSending] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);

  const merge = useCallback((incoming: PlanChatMessage[]) => {
    setMessages((current) => {
      const byId = new Map(current.map((m) => [m.id, m]));
      for (const m of incoming) byId.set(m.id, m);
      return [...byId.values()].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    });
  }, []);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const [detail, chat] = await Promise.all([getExperience(id), getPlanChat(id)]);
        if (cancelled) return;
        setTitle(detail.title);
        setMessages(chat.messages);
        setHasMore(chat.hasMore);
        setNextCursor(chat.nextCursor);
      } catch {
        if (!cancelled) setError('This chat is only open to people on the plan.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Realtime when the socket is up, with a slow poll as a safety net.
  useEffect(() => {
    if (!id || error) return;
    const socket = getRealtimeSocket();
    const onMessage = (payload: { experienceId: string; message: PlanChatMessage }) => {
      if (payload.experienceId === id) merge([payload.message]);
    };
    socket.on('plan:message', onMessage);
    const timer = window.setInterval(() => {
      void getPlanChat(id).then((chat) => merge(chat.messages)).catch(() => undefined);
    }, POLL_MS);
    return () => {
      socket.off('plan:message', onMessage);
      window.clearInterval(timer);
    };
  }, [id, error, merge]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function loadOlder() {
    if (!id || !nextCursor) return;
    const chat = await getPlanChat(id, nextCursor).catch(() => null);
    if (!chat) return;
    stickRef.current = false;
    merge(chat.messages);
    setHasMore(chat.hasMore);
    setNextCursor(chat.nextCursor);
  }

  async function onSend(e: FormEvent) {
    e.preventDefault();
    const body = composer.trim();
    if (!id || !body || sending) return;
    setSending(true);
    try {
      const res = await sendPlanChat(id, body);
      setComposer('');
      stickRef.current = true;
      merge([res.message]);
    } catch {
      window.alert('Message not sent. Try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="relative flex h-screen min-h-0 flex-col bg-ink-950 text-white">
      <header className="relative z-10 flex items-center justify-between border-b border-white/10 px-5 pb-3 pt-safe pt-5">
        <button
          onClick={() => navigate(id ? `/experiences/${id}` : '/experiences')}
          className="text-xs font-medium uppercase tracking-[0.2em] text-white/60 hover:text-white"
        >
          ‹ Plan
        </button>
        <div className="min-w-0 px-3 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-gold-300">Group chat</p>
          <h1 className="truncate text-sm text-white/85">{title}</h1>
        </div>
        <span className="w-12" />
      </header>

      {loading && <p className="p-8 text-center text-sm text-white/50">Loading…</p>}
      {error && !loading && <p role="alert" className="p-8 text-center text-sm text-white/60">{error}</p>}

      {!loading && !error && (
        <>
          <div
            ref={scrollerRef}
            onScroll={(e) => {
              const el = e.currentTarget;
              stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            }}
            className="relative z-10 flex-1 space-y-3 overflow-y-auto px-4 py-4"
          >
            {hasMore && (
              <button onClick={() => void loadOlder()} className="mx-auto block text-xs uppercase tracking-[0.16em] text-white/45 hover:text-white/70">
                Earlier messages
              </button>
            )}
            {messages.length === 0 && (
              <p className="py-16 text-center text-sm text-white/45">No messages yet. Say hello to everyone going.</p>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${m.mine ? 'bg-gold-400 text-ink-950' : 'border border-white/10 bg-white/[0.05] text-white'}`}>
                  {!m.mine && <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-gold-200">{m.senderName ?? 'Guest'}</p>}
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{m.body}</p>
                  <p className={`mt-1 text-[10px] ${m.mine ? 'text-ink-950/60' : 'text-white/35'}`}>
                    {new Date(m.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={onSend} className="relative z-10 flex items-end gap-2 border-t border-white/10 px-4 py-3" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}>
            <textarea
              value={composer}
              onChange={(e) => setComposer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              maxLength={1000}
              rows={1}
              aria-label="Message the group"
              placeholder="Message everyone on this plan…"
              className="input-luxe max-h-32 min-h-11 flex-1 resize-none"
            />
            <button type="submit" disabled={sending || !composer.trim()} className="btn-gold min-h-11 px-5 text-xs font-semibold uppercase tracking-[0.16em] disabled:opacity-50">
              Send
            </button>
          </form>
        </>
      )}
    </div>
  );
}

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { blockUser, reportUser, REPORT_REASONS, type ReportReason } from '../api/moderation';
import {
  getConversation,
  getMessages,
  markConversationRead,
  sendMessage as sendMessageRest,
} from '../api/messages';
import { unmatch } from '../api/matches';
import type { ConversationDetail, Message } from '../types';
import { useAuth } from '../store/auth';
import { getRealtimeSocket } from '../lib/realtime';
import { track, trackMilestone } from '../api/analytics';

export default function Conversation() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const userId = useAuth((state) => state.user?.id);
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  // Fire conversation_opened once per mount; dedupe across re-entries via
  // sessionStorage so we count unique conversations opened, not page refreshes.
  useEffect(() => {
    if (!id) return;
    const KEY = `simp_convo_opened_${id}`;
    try {
      if (sessionStorage.getItem(KEY)) return;
      sessionStorage.setItem(KEY, '1');
    } catch {
      /* sessionStorage may be unavailable */
    }
    void track('conversation_opened', { conversationId: id });
  }, [id]);
  const [composer, setComposer] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const [online, setOnline] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason>(REPORT_REASONS[0]);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<number | null>(null);
  const shouldStickRef = useRef(true);

  const mergeMessage = (message: Message) => {
    setMessages((current) => {
      const withoutOptimistic = current.filter(
        (item) => item.id !== message.id && (!message.clientId || item.clientId !== message.clientId),
      );
      return [...withoutOptimistic, message].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    });
  };

  useEffect(() => {
    if (!id || !userId) return;
    let cancelled = false;
    setTyping(false);
    setOnline(false);
    const load = async () => {
      setLoading(true);
      try {
        const [detail, history] = await Promise.all([getConversation(id), getMessages(id)]);
        if (cancelled) return;
        setConversation(detail);
        setMessages(history.messages);
        setNextCursor(history.nextCursor);
        setHasMore(history.hasMore);
        const latestIncoming = [...history.messages].reverse().find((message) => message.senderId !== userId);
        if (latestIncoming) await markConversationRead(id, latestIncoming.id).catch(() => undefined);
        window.requestAnimationFrame(() => scrollToBottom(false));
      } catch (value) {
        if (!cancelled) setError((value as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [id, userId]);

  useEffect(() => {
    if (!id || !userId) return;
    const socket = getRealtimeSocket();
    socket.emit('conversation:join', { conversationId: id });

    const onJoined = (payload: { conversationId: string; otherOnline: boolean }) => {
      if (payload.conversationId === id) setOnline(payload.otherOnline);
    };
    const onNew = (message: Message) => {
      if (message.conversationId !== id) return;
      mergeMessage(message);
      if (message.senderId !== userId) {
        socket.emit('message:read', { conversationId: id, throughMessageId: message.id });
      }
      if (shouldStickRef.current || message.senderId === userId) {
        window.requestAnimationFrame(() => scrollToBottom(true));
      }
    };
    const onSent = (message: Message) => {
      if (message.conversationId === id) mergeMessage(message);
    };
    const onError = (payload: { clientId?: string; message?: string }) => {
      if (payload.clientId) {
        setMessages((current) => current.filter((message) => message.clientId !== payload.clientId));
      }
      setError(payload.message ?? 'Message could not be sent.');
      setSending(false);
    };
    const onDelivered = (payload: { conversationId: string; at: string; throughMessageId?: string }) => {
      if (payload.conversationId !== id) return;
      setMessages((current) => applyReceipt(current, payload.throughMessageId, { deliveredAt: payload.at }));
    };
    const onRead = (payload: { conversationId: string; at: string; throughMessageId?: string }) => {
      if (payload.conversationId !== id) return;
      setMessages((current) =>
        applyReceipt(current, payload.throughMessageId, { deliveredAt: payload.at, readAt: payload.at }),
      );
    };
    const onTypingStart = (payload: { conversationId: string; userId: string }) => {
      if (payload.conversationId === id && payload.userId !== userId) setTyping(true);
    };
    const onTypingStop = (payload: { conversationId: string; userId: string }) => {
      if (payload.conversationId === id && payload.userId !== userId) setTyping(false);
    };
    const onPresence = (payload: { userId: string; online: boolean }) => {
      if (payload.userId === conversation?.otherUser.userId) {
        setOnline(payload.online);
      }
    };
    const onDeleted = (payload: { conversationId: string; messageId: string; deletedAt: string }) => {
      if (payload.conversationId !== id) return;
      setMessages((current) =>
        current.map((message) =>
          message.id === payload.messageId ? { ...message, body: '', deletedAt: payload.deletedAt } : message,
        ),
      );
    };
    const onBlocked = () => navigate('/messages', { replace: true });

    socket.on('conversation:joined', onJoined);
    socket.on('message:new', onNew);
    socket.on('message:sent', onSent);
    socket.on('message:error', onError);
    socket.on('message:delivered', onDelivered);
    socket.on('message:read', onRead);
    socket.on('typing:start', onTypingStart);
    socket.on('typing:stop', onTypingStop);
    socket.on('presence:update', onPresence);
    socket.on('message:deleted', onDeleted);
    socket.on('safety:block', onBlocked);

    return () => {
      socket.emit('conversation:leave', { conversationId: id });
      socket.off('conversation:joined', onJoined);
      socket.off('message:new', onNew);
      socket.off('message:sent', onSent);
      socket.off('message:error', onError);
      socket.off('message:delivered', onDelivered);
      socket.off('message:read', onRead);
      socket.off('typing:start', onTypingStart);
      socket.off('typing:stop', onTypingStop);
      socket.off('presence:update', onPresence);
      socket.off('message:deleted', onDeleted);
      socket.off('safety:block', onBlocked);
      if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
    };
  }, [id, userId, conversation?.otherUser.userId, navigate]);

  function scrollToBottom(smooth: boolean) {
    const scroller = scrollerRef.current;
    if (scroller) scroller.scrollTo({ top: scroller.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }

  async function loadOlder() {
    if (!id || !nextCursor || loadingOlder) return;
    const scroller = scrollerRef.current;
    const previousHeight = scroller?.scrollHeight ?? 0;
    setLoadingOlder(true);
    try {
      const response = await getMessages(id, nextCursor);
      setMessages((current) => {
        const ids = new Set(current.map((message) => message.id));
        return [...response.messages.filter((message) => !ids.has(message.id)), ...current];
      });
      setNextCursor(response.nextCursor);
      setHasMore(response.hasMore);
      window.requestAnimationFrame(() => {
        if (scroller) scroller.scrollTop = scroller.scrollHeight - previousHeight;
      });
    } catch (value) {
      setError((value as Error).message);
    } finally {
      setLoadingOlder(false);
    }
  }

  function handleComposerChange(value: string) {
    setComposer(value);
    if (!id) return;
    const socket = getRealtimeSocket();
    socket.emit('typing:start', { conversationId: id });
    if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
    typingTimerRef.current = window.setTimeout(() => {
      socket.emit('typing:stop', { conversationId: id });
    }, 1_200);
  }

  async function handleSend(event: FormEvent) {
    event.preventDefault();
    const body = composer.trim();
    if (!id || !userId || !body || sending) return;
    const clientId = crypto.randomUUID();
    const optimistic: Message = {
      id: `pending:${clientId}`,
      conversationId: id,
      senderId: userId,
      clientId,
      body,
      messageType: 'TEXT',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deliveredAt: null,
      readAt: null,
      deletedAt: null,
    };
    setComposer('');
    setSending(true);
    setError(null);
    mergeMessage(optimistic);
    window.requestAnimationFrame(() => scrollToBottom(true));
    const socket = getRealtimeSocket();
    socket.emit('typing:stop', { conversationId: id });
    try {
      if (socket.connected) {
        socket.emit('message:send', { conversationId: id, body, clientId });
      } else {
        mergeMessage(await sendMessageRest(id, body, clientId));
      }
    } catch (value) {
      setMessages((current) => current.filter((message) => message.clientId !== clientId));
      setError((value as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function handleReport() {
    if (!conversation) return;
    try {
      await reportUser(conversation.otherUser.userId, reportReason);
      setActionStatus('Report submitted. Our safety team will review it.');
      setShowReport(false);
    } catch (value) {
      setError((value as Error).message);
    }
  }

  async function handleBlock() {
    if (!conversation) return;
    try {
      await blockUser(conversation.otherUser.userId);
      navigate('/messages', { replace: true });
    } catch (value) {
      setError((value as Error).message);
    }
  }

  async function handleUnmatch() {
    if (!conversation) return;
    try {
      await unmatch(conversation.matchId);
      navigate('/matches', { replace: true });
    } catch (value) {
      setError((value as Error).message);
    }
  }

  if (loading) return <ConversationSkeleton />;
  if (!conversation || !id) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950 px-6 text-center text-white">
        <div>
          <p className="text-sm text-white/60">{error ?? 'Conversation unavailable.'}</p>
          <button type="button" onClick={() => navigate('/messages')} className="btn-gold-outline mt-5 px-5 py-2 text-xs uppercase tracking-[0.18em]">Back to messages</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-ink-950 text-white">
      <header className="relative z-20 border-b border-white/[0.08] bg-black/70 px-3 pt-safe backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-md items-center gap-3">
          <button type="button" onClick={() => navigate('/messages')} className="flex h-11 w-11 items-center justify-center rounded-full text-white/70 hover:bg-white/5" aria-label="Back to messages">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <button type="button" onClick={() => navigate(`/matches/${conversation.matchId}`)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-gold-400/30 bg-ink-800">
              {conversation.otherUser.thumbnailUrl || conversation.otherUser.photoUrl ? (
                <img src={conversation.otherUser.thumbnailUrl ?? conversation.otherUser.photoUrl ?? ''} alt={conversation.otherUser.displayName} className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold">{conversation.otherUser.displayName}</h1>
              <p className={`text-[10px] ${online ? 'text-green-300' : 'text-white/35'}`}>{typing ? 'Typing…' : online ? 'Online' : 'SIMP connection'}</p>
            </div>
          </button>
          <button type="button" onClick={() => setShowActions(true)} className="flex h-11 w-11 items-center justify-center rounded-full text-white/65 hover:bg-white/5" aria-label="Conversation actions">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>
          </button>
        </div>
      </header>

      <div
        ref={scrollerRef}
        onScroll={(event) => {
          const element = event.currentTarget;
          shouldStickRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 100;
          if (element.scrollTop < 80 && hasMore) void loadOlder();
        }}
        className="flex-1 overflow-y-auto overscroll-contain"
      >
        <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-end px-4 py-5">
          {hasMore && (
            <button type="button" onClick={() => void loadOlder()} disabled={loadingOlder} className="mx-auto mb-5 text-[10px] uppercase tracking-[0.2em] text-gold-300 disabled:opacity-40">
              {loadingOlder ? 'Loading…' : 'Load earlier messages'}
            </button>
          )}
          <div className="mb-6 mx-auto max-w-sm rounded-2xl border border-gold-400/25 bg-gradient-to-br from-gold-400/12 via-white/[0.04] to-transparent p-4 text-center shadow-soft">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-gold-300">You matched</p>
            <h2 className="display-heading mt-1 text-2xl font-light text-white">
              Say something only {conversation.otherUser.displayName.split(' ')[0]} would notice.
            </h2>
            <p className="mt-2 text-[11px] leading-relaxed text-white/55">
              Lead with a shared interest or a real question. Avoid generic openers — first messages with a hook are replied to twice as often.
            </p>
          </div>
          <p className="mb-6 text-center text-[10px] leading-relaxed text-white/30">
            Keep it respectful and never send money or sensitive information.
          </p>
          <div className="space-y-2">
            {messages.map((message, index) => {
              const mine = message.senderId === userId;
              const showDate = index === 0 || new Date(messages[index - 1]!.createdAt).toDateString() !== new Date(message.createdAt).toDateString();
              return (
                <div key={message.id}>
                  {showDate && <p className="my-4 text-center text-[10px] uppercase tracking-[0.16em] text-white/25">{formatDate(message.createdAt)}</p>}
                  <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[82%] rounded-2xl px-4 py-2.5 ${mine ? 'rounded-br-md bg-gradient-to-br from-gold-300 to-gold-500 text-black' : 'rounded-bl-md border border-white/[0.08] bg-white/[0.07] text-white'}`}>
                      <p className={`whitespace-pre-wrap break-words text-[15px] leading-snug ${message.deletedAt ? 'italic opacity-55' : ''}`}>
                        {message.deletedAt ? 'Message removed' : message.body}
                      </p>
                      <div className={`mt-1 flex items-center justify-end gap-1 text-[9px] ${mine ? 'text-black/55' : 'text-white/35'}`}>
                        <span>{new Date(message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                        {mine && <span>{message.readAt ? 'Read' : message.deliveredAt ? 'Delivered' : message.id.startsWith('pending:') ? 'Sending' : 'Sent'}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {typing && <p className="mt-2 text-xs text-white/35">{conversation.otherUser.displayName} is typing…</p>}
        </div>
      </div>

      {error && (
        <div className="mx-auto w-full max-w-md px-4">
          <div role="alert" className="rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</div>
        </div>
      )}
      {actionStatus && (
        <div className="mx-auto w-full max-w-md px-4">
          <div role="status" className="rounded-xl border border-green-400/25 bg-green-500/10 px-3 py-2 text-xs text-green-100">{actionStatus}</div>
        </div>
      )}
      <form onSubmit={handleSend} className="border-t border-white/[0.08] bg-black/80 px-3 pb-safe backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-md items-end gap-2 py-2">
          <textarea
            value={composer}
            onChange={(event) => handleComposerChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            rows={1}
            maxLength={2_000}
            placeholder="Write a message…"
            aria-label="Message"
            className="max-h-32 min-h-11 flex-1 resize-none rounded-3xl border border-white/10 bg-white/[0.06] px-4 py-3 text-[15px] text-white placeholder:text-white/30 focus:border-gold-400/50 focus:outline-none"
          />
          <button type="submit" disabled={!composer.trim() || sending} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold-400 text-black transition active:scale-95 disabled:opacity-30" aria-label="Send message">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="m5 12 14-7-5 14-2-5-7-2Z"/></svg>
          </button>
        </div>
      </form>

      <AnimatePresence>
        {showActions && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70" onClick={() => setShowActions(false)}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} onClick={(event) => event.stopPropagation()} className="w-full max-w-md rounded-t-3xl border-t border-white/10 bg-ink-900 p-5 pb-safe">
              <div className="mx-auto mb-5 h-1 w-12 rounded-full bg-white/20" />
              <button type="button" onClick={() => { setShowActions(false); setShowReport(true); }} className="w-full border-b border-white/[0.08] px-2 py-4 text-left text-sm text-white/85">Report this person</button>
              <button type="button" onClick={() => void handleBlock()} className="w-full border-b border-white/[0.08] px-2 py-4 text-left text-sm text-red-300">Block this person</button>
              <button type="button" onClick={() => void handleUnmatch()} className="w-full px-2 py-4 text-left text-sm text-red-300">Unmatch</button>
              <button type="button" onClick={() => setShowActions(false)} className="mt-3 w-full rounded-full border border-white/10 py-3 text-xs uppercase tracking-[0.18em] text-white/60">Cancel</button>
            </motion.div>
          </div>
        )}
        {showReport && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70" onClick={() => setShowReport(false)}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} onClick={(event) => event.stopPropagation()} className="w-full max-w-md rounded-t-3xl border-t border-red-400/25 bg-ink-900 p-5 pb-safe">
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-gold-300">Report {conversation.otherUser.displayName}</h2>
              <div className="mt-4 space-y-1">
                {REPORT_REASONS.map((reason) => (
                  <label key={reason} className="flex min-h-11 items-center gap-3 rounded-xl px-2 text-sm text-white/75 hover:bg-white/5">
                    <input type="radio" name="reportReason" checked={reportReason === reason} onChange={() => setReportReason(reason)} className="accent-gold-400" />
                    {reason}
                  </label>
                ))}
              </div>
              <button type="button" onClick={() => void handleReport()} className="mt-5 w-full rounded-full bg-red-500 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-white">Submit report</button>
              <button type="button" onClick={() => setShowReport(false)} className="mt-2 w-full py-3 text-xs uppercase tracking-[0.18em] text-white/45">Cancel</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function applyReceipt(messages: Message[], throughId: string | undefined, patch: Partial<Message>) {
  const throughIndex = throughId ? messages.findIndex((message) => message.id === throughId) : messages.length - 1;
  if (throughIndex === -1) return messages;
  return messages.map((message, index) =>
    index <= throughIndex && !message.id.startsWith('pending:') ? { ...message, ...patch } : message,
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return 'Today';
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function ConversationSkeleton() {
  return (
    <div className="flex min-h-screen flex-col bg-ink-950">
      <div className="h-20 border-b border-white/[0.08] bg-black/50 pt-safe" />
      <div className="flex flex-1 flex-col justify-end gap-3 px-4 pb-8">
        <div className="h-14 w-2/3 animate-pulse self-start rounded-2xl bg-white/[0.06]" />
        <div className="h-20 w-3/4 animate-pulse self-end rounded-2xl bg-gold-400/10" />
        <div className="h-14 w-1/2 animate-pulse self-start rounded-2xl bg-white/[0.06]" />
      </div>
      <div className="h-16 border-t border-white/[0.08]" />
    </div>
  );
}

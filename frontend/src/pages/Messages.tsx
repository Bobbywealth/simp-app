import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getConversations } from '../api/messages';
import type { ConversationSummary, Message } from '../types';
import { getRealtimeSocket } from '../lib/realtime';
import { SimpLogo } from '../components/SimpLogo';
import { ShareButton } from '../components/ShareButton';
import { useAuth } from '../store/auth';

export default function Messages() {
  const navigate = useNavigate();
  const user = useAuth((state) => state.user);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await getConversations();
      setConversations(response.conversations);
    } catch (value) {
      setError((value as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const socket = getRealtimeSocket();
    const onUpdate = (payload: { conversationId: string; message: Message; senderId: string }) => {
      const currentUserId = user?.id;
      const isFromOther = payload.senderId !== currentUserId;
      setConversations((current) => {
        const found = current.find((item) => item.id === payload.conversationId);
        if (!found) {
          void load();
          return current;
        }
        const updated = {
          ...found,
          latestMessage: payload.message,
          updatedAt: payload.message.createdAt,
          unreadCount: isFromOther ? found.unreadCount + 1 : found.unreadCount,
        };
        return [updated, ...current.filter((item) => item.id !== payload.conversationId)];
      });
    };
    socket.on('inbox:update', onUpdate);
    return () => {
      socket.off('inbox:update', onUpdate);
    };
  }, [user?.id]);

  return (
    <div className="relative flex min-h-screen flex-col bg-ink-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-ink-radial" />
      <header className="relative z-10 mx-auto flex w-full max-w-md items-end justify-between gap-3 px-6 pb-4 pt-safe">
        <div className="pt-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-gold-300">Connections</p>
          <h1 className="display-heading mt-1 text-4xl font-light leading-none">Messages</h1>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-white/55">
            Real people, no auto-replies. Lead with intention or reply when it counts.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/notifications')}
          className="mb-1 flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-gold-300 transition hover:border-gold-400/40"
          aria-label="Open notifications"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
          </svg>
        </button>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-md flex-1 px-4 pb-28">
        {loading && <InboxSkeleton />}
        {!loading && error && (
          <div className="mx-2 mt-16 rounded-2xl border border-red-400/20 bg-red-500/5 p-6 text-center">
            <p className="text-sm text-white/70">{error}</p>
            <button type="button" onClick={() => void load()} className="btn-gold-outline mt-4 px-5 py-2 text-xs uppercase tracking-[0.18em]">
              Try again
            </button>
          </div>
        )}
        {!loading && !error && conversations.length === 0 && (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <SimpLogo size={58} variant="emblem" />
            <h2 className="display-heading mt-5 text-2xl font-light">A conversation starts with a match</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/55">Match with someone and start a conversation.</p>
            <button type="button" onClick={() => navigate('/discover')} className="btn-gold mt-6 px-7 py-3 text-xs font-semibold uppercase tracking-[0.18em]">
              Discover people
            </button>
            <div className="mt-6">
              <ShareButton text="Join me on SIMP - let's chat!" />
            </div>
          </div>
        )}
        {!loading && !error && conversations.length > 0 && (
          <ul className="divide-y divide-white/[0.07] overflow-hidden rounded-3xl border border-white/[0.08] bg-black/20 backdrop-blur-sm">
            {conversations.map((conversation, index) => (
              <motion.li
                key={conversation.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.035, 0.25) }}
              >
                <button
                  type="button"
                  onClick={() => navigate(`/messages/${conversation.id}`)}
                  className="flex w-full items-center gap-3 px-4 py-4 text-left transition hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-400"
                >
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border border-gold-400/25 bg-ink-800">
                    {conversation.otherUser.thumbnailUrl || conversation.otherUser.photoUrl ? (
                      <img
                        src={conversation.otherUser.thumbnailUrl ?? conversation.otherUser.photoUrl ?? ''}
                        alt={conversation.otherUser.displayName}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xl text-white/25">
                        {conversation.otherUser.displayName.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate text-[15px] font-semibold text-white">{conversation.otherUser.displayName}</h2>
                      {conversation.otherUser.isVerified && (
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-gold-400 text-[9px] font-bold text-black" aria-label="Verified profile">✓</span>
                      )}
                      <span className="ml-auto shrink-0 text-[10px] text-white/35">
                        {formatTime(conversation.latestMessage?.createdAt ?? conversation.updatedAt)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <p className={`min-w-0 flex-1 truncate text-sm ${conversation.unreadCount ? 'font-medium text-white/90' : 'text-white/45'}`}>
                        {conversation.latestMessage
                          ? conversation.latestMessage.deletedAt
                            ? 'Message removed'
                            : conversation.latestMessage.body
                          : 'You matched. Say hello.'}
                      </p>
                      {conversation.unreadCount > 0 && (
                        <span className="flex min-w-5 items-center justify-center rounded-full bg-gold-400 px-1.5 py-0.5 text-[10px] font-bold text-black">
                          {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </motion.li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function InboxSkeleton() {
  return (
    <div className="overflow-hidden rounded-3xl border border-white/[0.08] bg-black/20">
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-4 last:border-0">
          <div className="h-16 w-16 animate-pulse rounded-full bg-white/[0.07]" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-28 animate-pulse rounded bg-white/[0.07]" />
            <div className="h-3 w-4/5 animate-pulse rounded bg-white/[0.05]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function formatTime(value: string) {
  const date = new Date(value);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

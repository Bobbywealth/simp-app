import type { ConversationDetail, ConversationSummary, Message } from '../types';
import { apiFetch } from './client';

export const getConversations = (cursor?: string) =>
  apiFetch<{
    conversations: ConversationSummary[];
    nextCursor: string | null;
    hasMore: boolean;
  }>(`/conversations${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`);

export const getUnreadMessageCount = () =>
  apiFetch<{ count: number }>('/conversations/unread-count');

export const getConversation = (id: string) =>
  apiFetch<ConversationDetail>(`/conversations/${encodeURIComponent(id)}`);

export const getMessages = (id: string, cursor?: string) =>
  apiFetch<{ messages: Message[]; nextCursor: string | null; hasMore: boolean }>(
    `/conversations/${encodeURIComponent(id)}/messages${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`,
  );

export const sendMessage = (conversationId: string, body: string, clientId: string) =>
  apiFetch<Message>(`/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: 'POST',
    body: JSON.stringify({ body, clientId, messageType: 'TEXT' }),
  });

export const markConversationRead = (conversationId: string, throughMessageId?: string) =>
  apiFetch<{ ok: boolean; readAt: string }>(`/conversations/${encodeURIComponent(conversationId)}/read`, {
    method: 'POST',
    body: JSON.stringify({ throughMessageId }),
  });

export const markConversationDelivered = (conversationId: string, throughMessageId?: string) =>
  apiFetch<{ ok: boolean; deliveredAt: string }>(
    `/conversations/${encodeURIComponent(conversationId)}/delivered`,
    { method: 'POST', body: JSON.stringify({ throughMessageId }) },
  );

export const openMatchConversation = (matchId: string) =>
  apiFetch<{ conversationId: string }>(`/matches/${encodeURIComponent(matchId)}/conversation`, {
    method: 'POST',
  });

export const deleteMessage = (messageId: string) =>
  apiFetch<{ ok: boolean }>(`/messages/${encodeURIComponent(messageId)}`, { method: 'DELETE' });

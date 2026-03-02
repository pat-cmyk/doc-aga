/**
 * Shared chat utilities for Doc Aga, DocAgaConsultation, and RICO
 * SSOT for message truncation and send cooldown logic
 */

import { useState, useRef, useCallback } from 'react';

interface ChatMessage {
  role: string;
  content: string;
  [key: string]: any;
}

/**
 * Sliding window truncation: keeps first user message (topic grounding) + last N-1 messages.
 * Prevents token overflow on long conversations.
 */
export function truncateMessages<T extends ChatMessage>(
  messages: T[],
  maxMessages: number = 20
): T[] {
  if (messages.length <= maxMessages) return messages;

  // Find first user message for topic grounding
  const firstUserIndex = messages.findIndex(m => m.role === 'user');
  
  if (firstUserIndex === -1) {
    // No user messages, just take last N
    return messages.slice(-maxMessages);
  }

  const firstUserMessage = messages[firstUserIndex];
  const remaining = messages.slice(-(maxMessages - 1));

  // Avoid duplicate if first user message is already in the window
  if (remaining.includes(firstUserMessage)) {
    return remaining;
  }

  return [firstUserMessage, ...remaining];
}

/**
 * Simple token count heuristic for logging/monitoring
 */
export function estimateTokenCount(messages: ChatMessage[]): number {
  return messages.reduce((sum, m) => sum + Math.ceil((m.content?.length || 0) / 4), 0);
}

/**
 * React hook for client-side send cooldown.
 * Prevents accidental double-sends (UX layer, not a security measure).
 */
export function useSendCooldown(cooldownMs: number = 2000) {
  const [canSend, setCanSend] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markSent = useCallback(() => {
    setCanSend(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCanSend(true), cooldownMs);
  }, [cooldownMs]);

  return { canSend, markSent };
}

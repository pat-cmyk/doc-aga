/**
 * FAQ Cache - Offline-first FAQ matching for Doc Aga
 *
 * Caches FAQs from doc_aga_faqs table in IndexedDB for offline use.
 * Ports the findMatchingFaq algorithm from supabase/functions/doc-aga/index.ts
 * to enable offline FAQ responses.
 *
 * SSOT flow: doc_aga_faqs table → Supabase SELECT → IndexedDB → findOfflineFaqMatch()
 */

import { openDB, type IDBPDatabase, type DBSchema } from 'idb';
import { supabase } from '@/integrations/supabase/client';

// ==================== TYPES ====================

interface CachedFaq {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  tags: string[];
  cachedAt: number;
}

interface FaqCacheDB extends DBSchema {
  faqs: {
    key: string;
    value: CachedFaq;
  };
  meta: {
    key: string;
    value: { key: string; value: number };
  };
}

interface FaqMatchResult {
  question: string;
  answer: string;
  faqId: string;
  score: number;
}

// ==================== CONSTANTS ====================

const DB_NAME = 'docAgaFaqCache';
const DB_VERSION = 1;
const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const MIN_MATCH_SCORE = 4; // Same threshold as server-side (doc-aga/index.ts:116)

// Stop words filtered from matching (same as server-side doc-aga/index.ts:87)
const STOP_WORDS = ['what', 'when', 'where', 'why', 'how', 'ang', 'mga', 'ano', 'paano', 'bakit'];

// ==================== DATABASE ====================

let dbInstance: IDBPDatabase<FaqCacheDB> | null = null;

async function getDB(): Promise<IDBPDatabase<FaqCacheDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<FaqCacheDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      db.createObjectStore('faqs', { keyPath: 'id' });
      db.createObjectStore('meta', { keyPath: 'key' });
    },
  });

  return dbInstance;
}

// ==================== CACHE OPERATIONS ====================

/**
 * Refresh FAQ cache from server.
 * Fetches all active FAQs and stores them in IndexedDB.
 */
export async function refreshFaqCache(): Promise<number> {
  try {
    const { data: faqs, error } = await supabase
      .from('doc_aga_faqs')
      .select('id, question, answer, category, tags')
      .eq('is_active', true);

    if (error) {
      console.error('[FaqCache] Failed to fetch FAQs:', error);
      return 0;
    }

    if (!faqs || faqs.length === 0) {
      console.log('[FaqCache] No active FAQs found');
      return 0;
    }

    const db = await getDB();
    const tx = db.transaction(['faqs', 'meta'], 'readwrite');
    const now = Date.now();

    // Clear existing FAQs
    await tx.objectStore('faqs').clear();

    // Store fresh FAQs
    for (const faq of faqs) {
      await tx.objectStore('faqs').put({
        id: faq.id,
        question: faq.question,
        answer: faq.answer,
        category: faq.category,
        tags: faq.tags || [],
        cachedAt: now,
      });
    }

    // Update cache timestamp
    await tx.objectStore('meta').put({ key: 'lastRefresh', value: now });
    await tx.done;

    console.log(`[FaqCache] Cached ${faqs.length} FAQs`);
    return faqs.length;
  } catch (error) {
    console.error('[FaqCache] Cache refresh failed:', error);
    return 0;
  }
}

/**
 * Get all cached FAQs from IndexedDB.
 */
export async function getCachedFaqs(): Promise<CachedFaq[]> {
  try {
    const db = await getDB();
    return await db.getAll('faqs');
  } catch (error) {
    console.error('[FaqCache] Failed to read cache:', error);
    return [];
  }
}

/**
 * Check if FAQ cache is stale (older than maxAgeMs).
 */
export async function isFaqCacheStale(maxAgeMs: number = MAX_CACHE_AGE_MS): Promise<boolean> {
  try {
    const db = await getDB();
    const meta = await db.get('meta', 'lastRefresh');
    if (!meta) return true;
    return Date.now() - meta.value > maxAgeMs;
  } catch {
    return true;
  }
}

// ==================== MATCHING ALGORITHM ====================

/**
 * Find a matching FAQ for a user question using cached data.
 *
 * Port of findMatchingFaq from supabase/functions/doc-aga/index.ts:64-117.
 * Uses the same scoring algorithm: exact match → keyword+tag scoring (threshold: 4).
 */
export async function findOfflineFaqMatch(question: string): Promise<FaqMatchResult | null> {
  const faqs = await getCachedFaqs();
  if (!question || faqs.length === 0) return null;

  const normalizedQuestion = question.toLowerCase().trim();

  // Strategy 1: Exact match (case-insensitive)
  const exactMatch = faqs.find(
    (faq) => faq.question.toLowerCase().trim() === normalizedQuestion
  );
  if (exactMatch) {
    return {
      question: exactMatch.question,
      answer: exactMatch.answer,
      faqId: exactMatch.id,
      score: 100,
    };
  }

  // Strategy 2: Keyword matching with scoring
  let bestMatch: { faq: CachedFaq; score: number } | null = null;

  // Split question into meaningful words (>3 chars, no stop words)
  const questionWords = normalizedQuestion
    .split(/\s+/)
    .filter((word) => word.length > 3)
    .filter((word) => !STOP_WORDS.includes(word));

  for (const faq of faqs) {
    let score = 0;
    const faqQuestion = faq.question.toLowerCase();
    const faqTags = faq.tags || [];

    // Score based on word matches in FAQ question (+2 per match)
    questionWords.forEach((word) => {
      if (faqQuestion.includes(word)) {
        score += 2;
      }
    });

    // Score based on tag matches (+3 per match)
    questionWords.forEach((word) => {
      if (faqTags.some((tag: string) => tag.toLowerCase().includes(word))) {
        score += 3;
      }
    });

    // Bonus for category match (+1)
    if (faq.category) {
      const category = faq.category.toLowerCase();
      if (normalizedQuestion.includes(category)) {
        score += 1;
      }
    }

    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { faq, score };
    }
  }

  if (bestMatch && bestMatch.score >= MIN_MATCH_SCORE) {
    return {
      question: bestMatch.faq.question,
      answer: bestMatch.faq.answer,
      faqId: bestMatch.faq.id,
      score: bestMatch.score,
    };
  }

  return null;
}

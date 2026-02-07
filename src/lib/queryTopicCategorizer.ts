/**
 * Shared topic categorization utility for Doc Aga queries.
 * Used by both admin dashboard and government dashboards.
 */

export const TOPIC_CATEGORIES = [
  { key: 'mastitis', label: 'Mastitis & Udder Health', keywords: ['mastitis', 'udder', 'milk infection', 'teat', 'suso', 'namamaga'] },
  { key: 'breeding', label: 'Pregnancy & Breeding', keywords: ['pregnan', 'calving', 'breeding', 'heat', 'insemination', 'buntis', 'init', 'estrus', 'nanganganak'] },
  { key: 'feeding', label: 'Feeding & Nutrition', keywords: ['feed', 'nutrition', 'diet', 'forage', 'supplement', 'kain', 'pagkain', 'damo', 'feeds'] },
  { key: 'digestive', label: 'Digestive Issues', keywords: ['diarrhea', 'scours', 'digestive', 'loose stool', 'pagtatae', 'dumi'] },
  { key: 'bloat', label: 'Bloat & Stomach Issues', keywords: ['bloat', 'gas', 'stomach', 'rumen', 'kabag', 'namamaga ang tiyan'] },
  { key: 'lameness', label: 'Lameness & Hoof Care', keywords: ['lame', 'hoof', 'leg', 'limping', 'foot rot', 'pilay', 'paa', 'kuko'] },
  { key: 'vaccination', label: 'Vaccination & Treatment', keywords: ['vaccine', 'injection', 'medicine', 'deworming', 'bakuna', 'gamot', 'purgante'] },
  { key: 'milk', label: 'Milk Production', keywords: ['milk yield', 'low milk', 'milking', 'gatas', 'paggatasan'] },
  { key: 'general', label: 'General Health & Management', keywords: [] }
] as const;

export type TopicCategory = typeof TOPIC_CATEGORIES[number];
export type TopicKey = TopicCategory['key'];
export type TopicLabel = TopicCategory['label'];

/**
 * Categorizes a single query question into a topic category.
 */
export function categorizeQuery(question: string): TopicLabel {
  const lower = question.toLowerCase();
  
  for (const category of TOPIC_CATEGORIES) {
    if (category.keywords.length > 0 && category.keywords.some(kw => lower.includes(kw))) {
      return category.label;
    }
  }
  return 'General Health & Management';
}

/**
 * Get topic key from label
 */
export function getTopicKey(label: TopicLabel): TopicKey {
  const category = TOPIC_CATEGORIES.find(c => c.label === label);
  return category?.key || 'general';
}

/**
 * Get topic label from key
 */
export function getTopicLabel(key: TopicKey): TopicLabel {
  const category = TOPIC_CATEGORIES.find(c => c.key === key);
  return category?.label || 'General Health & Management';
}

export interface QueryWithTopic {
  id: string;
  question: string;
  answer?: string | null;
  matched_faq_id?: string | null;
  created_at: string;
  [key: string]: any;
}

export interface TopicStats {
  topic: TopicLabel;
  key: TopicKey;
  count: number;
  matched: number;
  unmatched: number;
  gapPercentage: number;
  queries: QueryWithTopic[];
}

/**
 * Categorizes an array of queries and returns grouped statistics.
 */
export function categorizeQueries(queries: QueryWithTopic[]): TopicStats[] {
  const grouped: Record<TopicLabel, QueryWithTopic[]> = {} as Record<TopicLabel, QueryWithTopic[]>;
  
  // Initialize all categories
  TOPIC_CATEGORIES.forEach(cat => {
    grouped[cat.label] = [];
  });
  
  // Group queries by topic
  queries.forEach(q => {
    const topic = categorizeQuery(q.question);
    grouped[topic].push(q);
  });
  
  // Calculate stats for each topic
  return TOPIC_CATEGORIES.map(cat => {
    const topicQueries = grouped[cat.label] || [];
    const matched = topicQueries.filter(q => q.matched_faq_id).length;
    const unmatched = topicQueries.filter(q => !q.matched_faq_id).length;
    const total = topicQueries.length;
    
    return {
      topic: cat.label,
      key: cat.key,
      count: total,
      matched,
      unmatched,
      gapPercentage: total > 0 ? Math.round((unmatched / total) * 100) : 0,
      queries: topicQueries,
    };
  }).filter(stat => stat.count > 0)
    .sort((a, b) => b.count - a.count);
}

/**
 * Get only topics with unmatched queries, sorted by unmatched count.
 */
export function getUnmatchedTopics(queries: QueryWithTopic[]): TopicStats[] {
  return categorizeQueries(queries)
    .filter(stat => stat.unmatched > 0)
    .sort((a, b) => b.unmatched - a.unmatched);
}

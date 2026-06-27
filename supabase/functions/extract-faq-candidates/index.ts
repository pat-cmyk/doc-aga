import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";

// Tagalog/English stopwords to filter out
const STOPWORDS = new Set([
  // English
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
  'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used',
  'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into',
  'through', 'during', 'before', 'after', 'above', 'below', 'between',
  'and', 'but', 'or', 'nor', 'so', 'yet', 'both', 'either', 'neither',
  'not', 'only', 'own', 'same', 'than', 'too', 'very', 'just',
  'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those',
  'am', 'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves',
  'you', 'your', 'yours', 'yourself', 'yourselves',
  'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself',
  'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves',
  'how', 'when', 'where', 'why',
  // Tagalog
  'ang', 'ng', 'sa', 'mga', 'na', 'ay', 'at', 'ako', 'ko', 'akin',
  'ikaw', 'mo', 'iyo', 'siya', 'niya', 'kaniya', 'kami', 'tayo', 'namin', 'atin',
  'sila', 'nila', 'kanila', 'ito', 'iyan', 'iyon', 'dito', 'diyan', 'doon',
  'ano', 'sino', 'saan', 'kailan', 'bakit', 'paano', 'papaano',
  'ba', 'po', 'ho', 'lang', 'lamang', 'din', 'rin', 'man', 'pa', 'raw', 'daw',
  'naman', 'kasi', 'kaya', 'pala', 'nga', 'eh', 'yung', 'yun', 'ung',
  'ko', 'mo', 'nyo', 'nila', 'namin', 'natin',
  'may', 'mayroon', 'wala', 'meron',
  'kung', 'kapag', 'pag', 'para', 'dahil', 'hanggang', 'habang',
  'pero', 'ngunit', 'subalit', 'o', 'at',
  'hindi', 'wag', 'huwag', 'oo', 'yes', 'no',
  // Common question starters
  'pwede', 'pwedeng', 'puwede', 'puwedeng', 'maaari', 'maaring',
  'gusto', 'gustong', 'kailangan', 'kelangan',
  // Livestock-specific common words to normalize
  'baka', 'bakang', 'kambing', 'kalabaw', 'hayop'
]);

// Normalize text for comparison
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')  // Remove punctuation
    .replace(/\s+/g, ' ')       // Normalize whitespace
    .trim();
}

// Tokenize and filter stopwords
function tokenize(text: string): string[] {
  const normalized = normalizeText(text);
  return normalized
    .split(' ')
    .filter(word => word.length > 2 && !STOPWORDS.has(word));
}

// Calculate Jaccard similarity between two token sets
function jaccardSimilarity(tokens1: string[], tokens2: string[]): number {
  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

// Union-Find data structure for clustering
class UnionFind {
  parent: Map<number, number>;
  rank: Map<number, number>;
  
  constructor() {
    this.parent = new Map();
    this.rank = new Map();
  }
  
  find(x: number): number {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      this.rank.set(x, 0);
    }
    if (this.parent.get(x) !== x) {
      this.parent.set(x, this.find(this.parent.get(x)!));
    }
    return this.parent.get(x)!;
  }
  
  union(x: number, y: number): void {
    const rootX = this.find(x);
    const rootY = this.find(y);
    
    if (rootX === rootY) return;
    
    const rankX = this.rank.get(rootX) || 0;
    const rankY = this.rank.get(rootY) || 0;
    
    if (rankX < rankY) {
      this.parent.set(rootX, rootY);
    } else if (rankX > rankY) {
      this.parent.set(rootY, rootX);
    } else {
      this.parent.set(rootY, rootX);
      this.rank.set(rootX, rankX + 1);
    }
  }
}

interface QueryRecord {
  id: string;
  question: string;
  tokens: string[];
  normalized: string;
}

interface Cluster {
  representative: string;
  normalized: string;
  count: number;
  queryIds: string[];
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req, "authorization, x-client-info, apikey, content-type");
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse optional parameters
    const url = new URL(req.url);
    const daysBack = parseInt(url.searchParams.get('days') || '30');
    const minOccurrences = parseInt(url.searchParams.get('min_occurrences') || '3');
    const similarityThreshold = parseFloat(url.searchParams.get('threshold') || '0.6');

    console.log(`[extract-faq-candidates] Starting extraction: ${daysBack} days, min ${minOccurrences} occurrences, threshold ${similarityThreshold}`);

    // Calculate date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    // Fetch unmatched queries
    const { data: queries, error: queryError } = await supabase
      .from('doc_aga_queries')
      .select('id, question')
      .is('matched_faq_id', null)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(1000);

    if (queryError) {
      console.error('[extract-faq-candidates] Query fetch error:', queryError);
      throw queryError;
    }

    if (!queries || queries.length === 0) {
      console.log('[extract-faq-candidates] No unmatched queries found');
      return new Response(JSON.stringify({ 
        message: 'No unmatched queries found',
        candidates: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[extract-faq-candidates] Processing ${queries.length} unmatched queries`);

    // Tokenize all queries
    const queryRecords: QueryRecord[] = queries.map(q => ({
      id: q.id,
      question: q.question,
      tokens: tokenize(q.question),
      normalized: normalizeText(q.question)
    }));

    // Filter out queries with too few meaningful tokens
    const validQueries = queryRecords.filter(q => q.tokens.length >= 2);
    console.log(`[extract-faq-candidates] ${validQueries.length} queries have sufficient tokens`);

    if (validQueries.length === 0) {
      return new Response(JSON.stringify({ 
        message: 'No queries with sufficient content',
        candidates: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Build similarity graph and cluster using Union-Find
    const uf = new UnionFind();
    
    for (let i = 0; i < validQueries.length; i++) {
      for (let j = i + 1; j < validQueries.length; j++) {
        const similarity = jaccardSimilarity(validQueries[i].tokens, validQueries[j].tokens);
        if (similarity >= similarityThreshold) {
          uf.union(i, j);
        }
      }
    }

    // Group queries by cluster
    const clusterMap = new Map<number, number[]>();
    for (let i = 0; i < validQueries.length; i++) {
      const root = uf.find(i);
      if (!clusterMap.has(root)) {
        clusterMap.set(root, []);
      }
      clusterMap.get(root)!.push(i);
    }

    // Build cluster results
    const clusters: Cluster[] = [];
    for (const [root, indices] of clusterMap.entries()) {
      if (indices.length >= minOccurrences) {
        // Use the shortest question as representative (often clearest)
        const sortedByLength = indices.sort((a, b) => 
          validQueries[a].question.length - validQueries[b].question.length
        );
        const representativeIdx = sortedByLength[0];
        
        clusters.push({
          representative: validQueries[representativeIdx].question,
          normalized: validQueries[representativeIdx].normalized,
          count: indices.length,
          queryIds: indices.map(i => validQueries[i].id)
        });
      }
    }

    console.log(`[extract-faq-candidates] Found ${clusters.length} clusters with ${minOccurrences}+ occurrences`);

    // Upsert candidates
    let upsertedCount = 0;
    for (const cluster of clusters) {
      // Check if similar candidate already exists
      const { data: existing } = await supabase
        .from('faq_candidates')
        .select('id, occurrence_count, sample_query_ids')
        .eq('normalized_text', cluster.normalized)
        .single();

      if (existing) {
        // Update existing candidate
        const existingQueryIds = existing.sample_query_ids || [];
        const mergedQueryIds = [...new Set([...existingQueryIds, ...cluster.queryIds.slice(0, 5)])].slice(0, 10);
        
        const { error: updateError } = await supabase
          .from('faq_candidates')
          .update({
            occurrence_count: cluster.count,
            sample_query_ids: mergedQueryIds,
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id);

        if (!updateError) upsertedCount++;
      } else {
        // Insert new candidate
        const { error: insertError } = await supabase
          .from('faq_candidates')
          .insert({
            question_pattern: cluster.representative,
            normalized_text: cluster.normalized,
            occurrence_count: cluster.count,
            sample_query_ids: cluster.queryIds.slice(0, 5),
            status: 'pending'
          });

        if (!insertError) upsertedCount++;
      }
    }

    console.log(`[extract-faq-candidates] Upserted ${upsertedCount} candidates`);

    return new Response(JSON.stringify({
      message: 'FAQ candidate extraction complete',
      queriesProcessed: queries.length,
      clustersFound: clusters.length,
      candidatesUpserted: upsertedCount,
      clusters: clusters.map(c => ({
        question: c.representative,
        count: c.count
      }))
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[extract-faq-candidates] Error:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

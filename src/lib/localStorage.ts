/**
 * Type-safe localStorage utilities for Doc Aga preferences and onboarding
 */

export type InputMethod = 'chat' | 'voice' | 'image';

interface DocAgaPreferences {
  hasSeenTooltip: boolean;
  hasCompletedOnboarding: boolean;
  preferredInputMethod: InputMethod;
  tooltipViewCount: number;
}

const STORAGE_KEYS = {
  DOC_AGA_PREFS: 'doc_aga_preferences',
} as const;

const DEFAULT_PREFERENCES: DocAgaPreferences = {
  hasSeenTooltip: false,
  hasCompletedOnboarding: false,
  preferredInputMethod: 'voice',
  tooltipViewCount: 0,
};

/**
 * Get Doc Aga preferences from localStorage
 */
export function getDocAgaPreferences(): DocAgaPreferences {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.DOC_AGA_PREFS);
    if (!stored) return DEFAULT_PREFERENCES;
    
    const parsed = JSON.parse(stored);
    return { ...DEFAULT_PREFERENCES, ...parsed };
  } catch (error) {
    console.error('Error reading Doc Aga preferences:', error);
    return DEFAULT_PREFERENCES;
  }
}

/**
 * Save Doc Aga preferences to localStorage
 */
export function setDocAgaPreferences(preferences: Partial<DocAgaPreferences>): void {
  try {
    const current = getDocAgaPreferences();
    const updated = { ...current, ...preferences };
    localStorage.setItem(STORAGE_KEYS.DOC_AGA_PREFS, JSON.stringify(updated));
  } catch (error) {
    console.error('Error saving Doc Aga preferences:', error);
  }
}

/**
 * Check if user should see the tooltip
 */
export function shouldShowTooltip(): boolean {
  const prefs = getDocAgaPreferences();
  return prefs.tooltipViewCount < 3 && !prefs.hasSeenTooltip;
}

/**
 * Increment tooltip view count
 */
export function incrementTooltipView(): void {
  const prefs = getDocAgaPreferences();
  setDocAgaPreferences({
    tooltipViewCount: prefs.tooltipViewCount + 1,
    hasSeenTooltip: prefs.tooltipViewCount + 1 >= 3,
  });
}

/**
 * Mark onboarding as completed
 */
export function completeOnboarding(): void {
  setDocAgaPreferences({ hasCompletedOnboarding: true });
}

/**
 * Check if user should see onboarding
 */
export function shouldShowOnboarding(): boolean {
  const prefs = getDocAgaPreferences();
  return !prefs.hasCompletedOnboarding;
}

/**
 * Save preferred input method
 */
export function setPreferredInputMethod(method: InputMethod): void {
  setDocAgaPreferences({ preferredInputMethod: method });
}

/**
 * Conversation ID persistence with TTL
 */
interface StoredConversationId {
  id: string;
  createdAt: number;
}

export const CONVERSATION_KEYS = {
  DOC_AGA: 'doc_aga_conversation_id',
  DOC_AGA_CONSULTATION: 'doc_aga_consultation_id',
  RICO: 'rico_conversation_id',
} as const;

export const CONVERSATION_TTLS = {
  DEFAULT: 24 * 60 * 60 * 1000, // 24 hours
  CONSULTATION: 1 * 60 * 60 * 1000, // 1 hour
} as const;

/**
 * Get or create a conversation ID with TTL expiry
 */
export function getConversationId(key: string, ttlMs: number): string {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed: StoredConversationId = JSON.parse(stored);
      if (Date.now() - parsed.createdAt < ttlMs) {
        return parsed.id;
      }
    }
  } catch {
    // Fall through to create new
  }
  return resetConversationId(key);
}

/**
 * Force a new conversation ID
 */
export function resetConversationId(key: string): string {
  const id = crypto.randomUUID();
  const entry: StoredConversationId = { id, createdAt: Date.now() };
  try {
    localStorage.setItem(key, JSON.stringify(entry));
  } catch (error) {
    console.error('Error saving conversation ID:', error);
  }
  return id;
}

/**
 * Animal display primary field preference
 */
export type AnimalDisplayPrimary = 'name' | 'ear_tag';

const ANIMAL_DISPLAY_KEY = 'animal_display_primary';

export function getAnimalDisplayPrimary(): AnimalDisplayPrimary {
  try {
    const val = localStorage.getItem(ANIMAL_DISPLAY_KEY);
    if (val === 'ear_tag') return 'ear_tag';
    return 'name';
  } catch {
    return 'name';
  }
}

export function setAnimalDisplayPrimary(value: AnimalDisplayPrimary): void {
  try {
    localStorage.setItem(ANIMAL_DISPLAY_KEY, value);
  } catch (error) {
    console.error('Error saving animal display preference:', error);
  }
}

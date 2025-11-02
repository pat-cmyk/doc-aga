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

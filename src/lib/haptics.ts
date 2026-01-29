import { Capacitor } from '@capacitor/core';

// Module name constant for variable indirection (prevents Rollup static analysis)
const CAP_HAPTICS = '@capacitor/haptics';

// Dynamic import helper for Haptics
async function getHaptics() {
  const module = await import(/* @vite-ignore */ CAP_HAPTICS);
  return {
    Haptics: module.Haptics,
    ImpactStyle: module.ImpactStyle,
    NotificationType: module.NotificationType,
  };
}

/**
 * Haptic feedback utilities for native mobile interactions
 */

export const hapticImpact = async (style: 'light' | 'medium' | 'heavy' = 'medium') => {
  if (!Capacitor.isNativePlatform()) return;
  
  try {
    const { Haptics, ImpactStyle } = await getHaptics();
    const styleMap = {
      light: ImpactStyle.Light,
      medium: ImpactStyle.Medium,
      heavy: ImpactStyle.Heavy,
    };
    
    await Haptics.impact({ style: styleMap[style] });
  } catch (error) {
    console.warn('Haptic feedback failed:', error);
  }
};

export const hapticNotification = async (type: 'success' | 'warning' | 'error' = 'success') => {
  if (!Capacitor.isNativePlatform()) return;
  
  try {
    const { Haptics, NotificationType } = await getHaptics();
    const typeMap = {
      success: NotificationType.Success,
      warning: NotificationType.Warning,
      error: NotificationType.Error,
    };
    
    await Haptics.notification({ type: typeMap[type] });
  } catch (error) {
    console.warn('Haptic notification failed:', error);
  }
};

export const hapticSelection = async () => {
  if (!Capacitor.isNativePlatform()) return;
  
  try {
    const { Haptics } = await getHaptics();
    await Haptics.selectionStart();
    await Haptics.selectionChanged();
    await Haptics.selectionEnd();
  } catch (error) {
    console.warn('Haptic selection failed:', error);
  }
};

export const hapticVibrate = async (duration: number = 300) => {
  if (!Capacitor.isNativePlatform()) return;
  
  try {
    const { Haptics } = await getHaptics();
    await Haptics.vibrate({ duration });
  } catch (error) {
    console.warn('Haptic vibrate failed:', error);
  }
};

import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('utils', () => {
  describe('cn (className merger)', () => {
    it('should merge class names', () => {
      const result = cn('text-red-500', 'bg-blue-500');
      expect(result).toContain('text-red-500');
      expect(result).toContain('bg-blue-500');
    });

    it('should handle conditional classes', () => {
      const result = cn('base-class', false && 'hidden-class', 'visible-class');
      expect(result).toContain('base-class');
      expect(result).toContain('visible-class');
      expect(result).not.toContain('hidden-class');
    });

    it('should merge tailwind classes correctly', () => {
      const result = cn('p-4', 'p-8');
      // Should keep the last padding value
      expect(result).toBe('p-8');
    });

    it('should handle undefined and null', () => {
      const result = cn('base-class', undefined, null, 'other-class');
      expect(result).toContain('base-class');
      expect(result).toContain('other-class');
    });
  });
});


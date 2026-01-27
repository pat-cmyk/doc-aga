import { describe, it, expect } from 'vitest';
import { preprocessTagalogParticles } from '@/lib/voiceFormExtractors';

describe('preprocessTagalogParticles', () => {
  
  describe('Noise Particle Stripping', () => {
    it('strips "po" polite markers', () => {
      const result = preprocessTagalogParticles('30 liters po');
      expect(result.cleanedText).toBe('30 liters');
    });
    
    it('strips "opo" polite markers', () => {
      const result = preprocessTagalogParticles('Oo opo nagfeed na');
      expect(result.cleanedText).not.toContain('opo');
    });
    
    it('strips "eh" filler', () => {
      const result = preprocessTagalogParticles('Eh mga 20 kilos');
      expect(result.cleanedText).not.toContain('Eh');
    });
    
    it('strips multiple noise particles', () => {
      const result = preprocessTagalogParticles('50 liters po eh');
      expect(result.cleanedText).toBe('50 liters');
    });
    
    it('strips "ho" informal polite marker', () => {
      const result = preprocessTagalogParticles('100 kilos ho');
      expect(result.cleanedText).toBe('100 kilos');
    });
    
    it('strips "ah" filler', () => {
      const result = preprocessTagalogParticles('ah 15 liters');
      expect(result.cleanedText).toBe('15 liters');
    });
    
    it('strips "ay" filler', () => {
      const result = preprocessTagalogParticles('ay 25 bags');
      expect(result.cleanedText).toBe('25 bags');
    });
  });
  
  describe('Approximation Detection', () => {
    it('detects "mga" as approximate', () => {
      const result = preprocessTagalogParticles('Mga 40 liters');
      expect(result.isApproximate).toBe(true);
      expect(result.particleConfidence).toBe('low');
    });
    
    it('detects "halos" as approximate', () => {
      const result = preprocessTagalogParticles('Halos 50 kilos');
      expect(result.isApproximate).toBe(true);
    });
    
    it('detects "yata" as uncertain', () => {
      const result = preprocessTagalogParticles('20 liters yata');
      expect(result.isApproximate).toBe(true);
      expect(result.particleConfidence).toBe('low');
    });
    
    it('detects "siguro" as approximate', () => {
      const result = preprocessTagalogParticles('siguro 30 liters');
      expect(result.isApproximate).toBe(true);
    });
    
    it('detects "parang" as approximate', () => {
      const result = preprocessTagalogParticles('parang 10 bales');
      expect(result.isApproximate).toBe(true);
    });
  });
  
  describe('Emphasis Detection', () => {
    it('detects "talaga" as emphatic', () => {
      const result = preprocessTagalogParticles('50 kilos talaga');
      expect(result.isEmphatic).toBe(true);
      expect(result.particleConfidence).toBe('high');
    });
    
    it('detects "mismo" as emphatic', () => {
      const result = preprocessTagalogParticles('100 liters mismo');
      expect(result.isEmphatic).toBe(true);
    });
    
    it('detects "exactly" as emphatic', () => {
      const result = preprocessTagalogParticles('exactly 45 liters');
      expect(result.isEmphatic).toBe(true);
    });
    
    it('detects "talagang" as emphatic', () => {
      const result = preprocessTagalogParticles('talagang 80 kilos');
      expect(result.isEmphatic).toBe(true);
    });
  });
  
  describe('Correction Detection', () => {
    it('detects "pala" as correction', () => {
      const result = preprocessTagalogParticles('Ay pala kahapon yung feeding');
      expect(result.hasCorrection).toBe(true);
      expect(result.particleConfidence).toBe('low');
    });
    
    it('detects "ay pala" compound', () => {
      const result = preprocessTagalogParticles('Ay pala 30 liters');
      expect(result.hasCorrection).toBe(true);
    });
    
    it('detects "este" as correction', () => {
      const result = preprocessTagalogParticles('10 liters este 15 liters');
      expect(result.hasCorrection).toBe(true);
    });
  });
  
  describe('Addition Detection', () => {
    it('detects "din" as addition', () => {
      const result = preprocessTagalogParticles('Yung kambing din');
      expect(result.hasAddition).toBe(true);
    });
    
    it('detects "rin" as addition', () => {
      const result = preprocessTagalogParticles('Yung baka rin');
      expect(result.hasAddition).toBe(true);
    });
    
    it('detects "pa" as addition', () => {
      const result = preprocessTagalogParticles('Nagmilk pa ako');
      expect(result.hasAddition).toBe(true);
    });
    
    it('detects "pati" as addition', () => {
      const result = preprocessTagalogParticles('pati yung guya');
      expect(result.hasAddition).toBe(true);
    });
    
    it('detects "kasama" as addition', () => {
      const result = preprocessTagalogParticles('kasama ang mga baka');
      expect(result.hasAddition).toBe(true);
    });
  });
  
  describe('Completion Detection', () => {
    it('detects "tapos na" as completed', () => {
      const result = preprocessTagalogParticles('Feeding tapos na');
      expect(result.isCompleted).toBe(true);
    });
    
    it('detects "done na" as completed', () => {
      const result = preprocessTagalogParticles('Milking done na');
      expect(result.isCompleted).toBe(true);
    });
    
    it('detects "finish na" as completed', () => {
      const result = preprocessTagalogParticles('Weighing finish na');
      expect(result.isCompleted).toBe(true);
    });
  });
  
  describe('Confidence Scoring', () => {
    it('returns medium confidence by default', () => {
      const result = preprocessTagalogParticles('40 liters');
      expect(result.particleConfidence).toBe('medium');
    });
    
    it('returns high confidence with emphasis', () => {
      const result = preprocessTagalogParticles('40 liters talaga');
      expect(result.particleConfidence).toBe('high');
    });
    
    it('returns low confidence with approximation', () => {
      const result = preprocessTagalogParticles('mga 40 liters');
      expect(result.particleConfidence).toBe('low');
    });
    
    it('approximation overrides emphasis for confidence', () => {
      const result = preprocessTagalogParticles('mga 40 liters talaga');
      expect(result.particleConfidence).toBe('low');
    });
    
    it('correction overrides emphasis for confidence', () => {
      const result = preprocessTagalogParticles('pala 40 liters talaga');
      expect(result.particleConfidence).toBe('low');
    });
  });
  
  describe('Edge Cases', () => {
    it('handles empty string', () => {
      const result = preprocessTagalogParticles('');
      expect(result.cleanedText).toBe('');
    });
    
    it('handles string with only noise particles', () => {
      const result = preprocessTagalogParticles('po opo eh');
      expect(result.cleanedText.trim()).toBe('');
    });
    
    it('normalizes multiple spaces', () => {
      const result = preprocessTagalogParticles('40  liters   po');
      expect(result.cleanedText).toBe('40 liters');
    });
    
    it('preserves case for non-particles', () => {
      const result = preprocessTagalogParticles('Rumsol Feeds po');
      expect(result.cleanedText).toBe('Rumsol Feeds');
    });
    
    it('handles mixed case particles', () => {
      const result = preprocessTagalogParticles('30 liters PO');
      expect(result.cleanedText).toBe('30 liters');
    });
    
    it('handles particles at word boundaries only', () => {
      // "po" inside "export" should NOT be stripped
      const result = preprocessTagalogParticles('export 10 bags');
      expect(result.cleanedText).toBe('export 10 bags');
    });
  });
  
  describe('Real-World Scenarios', () => {
    it('processes "Mga 40 liters po ng gatas"', () => {
      const result = preprocessTagalogParticles('Mga 40 liters po ng gatas');
      expect(result.cleanedText).toBe('Mga 40 liters ng gatas');
      expect(result.isApproximate).toBe(true);
    });
    
    it('processes "Ay pala, kahapon yung feeding"', () => {
      const result = preprocessTagalogParticles('Ay pala, kahapon yung feeding');
      expect(result.hasCorrection).toBe(true);
    });
    
    it('processes "10 liters lang po"', () => {
      const result = preprocessTagalogParticles('10 liters lang po');
      expect(result.cleanedText).toBe('10 liters lang');
    });
    
    it('processes "50 kilos talaga po"', () => {
      const result = preprocessTagalogParticles('50 kilos talaga po');
      expect(result.cleanedText).toBe('50 kilos talaga');
      expect(result.isEmphatic).toBe(true);
      expect(result.particleConfidence).toBe('high');
    });
    
    it('processes "Nag-feed na po, tapos na"', () => {
      const result = preprocessTagalogParticles('Nag-feed na po, tapos na');
      expect(result.cleanedText).toBe('Nag-feed na, tapos na');
      expect(result.isCompleted).toBe(true);
    });
    
    it('processes "Yung baka din po, mga 25 liters"', () => {
      const result = preprocessTagalogParticles('Yung baka din po, mga 25 liters');
      expect(result.hasAddition).toBe(true);
      expect(result.isApproximate).toBe(true);
      expect(result.particleConfidence).toBe('low');
    });
    
    it('processes complex Taglish: "Nag-milk ako ng 30 liters po this morning"', () => {
      const result = preprocessTagalogParticles('Nag-milk ako ng 30 liters po this morning');
      expect(result.cleanedText).toBe('Nag-milk ako ng 30 liters this morning');
    });
    
    it('processes "Halos 100 liters po eh, siguro"', () => {
      const result = preprocessTagalogParticles('Halos 100 liters po eh, siguro');
      expect(result.cleanedText).toBe('Halos 100 liters, siguro');
      expect(result.isApproximate).toBe(true);
      expect(result.particleConfidence).toBe('low');
    });
  });
  
  describe('Particle Flag Combinations', () => {
    it('can detect multiple flags simultaneously', () => {
      // "mga" (approximate) + "din" (addition)
      const result = preprocessTagalogParticles('mga 20 liters din');
      expect(result.isApproximate).toBe(true);
      expect(result.hasAddition).toBe(true);
    });
    
    it('detects emphasis with completion', () => {
      const result = preprocessTagalogParticles('50 kilos talaga, tapos na');
      expect(result.isEmphatic).toBe(true);
      expect(result.isCompleted).toBe(true);
    });
    
    it('approximation flag takes precedence for confidence', () => {
      const result = preprocessTagalogParticles('mga 30 liters talaga, tapos na');
      expect(result.isApproximate).toBe(true);
      expect(result.isEmphatic).toBe(true);
      expect(result.isCompleted).toBe(true);
      expect(result.particleConfidence).toBe('low'); // Approximation wins
    });
  });
});

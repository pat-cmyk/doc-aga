import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, userEvent } from '@/test-utils';
import { mockGetUserMedia, cleanupMediaMocks } from '@/test-utils/media-mocks';
import { mockFeedInventory, mockAnimal, mockActivityData, mockMultiFeedActivityData } from '@/test-utils/fixtures';
import VoiceRecordButton from '../VoiceRecordButton';
import * as supabaseClient from '@/integrations/supabase/client';

// Mock the supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    functions: {
      invoke: vi.fn(),
    },
    auth: {
      getUser: vi.fn(),
    },
  },
}));

// Mock toast
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Helper to wait for condition
const waitForCondition = async (condition: () => boolean, timeout = 5000) => {
  const startTime = Date.now();
  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error('Timeout waiting for condition');
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
};

describe('VoiceRecordButton Integration Tests', () => {
  const user = userEvent.setup();
  let mockStream: MediaStream;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStream = mockGetUserMedia();
    
    // Mock auth user
    vi.mocked(supabaseClient.supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: 'user-123' } as any },
      error: null,
    });
  });

  afterEach(() => {
    cleanupMediaMocks();
  });

  describe('Test Case 1: Should check inventory before confirming activity', () => {
    it('should use "corn silage" from inventory when voice says "bales", NOT default to "hay"', async () => {
      // Mock inventory with ONLY corn silage in bales
      const inventoryWithOnlyCornSilage = [
        {
          ...mockFeedInventory[0],
          feed_type: 'corn silage',
          unit: 'bales',
        },
      ];

      vi.mocked(supabaseClient.supabase.from).mockImplementation((table: string) => {
        if (table === 'farm_memberships') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { farm_id: 'farm-123' },
              error: null,
            }),
          } as any;
        }
        if (table === 'feed_inventory') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              data: inventoryWithOnlyCornSilage,
              error: null,
            }),
          } as any;
        }
        return {} as any;
      });

      // Mock voice-to-text response
      vi.mocked(supabaseClient.supabase.functions.invoke).mockImplementation((fn: string) => {
        if (fn === 'voice-to-text') {
          return Promise.resolve({
            data: { text: 'I fed 10 bales' },
            error: null,
          });
        }
        if (fn === 'process-farmhand-activity') {
          return Promise.resolve({
            data: {
              ...mockActivityData,
              feed_type: 'corn silage', // AI should resolve to corn silage from inventory
              quantity: 10,
              unit: 'bales',
            },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      });

      const { getByRole, getByText, queryByText } = render(<VoiceRecordButton farmId="farm-123" />);

      // Start recording
      const recordButton = getByRole('button', { name: /record/i });
      await user.click(recordButton);

      await waitForCondition(() => !!queryByText(/recording/i));

      // Stop recording
      const stopButton = getByRole('button', { name: /stop/i });
      await user.click(stopButton);

      // Wait for processing to complete
      await waitForCondition(() => !!queryByText(/corn silage/i));

      // Verify "hay" does NOT appear anywhere
      expect(queryByText(/\bhay\b/i)).toBeNull();
      
      // Verify correct feed type is shown in confirmation
      expect(getByText(/corn silage/i)).toBeTruthy();
      expect(getByText(/10/)).toBeTruthy();
      expect(getByText(/bales/i)).toBeTruthy();
    });
  });

  describe('Test Case 2: Should show clarification when feed type is ambiguous', () => {
    it('should request clarification when multiple feeds match the unit', async () => {
      // Mock inventory with BOTH hay and corn silage in bales
      const ambiguousInventory = [
        {
          ...mockFeedInventory[0],
          feed_type: 'hay',
          unit: 'bales',
        },
        {
          ...mockFeedInventory[0],
          id: 'inv-2',
          feed_type: 'corn silage',
          unit: 'bales',
        },
      ];

      vi.mocked(supabaseClient.supabase.from).mockImplementation((table: string) => {
        if (table === 'farm_memberships') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { farm_id: 'farm-123' },
              error: null,
            }),
          } as any;
        }
        if (table === 'feed_inventory') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              data: ambiguousInventory,
              error: null,
            }),
          } as any;
        }
        return {} as any;
      });

      vi.mocked(supabaseClient.supabase.functions.invoke).mockImplementation((fn: string) => {
        if (fn === 'voice-to-text') {
          return Promise.resolve({
            data: { text: 'I fed 10 bales' },
            error: null,
          });
        }
        if (fn === 'process-farmhand-activity') {
          return Promise.resolve({
            data: null,
            error: {
              code: 'NEEDS_CLARIFICATION',
              message: 'Multiple feed types found for "bales". Please specify: hay, corn silage',
              availableOptions: ['hay', 'corn silage'],
            },
          });
        }
        return Promise.resolve({ data: null, error: null });
      });

      const { getByRole, getByText, queryByText } = render(<VoiceRecordButton farmId="farm-123" />);

      const recordButton = getByRole('button', { name: /record/i });
      await user.click(recordButton);

      await waitForCondition(() => !!queryByText(/recording/i));

      const stopButton = getByRole('button', { name: /stop/i });
      await user.click(stopButton);

      // Wait for clarification message
      await waitForCondition(() => !!queryByText(/multiple feed types/i));

      // Verify both options are shown
      expect(getByText(/hay/i)).toBeTruthy();
      expect(getByText(/corn silage/i)).toBeTruthy();
    });
  });

  describe('Test Case 3: Should process multiple feed types from single voice command', () => {
    it('should handle "10 bales and 5 bags of concentrates" correctly', async () => {
      vi.mocked(supabaseClient.supabase.from).mockImplementation((table: string) => {
        if (table === 'farm_memberships') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { farm_id: 'farm-123' },
              error: null,
            }),
          } as any;
        }
        if (table === 'feed_inventory') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              data: mockFeedInventory,
              error: null,
            }),
          } as any;
        }
        return {} as any;
      });

      vi.mocked(supabaseClient.supabase.functions.invoke).mockImplementation((fn: string) => {
        if (fn === 'voice-to-text') {
          return Promise.resolve({
            data: { text: 'I fed 10 bales and 5 bags of concentrates' },
            error: null,
          });
        }
        if (fn === 'process-farmhand-activity') {
          return Promise.resolve({
            data: mockMultiFeedActivityData,
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      });

      const { getByRole, getByText, queryByText } = render(<VoiceRecordButton farmId="farm-123" />);

      const recordButton = getByRole('button', { name: /record/i });
      await user.click(recordButton);

      await waitForCondition(() => !!queryByText(/recording/i));

      const stopButton = getByRole('button', { name: /stop/i });
      await user.click(stopButton);

      // Wait for multi-feed confirmation to appear
      await waitForCondition(() => !!queryByText(/hay/i) && !!queryByText(/concentrates/i));

      // Verify both feeds are shown with correct quantities
      expect(getByText(/10/)).toBeTruthy(); // hay quantity
      expect(getByText(/5/)).toBeTruthy(); // concentrates quantity
    });
  });

  describe('Test Case 4: Should route to Dok Aga when query contains "dok aga"', () => {
    it('should show DocAgaConsultation when voice mentions "dok aga"', async () => {
      vi.mocked(supabaseClient.supabase.from).mockImplementation((table: string) => {
        if (table === 'farm_memberships') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { farm_id: 'farm-123' },
              error: null,
            }),
          } as any;
        }
        return {} as any;
      });

      vi.mocked(supabaseClient.supabase.functions.invoke).mockResolvedValue({
        data: { text: 'Dok aga, bakit hindi kumakain ang baka ko?' },
        error: null,
      });

      const { getByRole, getByText, queryByText } = render(<VoiceRecordButton farmId="farm-123" />);

      const recordButton = getByRole('button', { name: /record/i });
      await user.click(recordButton);

      await waitForCondition(() => !!queryByText(/recording/i));

      const stopButton = getByRole('button', { name: /stop/i });
      await user.click(stopButton);

      // Wait for DocAgaConsultation to render
      await waitForCondition(() => !!queryByText(/dok aga/i));

      // Verify the query is passed correctly
      expect(getByText(/bakit hindi kumakain/i)).toBeTruthy();
    });
  });

  describe('Test Case 5: Should show error when inventory is empty', () => {
    it('should display error message when no inventory is found', async () => {
      vi.mocked(supabaseClient.supabase.from).mockImplementation((table: string) => {
        if (table === 'farm_memberships') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { farm_id: 'farm-123' },
              error: null,
            }),
          } as any;
        }
        if (table === 'feed_inventory') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              data: [], // Empty inventory
              error: null,
            }),
          } as any;
        }
        return {} as any;
      });

      vi.mocked(supabaseClient.supabase.functions.invoke).mockImplementation((fn: string) => {
        if (fn === 'voice-to-text') {
          return Promise.resolve({
            data: { text: 'I fed 10 bales' },
            error: null,
          });
        }
        if (fn === 'process-farmhand-activity') {
          return Promise.resolve({
            data: null,
            error: {
              code: 'NO_INVENTORY',
              message: 'No feed inventory found for this farm',
            },
          });
        }
        return Promise.resolve({ data: null, error: null });
      });

      const { getByRole, getByText, queryByText } = render(<VoiceRecordButton farmId="farm-123" />);

      const recordButton = getByRole('button', { name: /record/i });
      await user.click(recordButton);

      await waitForCondition(() => !!queryByText(/recording/i));

      const stopButton = getByRole('button', { name: /stop/i });
      await user.click(stopButton);

      // Wait for error message
      await waitForCondition(() => !!queryByText(/no feed inventory/i));
    });
  });

  describe('Test Case 6: Should handle animal context correctly', () => {
    it('should display animal context banner when animalId is provided', async () => {
      vi.mocked(supabaseClient.supabase.from).mockImplementation((table: string) => {
        if (table === 'farm_memberships') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { farm_id: 'farm-123' },
              error: null,
            }),
          } as any;
        }
        if (table === 'animals') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: mockAnimal,
              error: null,
            }),
          } as any;
        }
        if (table === 'feed_inventory') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              data: mockFeedInventory,
              error: null,
            }),
          } as any;
        }
        return {} as any;
      });

      const { getByText, queryByText } = render(<VoiceRecordButton farmId="farm-123" animalId="animal-123" />);

      // Wait for animal context to load
      await waitForCondition(() => !!queryByText(/bessie/i));

      // Verify ear tag is shown
      expect(getByText(/cow001/i)).toBeTruthy();
    });

    it('should include animal_id in activity processing when provided', async () => {
      const invokeSpy = vi.mocked(supabaseClient.supabase.functions.invoke);
      
      vi.mocked(supabaseClient.supabase.from).mockImplementation((table: string) => {
        if (table === 'farm_memberships') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { farm_id: 'farm-123' },
              error: null,
            }),
          } as any;
        }
        if (table === 'animals') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: mockAnimal,
              error: null,
            }),
          } as any;
        }
        if (table === 'feed_inventory') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
              data: mockFeedInventory,
              error: null,
            }),
          } as any;
        }
        return {} as any;
      });

      invokeSpy.mockImplementation((fn: string) => {
        if (fn === 'voice-to-text') {
          return Promise.resolve({
            data: { text: 'I fed 10 bales' },
            error: null,
          });
        }
        if (fn === 'process-farmhand-activity') {
          return Promise.resolve({
            data: {
              ...mockActivityData,
              animal_id: 'animal-123',
            },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      });

      const { getByRole, queryByText } = render(<VoiceRecordButton farmId="farm-123" animalId="animal-123" />);

      const recordButton = getByRole('button', { name: /record/i });
      await user.click(recordButton);

      await waitForCondition(() => !!queryByText(/recording/i));

      const stopButton = getByRole('button', { name: /stop/i });
      await user.click(stopButton);

      // Wait for processing to complete
      await waitForCondition(() => 
        invokeSpy.mock.calls.some(call => {
          const body = call[1] as any;
          return call[0] === 'process-farmhand-activity' && body?.body?.animal_id === 'animal-123';
        })
      );

      expect(invokeSpy).toHaveBeenCalledWith(
        'process-farmhand-activity',
        expect.objectContaining({
          body: expect.objectContaining({
            animal_id: 'animal-123',
          }),
        })
      );
    });
  });
});

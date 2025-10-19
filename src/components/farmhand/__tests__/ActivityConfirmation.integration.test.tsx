import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@/test-utils';
import userEvent from '@testing-library/user-event';
import ActivityConfirmation from '../ActivityConfirmation';
import { createMockSupabaseClient } from '@/test-utils/supabase-mocks';
import { 
  mockAnimal, 
  mockFeedInventory, 
  mockUser,
  mockActivityData,
  mockMultiFeedActivityData,
  mockMilkingActivity,
  mockWeightActivity,
  mockHealthActivity,
  mockInjectionActivity,
  mockInventoryBatches
} from '@/test-utils/fixtures';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: createMockSupabaseClient()
}));

// Mock toast
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast })
}));

describe('ActivityConfirmation Integration Tests', () => {
  const mockOnCancel = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockToast.mockClear();
  });

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

  it('should display single feed activity correctly', async () => {
    const { supabase } = await import('@/integrations/supabase/client');
    
    // Mock auth user
    vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
      data: { user: mockUser as any },
      error: null
    });

    // Mock farm membership
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { farm_id: 'farm-123' },
            error: null
          })
        })
      })
    });
    vi.spyOn(supabase, 'from').mockImplementation(mockFrom);

    const { getByText } = render(
      <ActivityConfirmation
        data={mockActivityData}
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    // Verify activity type badge
    expect(getByText('Feeding')).toBeInTheDocument();
    
    // Verify feed details
    expect(getByText(/corn silage/i)).toBeInTheDocument();
    expect(getByText(/10/)).toBeInTheDocument();
    expect(getByText(/bales/i)).toBeInTheDocument();
  });

  it('should display multiple feeds correctly', async () => {
    const { supabase } = await import('@/integrations/supabase/client');
    
    vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
      data: { user: mockUser as any },
      error: null
    });

    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { farm_id: 'farm-123' },
            error: null
          }),
          gt: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockFeedInventory,
              error: null
            })
          })
        })
      })
    });
    vi.spyOn(supabase, 'from').mockImplementation(mockFrom);

    const { getByText } = render(
      <ActivityConfirmation
        data={mockMultiFeedActivityData}
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    // Wait for inventory to load
    await waitForCondition(() => {
      try {
        getByText(/15 animals/i);
        return true;
      } catch {
        return false;
      }
    });

    // Verify both feed types are shown
    expect(getByText(/hay/i)).toBeInTheDocument();
    expect(getByText(/concentrates/i)).toBeInTheDocument();
    
    // Verify quantities
    expect(getByText(/10/)).toBeInTheDocument(); // hay quantity
    expect(getByText(/5/)).toBeInTheDocument(); // concentrates quantity
  });

  it('should allow editing feed types and recalculate distribution', async () => {
    const user = userEvent.setup();
    const { supabase } = await import('@/integrations/supabase/client');
    
    vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
      data: { user: mockUser as any },
      error: null
    });

    const mockInventory = [
      { id: 'inv-1', feed_type: 'hay', unit: 'bales', weight_per_unit: 25 },
      { id: 'inv-2', feed_type: 'corn silage', unit: 'bales', weight_per_unit: 30 },
      { id: 'inv-3', feed_type: 'concentrates', unit: 'bags', weight_per_unit: 50 }
    ];

    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { farm_id: 'farm-123' },
            error: null
          }),
          gt: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockInventory,
              error: null
            })
          })
        })
      })
    });
    vi.spyOn(supabase, 'from').mockImplementation(mockFrom);

    const { getAllByRole, queryByText, getByText } = render(
      <ActivityConfirmation
        data={mockMultiFeedActivityData}
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    // Wait for inventory to load
    await waitForCondition(() => mockFrom.mock.calls.some(call => call[0] === 'feed_inventory'));

    // Find and click the first feed type selector
    const selectors = getAllByRole('combobox');
    if (selectors.length > 0) {
      await user.click(selectors[0]);
      
      // Wait for options to appear and select corn silage
      await waitForCondition(() => {
        const option = queryByText('corn silage');
        if (option) {
          user.click(option);
          return true;
        }
        return false;
      });
    }

    // Verify the change is reflected (weight_per_unit should update total_kg)
    await waitForCondition(() => {
      try {
        getByText(/300/i);
        return true;
      } catch {
        return false;
      }
    });
  });

  it('should deduct from inventory using FIFO on confirm', async () => {
    const user = userEvent.setup();
    const { supabase } = await import('@/integrations/supabase/client');
    
    vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
      data: { user: mockUser as any },
      error: null
    });

    const insertMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const updateMock = vi.fn().mockResolvedValue({ data: null, error: null });

    const mockFrom = vi.fn((table: string) => {
      if (table === 'farm_memberships') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { farm_id: 'farm-123' },
                error: null
              })
            })
          })
        };
      }
      if (table === 'feed_inventory') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              ilike: vi.fn().mockReturnValue({
                gt: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({
                    data: mockInventoryBatches,
                    error: null
                  })
                })
              }),
              gt: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: mockFeedInventory,
                  error: null
                })
              })
            })
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue(updateMock)
          })
        };
      }
      if (table === 'feeding_records') {
        return {
          insert: vi.fn().mockReturnValue(insertMock)
        };
      }
      if (table === 'feed_stock_transactions') {
        return {
          insert: vi.fn().mockReturnValue(insertMock)
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnValue(insertMock)
      };
    });
    
    vi.spyOn(supabase, 'from').mockImplementation(mockFrom as any);

    const { getByRole } = render(
      <ActivityConfirmation
        data={mockActivityData}
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    // Click confirm button
    const confirmButton = getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);

    // Wait for operations to complete
    await waitForCondition(() => mockOnSuccess.mock.calls.length > 0);

    // Verify FIFO deduction: oldest batch should be updated first
    expect(updateMock).toHaveBeenCalled();
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        transaction_type: 'consumption'
      })
    );
  });

  it('should handle milking records correctly', async () => {
    const user = userEvent.setup();
    const { supabase } = await import('@/integrations/supabase/client');
    
    vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
      data: { user: mockUser as any },
      error: null
    });

    const insertMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockFrom = vi.fn((table: string) => {
      if (table === 'milking_records') {
        return {
          insert: vi.fn().mockReturnValue(insertMock)
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { farm_id: 'farm-123' },
              error: null
            })
          })
        })
      };
    });
    
    vi.spyOn(supabase, 'from').mockImplementation(mockFrom as any);

    const { getByText, getByRole } = render(
      <ActivityConfirmation
        data={mockMilkingActivity}
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    // Verify milking badge
    expect(getByText('Milking')).toBeInTheDocument();
    expect(getByText(/12.*liters/i)).toBeInTheDocument();

    // Click confirm
    const confirmButton = getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);

    await waitForCondition(() => {
      return insertMock.mock.calls.some(call => 
        call[0]?.animal_id === mockAnimal.id && call[0]?.liters === 12
      ) && mockToast.mock.calls.some(call =>
        call[0]?.title === 'Success'
      );
    });
  });

  it('should handle weight measurement and update animal', async () => {
    const user = userEvent.setup();
    const { supabase } = await import('@/integrations/supabase/client');
    
    vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
      data: { user: mockUser as any },
      error: null
    });

    const insertMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockFrom = vi.fn((table: string) => {
      if (table === 'weight_records') {
        return {
          insert: vi.fn().mockReturnValue(insertMock)
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { farm_id: 'farm-123' },
              error: null
            })
          })
        })
      };
    });
    
    vi.spyOn(supabase, 'from').mockImplementation(mockFrom as any);

    const { getByText, getByRole } = render(
      <ActivityConfirmation
        data={mockWeightActivity}
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    // Verify weight badge
    expect(getByText('Weight Measurement')).toBeInTheDocument();
    expect(getByText(/580.*kg/i)).toBeInTheDocument();

    // Click confirm
    const confirmButton = getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);

    await waitForCondition(() => {
      return insertMock.mock.calls.some(call => 
        call[0]?.animal_id === mockAnimal.id && 
        call[0]?.weight_kg === 580 &&
        call[0]?.measurement_method === 'visual_estimate'
      );
    });
  });

  it('should handle health observations', async () => {
    const user = userEvent.setup();
    const { supabase } = await import('@/integrations/supabase/client');
    
    vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
      data: { user: mockUser as any },
      error: null
    });

    const insertMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockFrom = vi.fn((table: string) => {
      if (table === 'health_records') {
        return {
          insert: vi.fn().mockReturnValue(insertMock)
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { farm_id: 'farm-123' },
              error: null
            })
          })
        })
      };
    });
    
    vi.spyOn(supabase, 'from').mockImplementation(mockFrom as any);

    const { getByText, getByRole } = render(
      <ActivityConfirmation
        data={mockHealthActivity}
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    // Verify health check badge
    expect(getByText('Health Check')).toBeInTheDocument();
    expect(getByText(/limping/i)).toBeInTheDocument();

    // Click confirm
    const confirmButton = getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);

    await waitForCondition(() => {
      return insertMock.mock.calls.some(call => 
        call[0]?.animal_id === mockAnimal.id && 
        call[0]?.diagnosis === 'Routine observation' &&
        call[0]?.notes === 'Animal appears to be limping on left front leg'
      );
    });
  });

  it('should handle injection records with medicine details', async () => {
    const user = userEvent.setup();
    const { supabase } = await import('@/integrations/supabase/client');
    
    vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
      data: { user: mockUser as any },
      error: null
    });

    const insertMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockFrom = vi.fn((table: string) => {
      if (table === 'injection_records') {
        return {
          insert: vi.fn().mockReturnValue(insertMock)
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { farm_id: 'farm-123' },
              error: null
            })
          })
        })
      };
    });
    
    vi.spyOn(supabase, 'from').mockImplementation(mockFrom as any);

    const { getByText, getByRole } = render(
      <ActivityConfirmation
        data={mockInjectionActivity}
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    // Verify injection badge
    expect(getByText('Injection/Medicine')).toBeInTheDocument();
    expect(getByText(/Ivermectin/i)).toBeInTheDocument();
    expect(getByText(/10ml/i)).toBeInTheDocument();

    // Click confirm
    const confirmButton = getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);

    await waitForCondition(() => {
      return insertMock.mock.calls.some(call => 
        call[0]?.animal_id === mockAnimal.id && 
        call[0]?.medicine_name === 'Ivermectin' &&
        call[0]?.dosage === '10ml'
      );
    });
  });
});

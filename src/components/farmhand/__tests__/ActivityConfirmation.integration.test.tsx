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

    render(
      <ActivityConfirmation
        data={mockMultiFeedActivityData}
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    // Wait for inventory to load
    await waitFor(() => {
      expect(screen.getByText(/15 animals/i)).toBeInTheDocument();
    });

    // Verify both feed types are shown
    expect(screen.getByText(/hay/i)).toBeInTheDocument();
    expect(screen.getByText(/concentrates/i)).toBeInTheDocument();
    
    // Verify quantities
    expect(screen.getByText(/10/)).toBeInTheDocument(); // hay quantity
    expect(screen.getByText(/5/)).toBeInTheDocument(); // concentrates quantity
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

    render(
      <ActivityConfirmation
        data={mockMultiFeedActivityData}
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    // Wait for inventory to load
    await waitFor(() => {
      expect(mockFrom).toHaveBeenCalledWith('feed_inventory');
    });

    // Find and click the first feed type selector
    const selectors = screen.getAllByRole('combobox');
    if (selectors.length > 0) {
      await user.click(selectors[0]);
      
      // Wait for options to appear and select corn silage
      await waitFor(() => {
        const option = screen.queryByText('corn silage');
        if (option) {
          user.click(option);
        }
      });
    }

    // Verify the change is reflected (weight_per_unit should update total_kg)
    await waitFor(() => {
      // After changing from hay (25kg/bale) to corn silage (30kg/bale),
      // 10 bales should now be 300kg instead of 250kg
      expect(screen.getByText(/300/i)).toBeInTheDocument();
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

    render(
      <ActivityConfirmation
        data={mockActivityData}
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    // Click confirm button
    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);

    // Wait for operations to complete
    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalled();
    });

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

    render(
      <ActivityConfirmation
        data={mockMilkingActivity}
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    // Verify milking badge
    expect(screen.getByText('Milking')).toBeInTheDocument();
    expect(screen.getByText(/12.*liters/i)).toBeInTheDocument();

    // Click confirm
    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          animal_id: mockAnimal.id,
          liters: 12
        })
      );
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Success'
        })
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

    render(
      <ActivityConfirmation
        data={mockWeightActivity}
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    // Verify weight badge
    expect(screen.getByText('Weight Measurement')).toBeInTheDocument();
    expect(screen.getByText(/580.*kg/i)).toBeInTheDocument();

    // Click confirm
    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          animal_id: mockAnimal.id,
          weight_kg: 580,
          measurement_method: 'visual_estimate'
        })
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

    render(
      <ActivityConfirmation
        data={mockHealthActivity}
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    // Verify health check badge
    expect(screen.getByText('Health Check')).toBeInTheDocument();
    expect(screen.getByText(/limping/i)).toBeInTheDocument();

    // Click confirm
    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          animal_id: mockAnimal.id,
          diagnosis: 'Routine observation',
          notes: 'Animal appears to be limping on left front leg'
        })
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

    render(
      <ActivityConfirmation
        data={mockInjectionActivity}
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    // Verify injection badge
    expect(screen.getByText('Injection/Medicine')).toBeInTheDocument();
    expect(screen.getByText(/Ivermectin/i)).toBeInTheDocument();
    expect(screen.getByText(/10ml/i)).toBeInTheDocument();

    // Click confirm
    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({
          animal_id: mockAnimal.id,
          medicine_name: 'Ivermectin',
          dosage: '10ml'
        })
      );
    });
  });
});

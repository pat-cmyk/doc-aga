import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@/test-utils';
import userEvent from '@testing-library/user-event';
import AnimalForm from './AnimalForm';
import { useToast } from '@/hooks/use-toast';

// Mock dependencies
vi.mock('@/hooks/use-toast');
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { supabase } from '@/integrations/supabase/client';

describe('AnimalForm', () => {
  const mockOnSuccess = vi.fn();
  const mockOnCancel = vi.fn();
  const mockToast = vi.fn();
  const mockFarmId = 'farm-123';

  beforeEach(() => {
    vi.clearAllMocks();
    (useToast as any).mockReturnValue({ toast: mockToast });

    // Mock empty parent lists by default
    (supabase.from as any).mockReturnValue({
      select: () => ({
        eq: () => ({
          ilike: () => ({
            eq: () => ({
              lte: () => ({
                order: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
        }),
        single: () => Promise.resolve({ data: null, error: null }),
      }),
      insert: () => ({
        select: () => Promise.resolve({ data: null, error: null }),
      }),
    });
  });

  it('should render form with required fields', async () => {
    const { findByLabelText, getByRole } = render(
      <AnimalForm
        farmId={mockFarmId}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    const animalTypeField = await findByLabelText(/Animal Type/i);
    expect(animalTypeField).toBeInTheDocument();

    expect(getByRole('button', { name: /Add Animal/i })).toBeInTheDocument();
    expect(getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
  });

  it('should show validation error when ear tag is missing', async () => {
    const { findByRole } = render(
      <AnimalForm
        farmId={mockFarmId}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    const submitButton = await findByRole('button', { name: /Add Animal/i });
    await userEvent.click(submitButton);

    // Wait for validation
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(mockToast).toHaveBeenCalledWith({
      title: 'Missing fields',
      description: 'Ear tag is required',
      variant: 'destructive',
    });
  });

  it('should call onCancel when cancel button is clicked', async () => {
    const { findByRole } = render(
      <AnimalForm
        farmId={mockFarmId}
        onSuccess={mockOnSuccess}
        onCancel={mockOnCancel}
      />
    );

    const cancelButton = await findByRole('button', { name: /Cancel/i });
    await userEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRole } from './useRole';
import { supabase } from '@/integrations/supabase/client';

// Mock the Supabase client
vi.mock('@/integrations/supabase/client');

// Helper to wait for async updates
const waitForNextUpdate = () => new Promise(resolve => setTimeout(resolve, 0));

describe('useRole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty roles when user is not authenticated', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: null },
      error: null,
    } as any);

    const { result } = renderHook(() => useRole());

    // Wait for async operations to complete
    await waitForNextUpdate();

    expect(result.current.isLoading).toBe(false);
    expect(result.current.roles).toEqual([]);
    expect(result.current.isMerchant).toBe(false);
    expect(result.current.isFarmer).toBe(false);
    expect(result.current.isAdmin).toBe(false);
  });

  it('should detect farmer_owner role', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    } as any);

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: [{ role: 'farmer_owner' }],
        error: null,
      }),
    } as any);

    const { result } = renderHook(() => useRole());

    await waitForNextUpdate();

    expect(result.current.isLoading).toBe(false);
    expect(result.current.roles).toContain('farmer_owner');
    expect(result.current.isFarmer).toBe(true);
    expect(result.current.isMerchant).toBe(false);
  });

  it('should detect merchant role', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    } as any);

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: [{ role: 'merchant' }],
        error: null,
      }),
    } as any);

    const { result } = renderHook(() => useRole());

    await waitForNextUpdate();

    expect(result.current.isLoading).toBe(false);
    expect(result.current.roles).toContain('merchant');
    expect(result.current.isMerchant).toBe(true);
    expect(result.current.isFarmer).toBe(false);
  });

  it('should detect admin role', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: 'admin-123' } },
      error: null,
    } as any);

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: [{ role: 'admin' }],
        error: null,
      }),
    } as any);

    const { result } = renderHook(() => useRole());

    await waitForNextUpdate();

    expect(result.current.isLoading).toBe(false);
    expect(result.current.roles).toContain('admin');
    expect(result.current.isAdmin).toBe(true);
  });

  it('should detect multiple roles', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    } as any);

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: [
          { role: 'farmer_owner' },
          { role: 'merchant' },
        ],
        error: null,
      }),
    } as any);

    const { result } = renderHook(() => useRole());

    await waitForNextUpdate();

    expect(result.current.isLoading).toBe(false);
    expect(result.current.roles).toContain('farmer_owner');
    expect(result.current.roles).toContain('merchant');
    expect(result.current.isFarmer).toBe(true);
    expect(result.current.isMerchant).toBe(true);
  });

  it('should use hasRole helper correctly', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    } as any);

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: [{ role: 'farmhand' }],
        error: null,
      }),
    } as any);

    const { result } = renderHook(() => useRole());

    await waitForNextUpdate();

    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasRole('farmhand')).toBe(true);
    expect(result.current.hasRole('merchant')).toBe(false);
  });
});

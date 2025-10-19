import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePermissions } from './usePermissions';
import * as useRoleModule from './useRole';

// Mock dependencies
vi.mock('./useRole');
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  },
}));

import { supabase } from '@/integrations/supabase/client';

describe('usePermissions', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  };

  const mockFarmId = 'farm-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return loading state initially', () => {
    vi.spyOn(useRoleModule, 'useRole').mockReturnValue({
      roles: [],
      isAdmin: false,
      isFarmer: false,
      isMerchant: false,
      isLoading: false,
      hasRole: vi.fn(),
    });

    const { result } = renderHook(() => usePermissions(mockFarmId));
    
    expect(result.current.isLoading).toBe(true);
  });

  it('should handle no farmId provided', async () => {
    vi.spyOn(useRoleModule, 'useRole').mockReturnValue({
      roles: [],
      isAdmin: false,
      isFarmer: false,
      isMerchant: false,
      isLoading: false,
      hasRole: vi.fn(),
    });

    const { result } = renderHook(() => usePermissions(undefined));
    
    // Wait for state to update
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isOwner).toBe(false);
    expect(result.current.canManageFarm).toBe(false);
  });

  it('should identify farm owner correctly', async () => {
    vi.spyOn(useRoleModule, 'useRole').mockReturnValue({
      roles: ['farmer_owner'],
      isAdmin: false,
      isFarmer: true,
      isMerchant: false,
      isLoading: false,
      hasRole: vi.fn(),
    });

    (supabase.auth.getUser as any).mockResolvedValue({
      data: { user: mockUser },
    });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'farms') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({
                data: { owner_id: mockUser.id },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'farm_memberships') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  single: () => Promise.resolve({
                    data: null,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }
    });

    const { result } = renderHook(() => usePermissions(mockFarmId));
    
    // Wait for state to update
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isOwner).toBe(true);
    expect(result.current.canManageTeam).toBe(true);
    expect(result.current.canManageFarm).toBe(true);
    expect(result.current.canDeleteAnimals).toBe(true);
  });

  it('should identify farm manager correctly', async () => {
    vi.spyOn(useRoleModule, 'useRole').mockReturnValue({
      roles: ['farmer_owner'],
      isAdmin: false,
      isFarmer: true,
      isMerchant: false,
      isLoading: false,
      hasRole: vi.fn(),
    });

    (supabase.auth.getUser as any).mockResolvedValue({
      data: { user: mockUser },
    });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'farms') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({
                data: { owner_id: 'different-user' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'farm_memberships') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  single: () => Promise.resolve({
                    data: { role_in_farm: 'farmer_owner' },
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }
    });

    const { result } = renderHook(() => usePermissions(mockFarmId));
    
    // Wait for state to update
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isOwner).toBe(false);
    expect(result.current.isManager).toBe(true);
    expect(result.current.canManageFarm).toBe(true);
    expect(result.current.canEditAnimals).toBe(true);
    expect(result.current.canDeleteAnimals).toBe(false);
  });

  it('should grant admin full permissions', async () => {
    vi.spyOn(useRoleModule, 'useRole').mockReturnValue({
      roles: ['admin'],
      isAdmin: true,
      isFarmer: false,
      isMerchant: false,
      isLoading: false,
      hasRole: vi.fn(),
    });

    (supabase.auth.getUser as any).mockResolvedValue({
      data: { user: mockUser },
    });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'farms') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({
                data: { owner_id: 'different-user' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'farm_memberships') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  single: () => Promise.resolve({
                    data: null,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }
    });

    const { result } = renderHook(() => usePermissions(mockFarmId));
    
    // Wait for state to update
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(result.current.isLoading).toBe(false);
    expect(result.current.canManageTeam).toBe(true);
    expect(result.current.canManageFarm).toBe(true);
    expect(result.current.canAddAnimals).toBe(true);
    expect(result.current.canDeleteAnimals).toBe(true);
  });

  it('should allow farmhand to create records', async () => {
    vi.spyOn(useRoleModule, 'useRole').mockReturnValue({
      roles: ['farmhand'],
      isAdmin: false,
      isFarmer: false,
      isMerchant: false,
      isLoading: false,
      hasRole: vi.fn(),
    });

    (supabase.auth.getUser as any).mockResolvedValue({
      data: { user: mockUser },
    });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'farms') {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({
                data: { owner_id: 'different-user' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'farm_memberships') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  single: () => Promise.resolve({
                    data: null,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }
    });

    const { result } = renderHook(() => usePermissions(mockFarmId));
    
    // Wait for state to update
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isFarmhand).toBe(true);
    expect(result.current.canCreateRecords).toBe(true);
    expect(result.current.canManageFarm).toBe(false);
    expect(result.current.canDeleteAnimals).toBe(false);
  });
});

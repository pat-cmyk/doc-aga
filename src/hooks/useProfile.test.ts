import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useProfile } from './useProfile';
import { useToast } from './use-toast';

// Mock dependencies
vi.mock('./use-toast');
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
      updateUser: vi.fn(),
    },
    from: vi.fn(),
  },
}));

import { supabase } from '@/integrations/supabase/client';

describe('useProfile', () => {
  const mockToast = vi.fn();
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
  };

  const mockProfile = {
    id: 'user-123',
    full_name: 'John Doe',
    phone: '+1234567890',
    role: 'farmer_owner',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useToast as any).mockReturnValue({ toast: mockToast });
  });

  it('should load profile on mount', async () => {
    (supabase.auth.getUser as any).mockResolvedValue({
      data: { user: mockUser },
    });

    (supabase.from as any).mockReturnValue({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({
            data: mockProfile,
            error: null,
          }),
        }),
      }),
    });

    const { result } = renderHook(() => useProfile());
    
    expect(result.current.loading).toBe(true);
    
    // Wait for state to update
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(result.current.loading).toBe(false);
    expect(result.current.profile).toEqual(mockProfile);
  });

  it('should handle profile load error', async () => {
    (supabase.auth.getUser as any).mockResolvedValue({
      data: { user: mockUser },
    });

    const error = new Error('Database error');
    (supabase.from as any).mockReturnValue({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({
            data: null,
            error,
          }),
        }),
      }),
    });

    const { result } = renderHook(() => useProfile());
    
    // Wait for state to update
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(result.current.loading).toBe(false);
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Error loading profile',
      description: error.message,
      variant: 'destructive',
    });
  });

  it('should update profile successfully', async () => {
    (supabase.auth.getUser as any).mockResolvedValue({
      data: { user: mockUser },
    });

    // Mock initial load
    (supabase.from as any).mockReturnValue({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({
            data: mockProfile,
            error: null,
          }),
        }),
      }),
      update: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
    });

    const { result } = renderHook(() => useProfile());
    
    // Wait for state to update
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(result.current.loading).toBe(false);

    const success = await result.current.updateProfile({
      full_name: 'Jane Doe',
    });
    
    expect(success).toBe(true);
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Success',
      description: 'Profile updated successfully',
    });
  });

  it('should handle profile update error', async () => {
    (supabase.auth.getUser as any).mockResolvedValue({
      data: { user: mockUser },
    });

    const updateError = new Error('Update failed');
    (supabase.from as any).mockReturnValue({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({
            data: mockProfile,
            error: null,
          }),
        }),
      }),
      update: () => ({
        eq: () => Promise.resolve({ error: updateError }),
      }),
    });

    const { result } = renderHook(() => useProfile());
    
    // Wait for state to update
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(result.current.loading).toBe(false);

    const success = await result.current.updateProfile({
      full_name: 'Jane Doe',
    });
    
    expect(success).toBe(false);
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Error updating profile',
      description: updateError.message,
      variant: 'destructive',
    });
  });

  it('should update password successfully', async () => {
    (supabase.auth.getUser as any).mockResolvedValue({
      data: { user: mockUser },
    });

    (supabase.auth.updateUser as any).mockResolvedValue({
      error: null,
    });

    (supabase.from as any).mockReturnValue({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({
            data: mockProfile,
            error: null,
          }),
        }),
      }),
    });

    const { result } = renderHook(() => useProfile());
    
    // Wait for state to update
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(result.current.loading).toBe(false);

    const success = await result.current.updatePassword('NewSecurePassword123!');
    
    expect(success).toBe(true);
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Success',
      description: 'Password updated successfully',
    });
  });

  it('should handle leaked password error', async () => {
    (supabase.auth.getUser as any).mockResolvedValue({
      data: { user: mockUser },
    });

    const leakedPasswordError = {
      message: 'This password has been exposed in a data breach',
    };
    (supabase.auth.updateUser as any).mockResolvedValue({
      error: leakedPasswordError,
    });

    (supabase.from as any).mockReturnValue({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({
            data: mockProfile,
            error: null,
          }),
        }),
      }),
    });

    const { result } = renderHook(() => useProfile());
    
    // Wait for state to update
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(result.current.loading).toBe(false);

    const success = await result.current.updatePassword('password123');
    
    expect(success).toBe(false);
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Weak Password Detected',
      description: 'This password has been exposed in a data breach. Please choose a stronger, unique password.',
      variant: 'destructive',
    });
  });

  it('should handle no user found error during update', async () => {
    (supabase.auth.getUser as any).mockResolvedValue({
      data: { user: null },
    });

    (supabase.from as any).mockReturnValue({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({
            data: null,
            error: null,
          }),
        }),
      }),
    });

    const { result } = renderHook(() => useProfile());
    
    // Wait for state to update
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(result.current.loading).toBe(false);

    const success = await result.current.updateProfile({
      full_name: 'Test',
    });
    
    expect(success).toBe(false);
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Error updating profile',
      description: 'No user found',
      variant: 'destructive',
    });
  });
});

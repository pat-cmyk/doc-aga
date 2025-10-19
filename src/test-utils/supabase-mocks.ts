import { vi } from 'vitest';

export const mockSupabaseTable = (tableName: string, mockData: any) => {
  const selectMock = vi.fn().mockReturnThis();
  const eqMock = vi.fn().mockReturnThis();
  const singleMock = vi.fn().mockResolvedValue({ data: mockData, error: null });
  const maybeSingleMock = vi.fn().mockResolvedValue({ data: mockData, error: null });
  
  return {
    select: selectMock,
    eq: eqMock,
    single: singleMock,
    maybeSingle: maybeSingleMock,
  };
};

export const mockSupabaseFunction = (functionName: string, mockResponse: any) => {
  return vi.fn().mockResolvedValue({
    data: mockResponse,
    error: null,
  });
};

export const mockAuthUser = (userId: string = 'test-user-id') => {
  return {
    id: userId,
    email: 'test@example.com',
    aud: 'authenticated',
    role: 'authenticated',
  };
};

export const createMockSupabaseClient = (overrides: any = {}) => {
  return {
    from: vi.fn((table: string) => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      ...overrides[table],
    })),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: mockAuthUser() },
        error: null,
      }),
    },
    ...overrides,
  };
};

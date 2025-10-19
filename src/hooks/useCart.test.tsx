import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { CartProvider, useCart } from './useCart';
import { ReactNode } from 'react';
import type { Product } from './useProducts';

const wrapper = ({ children }: { children: ReactNode }) => (
  <CartProvider>{children}</CartProvider>
);

const mockProduct: Product = {
  id: 'prod-1',
  name: 'Test Feed',
  description: 'Quality cattle feed',
  price: 100,
  unit: 'kg',
  image_url: null,
  stock_quantity: 50,
  is_active: true,
  merchant: {
    id: 'merchant-1',
    business_name: 'Test Merchant',
    business_logo_url: null,
  },
};

describe('useCart', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should throw error when used outside CartProvider', () => {
    // Suppress console error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => {
      renderHook(() => useCart());
    }).toThrow('useCart must be used within a CartProvider');
    
    consoleSpy.mockRestore();
  });

  it('should initialize with empty cart', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    
    expect(result.current.cart).toEqual([]);
    expect(result.current.getTotalItems()).toBe(0);
    expect(result.current.getTotalPrice()).toBe(0);
  });

  it('should add item to cart', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    
    act(() => {
      result.current.addToCart(mockProduct, 2);
    });
    
    expect(result.current.cart).toHaveLength(1);
    expect(result.current.cart[0].quantity).toBe(2);
    expect(result.current.getTotalItems()).toBe(2);
    expect(result.current.getTotalPrice()).toBe(200);
  });

  it('should increment quantity when adding existing item', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    
    act(() => {
      result.current.addToCart(mockProduct, 1);
    });
    
    act(() => {
      result.current.addToCart(mockProduct, 2);
    });
    
    expect(result.current.cart).toHaveLength(1);
    expect(result.current.cart[0].quantity).toBe(3);
    expect(result.current.getTotalItems()).toBe(3);
  });

  it('should remove item from cart', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    
    act(() => {
      result.current.addToCart(mockProduct, 2);
    });
    
    act(() => {
      result.current.removeFromCart(mockProduct.id);
    });
    
    expect(result.current.cart).toHaveLength(0);
    expect(result.current.getTotalItems()).toBe(0);
  });

  it('should update item quantity', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    
    act(() => {
      result.current.addToCart(mockProduct, 2);
    });
    
    act(() => {
      result.current.updateQuantity(mockProduct.id, 5);
    });
    
    expect(result.current.cart[0].quantity).toBe(5);
    expect(result.current.getTotalItems()).toBe(5);
    expect(result.current.getTotalPrice()).toBe(500);
  });

  it('should remove item when quantity is set to zero', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    
    act(() => {
      result.current.addToCart(mockProduct, 2);
    });
    
    act(() => {
      result.current.updateQuantity(mockProduct.id, 0);
    });
    
    expect(result.current.cart).toHaveLength(0);
  });

  it('should clear entire cart', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    
    const product2 = { ...mockProduct, id: 'prod-2', name: 'Product 2' };
    
    act(() => {
      result.current.addToCart(mockProduct, 1);
      result.current.addToCart(product2, 2);
    });
    
    expect(result.current.cart).toHaveLength(2);
    
    act(() => {
      result.current.clearCart();
    });
    
    expect(result.current.cart).toHaveLength(0);
    expect(result.current.getTotalItems()).toBe(0);
  });

  it('should calculate total price correctly with multiple items', () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    
    const product2 = { ...mockProduct, id: 'prod-2', price: 50 };
    
    act(() => {
      result.current.addToCart(mockProduct, 2); // 100 * 2 = 200
      result.current.addToCart(product2, 3);    // 50 * 3 = 150
    });
    
    expect(result.current.getTotalPrice()).toBe(350);
  });

  it('should persist cart to localStorage', async () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    
    act(() => {
      result.current.addToCart(mockProduct, 2);
    });
    
    // Wait a bit for localStorage to update
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const stored = localStorage.getItem('farmplus_cart');
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored!);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].quantity).toBe(2);
  });

  it('should load cart from localStorage on mount', () => {
    const cartData = [{ ...mockProduct, quantity: 3 }];
    localStorage.setItem('farmplus_cart', JSON.stringify(cartData));
    
    const { result } = renderHook(() => useCart(), { wrapper });
    
    expect(result.current.cart).toHaveLength(1);
    expect(result.current.cart[0].quantity).toBe(3);
    expect(result.current.getTotalItems()).toBe(3);
  });
});

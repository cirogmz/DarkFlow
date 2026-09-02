import { create } from 'zustand';

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  imageUrl?: string;
  quantity: number;
  notes?: string;
}

interface BrandTheme {
  id: string;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl?: string;
}

interface AppState {
  // Brand state
  activeBrand: BrandTheme | null;
  setActiveBrand: (brand: BrandTheme | null) => void;
  
  // Cart state
  cart: CartItem[];
  addToCart: (product: { id: string; name: string; price: number; imageUrl?: string }) => void;
  removeFromCart: (productId: string) => void;
  updateCartQty: (productId: string, qty: number) => void;
  updateCartNotes: (productId: string, notes: string) => void;
  clearCart: () => void;
  
  // Notification system
  notifications: Array<{ id: string; message: string; type: 'info' | 'success' | 'warning' }>;
  addNotification: (message: string, type?: 'info' | 'success' | 'warning') => void;
  clearNotifications: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeBrand: null,
  setActiveBrand: (brand) => set({ activeBrand: brand }),
  
  cart: [],
  addToCart: (product) => set((state) => {
    const existing = state.cart.find((item) => item.productId === product.id);
    if (existing) {
      return {
        cart: state.cart.map((item) =>
          item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item
        ),
      };
    }
    return {
      cart: [...state.cart, { productId: product.id, name: product.name, price: product.price, imageUrl: product.imageUrl, quantity: 1 }],
    };
  }),
  removeFromCart: (productId) => set((state) => ({
    cart: state.cart.filter((item) => item.productId !== productId),
  })),
  updateCartQty: (productId, qty) => set((state) => ({
    cart: state.cart.map((item) =>
      item.productId === productId ? { ...item, quantity: Math.max(1, qty) } : item
    ),
  })),
  updateCartNotes: (productId, notes) => set((state) => ({
    cart: state.cart.map((item) =>
      item.productId === productId ? { ...item, notes } : item
    ),
  })),
  clearCart: () => set({ cart: [] }),
  
  notifications: [],
  addNotification: (message, type = 'info') => set((state) => ({
    notifications: [{ id: Math.random().toString(), message, type }, ...state.notifications].slice(0, 10),
  })),
  clearNotifications: () => set({ notifications: [] }),
}));

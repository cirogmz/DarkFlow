import { create } from 'zustand';

export interface CartModifier {
  groupName: string;
  optionName: string;
  price: number;
  ingredientId?: string | null;
  ingredientQuantity?: number | null;
}

export interface CartItem {
  id?: string; // Unique key in cart (product + modifiers)
  productId: string;
  name: string;
  price: number;
  imageUrl?: string;
  quantity: number;
  notes?: string;
  modifiers?: CartModifier[];
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
  addToCart: (product: {
    id: string;
    name: string;
    price: number;
    imageUrl?: string;
    notes?: string;
    modifiers?: CartModifier[];
  }) => void;
  removeFromCart: (itemKey: string) => void;
  updateCartQty: (itemKey: string, qty: number) => void;
  updateCartNotes: (itemKey: string, notes: string) => void;
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
    const itemKey = product.modifiers && product.modifiers.length > 0
      ? `${product.id}-${JSON.stringify(product.modifiers)}`
      : product.id;

    const existing = state.cart.find((item) => (item.id || item.productId) === itemKey);
    if (existing) {
      return {
        cart: state.cart.map((item) =>
          (item.id || item.productId) === itemKey ? { ...item, quantity: item.quantity + 1 } : item
        ),
      };
    }
    return {
      cart: [
        ...state.cart,
        {
          id: itemKey,
          productId: product.id,
          name: product.name,
          price: product.price,
          imageUrl: product.imageUrl,
          quantity: 1,
          notes: product.notes,
          modifiers: product.modifiers,
        },
      ],
    };
  }),
  removeFromCart: (itemKey) => set((state) => ({
    cart: state.cart.filter((item) => (item.id || item.productId) !== itemKey),
  })),
  updateCartQty: (itemKey, qty) => set((state) => ({
    cart: state.cart.map((item) =>
      (item.id || item.productId) === itemKey ? { ...item, quantity: Math.max(1, qty) } : item
    ),
  })),
  updateCartNotes: (itemKey, notes) => set((state) => ({
    cart: state.cart.map((item) =>
      (item.id || item.productId) === itemKey ? { ...item, notes } : item
    ),
  })),
  clearCart: () => set({ cart: [] }),
  
  notifications: [],
  addNotification: (message, type = 'info') => set((state) => ({
    notifications: [{ id: Math.random().toString(), message, type }, ...state.notifications].slice(0, 10),
  })),
  clearNotifications: () => set({ notifications: [] }),
}));

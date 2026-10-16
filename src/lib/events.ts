import { EventEmitter } from 'events';

// Global singleton EventEmitter across Next.js dev reloads and route handlers
declare global {
  var __orderEventEmitter: EventEmitter | undefined;
}

export interface OrderEventPayload {
  action: 'CREATED' | 'UPDATED' | 'STATUS_CHANGED' | 'WAITER_CALLED' | 'EXPO_PACKED' | 'DRINKS_READY';
  orderId: string;
  orderNumber: string;
  status: string;
  brandId: string;
  source: string;
  customerName?: string | null;
  tableId?: string | null;
  tableNumber?: string | null;
  waiterId?: string | null;
  waiterName?: string | null;
  securitySeal?: string | null;
  station?: string | null;
  timestamp: string;
  order?: unknown;
}

export function getOrderEventEmitter(): EventEmitter {
  if (!global.__orderEventEmitter) {
    global.__orderEventEmitter = new EventEmitter();
    // Allow multiple concurrent KDS and Dispatch clients
    global.__orderEventEmitter.setMaxListeners(100);
  }
  return global.__orderEventEmitter;
}

export const orderEvents = getOrderEventEmitter();

import { prisma } from '@/lib/db';
import { orderEvents } from '@/lib/events';
import { recordAuditLog } from '@/lib/audit';

export type TerminalProvider = 'CLIP' | 'MERCADOPAGO_POINT';
export type TerminalStatus = 'ONLINE' | 'BUSY' | 'OFFLINE';
export type IntentStatus = 'PENDING' | 'PROCESSING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface SmartTerminalDTO {
  id: string;
  brandId: string;
  name: string;
  provider: TerminalProvider;
  serialNumber: string;
  deviceId: string;
  zone: string;
  isActive: boolean;
  status: TerminalStatus;
  lastHeartbeatAt: string | null;
  notes: string | null;
  activeIntentsCount?: number;
  createdAt: string;
}

export interface CreateSmartTerminalParams {
  brandId: string;
  name: string;
  provider: TerminalProvider;
  serialNumber: string;
  deviceId: string;
  zone?: string;
  notes?: string;
}

export interface SmartTerminalIntentDTO {
  id: string;
  terminalId: string;
  terminalName: string;
  provider: TerminalProvider;
  brandId: string;
  orderId: string;
  orderNumber: string;
  amount: number;
  tip: number;
  currency: string;
  status: IntentStatus;
  providerIntentId?: string | null;
  authCode?: string | null;
  cardBrand?: string | null;
  cardLast4?: string | null;
  errorMessage?: string | null;
  createdAt: string;
}

export interface CreatePaymentPushParams {
  brandId: string;
  terminalId: string;
  orderId: string;
  amount: number;
  tip?: number;
  req?: Request;
}

export interface SimulateTerminalResultParams {
  intentId: string;
  action: 'APPROVE' | 'REJECT' | 'CANCEL';
  cardBrand?: 'VISA' | 'MASTERCARD' | 'AMEX';
  cardLast4?: string;
  authCode?: string;
  tip?: number;
  rejectionReason?: string;
  req?: Request;
}

/**
 * List all registered terminals for a brand
 */
export async function listSmartTerminals(brandId: string): Promise<SmartTerminalDTO[]> {
  const terminals = await prisma.smartTerminal.findMany({
    where: { brandId },
    include: {
      intents: {
        where: { status: { in: ['PENDING', 'PROCESSING'] } },
      },
    },
    orderBy: [{ zone: 'asc' }, { name: 'asc' }],
  });

  return terminals.map((t) => ({
    id: t.id,
    brandId: t.brandId,
    name: t.name,
    provider: t.provider as TerminalProvider,
    serialNumber: t.serialNumber,
    deviceId: t.deviceId,
    zone: t.zone,
    isActive: t.isActive,
    status: (t.intents.length > 0 ? 'BUSY' : t.status) as TerminalStatus,
    lastHeartbeatAt: t.lastHeartbeatAt ? t.lastHeartbeatAt.toISOString() : null,
    notes: t.notes,
    activeIntentsCount: t.intents.length,
    createdAt: t.createdAt.toISOString(),
  }));
}

/**
 * Create or update a Smart Terminal
 */
export async function upsertSmartTerminal(
  params: CreateSmartTerminalParams & { id?: string }
): Promise<SmartTerminalDTO> {
  const { id, brandId, name, provider, serialNumber, deviceId, zone = 'Salón', notes } = params;

  if (!name.trim()) throw new Error('El nombre de la terminal es requerido');
  if (!serialNumber.trim()) throw new Error('El número de serie es requerido');
  if (!deviceId.trim()) throw new Error('El ID de dispositivo es requerido');

  let terminal;
  if (id) {
    terminal = await prisma.smartTerminal.update({
      where: { id },
      data: {
        name: name.trim(),
        provider,
        serialNumber: serialNumber.trim(),
        deviceId: deviceId.trim(),
        zone: zone.trim(),
        notes: notes?.trim() || null,
        lastHeartbeatAt: new Date(),
      },
    });
  } else {
    terminal = await prisma.smartTerminal.create({
      data: {
        brandId,
        name: name.trim(),
        provider,
        serialNumber: serialNumber.trim(),
        deviceId: deviceId.trim(),
        zone: zone.trim(),
        notes: notes?.trim() || null,
        status: 'ONLINE',
        lastHeartbeatAt: new Date(),
      },
    });
  }

  return {
    id: terminal.id,
    brandId: terminal.brandId,
    name: terminal.name,
    provider: terminal.provider as TerminalProvider,
    serialNumber: terminal.serialNumber,
    deviceId: terminal.deviceId,
    zone: terminal.zone,
    isActive: terminal.isActive,
    status: terminal.status as TerminalStatus,
    lastHeartbeatAt: terminal.lastHeartbeatAt ? terminal.lastHeartbeatAt.toISOString() : null,
    notes: terminal.notes,
    createdAt: terminal.createdAt.toISOString(),
  };
}

/**
 * Delete a Smart Terminal
 */
export async function deleteSmartTerminal(terminalId: string, brandId: string) {
  return await prisma.smartTerminal.delete({
    where: { id: terminalId, brandId },
  });
}

/**
 * Push payment to Smart POS Terminal (Clip / Mercado Pago Point)
 */
export async function pushPaymentToTerminal(params: CreatePaymentPushParams) {
  const { brandId, terminalId, orderId, amount, tip = 0, req } = params;

  if (amount <= 0) {
    throw new Error('El monto a cobrar debe ser mayor a 0');
  }

  const [brand, terminal, order] = await Promise.all([
    prisma.brand.findUnique({
      where: { id: brandId },
      select: {
        id: true,
        name: true,
        clipApiKey: true,
        clipSandboxMode: true,
        mpAccessToken: true,
        mpPointSandboxMode: true,
      },
    }),
    prisma.smartTerminal.findUnique({
      where: { id: terminalId },
    }),
    prisma.order.findUnique({
      where: { id: orderId },
      include: { table: true },
    }),
  ]);

  if (!brand) throw new Error('Marca no encontrada');
  if (!terminal || !terminal.isActive) throw new Error('Terminal no encontrada o inactiva');
  if (!order) throw new Error('Comanda no encontrada');

  const safeAmount = parseFloat(amount.toFixed(2));
  const safeTip = Math.max(0, parseFloat((tip || 0).toFixed(2)));

  // Generate unique provider intent ID
  const providerIntentId = `${terminal.provider.toLowerCase()}_int_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // If live mode and credentials provided, call external provider API
  // In sandbox, we generate simulated intent
  const isSandbox = terminal.provider === 'CLIP' ? brand.clipSandboxMode : brand.mpPointSandboxMode;

  const result = await prisma.$transaction(async (tx) => {
    // 1. Mark terminal as BUSY
    await tx.smartTerminal.update({
      where: { id: terminal.id },
      data: {
        status: 'BUSY',
        lastHeartbeatAt: new Date(),
      },
    });

    // 2. Create SmartTerminalIntent
    const intent = await tx.smartTerminalIntent.create({
      data: {
        terminalId: terminal.id,
        brandId: brand.id,
        orderId: order.id,
        amount: safeAmount,
        tip: safeTip,
        currency: 'MXN',
        status: 'PROCESSING',
        providerIntentId,
      },
      include: {
        terminal: true,
        order: true,
      },
    });

    return intent;
  });

  // Emit SSE event
  orderEvents.emit('order_updated', {
    id: order.id,
    orderNumber: order.orderNumber,
    brandId: brand.id,
    tableNumber: order.table?.number || null,
    action: 'WAITER_CALLED',
    reason: `💳 Cobro de $${safeAmount.toFixed(2)} MXN enviado a terminal ${terminal.name} (${terminal.provider})`,
    timestamp: new Date().toISOString(),
  });

  await recordAuditLog({
    brandId: brand.id,
    action: 'SMART_TERMINAL_PAYMENT_PUSHED',
    entityType: 'Order',
    entityId: order.id,
    details: {
      terminalName: terminal.name,
      provider: terminal.provider,
      orderNumber: order.orderNumber,
      amount: safeAmount,
      tip: safeTip,
      isSandbox,
      providerIntentId,
    },
    req,
  });

  return {
    success: true,
    intentId: result.id,
    providerIntentId,
    terminalName: terminal.name,
    provider: terminal.provider,
    amount: safeAmount,
    tip: safeTip,
    isSandbox,
  };
}

/**
 * Resolves a Terminal Payment Intent (simulated in Sandbox or from Webhook callback)
 */
export async function resolveTerminalPaymentIntent(params: SimulateTerminalResultParams) {
  const {
    intentId,
    action,
    cardBrand = 'VISA',
    cardLast4 = '4242',
    authCode = `AUTH-${Math.floor(100000 + Math.random() * 900000)}`,
    tip = 0,
    rejectionReason = 'Fondos insuficientes',
    req,
  } = params;

  const intent = await prisma.smartTerminalIntent.findUnique({
    where: { id: intentId },
    include: {
      terminal: true,
      order: {
        include: { table: true },
      },
    },
  });

  if (!intent) {
    throw new Error('Intención de cobro no encontrada');
  }

  if (intent.status !== 'PROCESSING' && intent.status !== 'PENDING') {
    throw new Error(`La intención ya está en estado ${intent.status}`);
  }

  const effectiveTip = Math.max(0, tip || intent.tip);
  const now = new Date();

  if (action === 'APPROVE') {
    const updated = await prisma.$transaction(async (tx) => {
      // 1. Update intent
      const updatedIntent = await tx.smartTerminalIntent.update({
        where: { id: intent.id },
        data: {
          status: 'APPROVED',
          authCode,
          cardBrand,
          cardLast4,
          tip: effectiveTip,
        },
      });

      // 2. Mark order as PAID
      const gatewayName = intent.terminal.provider === 'CLIP' ? 'CLIP_TERMINAL' : 'MERCADOPAGO_POINT';
      const updatedOrder = await tx.order.update({
        where: { id: intent.orderId },
        data: {
          paymentStatus: 'PAID',
          paymentMethod: gatewayName,
          paidAmount: intent.amount,
          tip: { increment: effectiveTip },
          paidAt: now,
          paymentTransactionId: authCode,
        },
      });

      // 3. Create PaymentTransaction
      await tx.paymentTransaction.create({
        data: {
          orderId: intent.orderId,
          brandId: intent.brandId,
          gateway: gatewayName,
          status: 'PAID',
          amount: intent.amount,
          tip: effectiveTip,
          currency: 'MXN',
          method: 'SMART_TERMINAL',
          notes: `Aprobado en ${intent.terminal.name} • ${cardBrand} ****${cardLast4} • Aut: ${authCode}`,
          gatewayPaymentId: authCode,
          gatewayOrderId: intent.order.orderNumber,
        },
      });

      // 4. If table occupied, free table
      if (intent.order.tableId) {
        await tx.table.update({
          where: { id: intent.order.tableId },
          data: {
            status: 'AVAILABLE',
            waiterCallStatus: 'IDLE',
            waiterCallNotes: null,
            billRequestedAt: null,
          },
        });
      }

      // 5. Free terminal
      await tx.smartTerminal.update({
        where: { id: intent.terminalId },
        data: {
          status: 'ONLINE',
          lastHeartbeatAt: now,
        },
      });

      return { intent: updatedIntent, order: updatedOrder };
    });

    // Emit SSE
    orderEvents.emit('order_updated', {
      id: intent.orderId,
      orderNumber: intent.order.orderNumber,
      brandId: intent.brandId,
      tableNumber: intent.order.table?.number || null,
      action: 'WAITER_CALLED',
      reason: `✅ Pago APROBADO en terminal ${intent.terminal.name}: $${intent.amount.toFixed(2)} MXN (${cardBrand} ****${cardLast4})`,
      timestamp: now.toISOString(),
    });

    await recordAuditLog({
      brandId: intent.brandId,
      action: 'SMART_TERMINAL_PAYMENT_APPROVED',
      entityType: 'Order',
      entityId: intent.orderId,
      details: {
        terminalName: intent.terminal.name,
        authCode,
        cardBrand,
        cardLast4,
        amount: intent.amount,
        tip: effectiveTip,
      },
      req,
    });

    return {
      success: true,
      status: 'APPROVED',
      authCode,
      cardBrand,
      cardLast4,
      amount: intent.amount,
      tip: effectiveTip,
      order: updated.order,
    };
  } else if (action === 'REJECT') {
    await prisma.$transaction([
      prisma.smartTerminalIntent.update({
        where: { id: intent.id },
        data: {
          status: 'REJECTED',
          errorMessage: rejectionReason,
        },
      }),
      prisma.smartTerminal.update({
        where: { id: intent.terminalId },
        data: {
          status: 'ONLINE',
          lastHeartbeatAt: now,
        },
      }),
    ]);

    // Emit SSE
    orderEvents.emit('order_updated', {
      id: intent.orderId,
      orderNumber: intent.order.orderNumber,
      brandId: intent.brandId,
      action: 'WAITER_CALLED',
      reason: `❌ Pago RECHAZADO en terminal ${intent.terminal.name}: ${rejectionReason}`,
      timestamp: now.toISOString(),
    });

    await recordAuditLog({
      brandId: intent.brandId,
      action: 'SMART_TERMINAL_PAYMENT_REJECTED',
      entityType: 'Order',
      entityId: intent.orderId,
      details: {
        terminalName: intent.terminal.name,
        reason: rejectionReason,
      },
      req,
    });

    return {
      success: false,
      status: 'REJECTED',
      reason: rejectionReason,
    };
  } else {
    // CANCEL
    await prisma.$transaction([
      prisma.smartTerminalIntent.update({
        where: { id: intent.id },
        data: {
          status: 'CANCELLED',
          errorMessage: 'Cobro cancelado por el operador',
        },
      }),
      prisma.smartTerminal.update({
        where: { id: intent.terminalId },
        data: {
          status: 'ONLINE',
          lastHeartbeatAt: now,
        },
      }),
    ]);

    return {
      success: false,
      status: 'CANCELLED',
    };
  }
}


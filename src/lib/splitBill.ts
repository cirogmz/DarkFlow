import { prisma } from '@/lib/db';
import { orderEvents } from '@/lib/events';
import { recordAuditLog } from '@/lib/audit';
import { redeemCustomerWallet } from '@/lib/wallet';

export interface TableBillItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  paidQuantity: number;
  unpaidQuantity: number;
  lineTotal: number;
  isPaid: boolean;
  serviceStage?: string | null;
  notes?: string | null;
  modifiers?: string | null;
  promoBadge?: string | null;
}

export interface TableBillTransaction {
  id: string;
  amount: number;
  tip: number;
  gateway: string;
  status: string;
  method?: string | null;
  splitIndex?: number | null;
  payerName?: string | null;
  payerPhone?: string | null;
  notes?: string | null;
  itemBreakdown?: string | null;
  createdAt: string;
}

export interface TableBillSummary {
  tableId: string;
  tableNumber: string;
  tableName: string;
  zone: string;
  tableStatus: string;
  brandId: string;
  brandName: string;
  brandSlug: string;
  brandLogoUrl?: string | null;
  assignedWaiter?: { id: string; name: string } | null;
  waiterCallStatus: string;
  waiterCallNotes?: string | null;
  waiterCallAt?: string | null;
  orderId?: string | null;
  orderNumber?: string | null;
  diners: number;
  subtotal: number;
  tax: number;
  total: number;
  totalPaid: number;
  totalTip: number;
  remainingBalance: number;
  isFullyPaid: boolean;
  items: TableBillItem[];
  transactions: TableBillTransaction[];
}

export interface EqualSplitOption {
  splitIndex: number;
  amount: number;
  suggestedTips: {
    pct10: number;
    pct15: number;
    pct20: number;
  };
}

export interface ProcessSplitPaymentParams {
  brandSlug: string;
  tableNumber: string;
  paymentMethod: 'CARD' | 'WALLET' | 'CASH';
  splitType: 'FULL' | 'EQUAL' | 'ITEMS';
  amount: number;
  tip: number;
  splitIndex?: number;
  payerName?: string;
  payerPhone?: string;
  selectedItems?: { orderItemId: string; quantity: number }[];
  gatewayPaymentId?: string;
  req?: Request;
}

/**
 * Calculates suggested tips for a given amount (10%, 15%, 20%)
 */
export function calculateSuggestedTips(amount: number) {
  const safeAmount = Math.max(0, amount);
  return {
    pct10: parseFloat((safeAmount * 0.10).toFixed(2)),
    pct15: parseFloat((safeAmount * 0.15).toFixed(2)),
    pct20: parseFloat((safeAmount * 0.20).toFixed(2)),
  };
}

/**
 * Retrieves the live table bill for a brand slug and table number
 */
export async function getTableBill(brandSlug: string, tableNumber: string): Promise<TableBillSummary | null> {
  const brand = await prisma.brand.findUnique({
    where: { slug: brandSlug },
    select: { id: true, name: true, slug: true, logoUrl: true },
  });

  if (!brand) return null;

  const table = await prisma.table.findFirst({
    where: {
      number: String(tableNumber),
      brandId: brand.id,
    },
    include: {
      assignedWaiter: {
        select: { id: true, name: true },
      },
      orders: {
        where: {
          status: { in: ['RECEIVED', 'PREPARING', 'READY'] },
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: {
          waiter: { select: { id: true, name: true } },
          items: {
            include: {
              product: { select: { id: true, name: true } },
            },
          },
          paymentTransactions: {
            where: { status: 'PAID' },
            orderBy: { createdAt: 'asc' },
          },
        },
      },
    },
  });

  if (!table) return null;

  const activeOrder = table.orders && table.orders.length > 0 ? table.orders[0] : null;

  if (!activeOrder) {
    return {
      tableId: table.id,
      tableNumber: table.number,
      tableName: table.name,
      zone: table.zone,
      tableStatus: table.status,
      brandId: brand.id,
      brandName: brand.name,
      brandSlug: brand.slug,
      brandLogoUrl: brand.logoUrl,
      assignedWaiter: table.assignedWaiter,
      waiterCallStatus: table.waiterCallStatus || 'IDLE',
      waiterCallNotes: table.waiterCallNotes,
      waiterCallAt: table.waiterCallAt ? table.waiterCallAt.toISOString() : null,
      orderId: null,
      orderNumber: null,
      diners: table.capacity,
      subtotal: 0,
      tax: 0,
      total: 0,
      totalPaid: 0,
      totalTip: 0,
      remainingBalance: 0,
      isFullyPaid: true,
      items: [],
      transactions: [],
    };
  }

  // Calculate items with paid breakdown
  const items: TableBillItem[] = activeOrder.items.map((item) => {
    const paidQuantity = item.paidQuantity || 0;
    const unpaidQuantity = Math.max(0, item.quantity - paidQuantity);
    const isPaid = item.isPaid || paidQuantity >= item.quantity;
    const lineTotal = parseFloat((item.price * item.quantity).toFixed(2));

    return {
      id: item.id,
      productId: item.productId,
      name: item.product.name,
      price: item.price,
      quantity: item.quantity,
      paidQuantity,
      unpaidQuantity,
      lineTotal,
      isPaid,
      serviceStage: item.serviceStage,
      notes: item.notes,
      modifiers: item.modifiers,
      promoBadge: item.promoBadge,
    };
  });

  const transactions: TableBillTransaction[] = activeOrder.paymentTransactions.map((tx) => ({
    id: tx.id,
    amount: tx.amount,
    tip: tx.tip,
    gateway: tx.gateway,
    status: tx.status,
    method: tx.method,
    splitIndex: tx.splitIndex,
    payerName: tx.payerName,
    payerPhone: tx.payerPhone,
    notes: tx.notes,
    itemBreakdown: tx.itemBreakdown,
    createdAt: tx.createdAt.toISOString(),
  }));

  const totalPaid = parseFloat(
    transactions.reduce((sum, tx) => sum + tx.amount, 0).toFixed(2)
  );
  const totalTip = parseFloat(
    transactions.reduce((sum, tx) => sum + tx.tip, 0).toFixed(2)
  );

  const remainingBalance = Math.max(0, parseFloat((activeOrder.total - totalPaid).toFixed(2)));
  const isFullyPaid = remainingBalance <= 0.01;

  const assignedWaiter = activeOrder.waiter || table.assignedWaiter;

  return {
    tableId: table.id,
    tableNumber: table.number,
    tableName: table.name,
    zone: table.zone,
    tableStatus: table.status,
    brandId: brand.id,
    brandName: brand.name,
    brandSlug: brand.slug,
    brandLogoUrl: brand.logoUrl,
    assignedWaiter,
    waiterCallStatus: table.waiterCallStatus || 'IDLE',
    waiterCallNotes: table.waiterCallNotes,
    waiterCallAt: table.waiterCallAt ? table.waiterCallAt.toISOString() : null,
    orderId: activeOrder.id,
    orderNumber: activeOrder.orderNumber,
    diners: activeOrder.diners || table.capacity,
    subtotal: activeOrder.subtotal,
    tax: activeOrder.tax,
    total: activeOrder.total,
    totalPaid,
    totalTip,
    remainingBalance,
    isFullyPaid,
    items,
    transactions,
  };
}

/**
 * Calculates equal splits for remaining balance
 */
export function calculateEqualSplits(remainingBalance: number, numSplits: number = 2): EqualSplitOption[] {
  const safeCount = Math.max(1, Math.min(20, numSplits));
  const rawPerPerson = remainingBalance / safeCount;
  const baseAmount = Math.floor(rawPerPerson * 100) / 100;
  let remainder = Math.round((remainingBalance - baseAmount * safeCount) * 100);

  const splits: EqualSplitOption[] = [];

  for (let i = 1; i <= safeCount; i++) {
    let personAmount = baseAmount;
    if (remainder > 0) {
      personAmount += 0.01;
      remainder--;
    }
    personAmount = parseFloat(personAmount.toFixed(2));

    splits.push({
      splitIndex: i,
      amount: personAmount,
      suggestedTips: calculateSuggestedTips(personAmount),
    });
  }

  return splits;
}

/**
 * Processes a split payment atomically (Equal, Item-based, or Full)
 */
export async function processSplitPayment(params: ProcessSplitPaymentParams) {
  const {
    brandSlug,
    tableNumber,
    paymentMethod,
    splitType,
    amount,
    tip,
    splitIndex,
    payerName,
    payerPhone,
    selectedItems,
    gatewayPaymentId,
    req,
  } = params;

  if (amount <= 0) {
    throw new Error('El monto a pagar debe ser mayor a 0');
  }

  const brand = await prisma.brand.findUnique({
    where: { slug: brandSlug },
    select: { id: true, name: true },
  });

  if (!brand) {
    throw new Error('Marca no encontrada');
  }

  const table = await prisma.table.findFirst({
    where: {
      number: String(tableNumber),
      brandId: brand.id,
    },
    include: {
      assignedWaiter: true,
      orders: {
        where: {
          status: { in: ['RECEIVED', 'PREPARING', 'READY'] },
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: {
          waiter: true,
          items: true,
          paymentTransactions: {
            where: { status: 'PAID' },
          },
        },
      },
    },
  });

  if (!table || !table.orders || table.orders.length === 0) {
    throw new Error('No hay comanda activa para esta mesa');
  }

  const activeOrder = table.orders[0];

  // Calculate current paid
  const alreadyPaid = activeOrder.paymentTransactions.reduce((acc, t) => acc + t.amount, 0);
  const remaining = Math.max(0, parseFloat((activeOrder.total - alreadyPaid).toFixed(2)));

  if (remaining <= 0) {
    throw new Error('Esta comanda ya ha sido pagada en su totalidad');
  }

  // Cap payment at remaining balance
  const effectiveAmount = parseFloat(Math.min(amount, remaining).toFixed(2));
  const safeTip = Math.max(0, parseFloat(Number(tip || 0).toFixed(2)));

  // If customer pays by WALLET, verify and redeem balance
  if (paymentMethod === 'WALLET') {
    if (!payerPhone || !payerPhone.trim()) {
      throw new Error('Ingresa tu número de teléfono para debitar de tu Monedero Digital');
    }

    const customer = await prisma.customer.findFirst({
      where: {
        phone: payerPhone.trim(),
        brandId: brand.id,
      },
    });

    if (!customer) {
      throw new Error('No se encontró cuenta de Monedero Digital vinculada a este número');
    }

    if (customer.walletBalance < effectiveAmount) {
      throw new Error(
        `Saldo insuficiente en Monedero ($${customer.walletBalance.toFixed(2)} MXN). Se requieren $${effectiveAmount.toFixed(2)} MXN.`
      );
    }

    // Redeem from customer wallet
    await redeemCustomerWallet({
      customerId: customer.id,
      brandId: brand.id,
      orderId: activeOrder.id,
      orderNumber: activeOrder.orderNumber,
      amountToRedeem: effectiveAmount,
      userName: `Autoservicio Mesa ${table.number}`,
    });
  }

  // Atomic database update
  const result = await prisma.$transaction(async (tx) => {
    // 1. Create PaymentTransaction
    const createdTx = await tx.paymentTransaction.create({
      data: {
        orderId: activeOrder.id,
        brandId: brand.id,
        gateway: paymentMethod,
        status: 'PAID',
        amount: effectiveAmount,
        tip: safeTip,
        currency: 'MXN',
        method: splitType,
        splitIndex: splitIndex || null,
        notes: `Pago QR ${splitType} por ${payerName || 'Comensal'} (Mesa ${table.number})`,
        payerName: payerName || (splitIndex ? `Comensal ${splitIndex}` : 'Comensal'),
        payerPhone: payerPhone || null,
        itemBreakdown: selectedItems && selectedItems.length > 0 ? JSON.stringify(selectedItems) : null,
        gatewayPaymentId: gatewayPaymentId || `qr_pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      },
    });

    // 2. If item-based split, update OrderItems
    if (splitType === 'ITEMS' && selectedItems && selectedItems.length > 0) {
      for (const sel of selectedItems) {
        const item = activeOrder.items.find((i) => i.id === sel.orderItemId);
        if (item) {
          const newPaidQty = Math.min(item.quantity, (item.paidQuantity || 0) + sel.quantity);
          const isItemDone = newPaidQty >= item.quantity;
          await tx.orderItem.update({
            where: { id: item.id },
            data: {
              paidQuantity: newPaidQty,
              isPaid: isItemDone,
            },
          });
        }
      }
    }

    // 3. Update Order paid amounts
    const newTotalPaid = parseFloat((alreadyPaid + effectiveAmount).toFixed(2));
    const newRemaining = Math.max(0, parseFloat((activeOrder.total - newTotalPaid).toFixed(2)));
    const isNowFullyPaid = newRemaining <= 0.01;

    const updatedOrder = await tx.order.update({
      where: { id: activeOrder.id },
      data: {
        paidAmount: newTotalPaid,
        tip: { increment: safeTip },
        paymentStatus: isNowFullyPaid ? 'PAID' : 'PARTIALLY_PAID',
        paymentMethod: paymentMethod,
        paidAt: isNowFullyPaid ? new Date() : activeOrder.paidAt,
      },
      include: {
        waiter: true,
      },
    });

    // 4. Update Table status if fully paid
    if (isNowFullyPaid) {
      await tx.table.update({
        where: { id: table.id },
        data: {
          status: 'AVAILABLE',
          waiterCallStatus: 'IDLE',
          waiterCallNotes: null,
          billRequestedAt: null,
        },
      });
    }

    return {
      transaction: createdTx,
      order: updatedOrder,
      effectiveAmount,
      safeTip,
      newTotalPaid,
      newRemaining,
      isNowFullyPaid,
    };
  });

  // Emit SSE Events to Waiter Hub & POS
  if (result.isNowFullyPaid) {
    orderEvents.emit('order_updated', {
      id: activeOrder.id,
      orderNumber: activeOrder.orderNumber,
      brandId: brand.id,
      tableNumber: table.number,
      action: 'WAITER_CALLED',
      reason: `✅ Mesa #${table.number} ha pagado la cuenta completa ($${activeOrder.total.toFixed(2)} MXN). Mesa liberada.`,
      timestamp: new Date().toISOString(),
    });
  } else {
    orderEvents.emit('order_updated', {
      id: activeOrder.id,
      orderNumber: activeOrder.orderNumber,
      brandId: brand.id,
      tableNumber: table.number,
      action: 'WAITER_CALLED',
      reason: `💳 Pago parcial recibido en Mesa #${table.number}: $${effectiveAmount.toFixed(2)} MXN (Resta: $${result.newRemaining.toFixed(2)} MXN)`,
      timestamp: new Date().toISOString(),
    });
  }

  // Audit log
  await recordAuditLog({
    brandId: brand.id,
    action: result.isNowFullyPaid ? 'TABLE_BILL_FULLY_PAID' : 'TABLE_BILL_SPLIT_PAID',
    entityType: 'Order',
    entityId: activeOrder.id,
    details: {
      tableNumber: table.number,
      orderNumber: activeOrder.orderNumber,
      splitType,
      paidAmount: effectiveAmount,
      tip: safeTip,
      remainingBalance: result.newRemaining,
      isFullyPaid: result.isNowFullyPaid,
      paymentMethod,
      payerName,
    },
    req,
  });

  return result;
}

/**
 * Handles diner assistance calls (Llamar al Mesero, Pedir la Cuenta, etc.)
 */
export async function callWaiter(params: {
  brandSlug: string;
  tableNumber: string;
  reason: 'CALL_WAITER' | 'BILL_REQUESTED' | 'SERVICE_HELP';
  notes?: string;
  req?: Request;
}) {
  const { brandSlug, tableNumber, reason, notes, req } = params;

  const brand = await prisma.brand.findUnique({
    where: { slug: brandSlug },
    select: { id: true, name: true },
  });

  if (!brand) throw new Error('Marca no encontrada');

  const table = await prisma.table.findFirst({
    where: {
      number: String(tableNumber),
      brandId: brand.id,
    },
    include: {
      assignedWaiter: true,
      orders: {
        where: { status: { in: ['RECEIVED', 'PREPARING', 'READY'] } },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!table) throw new Error('Mesa no encontrada');

  const reasonLabels: Record<string, string> = {
    CALL_WAITER: '🔔 Comensal solicita asistencia del mesero',
    BILL_REQUESTED: '🧾 Comensal solicita la cuenta impresa / terminal',
    SERVICE_HELP: '🧊 Comensal solicita servilletas, cubiertos o hielo',
  };

  const label = reasonLabels[reason] || 'Asistencia solicitada';
  const fullNotes = notes ? `${label}: ${notes}` : label;
  const now = new Date();

  const updatedTable = await prisma.table.update({
    where: { id: table.id },
    data: {
      waiterCallStatus: reason,
      waiterCallNotes: fullNotes,
      waiterCallAt: now,
      status: reason === 'BILL_REQUESTED' ? 'BILL_REQUESTED' : table.status,
    },
  });

  // Emit SSE to /waiter
  orderEvents.emit('order_updated', {
    id: table.orders[0]?.id || `tbl_${table.id}`,
    orderNumber: table.orders[0]?.orderNumber || `MESA-${table.number}`,
    brandId: brand.id,
    tableNumber: table.number,
    action: 'WAITER_CALLED',
    reason: fullNotes,
    timestamp: now.toISOString(),
  });

  await recordAuditLog({
    brandId: brand.id,
    action: 'WAITER_CALL_REQUESTED_FROM_QR',
    entityType: 'Table',
    entityId: table.id,
    details: {
      tableNumber: table.number,
      reason,
      notes: fullNotes,
    },
    req,
  });

  return {
    success: true,
    table: updatedTable,
    message: label,
  };
}

/**
 * Dismisses a waiter call on a table (called from /waiter)
 */
export async function dismissWaiterCall(tableId: string) {
  const updated = await prisma.table.update({
    where: { id: tableId },
    data: {
      waiterCallStatus: 'IDLE',
      waiterCallNotes: null,
      waiterCallAt: null,
    },
  });

  return updated;
}


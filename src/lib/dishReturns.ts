export const RETURN_REASONS: Record<string, { label: string; defaultAttribution: 'KITCHEN' | 'SERVICE_WAITER' | 'CUSTOMER_PREFERENCE' | 'UNKNOWN' }> = {
  UNDERCOOKED_OVERCOOKED: { label: 'Término / Cocción Incorrecta', defaultAttribution: 'KITCHEN' },
  COLD_FOOD: { label: 'Platillo Frío / Temperatura Inadecuada', defaultAttribution: 'KITCHEN' },
  WRONG_ITEM_ORDERED: { label: 'Error del Mesero al Capturar Comanda', defaultAttribution: 'SERVICE_WAITER' },
  WRONG_ITEM_DELIVERED: { label: 'Error al Entregar en Mesa Equivocada', defaultAttribution: 'SERVICE_WAITER' },
  ALLERGEN_MODIFIER_ERROR: { label: 'Omisión de Modificador / Alérgeno', defaultAttribution: 'KITCHEN' },
  FOREIGN_OBJECT: { label: 'Presencia de Objeto Extraño / Físico', defaultAttribution: 'KITCHEN' },
  EXCESSIVE_DELAY: { label: 'Demora Excesiva en Servicio', defaultAttribution: 'KITCHEN' },
  CUSTOMER_CHANGED_MIND: { label: 'Cambio de Opinión del Comensal', defaultAttribution: 'CUSTOMER_PREFERENCE' },
  SPOILED_OFF_TASTE: { label: 'Sabor Anómalo / Calidad Sensorial', defaultAttribution: 'KITCHEN' },
  OTHER: { label: 'Otro Motivo', defaultAttribution: 'UNKNOWN' },
};

export const ATTRIBUTIONS: Record<string, { label: string; color: string }> = {
  KITCHEN: { label: 'Cocina / Preparación', color: 'text-rose-400 bg-rose-500/10 border-rose-500/30' },
  SERVICE_WAITER: { label: 'Servicio / Mesero', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  CUSTOMER_PREFERENCE: { label: 'Preferencia Comensal', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
  UNKNOWN: { label: 'No Determinado', color: 'text-slate-400 bg-slate-500/10 border-slate-500/30' },
};

export const RESOLUTIONS: Record<string, string> = {
  RECOOK: 'Rehacer Urgente en Cocina (Prioridad KDS)',
  REMOVE_FROM_BILL: 'Retirar Platillo de la Cuenta (Sin Cobro)',
  DISCOUNT_APPLIED: 'Descuento Parcial en la Cuenta',
  COMPLIMENTARY_RECOVERY: 'Cortesía de Recuperación (Bebida/Postre/Saldo)',
  REPLACE_WITH_DIFFERENT_ITEM: 'Sustituir por Otro Platillo del Menú',
  NO_ACTION: 'Sin Acción Financiera',
};

export interface ReturnMetrics {
  totalReturns: number;
  totalReturnedSalesValue: number;
  totalEstimatedWasteCost: number;
  kitchenAttributedCount: number;
  waiterAttributedCount: number;
  customerAttributedCount: number;
  recookCount: number;
  voidedFromBillCount: number;
  topReasons: Array<{ reason: string; label: string; count: number; percentage: number }>;
  topReturnedDishes: Array<{ productName: string; count: number; value: number }>;
}

/**
 * Calculates aggregated dish return metrics and root-cause analytics
 */
export function calculateReturnMetrics(
  returns: Array<{
    productName: string;
    returnReason: string;
    attribution: string;
    resolution: string;
    price: number;
    estimatedFoodCost?: number | null;
    quantity: number;
  }>
): ReturnMetrics {
  const totalReturns = returns.reduce((sum, r) => sum + (r.quantity || 1), 0);
  const totalReturnedSalesValue = returns.reduce((sum, r) => sum + (r.price * (r.quantity || 1)), 0);
  const totalEstimatedWasteCost = returns.reduce((sum, r) => sum + ((r.estimatedFoodCost || 0) * (r.quantity || 1)), 0);

  let kitchenAttributedCount = 0;
  let waiterAttributedCount = 0;
  let customerAttributedCount = 0;
  let recookCount = 0;
  let voidedFromBillCount = 0;

  const reasonMap: Record<string, number> = {};
  const dishMap: Record<string, { count: number; value: number }> = {};

  for (const r of returns) {
    const qty = r.quantity || 1;
    if (r.attribution === 'KITCHEN') kitchenAttributedCount += qty;
    else if (r.attribution === 'SERVICE_WAITER') waiterAttributedCount += qty;
    else if (r.attribution === 'CUSTOMER_PREFERENCE') customerAttributedCount += qty;

    if (r.resolution === 'RECOOK') recookCount += qty;
    else if (r.resolution === 'REMOVE_FROM_BILL') voidedFromBillCount += qty;

    reasonMap[r.returnReason] = (reasonMap[r.returnReason] || 0) + qty;

    if (!dishMap[r.productName]) {
      dishMap[r.productName] = { count: 0, value: 0 };
    }
    dishMap[r.productName].count += qty;
    dishMap[r.productName].value += r.price * qty;
  }

  const topReasons = Object.entries(reasonMap)
    .map(([reason, count]) => ({
      reason,
      label: RETURN_REASONS[reason]?.label || reason,
      count,
      percentage: totalReturns > 0 ? Math.round((count / totalReturns) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const topReturnedDishes = Object.entries(dishMap)
    .map(([productName, data]) => ({
      productName,
      count: data.count,
      value: Math.round(data.value * 100) / 100,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalReturns,
    totalReturnedSalesValue: Math.round(totalReturnedSalesValue * 100) / 100,
    totalEstimatedWasteCost: Math.round(totalEstimatedWasteCost * 100) / 100,
    kitchenAttributedCount,
    waiterAttributedCount,
    customerAttributedCount,
    recookCount,
    voidedFromBillCount,
    topReasons,
    topReturnedDishes,
  };
}

/**
 * Generates an 80mm ESC/POS ASCII formatted Dish Return & Service Recovery Ticket
 */
export function generateDishReturnTicket(params: {
  brandName?: string;
  orderNumber: string;
  tableNumber?: string | null;
  productName: string;
  quantity: number;
  price: number;
  estimatedFoodCost?: number | null;
  returnReason: string;
  attribution: string;
  resolution: string;
  guestCompType?: string | null;
  guestCompAmount?: number | null;
  waiterName?: string | null;
  supervisorName?: string | null;
  notes?: string | null;
  createdAt?: Date | string;
}): string {
  const pad = (str: string, len: number, fill = ' ') => {
    return str.length >= len ? str.slice(0, len) : str + fill.repeat(len - str.length);
  };
  const center = (str: string, len: number) => {
    if (str.length >= len) return str;
    const left = Math.floor((len - str.length) / 2);
    const right = len - str.length - left;
    return ' '.repeat(left) + str + ' '.repeat(right);
  };

  const line = '='.repeat(42);
  const dash = '-'.repeat(42);
  const dateStr = new Date(params.createdAt || new Date()).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });

  const reasonLabel = RETURN_REASONS[params.returnReason]?.label || params.returnReason;
  const attributionLabel = ATTRIBUTIONS[params.attribution]?.label || params.attribution;
  const resolutionLabel = RESOLUTIONS[params.resolution] || params.resolution;

  return [
    line,
    center(params.brandName ? params.brandName.toUpperCase() : 'DARKFLOW ENTERPRISE', 42),
    center('VALE DE DEVOLUCIÓN DE PLATILLO', 42),
    center('AUDITORÍA DE SERVICIO & MERMA DE SALÓN', 42),
    line,
    `Fecha / Hora  : ${dateStr}`,
    `Comanda / Mesa: #${params.orderNumber} ${params.tableNumber ? `(Mesa ${params.tableNumber})` : '(Para Llevar)'}`,
    `Mesero        : ${params.waiterName || 'Sin asignar'}`,
    `Autorizó      : ${params.supervisorName || 'Gerente en Turno'}`,
    dash,
    center('DATOS DEL PLATILLO DEVUELTO', 42),
    dash,
    `Platillo      : ${params.productName}`,
    `Cantidad      : ${params.quantity} unidad(es)`,
    `Precio Venta  : $${(params.price * params.quantity).toFixed(2)} MXN`,
    params.estimatedFoodCost ? `Costo Merma   : $${(params.estimatedFoodCost * params.quantity).toFixed(2)} MXN (Food Cost)` : '',
    dash,
    center('DIAGNÓSTICO Y CAUSA RAÍZ', 42),
    dash,
    `Motivo        : ${reasonLabel}`,
    `Atribución    : ${attributionLabel}`,
    params.notes ? `Detalles      : ${params.notes}` : '',
    dash,
    center('RESOLUCIÓN Y RECUPERACIÓN', 42),
    dash,
    `Acción        : ${resolutionLabel}`,
    params.guestCompType && params.guestCompType !== 'NONE'
      ? `Compensación  : ${params.guestCompType} (${params.guestCompAmount ? `$${params.guestCompAmount.toFixed(2)}` : 'Concedido'})`
      : '',
    line,
    params.resolution === 'RECOOK'
      ? center('*** PRIORIDAD DE REPROCESO EN COCINA (RECOOK) ***', 42)
      : center('PLATILLO CANCELADO DE LA CUENTA DEL CLIENTE', 42),
    line,
  ]
    .filter(Boolean)
    .join('\n');
}

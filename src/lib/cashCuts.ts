export interface DenominationItem {
  key: string;
  label: string;
  value: number;
  type: 'BILL' | 'COIN';
}

export const CASH_DENOMINATIONS: DenominationItem[] = [
  { key: 'b1000', label: '$1,000', value: 1000, type: 'BILL' },
  { key: 'b500', label: '$500', value: 500, type: 'BILL' },
  { key: 'b200', label: '$200', value: 200, type: 'BILL' },
  { key: 'b100', label: '$100', value: 100, type: 'BILL' },
  { key: 'b50', label: '$50', value: 50, type: 'BILL' },
  { key: 'b20', label: '$20', value: 20, type: 'BILL' },
  { key: 'c20', label: '$20 Moneda', value: 20, type: 'COIN' },
  { key: 'c10', label: '$10', value: 10, type: 'COIN' },
  { key: 'c5', label: '$5', value: 5, type: 'COIN' },
  { key: 'c2', label: '$2', value: 2, type: 'COIN' },
  { key: 'c1', label: '$1', value: 1, type: 'COIN' },
  { key: 'c05', label: '$0.50', value: 0.5, type: 'COIN' },
];

export type DenominationsMap = Record<string, number>;

export function calculateDenominationsTotal(denominations: DenominationsMap): number {
  let total = 0;
  for (const item of CASH_DENOMINATIONS) {
    const qty = denominations[item.key] || 0;
    if (qty > 0) {
      total += qty * item.value;
    }
  }
  return parseFloat(total.toFixed(2));
}

export interface CutSummaryData {
  cutType: 'CORTE_X' | 'CORTE_Z';
  cutNumber: string;
  consecutive: number;
  brandName: string;
  brandRfc?: string | null;
  brandAddress?: string | null;
  branchName?: string | null;
  openedAt: string | Date;
  cutAt: string | Date;
  cashierName: string;
  openingBalance: number;
  cashSales: number;
  cardSales: number;
  appsSales: number;
  giftCardSales: number;
  transfersSales: number;
  totalSales: number;
  cashInTotal: number;
  cashOutTotal: number;
  expectedCash: number;
  declaredCash: number;
  cashDifference: number; // declared - expected
  declaredCard?: number;
  declaredOther?: number;
  totalDeclared: number;
  totalDifference: number;
  ordersCount: number;
  discountsTotal: number;
  canceledOrdersCount: number;
  canceledAmount: number;
  tipsTotal: number;
  tipsCash: number;
  tipsCard: number;
  denominations?: DenominationsMap | null;
  notes?: string | null;
}

export function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function generateCutTicketText(data: CutSummaryData): string {
  const line = '------------------------------------------';
  const doubleLine = '==========================================';
  const isZ = data.cutType === 'CORTE_Z';
  const title = isZ ? '*** CORTE Z - CIERRE DEFINITIVO ***' : '*** CORTE X - ARQUEO INFORMATIVO ***';
  const subtitle = isZ ? `FOLIO FISCAL: ${data.cutNumber}` : `FOLIO: ${data.cutNumber} (NO CIERRA TURNO)`;

  const openDateStr = new Date(data.openedAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
  const cutDateStr = new Date(data.cutAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });

  const pad = (left: string, right: string, width = 42) => {
    const space = Math.max(1, width - left.length - right.length);
    return left + ' '.repeat(space) + right;
  };

  const center = (text: string, width = 42) => {
    const leftPad = Math.max(0, Math.floor((width - text.length) / 2));
    return ' '.repeat(leftPad) + text;
  };

  const lines: string[] = [
    doubleLine,
    center(data.brandName.toUpperCase()),
    ...(data.brandRfc ? [center(`RFC: ${data.brandRfc}`)] : []),
    ...(data.brandAddress ? [center(data.brandAddress)] : []),
    line,
    center(title),
    center(subtitle),
    line,
    pad('Cajero en Turno:', data.cashierName),
    pad('Fecha Apertura:', openDateStr),
    pad('Fecha de Corte:', cutDateStr),
    line,
    center('[ RESUMEN DE VENTAS DEL TURNO ]'),
    pad('Ventas en Efectivo:', formatCurrency(data.cashSales)),
    pad('Ventas Tarjeta / POS:', formatCurrency(data.cardSales)),
    pad('Ventas Monedero / Gift:', formatCurrency(data.giftCardSales)),
    pad('Ventas Plataformas Delivery:', formatCurrency(data.appsSales)),
    ...(data.transfersSales > 0 ? [pad('Ventas Transferencias:', formatCurrency(data.transfersSales))] : []),
    pad('TOTAL VENTAS:', formatCurrency(data.totalSales)),
    line,
    center('[ FLUJO DE EFECTIVO EN GAVETA ]'),
    pad('(+) Fondo Inicial:', formatCurrency(data.openingBalance)),
    pad('(+) Ventas Efectivo:', formatCurrency(data.cashSales)),
    pad('(+) Entradas de Cambio:', formatCurrency(data.cashInTotal)),
    pad('(-) Sangrías / Retiros:', `-${formatCurrency(data.cashOutTotal)}`),
    line,
    pad('(=) EFECTIVO ESPERADO:', formatCurrency(data.expectedCash)),
    pad('(=) EFECTIVO DECLARADO:', formatCurrency(data.declaredCash)),
    line,
  ];

  // Diferencia
  const diff = data.cashDifference;
  let diffLabel = 'EXACTO (CUADRADO)';
  if (diff > 0.05) diffLabel = `SOBRANTE (+${formatCurrency(diff)})`;
  else if (diff < -0.05) diffLabel = `FALTANTE (-${formatCurrency(Math.abs(diff))})`;

  lines.push(
    pad('DIFERENCIA EFECTIVO:', diffLabel),
    line,
    center('[ CONTROL DE PROPINAS ]'),
    pad('Propinas Efectivo:', formatCurrency(data.tipsCash)),
    pad('Propinas Tarjeta:', formatCurrency(data.tipsCard)),
    pad('TOTAL PROPINAS:', formatCurrency(data.tipsTotal)),
    line,
    center('[ MÉTRICAS OPERATIVAS ]'),
    pad('Tickets / Órdenes Cobradas:', String(data.ordersCount)),
    pad('Descuentos y Cortesías:', formatCurrency(data.discountsTotal)),
    pad('Órdenes Canceladas:', `${data.canceledOrdersCount} (${formatCurrency(data.canceledAmount)})`),
    line
  );

  // Desglose de denominaciones si existe
  if (data.denominations && Object.keys(data.denominations).length > 0) {
    lines.push(center('[ ARQUEO CIEGO: DESGLOSE ]'));
    for (const item of CASH_DENOMINATIONS) {
      const qty = data.denominations[item.key] || 0;
      if (qty > 0) {
        const sub = qty * item.value;
        lines.push(pad(`  ${qty}x ${item.label}`, formatCurrency(sub)));
      }
    }
    lines.push(line);
  }

  if (data.notes) {
    lines.push(`NOTAS: ${data.notes}`, line);
  }

  lines.push(
    '',
    center('________________________________'),
    center('FIRMA DEL CAJERO'),
    '',
    center('________________________________'),
    center('FIRMA SUPERVISOR / GERENCIA'),
    '',
    doubleLine,
    isZ ? center('*** FIN DE CORTE Z OFICIAL ***') : center('*** FIN DE CORTE X INFORMATIVO ***'),
    doubleLine
  );

  return lines.join('\n');
}

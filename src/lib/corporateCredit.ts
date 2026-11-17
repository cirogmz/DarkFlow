/**
 * DarkFlow Manager - Motor de Crédito Corporativo B2B y Cuentas por Cobrar (AR)
 * Gestiona líneas de crédito para empresas, validación de saldos, generación de pagarés/vouchers
 * y estados de cuenta periódicos con desglose mercantil.
 */

export interface CreditValidationResult {
  allowed: boolean;
  reason?: string;
  availableCredit: number;
  currentBalance: number;
  creditLimit: number;
}

/**
 * Valida si una cuenta corporativa tiene saldo disponible y estatus activo para autorizar un consumo.
 */
export function validateCreditAvailability(
  account: {
    creditLimit: number;
    currentBalance: number;
    status: string;
  },
  chargeAmount: number
): CreditValidationResult {
  const currentBalance = Math.round((account.currentBalance || 0) * 100) / 100;
  const creditLimit = Math.round((account.creditLimit || 0) * 100) / 100;
  const availableCredit = Math.max(0, Math.round((creditLimit - currentBalance) * 100) / 100);

  if (account.status !== 'ACTIVE') {
    let reason = 'La cuenta corporativa se encuentra inactiva.';
    if (account.status === 'SUSPENDED') {
      reason = 'La cuenta corporativa está suspendida temporalmente por administración.';
    } else if (account.status === 'OVER_LIMIT') {
      reason = 'La cuenta corporativa tiene el crédito congelado por rebasar su límite.';
    } else if (account.status === 'CLOSED') {
      reason = 'La cuenta corporativa se encuentra cerrada definitivamente.';
    }
    return {
      allowed: false,
      reason,
      availableCredit,
      currentBalance,
      creditLimit,
    };
  }

  if (chargeAmount <= 0) {
    return {
      allowed: false,
      reason: 'El monto del cargo debe ser mayor a $0.00 MXN.',
      availableCredit,
      currentBalance,
      creditLimit,
    };
  }

  if (chargeAmount > availableCredit) {
    return {
      allowed: false,
      reason: `Crédito insuficiente. Disponible: $${availableCredit.toFixed(2)} MXN, Monto solicitado: $${chargeAmount.toFixed(2)} MXN.`,
      availableCredit,
      currentBalance,
      creditLimit,
    };
  }

  return {
    allowed: true,
    availableCredit,
    currentBalance,
    creditLimit,
  };
}

/**
 * Genera folio correlativo único para Pagaré / Vale de Crédito
 */
export function generateVoucherFolio(counter?: number): string {
  const year = new Date().getFullYear();
  if (counter !== undefined) {
    return `VOU-${year}-${counter.toString().padStart(5, '0')}`;
  }
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const timeSuffix = Date.now().toString().slice(-4);
  return `VOU-${year}-${timeSuffix}${randomSuffix}`;
}

/**
 * Genera folio correlativo único para Recibo de Pago / Abono
 */
export function generateReceiptFolio(counter?: number): string {
  const year = new Date().getFullYear();
  if (counter !== undefined) {
    return `REC-${year}-${counter.toString().padStart(5, '0')}`;
  }
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const timeSuffix = Date.now().toString().slice(-4);
  return `REC-${year}-${timeSuffix}${randomSuffix}`;
}

/**
 * Genera folio correlativo único para Estado de Cuenta (EDC)
 */
export function generateStatementFolio(accountNumber: string, counter?: number): string {
  const year = new Date().getFullYear();
  const cleanAcc = accountNumber.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase();
  if (counter !== undefined) {
    return `EDC-${cleanAcc}-${year}-${counter.toString().padStart(4, '0')}`;
  }
  const timeSuffix = Date.now().toString().slice(-4);
  return `EDC-${cleanAcc}-${year}-${timeSuffix}`;
}

/**
 * Genera comprobante térmico ESC/POS de 80mm para Pagaré / Vale de Crédito firmado
 */
export function generateVoucherThermalTicket(params: {
  brandName: string;
  orderNumber: string;
  voucher: {
    voucherFolio: string;
    amount: number;
    signedByName: string;
    employeeId?: string | null;
    department?: string | null;
    createdAt?: Date | string;
    notes?: string | null;
  };
  account: {
    accountNumber: string;
    companyName: string;
    rfc?: string | null;
    contactPhone?: string | null;
    creditLimit: number;
    currentBalance: number;
  };
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    total: number;
  }>;
}): string {
  const { brandName, orderNumber, voucher, account, items } = params;
  const dateStr = voucher.createdAt
    ? new Date(voucher.createdAt).toLocaleString('es-MX', { hour12: false })
    : new Date().toLocaleString('es-MX', { hour12: false });

  const availableAfter = Math.max(0, account.creditLimit - account.currentBalance);

  let ticket = `
================================================
          PAGARÉ / VALE DE CONSUMO
            ${brandName.toUpperCase()}
================================================
FOLIO VALE:    ${voucher.voucherFolio}
ORDEN / TICKET: #${orderNumber}
FECHA / HORA:  ${dateStr}
------------------------------------------------
DATOS DE LA CUENTA CORPORATIVA:
CUENTA:        [${account.accountNumber}]
EMPRESA:       ${account.companyName}
RFC:           ${account.rfc || 'XEXX010101000'}
------------------------------------------------
DATOS DEL CONSUMIDOR / AUTORIZADO:
FIRMA POR:     ${voucher.signedByName.toUpperCase()}
NO. NÓMINA:    ${voucher.employeeId || 'N/A'}
DEPTO / C.C.:  ${voucher.department || 'GENERAL'}
${voucher.notes ? `NOTAS:         ${voucher.notes}\n` : ''}------------------------------------------------
DETALLE DEL CONSUMO:
CANT.  CONCEPTO                     IMPORTE
------------------------------------------------
`;

  items.forEach((item) => {
    const qty = `${item.quantity}x`.padEnd(6, ' ');
    const name = item.name.length > 25 ? item.name.substring(0, 22) + '...' : item.name.padEnd(25, ' ');
    const amt = `$${item.total.toFixed(2)}`.padStart(12, ' ');
    ticket += `${qty} ${name} ${amt}\n`;
  });

  ticket += `------------------------------------------------
TOTAL A CARGO DEL PAGARÉ:       $${voucher.amount.toFixed(2)} MXN
================================================
ESTADO DE LA LÍNEA DE CRÉDITO:
• Límite Autorizado:           $${account.creditLimit.toFixed(2)} MXN
• Saldo Deudor Actual:         $${account.currentBalance.toFixed(2)} MXN
• Crédito Disponible:          $${availableAfter.toFixed(2)} MXN
================================================

            PAGARÉ MERCANTIL
"Debo(emos) y pagaré(mos) incondicionalmente a la
orden de ${brandName.toUpperCase()} en esta plaza o en
cualquier otra que se me requiera, la cantidad de
$${voucher.amount.toFixed(2)} MXN recibida a mi entera satisfacción
en bienes y consumos de alimentos y bebidas.
El importe de este pagaré formará parte del
estado de cuenta de ${account.companyName}."


________________________________________________
       FIRMA DE CONFORMIDAD Y ACEPTACIÓN
      ${voucher.signedByName.toUpperCase()}
       ID / GAFETE: ${voucher.employeeId || 'VERIFICADO'}

================================================
      CONSERVE ESTE COMPROBANTE PARA
        SU REVISIÓN Y CONCILIACIÓN
================================================
\n\n\n`;

  return ticket;
}

/**
 * Genera texto oficial formateado para Estado de Cuenta Corporativo (EDC)
 */
export function generateStatementReportText(params: {
  brandName: string;
  account: {
    accountNumber: string;
    companyName: string;
    tradeName?: string | null;
    rfc?: string | null;
    billingAddress?: string | null;
    contactName: string;
    contactPhone: string;
    creditLimit: number;
    paymentTermsDays: number;
  };
  statement: {
    statementFolio: string;
    periodStart: Date | string;
    periodEnd: Date | string;
    previousBalance: number;
    chargesAmount: number;
    paymentsAmount: number;
    closingBalance: number;
    dueDate: Date | string;
    status: string;
  };
  vouchers: Array<{
    voucherFolio: string;
    amount: number;
    signedByName: string;
    employeeId?: string | null;
    department?: string | null;
    createdAt: Date | string;
    orderNumber?: string | null;
  }>;
  payments: Array<{
    receiptFolio: string;
    amount: number;
    paymentMethod: string;
    bankReference?: string | null;
    createdAt: Date | string;
  }>;
  bankDetails?: {
    bankName?: string;
    clabe?: string;
    beneficiary?: string;
  };
}): string {
  const { brandName, account, statement, vouchers, payments, bankDetails } = params;

  const startStr = new Date(statement.periodStart).toLocaleDateString('es-MX');
  const endStr = new Date(statement.periodEnd).toLocaleDateString('es-MX');
  const dueStr = new Date(statement.dueDate).toLocaleDateString('es-MX');

  let report = `
================================================================================
                    ESTADO DE CUENTA CORPORATIVO
                    ${brandName.toUpperCase()}
================================================================================
FOLIO EDC:          ${statement.statementFolio}
PERIODO:            ${startStr} AL ${endStr}
FECHA LÍMITE PAGO:  ${dueStr} (${account.paymentTermsDays} DÍAS DE PLAZO)
ESTATUS:            ${statement.status}
--------------------------------------------------------------------------------
DATOS DEL CLIENTE / TITULAR:
CUENTA:             [${account.accountNumber}] ${account.tradeName || account.companyName}
RAZÓN SOCIAL:       ${account.companyName}
RFC:                ${account.rfc || 'XEXX010101000'}
DIRECCIÓN FISCAL:   ${account.billingAddress || 'No especificada'}
ATENCIÓN A:         ${account.contactName} (${account.contactPhone})
LÍMITE DE CRÉDITO:  $${account.creditLimit.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN
--------------------------------------------------------------------------------
RESUMEN DEL PERIODO:
(+) Saldo Anterior / Arrastre:          $${statement.previousBalance.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN
(+) Consumos del Periodo (${vouchers.length} vales):     $${statement.chargesAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN
(-) Pagos y Abonos Aplicados (${payments.length}):       $${statement.paymentsAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN
--------------------------------------------------------------------------------
(=) SALDO TOTAL AL CORTE:               $${statement.closingBalance.toLocaleString('es-MX', { minimumFractionDigits: 2 })} MXN
================================================================================

DETALLE DE VALES / CONSUMOS DEL PERIODO:
FECHA        FOLIO VALE      ORDEN     CONSUMIDOR / DEPTO             IMPORTE
--------------------------------------------------------------------------------
`;

  if (vouchers.length === 0) {
    report += `  (No se registraron consumos en el periodo seleccionado)\n`;
  } else {
    vouchers.forEach((v) => {
      const d = new Date(v.createdAt).toLocaleDateString('es-MX');
      const fol = v.voucherFolio.padEnd(15, ' ');
      const ord = (v.orderNumber ? `#${v.orderNumber}` : '-').padEnd(9, ' ');
      const consumer = `${v.signedByName} (${v.department || 'GRAL'})`.slice(0, 30).padEnd(30, ' ');
      const amt = `$${v.amount.toFixed(2)} MXN`.padStart(14, ' ');
      report += `${d}   ${fol} ${ord} ${consumer} ${amt}\n`;
    });
  }

  report += `\n--------------------------------------------------------------------------------
DETALLE DE PAGOS Y ABONOS REGISTRADOS:
FECHA        FOLIO RECIBO    MÉTODO    REFERENCIA                     IMPORTE
--------------------------------------------------------------------------------
`;

  if (payments.length === 0) {
    report += `  (No se registraron abonos en el periodo seleccionado)\n`;
  } else {
    payments.forEach((p) => {
      const d = new Date(p.createdAt).toLocaleDateString('es-MX');
      const rec = p.receiptFolio.padEnd(15, ' ');
      const met = p.paymentMethod.padEnd(9, ' ');
      const ref = (p.bankReference || 'TRANSFERENCIA').slice(0, 30).padEnd(30, ' ');
      const amt = `$${p.amount.toFixed(2)} MXN`.padStart(14, ' ');
      report += `${d}   ${rec} ${met} ${ref} ${amt}\n`;
    });
  }

  report += `\n================================================================================
INSTRUCCIONES DE PAGO / TRANSFERENCIA SPEI:
BANCO:              ${bankDetails?.bankName || 'BBVA MÉXICO'}
CLABE INTERBANCARIA:${bankDetails?.clabe || '012180001234567890'}
BENEFICIARIO:       ${bankDetails?.beneficiary || brandName}
CONCEPTO / MOTIVO:  ${statement.statementFolio} / ${account.accountNumber}
--------------------------------------------------------------------------------
FAVOR DE ENVIAR SU COMPROBANTE DE PAGO PARA LA APLICACIÓN INMEDIATA DE SU ABONO.
================================================================================\n`;

  return report;
}

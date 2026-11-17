import { PrismaClient } from '@prisma/client';
import { 
  generateCfdi40, 
  RFC_GENERICO_NACIONAL, 
  ConceptoFiscal, 
  InformacionGlobal 
} from './cfdi';
import { recordAuditLog } from './audit';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();

export interface GlobalInvoiceSchedulerResult {
  brandId: string;
  brandName: string;
  status: 'SUCCESS' | 'NO_TICKETS' | 'FAILED' | 'SKIPPED';
  folio?: string;
  uuid?: string;
  ordersCount: number;
  subtotal: number;
  tax: number;
  total: number;
  error?: string;
  executedAt: Date;
}

export interface UnbilledTicketsSummary {
  count: number;
  subtotal: number;
  tax: number;
  total: number;
  minDate: Date | null;
  maxDate: Date | null;
}

/**
 * Calcula el resumen de tickets cerrados sin facturar disponibles para consolidación global
 */
export async function getUnbilledTicketsSummary(brandId: string, startDate?: Date, endDate?: Date): Promise<UnbilledTicketsSummary> {
  const dateFilter: Record<string, unknown> = {};
  if (startDate) dateFilter.gte = startDate;
  if (endDate) dateFilter.lte = endDate;

  const eligibleOrders = await prisma.order.findMany({
    where: {
      brandId,
      status: { not: 'CANCELLED' },
      invoiceId: null,
      globalInvoiceId: null,
      isComped: false,
      OR: [
        { paymentStatus: 'PAID' },
        { status: 'DELIVERED' },
        { status: 'COMPLETED' },
      ],
      ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
    },
    select: {
      id: true,
      subtotal: true,
      tax: true,
      total: true,
      createdAt: true,
    },
  });

  if (eligibleOrders.length === 0) {
    return {
      count: 0,
      subtotal: 0,
      tax: 0,
      total: 0,
      minDate: null,
      maxDate: null,
    };
  }

  const times = eligibleOrders.map((o) => o.createdAt.getTime());
  const subtotal = eligibleOrders.reduce((sum, o) => sum + (o.subtotal || 0), 0);
  const tax = eligibleOrders.reduce((sum, o) => sum + (o.tax || 0), 0);
  const total = eligibleOrders.reduce((sum, o) => sum + (o.total || 0), 0);

  return {
    count: eligibleOrders.length,
    subtotal: Math.round(subtotal * 100) / 100,
    tax: Math.round(tax * 100) / 100,
    total: Math.round(total * 100) / 100,
    minDate: new Date(Math.min(...times)),
    maxDate: new Date(Math.max(...times)),
  };
}

/**
 * Motor central de ejecución del timbrado global programado / automatizado
 */
export async function executeAutomatedGlobalInvoicing(options?: {
  brandId?: string;
  force?: boolean;
  userId?: string;
  req?: any;
}): Promise<{
  success: boolean;
  executedCount: number;
  results: GlobalInvoiceSchedulerResult[];
}> {
  const { brandId, force = false, userId, req } = options || {};

  // 1. Buscar marcas elegibles
  const whereBrand: Record<string, unknown> = {};
  if (brandId) {
    whereBrand.id = brandId;
  } else {
    whereBrand.autoGlobalInvoiceEnabled = true;
  }

  const brands = await prisma.brand.findMany({
    where: whereBrand,
  });

  const results: GlobalInvoiceSchedulerResult[] = [];

  for (const brand of brands) {
    const executedAt = new Date();

    // Si no es ejecución forzada, validar que esté habilitado el cron en la marca
    if (!force && !brand.autoGlobalInvoiceEnabled) {
      results.push({
        brandId: brand.id,
        brandName: brand.name,
        status: 'SKIPPED',
        ordersCount: 0,
        subtotal: 0,
        tax: 0,
        total: 0,
        error: 'Facturación global automática deshabilitada',
        executedAt,
      });
      continue;
    }

    // Validar datos fiscales del emisor
    if (!brand.rfc || !brand.legalName || !brand.taxRegime || !brand.postalCode) {
      const errorMsg = 'Datos fiscales incompletos (RFC, Razón Social, Régimen Fiscal o CP faltante)';
      await prisma.brand.update({
        where: { id: brand.id },
        data: {
          lastGlobalInvoiceAt: executedAt,
          lastGlobalInvoiceStatus: 'FAILED',
          lastGlobalInvoiceError: errorMsg,
        },
      });

      results.push({
        brandId: brand.id,
        brandName: brand.name,
        status: 'FAILED',
        ordersCount: 0,
        subtotal: 0,
        tax: 0,
        total: 0,
        error: errorMsg,
        executedAt,
      });
      continue;
    }

    // 2. Determinar ventana temporal según periodicidad SAT
    const periodicity = brand.globalInvoicePeriodicity || '01'; // 01=Diario, 02=Semanal, 03=Quincenal, 04=Mensual
    const windowEnd = new Date();
    let windowStart = new Date();

    if (periodicity === '01') {
      // Diario: desde el inicio del día actual (00:00:00)
      windowStart.setHours(0, 0, 0, 0);
    } else if (periodicity === '02') {
      // Semanal: últimos 7 días
      windowStart = new Date(windowEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (periodicity === '03') {
      // Quincenal: últimos 15 días
      windowStart = new Date(windowEnd.getTime() - 15 * 24 * 60 * 60 * 1000);
    } else if (periodicity === '04') {
      // Mensual: desde el primer día del mes actual a las 00:00:00
      windowStart = new Date(windowEnd.getFullYear(), windowEnd.getMonth(), 1, 0, 0, 0);
    }

    // 3. Buscar comandas cerradas sin facturar
    const eligibleOrders = await prisma.order.findMany({
      where: {
        brandId: brand.id,
        status: { not: 'CANCELLED' },
        invoiceId: null,
        globalInvoiceId: null,
        isComped: false,
        OR: [
          { paymentStatus: 'PAID' },
          { status: 'DELIVERED' },
          { status: 'COMPLETED' },
        ],
        createdAt: {
          gte: windowStart,
          lte: windowEnd,
        },
      },
      select: {
        id: true,
        orderNumber: true,
        subtotal: true,
        tax: true,
        total: true,
        paymentMethod: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const minTickets = brand.globalInvoiceMinTickets || 1;
    if (eligibleOrders.length < minTickets) {
      await prisma.brand.update({
        where: { id: brand.id },
        data: {
          lastGlobalInvoiceAt: executedAt,
          lastGlobalInvoiceStatus: 'NO_TICKETS',
          lastGlobalInvoiceError: `Comandas acumuladas (${eligibleOrders.length}) menor al umbral mínimo requerido (${minTickets})`,
        },
      });

      results.push({
        brandId: brand.id,
        brandName: brand.name,
        status: 'NO_TICKETS',
        ordersCount: eligibleOrders.length,
        subtotal: 0,
        tax: 0,
        total: 0,
        error: `Comandas acumuladas (${eligibleOrders.length}) menor al mínimo (${minTickets})`,
        executedAt,
      });
      continue;
    }

    // 4. Calcular importes consolidados
    const subtotal = eligibleOrders.reduce((sum, o) => sum + (o.subtotal || 0), 0);
    const tax = eligibleOrders.reduce((sum, o) => sum + (o.tax || 0), 0);
    const total = eligibleOrders.reduce((sum, o) => sum + (o.total || 0), 0);

    const serie = brand.invoiceSeries || 'FAC';
    const folio = brand.invoiceNextFolio || 1;
    const currentYear = executedAt.getFullYear();
    const currentMonth = String(executedAt.getMonth() + 1).padStart(2, '0');

    // 5. Construir conceptos según Regla SAT 2.7.1.21
    const conceptos: ConceptoFiscal[] = eligibleOrders.map((o) => ({
      noIdentificacion: o.orderNumber,
      claveProdServ: '01010101',
      claveUnidad: 'ACT',
      unidad: 'Venta',
      descripcion: `Venta correspondiente al ticket ${o.orderNumber}`,
      cantidad: 1,
      valorUnitario: o.subtotal,
      importe: o.subtotal,
      baseIva: o.subtotal,
      importeIva: o.tax,
    }));

    const informacionGlobal: InformacionGlobal = {
      periodicidad: periodicity,
      meses: currentMonth,
      año: currentYear,
    };

    try {
      // 6. Timbrar CFDI 4.0 con RFC Genérico Nacional
      const timbre = generateCfdi40({
        serie,
        folio,
        emisor: {
          rfc: brand.rfc || 'XAXX010101000',
          nombre: brand.legalName || brand.name,
          regimenFiscal: brand.taxRegime || '601',
          codigoPostal: brand.postalCode || '06700',
        },
        receptor: {
          rfc: RFC_GENERICO_NACIONAL,
          nombre: 'PUBLICO EN GENERAL',
          codigoPostal: brand.postalCode || '06700',
          regimenFiscal: '616', // Sin obligaciones fiscales
          usoCfdi: 'S01',       // Sin efectos fiscales
          email: brand.notificationEmail || null,
        },
        informacionGlobal,
        conceptos,
        formaPago: '01',        // Efectivo/Consolidado genérico
        metodoPago: 'PUE',
        subtotal,
        descuento: 0,
        iva: tax,
        total,
      });

      // 7. Transacción Atómica en Base de Datos
      const fullFolio = `${serie}-${folio}`;
      const savedInvoice = await prisma.$transaction(async (tx) => {
        const inv = await tx.invoice.create({
          data: {
            uuid: timbre.uuid,
            folio,
            serie,
            brandId: brand.id,
            isGlobal: true,
            globalPeriodicity: periodicity,
            globalMonth: currentMonth,
            globalYear: currentYear,
            rfcReceptor: RFC_GENERICO_NACIONAL,
            nombreReceptor: 'PUBLICO EN GENERAL',
            regimenFiscalReceptor: '616',
            codigoPostalReceptor: brand.postalCode || '06700',
            usoCfdi: 'S01',
            subtotal,
            descuento: 0,
            iva: tax,
            total,
            formaPago: '01',
            metodoPago: 'PUE',
            selloDigital: timbre.selloDigital,
            selloSat: timbre.selloSat,
            noCertificadoSat: timbre.noCertificadoSat,
            cadenaOriginalSat: timbre.cadenaOriginalSat,
            qrSatUrl: timbre.qrSatUrl,
            xmlContent: timbre.xmlContent,
            status: 'TIMBRADO',
          },
        });

        // Vincular comandas a la factura global
        await tx.order.updateMany({
          where: { id: { in: eligibleOrders.map((o) => o.id) } },
          data: { globalInvoiceId: inv.id },
        });

        // Actualizar marca con métricas de último timbrado
        await tx.brand.update({
          where: { id: brand.id },
          data: {
            invoiceNextFolio: folio + 1,
            lastGlobalInvoiceAt: executedAt,
            lastGlobalInvoiceFolio: fullFolio,
            lastGlobalInvoiceStatus: 'SUCCESS',
            lastGlobalInvoiceError: null,
          },
        });

        return inv;
      });

      // 8. Registro en Bitácora de Auditoría
      await recordAuditLog({
        action: 'GLOBAL_INVOICE_GENERATED',
        entityType: 'ORDER',
        entityId: savedInvoice.id,
        details: {
          uuid: savedInvoice.uuid,
          folio: fullFolio,
          periodicity,
          month: currentMonth,
          year: currentYear,
          consolidatedOrdersCount: eligibleOrders.length,
          total: savedInvoice.total,
          source: 'AUTO_SCHEDULER_CRON',
        },
        severity: 'INFO',
        brandId: brand.id,
        userId: userId || undefined,
        req,
      });

      results.push({
        brandId: brand.id,
        brandName: brand.name,
        status: 'SUCCESS',
        folio: fullFolio,
        uuid: savedInvoice.uuid,
        ordersCount: eligibleOrders.length,
        subtotal: Math.round(subtotal * 100) / 100,
        tax: Math.round(tax * 100) / 100,
        total: Math.round(total * 100) / 100,
        executedAt,
      });
    } catch (stampError: any) {
      console.error(`Error timbrando factura global automática para marca ${brand.name}:`, stampError);
      const errMsg = stampError.message || 'Error en timbrado CFDI 4.0';

      await prisma.brand.update({
        where: { id: brand.id },
        data: {
          lastGlobalInvoiceAt: executedAt,
          lastGlobalInvoiceStatus: 'FAILED',
          lastGlobalInvoiceError: errMsg,
        },
      });

      results.push({
        brandId: brand.id,
        brandName: brand.name,
        status: 'FAILED',
        ordersCount: eligibleOrders.length,
        subtotal,
        tax,
        total,
        error: errMsg,
        executedAt,
      });
    }
  }

  const executedCount = results.filter((r) => r.status === 'SUCCESS').length;

  return {
    success: true,
    executedCount,
    results,
  };
}

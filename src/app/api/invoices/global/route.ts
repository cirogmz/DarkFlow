import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { recordAuditLog } from '@/lib/audit';
import { 
  generateCfdi40, 
  RFC_GENERICO_NACIONAL, 
  ConceptoFiscal, 
  InformacionGlobal 
} from '@/lib/cfdi';

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const activeBrandId = session.activeBrandId as string;
    const { searchParams } = new URL(req.url);
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    // Build date filters for eligible completed unbilled orders
    const dateFilter: Record<string, unknown> = {};
    if (startDateParam) {
      dateFilter.gte = new Date(startDateParam);
    }
    if (endDateParam) {
      const end = new Date(endDateParam);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }

    // Eligible orders for global invoicing:
    // 1. Belong to activeBrandId
    // 2. Not cancelled
    // 3. Paid or completed/delivered
    // 4. Have no individual invoice (invoiceId is null)
    // 5. Have not been included in a previous global invoice (globalInvoiceId is null)
    const eligibleOrders = await prisma.order.findMany({
      where: {
        brandId: activeBrandId,
        status: { not: 'CANCELLED' },
        invoiceId: null,
        globalInvoiceId: null,
        OR: [
          { paymentStatus: 'PAID' },
          { status: 'DELIVERED' },
          { status: 'COMPLETED' },
        ],
        ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
      },
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        total: true,
        subtotal: true,
        tax: true,
        paymentMethod: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const summary = eligibleOrders.reduce(
      (acc, o) => {
        acc.count += 1;
        acc.subtotal += o.subtotal;
        acc.tax += o.tax;
        acc.total += o.total;
        return acc;
      },
      { count: 0, subtotal: 0, tax: 0, total: 0 }
    );

    // Also fetch recent global invoices for history
    const recentGlobalInvoices = await prisma.invoice.findMany({
      where: {
        brandId: activeBrandId,
        isGlobal: true,
      },
      include: {
        _count: {
          select: { globalOrders: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({
      eligibleOrders,
      summary: {
        count: summary.count,
        subtotal: Math.round(summary.subtotal * 100) / 100,
        tax: Math.round(summary.tax * 100) / 100,
        total: Math.round(summary.total * 100) / 100,
      },
      recentGlobalInvoices,
    });
  } catch (error: unknown) {
    console.error('Error fetching global invoice preview:', error);
    return NextResponse.json({ error: 'Error al consultar comandas para factura global' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const activeBrandId = session.activeBrandId as string;
    const body = await req.json();

    const {
      periodicity = '01', // 01=Diario, 02=Semanal, 03=Quincenal, 04=Mensual
      month,              // 01 a 12
      year = new Date().getFullYear(),
      orderIds,           // Optional list of specific order IDs
      startDate,
      endDate,
    } = body;

    if (!month) {
      return NextResponse.json({ error: 'El mes de la factura global es obligatorio (01 a 12)' }, { status: 400 });
    }

    const brand = await prisma.brand.findUnique({
      where: { id: activeBrandId },
    });

    if (!brand) {
      return NextResponse.json({ error: 'Marca no encontrada' }, { status: 404 });
    }

    if (!brand.rfc || !brand.legalName || !brand.taxRegime || !brand.postalCode) {
      return NextResponse.json(
        { error: 'La marca no tiene configurados sus datos fiscales de emisor (RFC, Razón Social, Régimen, CP)' },
        { status: 400 }
      );
    }

    // Build query for orders to consolidate
    const whereClause: Record<string, unknown> = {
      brandId: activeBrandId,
      status: { not: 'CANCELLED' },
      invoiceId: null,
      globalInvoiceId: null,
      OR: [
        { paymentStatus: 'PAID' },
        { status: 'DELIVERED' },
        { status: 'COMPLETED' },
      ],
    };

    if (Array.isArray(orderIds) && orderIds.length > 0) {
      whereClause.id = { in: orderIds };
    } else if (startDate || endDate) {
      const dateFilter: Record<string, unknown> = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.lte = end;
      }
      whereClause.createdAt = dateFilter;
    }

    const ordersToConsolidate = await prisma.order.findMany({
      where: whereClause,
      select: {
        id: true,
        orderNumber: true,
        total: true,
        subtotal: true,
        tax: true,
        paymentMethod: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (ordersToConsolidate.length === 0) {
      return NextResponse.json({ error: 'No hay comandas pendientes de facturar en el periodo seleccionado' }, { status: 400 });
    }

    // Calculate aggregated financials
    const subtotal = ordersToConsolidate.reduce((sum, o) => sum + o.subtotal, 0);
    const iva = ordersToConsolidate.reduce((sum, o) => sum + o.tax, 0);
    const total = ordersToConsolidate.reduce((sum, o) => sum + o.total, 0);

    const serie = brand.invoiceSeries || 'FAC';
    const folio = brand.invoiceNextFolio || 1;

    // SAT Rule 2.7.1.21 for Global Invoice:
    // Conceptos: one line per ticket, ClaveProdServ "01010101", ClaveUnidad "ACT", Descripcion "Venta"
    const conceptos: ConceptoFiscal[] = ordersToConsolidate.map((o) => ({
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
      meses: String(month).padStart(2, '0'),
      año: Number(year),
    };

    // Stamping with generic Mexican RFC XAXX010101000
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
        email: null,
      },
      informacionGlobal,
      conceptos,
      formaPago: '01',        // Default SAT global cash/blended
      metodoPago: 'PUE',
      subtotal,
      descuento: 0,
      iva,
      total,
    });

    // Execute atomic transaction to save global invoice and link orders
    const globalInvoice = await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.create({
        data: {
          uuid: timbre.uuid,
          folio,
          serie,
          brandId: activeBrandId,
          isGlobal: true,
          globalPeriodicity: periodicity,
          globalMonth: String(month).padStart(2, '0'),
          globalYear: Number(year),
          rfcReceptor: RFC_GENERICO_NACIONAL,
          nombreReceptor: 'PUBLICO EN GENERAL',
          regimenFiscalReceptor: '616',
          codigoPostalReceptor: brand.postalCode || '06700',
          usoCfdi: 'S01',
          subtotal,
          descuento: 0,
          iva,
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

      // Link all orders to this global invoice
      await tx.order.updateMany({
        where: { id: { in: ordersToConsolidate.map((o) => o.id) } },
        data: { globalInvoiceId: inv.id },
      });

      // Increment brand folio
      await tx.brand.update({
        where: { id: activeBrandId },
        data: { invoiceNextFolio: folio + 1 },
      });

      return inv;
    });

    await recordAuditLog({
      action: 'GLOBAL_INVOICE_GENERATED',
      entityType: 'ORDER',
      entityId: globalInvoice.id,
      details: {
        uuid: globalInvoice.uuid,
        serieFolio: `${serie}-${folio}`,
        periodicity,
        month,
        year,
        consolidatedOrdersCount: ordersToConsolidate.length,
        total: globalInvoice.total,
      },
      severity: 'INFO',
      brandId: activeBrandId,
      userId: session.userId,
      req,
    });

    return NextResponse.json({
      success: true,
      invoice: globalInvoice,
      consolidatedCount: ordersToConsolidate.length,
    });
  } catch (error: unknown) {
    console.error('Error creating global invoice:', error);
    return NextResponse.json({ error: 'Error al generar y timbrar la factura global' }, { status: 500 });
  }
}

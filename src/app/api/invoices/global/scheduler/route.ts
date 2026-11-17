import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { 
  getUnbilledTicketsSummary, 
  executeAutomatedGlobalInvoicing 
} from '@/lib/globalInvoiceScheduler';

// GET: Consultar configuración del Scheduler y resumen de tickets no facturados
export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const activeBrandId = session.activeBrandId as string;

    const brand = await prisma.brand.findUnique({
      where: { id: activeBrandId },
      select: {
        id: true,
        name: true,
        rfc: true,
        legalName: true,
        taxRegime: true,
        postalCode: true,
        invoiceSeries: true,
        invoiceNextFolio: true,
        autoGlobalInvoiceEnabled: true,
        globalInvoicePeriodicity: true,
        globalInvoiceCronHour: true,
        globalInvoiceCronMinute: true,
        globalInvoiceMinTickets: true,
        lastGlobalInvoiceAt: true,
        lastGlobalInvoiceFolio: true,
        lastGlobalInvoiceStatus: true,
        lastGlobalInvoiceError: true,
        autoGlobalInvoiceEmailNotification: true,
        notificationEmail: true,
      },
    });

    if (!brand) {
      return NextResponse.json({ error: 'Marca no encontrada' }, { status: 404 });
    }

    // Calcular resumen de tickets no facturados actualmente acumulados
    const summary = await getUnbilledTicketsSummary(activeBrandId);

    // Obtener los últimos 10 CFDIs globales generados
    const recentGlobalInvoices = await prisma.invoice.findMany({
      where: {
        brandId: activeBrandId,
        isGlobal: true,
      },
      select: {
        id: true,
        uuid: true,
        serie: true,
        folio: true,
        globalPeriodicity: true,
        globalMonth: true,
        globalYear: true,
        subtotal: true,
        iva: true,
        total: true,
        status: true,
        createdAt: true,
        _count: {
          select: { globalOrders: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return NextResponse.json({
      brand,
      summary,
      recentGlobalInvoices,
    });
  } catch (error: any) {
    console.error('Error al consultar scheduler de facturación global:', error);
    return NextResponse.json({ error: error.message || 'Error del servidor' }, { status: 500 });
  }
}

// PUT: Actualizar configuración del Scheduler de facturación global
export async function PUT(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const activeBrandId = session.activeBrandId as string;
    const body = await req.json();

    const {
      autoGlobalInvoiceEnabled,
      globalInvoicePeriodicity,
      globalInvoiceCronHour,
      globalInvoiceCronMinute,
      globalInvoiceMinTickets,
      autoGlobalInvoiceEmailNotification,
      notificationEmail,
    } = body;

    const updatedBrand = await prisma.brand.update({
      where: { id: activeBrandId },
      data: {
        ...(typeof autoGlobalInvoiceEnabled === 'boolean' ? { autoGlobalInvoiceEnabled } : {}),
        ...(globalInvoicePeriodicity ? { globalInvoicePeriodicity: String(globalInvoicePeriodicity) } : {}),
        ...(typeof globalInvoiceCronHour === 'number' ? { globalInvoiceCronHour: Math.max(0, Math.min(23, globalInvoiceCronHour)) } : {}),
        ...(typeof globalInvoiceCronMinute === 'number' ? { globalInvoiceCronMinute: Math.max(0, Math.min(59, globalInvoiceCronMinute)) } : {}),
        ...(typeof globalInvoiceMinTickets === 'number' ? { globalInvoiceMinTickets: Math.max(1, globalInvoiceMinTickets) } : {}),
        ...(typeof autoGlobalInvoiceEmailNotification === 'boolean' ? { autoGlobalInvoiceEmailNotification } : {}),
        ...(notificationEmail !== undefined ? { notificationEmail: notificationEmail ? String(notificationEmail).trim() : null } : {}),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Configuración de facturación global automática actualizada con éxito',
      brand: {
        id: updatedBrand.id,
        autoGlobalInvoiceEnabled: updatedBrand.autoGlobalInvoiceEnabled,
        globalInvoicePeriodicity: updatedBrand.globalInvoicePeriodicity,
        globalInvoiceCronHour: updatedBrand.globalInvoiceCronHour,
        globalInvoiceCronMinute: updatedBrand.globalInvoiceCronMinute,
        globalInvoiceMinTickets: updatedBrand.globalInvoiceMinTickets,
        autoGlobalInvoiceEmailNotification: updatedBrand.autoGlobalInvoiceEmailNotification,
        notificationEmail: updatedBrand.notificationEmail,
      },
    });
  } catch (error: any) {
    console.error('Error al actualizar scheduler de facturación global:', error);
    return NextResponse.json({ error: error.message || 'Error del servidor' }, { status: 500 });
  }
}

// POST: Disparar ejecución inmediata de la facturación global (Manual / Forzado)
export async function POST(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const activeBrandId = session.activeBrandId as string;

    const result = await executeAutomatedGlobalInvoicing({
      brandId: activeBrandId,
      force: true,
      userId: session.userId,
      req,
    });

    const execution = result.results[0];

    if (!execution || execution.status === 'FAILED') {
      return NextResponse.json({
        success: false,
        error: execution?.error || 'Falló la generación de la factura global',
        result,
      }, { status: 400 });
    }

    if (execution.status === 'NO_TICKETS') {
      return NextResponse.json({
        success: true,
        message: 'No hay comandas pendientes de facturar para consolidar',
        result,
      });
    }

    return NextResponse.json({
      success: true,
      message: `CFDI Global timbrado exitosamente con folio ${execution.folio} consolidando ${execution.ordersCount} comandas`,
      result,
    });
  } catch (error: any) {
    console.error('Error al ejecutar timbrado global inmediato:', error);
    return NextResponse.json({ error: error.message || 'Error del servidor' }, { status: 500 });
  }
}

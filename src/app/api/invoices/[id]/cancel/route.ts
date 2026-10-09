import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { recordAuditLog } from '@/lib/audit';
import { generateCancellationAcuse, CANCELLATION_REASONS } from '@/lib/cfdi';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Role check: Only SUPER_ADMIN and BRAND_ADMIN can cancel tax invoices
    if (session.role !== 'SUPER_ADMIN' && session.role !== 'BRAND_ADMIN') {
      return NextResponse.json(
        { error: 'Permisos insuficientes. Sólo administradores pueden cancelar facturas fiscales ante el SAT' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { motivo, replacementUuid } = body;

    if (!motivo || !['01', '02', '03', '04'].includes(motivo)) {
      return NextResponse.json(
        { error: 'Motivo de cancelación del SAT inválido. Debe ser 01, 02, 03 o 04' },
        { status: 400 }
      );
    }

    if (motivo === '01' && !replacementUuid) {
      return NextResponse.json(
        { error: 'Para el motivo 01 (Comprobante con errores con relación), el UUID de sustitución es obligatorio' },
        { status: 400 }
      );
    }

    // Find target invoice
    const invoice = await prisma.invoice.findFirst({
      where: {
        OR: [{ id }, { uuid: id }],
        brandId: session.activeBrandId as string,
      },
      include: {
        brand: true,
        order: true,
        globalOrders: {
          select: { id: true, orderNumber: true },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });
    }

    if (invoice.status === 'CANCELADO') {
      return NextResponse.json({ error: 'La factura ya se encuentra cancelada ante el SAT' }, { status: 400 });
    }

    // Generate official SAT Cancellation Acuse XML with cryptographic signature
    const acuseResult = generateCancellationAcuse({
      uuid: invoice.uuid,
      rfcEmisor: invoice.brand.rfc || 'XAXX010101000',
      motivo,
      folioSustitucion: replacementUuid ? replacementUuid.trim().toUpperCase() : null,
      total: invoice.total,
    });

    const cancellationDate = new Date(acuseResult.fechaCancelacion);

    // Atomic transaction: mark invoice CANCELADO, store acuse, and detach orders
    const updatedInvoice = await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          status: 'CANCELADO',
          cancellationReason: motivo,
          replacementUuid: replacementUuid ? replacementUuid.trim().toUpperCase() : null,
          cancellationDate,
          cancellationAcuse: acuseResult.acuseXml,
        },
      });

      // If individual invoice: release order invoiceId so it can be re-invoiced or added to global
      if (invoice.orderId) {
        await tx.order.update({
          where: { id: invoice.orderId },
          data: { invoiceId: null },
        });
      }

      // If global invoice: release all consolidated orders
      if (invoice.isGlobal) {
        await tx.order.updateMany({
          where: { globalInvoiceId: invoice.id },
          data: { globalInvoiceId: null },
        });
      }

      return inv;
    });

    // Record immutable audit log
    await recordAuditLog({
      action: 'INVOICE_CANCELLED',
      entityType: 'ORDER',
      entityId: invoice.id,
      details: {
        uuid: invoice.uuid,
        serieFolio: `${invoice.serie}-${invoice.folio}`,
        isGlobal: invoice.isGlobal,
        motivo,
        motivoNombre: CANCELLATION_REASONS.find((r) => r.code === motivo)?.name,
        replacementUuid: replacementUuid || null,
        total: invoice.total,
        freedOrdersCount: invoice.isGlobal ? invoice.globalOrders.length : 1,
      },
      severity: 'CRITICAL',
      brandId: session.activeBrandId as string,
      userId: session.userId,
      req,
    });

    return NextResponse.json({
      success: true,
      message: 'Factura cancelada exitosamente ante el SAT con acuse digital generado',
      invoice: updatedInvoice,
      acuseXml: acuseResult.acuseXml,
    });
  } catch (error: unknown) {
    console.error('Error cancelling invoice:', error);
    return NextResponse.json({ error: 'Error al procesar la cancelación fiscal ante el SAT' }, { status: 500 });
  }
}

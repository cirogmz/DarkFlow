import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { recordAuditLog } from '@/lib/audit';
import { generateCfdi40, validateRfc, ConceptoFiscal } from '@/lib/cfdi';

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const activeBrandId = session.activeBrandId as string;
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';

    const invoices = await prisma.invoice.findMany({
      where: {
        brandId: activeBrandId,
        ...(query
          ? {
              OR: [
                { uuid: { contains: query } },
                { rfcReceptor: { contains: query } },
                { nombreReceptor: { contains: query } },
              ],
            }
          : {}),
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            total: true,
            customerName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ invoices });
  } catch (error: unknown) {
    console.error('Error fetching invoices:', error);
    return NextResponse.json({ error: 'Error al consultar facturas' }, { status: 500 });
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
      orderId,
      rfcReceptor,
      nombreReceptor,
      codigoPostalReceptor,
      regimenFiscalReceptor,
      usoCfdi,
      emailReceptor,
      formaPago,
    } = body;

    if (!orderId || !rfcReceptor || !nombreReceptor || !codigoPostalReceptor || !regimenFiscalReceptor || !usoCfdi) {
      return NextResponse.json({ error: 'Faltan campos obligatorios para timbrar la factura' }, { status: 400 });
    }

    if (!validateRfc(rfcReceptor)) {
      return NextResponse.json({ error: 'El RFC del receptor no tiene una estructura válida según el SAT' }, { status: 400 });
    }

    // Retrieve order and brand
    const [order, brand] = await Promise.all([
      prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          invoice: true,
        },
      }),
      prisma.brand.findUnique({
        where: { id: activeBrandId },
      }),
    ]);

    if (!order || order.brandId !== activeBrandId) {
      return NextResponse.json({ error: 'Comanda no encontrada' }, { status: 404 });
    }

    if (!brand) {
      return NextResponse.json({ error: 'Marca no encontrada' }, { status: 404 });
    }

    if (order.invoice) {
      return NextResponse.json(
        { error: 'Esta comanda ya cuenta con una factura timbrada', invoice: order.invoice },
        { status: 400 }
      );
    }

    const emisorRfc = brand.rfc || 'XAXX010101000';
    const emisorNombre = brand.legalName || brand.name;
    const emisorRegimen = brand.taxRegime || '601';
    const emisorCp = brand.postalCode || '06000';

    const serie = brand.invoiceSeries || 'FAC';
    const folio = brand.invoiceNextFolio || 1;

    // Build concepts from order items
    const subtotal = order.subtotal;
    const total = order.total;
    const iva = order.tax || subtotal * 0.16;
    const descuento = order.discountAmount || 0;

    const conceptos: ConceptoFiscal[] = order.items.map((item) => {
      const itemSub = item.price * item.quantity;
      const itemIva = itemSub * 0.16;
      return {
        claveProdServ: '90101503',
        claveUnidad: 'E48',
        unidad: 'Servicio',
        descripcion: item.product.name + (item.notes ? ` (${item.notes})` : ''),
        cantidad: item.quantity,
        valorUnitario: item.price,
        importe: itemSub,
        baseIva: itemSub,
        importeIva: itemIva,
      };
    });

    // Determine payment form SAT
    let satFormaPago = formaPago;
    if (!satFormaPago) {
      if (order.paymentMethod === 'CASH') satFormaPago = '01';
      else if (order.paymentMethod === 'TERMINAL' || order.paymentMethod === 'STRIPE' || order.paymentMethod === 'MERCADOPAGO')
        satFormaPago = '04';
      else satFormaPago = '01';
    }

    const timbre = generateCfdi40({
      serie,
      folio,
      emisor: {
        rfc: emisorRfc,
        nombre: emisorNombre,
        regimenFiscal: emisorRegimen,
        codigoPostal: emisorCp,
      },
      receptor: {
        rfc: rfcReceptor.trim().toUpperCase(),
        nombre: nombreReceptor.trim().toUpperCase(),
        codigoPostal: codigoPostalReceptor.trim(),
        regimenFiscal: regimenFiscalReceptor.trim(),
        usoCfdi: usoCfdi.trim(),
        email: emailReceptor ? emailReceptor.trim() : null,
      },
      conceptos,
      formaPago: satFormaPago,
      metodoPago: 'PUE',
      subtotal,
      descuento,
      iva,
      total,
    });

    const invoice = await prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.create({
        data: {
          uuid: timbre.uuid,
          folio,
          serie,
          brandId: activeBrandId,
          orderId: order.id,
          rfcReceptor: rfcReceptor.trim().toUpperCase(),
          nombreReceptor: nombreReceptor.trim().toUpperCase(),
          regimenFiscalReceptor: regimenFiscalReceptor.trim(),
          codigoPostalReceptor: codigoPostalReceptor.trim(),
          usoCfdi: usoCfdi.trim(),
          emailReceptor: emailReceptor ? emailReceptor.trim() : null,
          subtotal,
          descuento,
          iva,
          total,
          formaPago: satFormaPago,
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

      await tx.order.update({
        where: { id: order.id },
        data: { invoiceId: inv.id },
      });

      await tx.brand.update({
        where: { id: activeBrandId },
        data: { invoiceNextFolio: folio + 1 },
      });

      return inv;
    });

    await recordAuditLog({
      action: 'INVOICE_GENERATED',
      entityType: 'ORDER',
      entityId: order.id,
      details: {
        uuid: invoice.uuid,
        serieFolio: `${serie}-${folio}`,
        rfcReceptor: invoice.rfcReceptor,
        total: invoice.total,
      },
      severity: 'INFO',
      brandId: activeBrandId,
      userId: session.userId,
      req,
    });

    return NextResponse.json({ success: true, invoice });
  } catch (error: unknown) {
    console.error('Error generating CFDI invoice:', error);
    return NextResponse.json({ error: 'Error al generar la factura fiscal' }, { status: 500 });
  }
}

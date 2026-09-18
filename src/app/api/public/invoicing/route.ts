import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { recordAuditLog } from '@/lib/audit';
import { generateCfdi40, validateRfc, ConceptoFiscal } from '@/lib/cfdi';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    // 1. LOOKUP ORDER FOR INVOICING
    if (action === 'lookup') {
      const { orderNumber, total } = body;

      if (!orderNumber || total === undefined) {
        return NextResponse.json({ error: 'Número de comanda y total del ticket son requeridos' }, { status: 400 });
      }

      const cleanOrderNumber = String(orderNumber).trim();
      const parsedTotal = parseFloat(String(total));

      const order = await prisma.order.findFirst({
        where: {
          orderNumber: cleanOrderNumber,
        },
        include: {
          brand: {
            select: {
              id: true,
              name: true,
              slug: true,
              logoUrl: true,
              rfc: true,
              legalName: true,
              taxRegime: true,
              postalCode: true,
            },
          },
          items: {
            include: {
              product: true,
            },
          },
          invoice: true,
        },
      });

      if (!order) {
        return NextResponse.json(
          { error: 'No se encontró ninguna comanda con este número de folio' },
          { status: 404 }
        );
      }

      // Security validation: verify total matches order amount
      if (Math.abs(order.total - parsedTotal) > 0.5) {
        return NextResponse.json(
          { error: 'El monto ingresado no coincide con el total del ticket proporcionado' },
          { status: 400 }
        );
      }

      if (order.invoice) {
        return NextResponse.json({
          success: true,
          alreadyInvoiced: true,
          order: {
            id: order.id,
            orderNumber: order.orderNumber,
            total: order.total,
            subtotal: order.subtotal,
            tax: order.tax,
            createdAt: order.createdAt,
            brand: order.brand,
          },
          invoice: order.invoice,
        });
      }

      return NextResponse.json({
        success: true,
        alreadyInvoiced: false,
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          total: order.total,
          subtotal: order.subtotal,
          tax: order.tax,
          itemsCount: order.items.length,
          createdAt: order.createdAt,
          brand: order.brand,
        },
      });
    }

    // 2. ISSUE CFDI 4.0 INVOICE
    if (action === 'issue') {
      const {
        orderNumber,
        total,
        rfcReceptor,
        nombreReceptor,
        codigoPostalReceptor,
        regimenFiscalReceptor,
        usoCfdi,
        emailReceptor,
      } = body;

      if (
        !orderNumber ||
        total === undefined ||
        !rfcReceptor ||
        !nombreReceptor ||
        !codigoPostalReceptor ||
        !regimenFiscalReceptor ||
        !usoCfdi
      ) {
        return NextResponse.json({ error: 'Faltan campos obligatorios para generar la factura' }, { status: 400 });
      }

      if (!validateRfc(rfcReceptor)) {
        return NextResponse.json(
          { error: 'El RFC del receptor no tiene una estructura válida según las reglas del SAT' },
          { status: 400 }
        );
      }

      const cleanOrderNumber = String(orderNumber).trim();
      const parsedTotal = parseFloat(String(total));

      const order = await prisma.order.findFirst({
        where: { orderNumber: cleanOrderNumber },
        include: {
          brand: true,
          items: {
            include: {
              product: true,
            },
          },
          invoice: true,
        },
      });

      if (!order) {
        return NextResponse.json({ error: 'Comanda no encontrada' }, { status: 404 });
      }

      if (Math.abs(order.total - parsedTotal) > 0.5) {
        return NextResponse.json({ error: 'El monto ingresado no coincide con el ticket' }, { status: 400 });
      }

      if (order.invoice) {
        return NextResponse.json({
          success: true,
          alreadyInvoiced: true,
          invoice: order.invoice,
        });
      }

      const brand = order.brand;
      const emisorRfc = brand.rfc || 'XAXX010101000';
      const emisorNombre = brand.legalName || brand.name;
      const emisorRegimen = brand.taxRegime || '601';
      const emisorCp = brand.postalCode || '06000';
      const serie = brand.invoiceSeries || 'FAC';
      const folio = brand.invoiceNextFolio || 1;

      const subtotal = order.subtotal;
      const orderTotal = order.total;
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

      let satFormaPago = '01';
      if (order.paymentMethod === 'TERMINAL' || order.paymentMethod === 'STRIPE' || order.paymentMethod === 'MERCADOPAGO') {
        satFormaPago = '04';
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
        total: orderTotal,
      });

      const invoice = await prisma.$transaction(async (tx) => {
        const inv = await tx.invoice.create({
          data: {
            uuid: timbre.uuid,
            folio,
            serie,
            brandId: brand.id,
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
            total: orderTotal,
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
          where: { id: brand.id },
          data: { invoiceNextFolio: folio + 1 },
        });

        return inv;
      });

      await recordAuditLog({
        action: 'INVOICE_SELF_SERVED',
        entityType: 'ORDER',
        entityId: order.id,
        details: {
          uuid: invoice.uuid,
          serieFolio: `${serie}-${folio}`,
          rfcReceptor: invoice.rfcReceptor,
          total: invoice.total,
        },
        severity: 'INFO',
        brandId: brand.id,
        req,
      });

      return NextResponse.json({ success: true, invoice });
    }

    return NextResponse.json({ error: 'Acción no soportada' }, { status: 400 });
  } catch (error: unknown) {
    console.error('Error in public invoicing:', error);
    return NextResponse.json({ error: 'Error al procesar la solicitud de facturación' }, { status: 500 });
  }
}

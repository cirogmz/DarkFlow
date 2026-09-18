import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format');

    const invoice = await prisma.invoice.findFirst({
      where: {
        OR: [{ id }, { uuid: id }],
      },
      include: {
        brand: {
          select: {
            name: true,
            rfc: true,
            legalName: true,
            taxRegime: true,
            postalCode: true,
          },
        },
        order: {
          select: {
            orderNumber: true,
            createdAt: true,
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });
    }

    if (format === 'xml') {
      return new NextResponse(invoice.xmlContent, {
        status: 200,
        headers: {
          'Content-Type': 'application/xml; charset=utf-8',
          'Content-Disposition': `attachment; filename="${invoice.serie}-${invoice.folio}_${invoice.uuid}.xml"`,
        },
      });
    }

    return NextResponse.json({ invoice });
  } catch (error: unknown) {
    console.error('Error fetching invoice:', error);
    return NextResponse.json({ error: 'Error al consultar factura' }, { status: 500 });
  }
}

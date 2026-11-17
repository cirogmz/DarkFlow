import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const brandIdParam = searchParams.get('brandId');
    const limit = parseInt(searchParams.get('limit') || '30', 10);

    let brandId = brandIdParam;
    if (!brandId) {
      const firstBrand = await prisma.brand.findFirst();
      if (!firstBrand) {
        return NextResponse.json({ conversations: [], invoiceRequests: [] });
      }
      brandId = firstBrand.id;
    }

    const [conversations, invoiceRequests] = await Promise.all([
      prisma.whatsAppConversation.findMany({
        where: { brandId },
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 20,
          },
        },
        orderBy: { lastMessageAt: 'desc' },
        take: limit,
      }),
      prisma.whatsAppBotInvoiceRequest.findMany({
        where: { brandId },
        include: {
          invoice: {
            select: {
              id: true,
              uuid: true,
              folio: true,
              serie: true,
              total: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
    ]);

    return NextResponse.json({
      success: true,
      conversations,
      invoiceRequests,
    });
  } catch (error) {
    console.error('Error en /api/whatsapp/conversations:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al obtener conversaciones de WhatsApp' },
      { status: 500 }
    );
  }
}


import { NextRequest, NextResponse } from 'next/server';
import { simulateCustomerWhatsAppMessage } from '@/lib/whatsappBot';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { brandId, customerPhone, customerName, content, mediaUrl } = body;

    if (!content && !mediaUrl) {
      return NextResponse.json({ error: 'El contenido o imagen del mensaje es requerido' }, { status: 400 });
    }

    let effectiveBrandId = brandId;
    if (!effectiveBrandId) {
      const firstBrand = await prisma.brand.findFirst();
      if (!firstBrand) {
        return NextResponse.json({ error: 'No se encontró una marca activa' }, { status: 400 });
      }
      effectiveBrandId = firstBrand.id;
    }

    const reply = await simulateCustomerWhatsAppMessage({
      brandId: effectiveBrandId,
      customerPhone: customerPhone || '5215598765432',
      customerName: customerName || 'Comensal Simulado',
      content: content || 'Foto de ticket',
      mediaUrl,
    });

    return NextResponse.json({
      success: true,
      reply,
    });
  } catch (error) {
    console.error('Error en /api/whatsapp/simulate:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al procesar mensaje simulado de WhatsApp' },
      { status: 500 }
    );
  }
}


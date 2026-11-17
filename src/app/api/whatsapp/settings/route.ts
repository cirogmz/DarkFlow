import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const brandIdParam = searchParams.get('brandId');

    let brandId = brandIdParam;
    if (!brandId) {
      const firstBrand = await prisma.brand.findFirst();
      if (!firstBrand) {
        return NextResponse.json({ error: 'Marca no encontrada' }, { status: 404 });
      }
      brandId = firstBrand.id;
    }

    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      select: {
        id: true,
        name: true,
        whatsappBotEnabled: true,
        whatsappPhoneNumberId: true,
        whatsappAccessToken: true,
        whatsappWebhookVerifyToken: true,
        whatsappWelcomeMsg: true,
      },
    });

    if (!brand) {
      return NextResponse.json({ error: 'Marca no encontrada' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      settings: brand,
    });
  } catch (error) {
    console.error('Error en GET /api/whatsapp/settings:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al obtener configuración de WhatsApp' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      brandId,
      whatsappBotEnabled,
      whatsappPhoneNumberId,
      whatsappAccessToken,
      whatsappWebhookVerifyToken,
      whatsappWelcomeMsg,
    } = body;

    let effectiveBrandId = brandId;
    if (!effectiveBrandId) {
      const firstBrand = await prisma.brand.findFirst();
      if (!firstBrand) {
        return NextResponse.json({ error: 'Marca no encontrada' }, { status: 404 });
      }
      effectiveBrandId = firstBrand.id;
    }

    const updated = await prisma.brand.update({
      where: { id: effectiveBrandId },
      data: {
        whatsappBotEnabled: whatsappBotEnabled !== undefined ? whatsappBotEnabled : undefined,
        whatsappPhoneNumberId: whatsappPhoneNumberId !== undefined ? whatsappPhoneNumberId : undefined,
        whatsappAccessToken: whatsappAccessToken !== undefined ? whatsappAccessToken : undefined,
        whatsappWebhookVerifyToken: whatsappWebhookVerifyToken !== undefined ? whatsappWebhookVerifyToken : undefined,
        whatsappWelcomeMsg: whatsappWelcomeMsg !== undefined ? whatsappWelcomeMsg : undefined,
      },
      select: {
        id: true,
        name: true,
        whatsappBotEnabled: true,
        whatsappPhoneNumberId: true,
        whatsappAccessToken: true,
        whatsappWebhookVerifyToken: true,
        whatsappWelcomeMsg: true,
      },
    });

    return NextResponse.json({
      success: true,
      settings: updated,
    });
  } catch (error) {
    console.error('Error en PUT /api/whatsapp/settings:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al actualizar configuración de WhatsApp' },
      { status: 500 }
    );
  }
}


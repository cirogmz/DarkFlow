import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { processInboundWhatsAppMessage } from '@/lib/whatsappBot';

// Meta WhatsApp Webhook Verification (GET)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  // Si no hay verify token configurado, verificar contra token por defecto
  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN || 'darkflow_whatsapp_webhook_2026';

  if (mode === 'subscribe' && token === expectedToken) {
    console.log('✅ Webhook de WhatsApp verificado exitosamente con Meta');
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: 'Verificación fallida de token' }, { status: 403 });
}

// Meta WhatsApp Inbound Message Handler (POST)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validar estructura de payload de Meta Cloud API
    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];
    const contact = value?.contacts?.[0];

    if (!message) {
      // Puede ser una notificación de status (sent, delivered, read)
      return NextResponse.json({ status: 'ignored' }, { status: 200 });
    }

    const customerPhone = message.from;
    const customerName = contact?.profile?.name || 'Cliente WhatsApp';

    // Determinar contenido según tipo de mensaje
    let content = '';
    let mediaUrl: string | undefined;

    if (message.type === 'text') {
      content = message.text?.body || '';
    } else if (message.type === 'image') {
      content = message.image?.caption || 'Foto de ticket';
      mediaUrl = message.image?.id || 'whatsapp_media_image';
    } else if (message.type === 'interactive') {
      content = message.interactive?.button_reply?.title || message.interactive?.list_reply?.title || '';
    } else {
      content = 'Mensaje no soportado';
    }

    // Buscar la marca correspondiente
    const phoneNumberId = value?.metadata?.phone_number_id;
    let brand = null;
    if (phoneNumberId) {
      brand = await prisma.brand.findFirst({
        where: { whatsappPhoneNumberId: phoneNumberId },
      });
    }

    if (!brand) {
      brand = await prisma.brand.findFirst({
        where: { whatsappBotEnabled: true },
      });
    }

    if (!brand) {
      return NextResponse.json({ error: 'No brand configured for WhatsApp' }, { status: 200 });
    }

    // Procesar con el motor conversacional
    const reply = await processInboundWhatsAppMessage({
      brandId: brand.id,
      customerPhone,
      customerName,
      content,
      mediaUrl,
    });

    return NextResponse.json({
      status: 'processed',
      reply,
    }, { status: 200 });
  } catch (error) {
    console.error('Error en webhook de WhatsApp:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error en webhook' },
      { status: 500 }
    );
  }
}


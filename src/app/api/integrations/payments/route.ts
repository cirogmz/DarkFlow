import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { recordAuditLog } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'BRAND_ADMIN')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const brandId = searchParams.get('brandId') || session.activeBrandId;

    if (!brandId) {
      return NextResponse.json({ error: 'Marca no seleccionada' }, { status: 400 });
    }

    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      select: {
        id: true,
        name: true,
        slug: true,
        paymentSandboxMode: true,
        allowOnlinePayments: true,
        stripeSecretKey: true,
        stripePublicKey: true,
        stripeWebhookSecret: true,
        mpAccessToken: true,
        mpPublicKey: true,
        mpWebhookSecret: true,
      },
    });

    if (!brand) {
      return NextResponse.json({ error: 'Marca no encontrada' }, { status: 404 });
    }

    // Mask secret keys for secure frontend display
    const maskKey = (key: string | null) => {
      if (!key) return '';
      if (key.length <= 8) return '••••••••';
      return `${key.substring(0, 4)}••••••••${key.substring(key.length - 4)}`;
    };

    return NextResponse.json({
      config: {
        id: brand.id,
        name: brand.name,
        slug: brand.slug,
        paymentSandboxMode: brand.paymentSandboxMode,
        allowOnlinePayments: brand.allowOnlinePayments,
        hasStripeSecret: Boolean(brand.stripeSecretKey),
        stripeSecretKeyMasked: maskKey(brand.stripeSecretKey),
        stripePublicKey: brand.stripePublicKey || '',
        hasMpToken: Boolean(brand.mpAccessToken),
        mpAccessTokenMasked: maskKey(brand.mpAccessToken),
        mpPublicKey: brand.mpPublicKey || '',
        webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/api/webhooks/payments`,
      },
    });
  } catch (error: unknown) {
    console.error('Error fetching payment config:', error);
    return NextResponse.json({ error: 'Error interno al consultar configuración de pagos' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'BRAND_ADMIN')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = await req.json();
    const {
      brandId,
      paymentSandboxMode,
      allowOnlinePayments,
      stripeSecretKey,
      stripePublicKey,
      stripeWebhookSecret,
      mpAccessToken,
      mpPublicKey,
      mpWebhookSecret,
    } = body;

    const targetBrandId = brandId || session.activeBrandId;
    if (!targetBrandId) {
      return NextResponse.json({ error: 'Marca no seleccionada' }, { status: 400 });
    }

    // Build update object only for provided non-masked fields
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};
    if (paymentSandboxMode !== undefined) updateData.paymentSandboxMode = Boolean(paymentSandboxMode);
    if (allowOnlinePayments !== undefined) updateData.allowOnlinePayments = Boolean(allowOnlinePayments);

    if (stripeSecretKey !== undefined && !stripeSecretKey.includes('••••')) {
      updateData.stripeSecretKey = stripeSecretKey.trim() || null;
    }
    if (stripePublicKey !== undefined) {
      updateData.stripePublicKey = stripePublicKey.trim() || null;
    }
    if (stripeWebhookSecret !== undefined && !stripeWebhookSecret.includes('••••')) {
      updateData.stripeWebhookSecret = stripeWebhookSecret.trim() || null;
    }

    if (mpAccessToken !== undefined && !mpAccessToken.includes('••••')) {
      updateData.mpAccessToken = mpAccessToken.trim() || null;
    }
    if (mpPublicKey !== undefined) {
      updateData.mpPublicKey = mpPublicKey.trim() || null;
    }
    if (mpWebhookSecret !== undefined && !mpWebhookSecret.includes('••••')) {
      updateData.mpWebhookSecret = mpWebhookSecret.trim() || null;
    }

    const updated = await prisma.brand.update({
      where: { id: targetBrandId },
      data: updateData,
    });

    await recordAuditLog({
      action: 'PAYMENT_GATEWAY_CONFIG_UPDATED',
      entityType: 'BRAND',
      entityId: updated.id,
      details: {
        brandName: updated.name,
        paymentSandboxMode: updated.paymentSandboxMode,
        allowOnlinePayments: updated.allowOnlinePayments,
        hasStripe: Boolean(updated.stripeSecretKey),
        hasMercadoPago: Boolean(updated.mpAccessToken),
      },
      severity: 'CRITICAL',
      brandId: updated.id,
      userId: session.userId,
      req,
    });

    return NextResponse.json({
      success: true,
      message: 'Configuración de pasarelas de pago guardada exitosamente',
    });
  } catch (error: unknown) {
    console.error('Error updating payment config:', error);
    return NextResponse.json({ error: 'Error al actualizar configuración de pasarelas' }, { status: 500 });
  }
}

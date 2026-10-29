import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { recordAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const campaign = await prisma.marketingCampaign.findUnique({
      where: { id: params.id },
      include: {
        brand: true,
        recipients: {
          orderBy: { createdAt: 'asc' },
          take: 300,
        },
      },
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 });
    }

    return NextResponse.json({ campaign });
  } catch (error: any) {
    console.error('Error fetching campaign details:', error);
    return NextResponse.json(
      { error: error.message || 'Error al obtener campaña' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const body = await req.json();
    const campaign = await prisma.marketingCampaign.findUnique({
      where: { id: params.id },
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 });
    }

    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.messageTemplate !== undefined) updateData.messageTemplate = body.messageTemplate;
    if (body.targetSegment !== undefined) updateData.targetSegment = body.targetSegment;
    if (body.channel !== undefined) updateData.channel = body.channel;
    if (body.triggerType !== undefined) updateData.triggerType = body.triggerType;
    if (body.subject !== undefined) updateData.subject = body.subject;
    if (body.couponCode !== undefined) updateData.couponCode = body.couponCode;
    if (body.discountPct !== undefined) updateData.discountPct = Number(body.discountPct);
    if (body.walletBonusAmount !== undefined) updateData.walletBonusAmount = Number(body.walletBonusAmount);
    if (body.status !== undefined) updateData.status = body.status;
    if (body.scheduledAt !== undefined) {
      updateData.scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
    }

    const updated = await prisma.marketingCampaign.update({
      where: { id: params.id },
      data: updateData,
    });

    await recordAuditLog({
      action: 'MARKETING_CAMPAIGN_UPDATE',
      entityType: 'MARKETING_CAMPAIGN',
      entityId: params.id,
      severity: 'INFO',
      details: `✏️ Campaña "${updated.name}" actualizada. Modificaciones: ${Object.keys(updateData).join(', ')}`,
      brandId: updated.brandId,
      userId: session.userId,
    });

    return NextResponse.json({ campaign: updated });
  } catch (error: any) {
    console.error('Error updating campaign:', error);
    return NextResponse.json(
      { error: error.message || 'Error al actualizar campaña' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const campaign = await prisma.marketingCampaign.findUnique({
      where: { id: params.id },
    });

    if (!campaign) {
      return NextResponse.json({ error: 'Campaña no encontrada' }, { status: 404 });
    }

    if (campaign.status === 'DRAFT') {
      await prisma.marketingCampaign.delete({
        where: { id: params.id },
      });
    } else {
      await prisma.marketingCampaign.update({
        where: { id: params.id },
        data: { status: 'CANCELLED' },
      });
    }

    await recordAuditLog({
      action: 'MARKETING_CAMPAIGN_DELETE',
      entityType: 'MARKETING_CAMPAIGN',
      entityId: params.id,
      severity: 'WARNING',
      details: `🗑️ Campaña "${campaign.name}" (${campaign.folio}) eliminada o cancelada por ${session.name || session.email}`,
      brandId: campaign.brandId,
      userId: session.userId,
    });

    return NextResponse.json({ success: true, message: 'Campaña procesada correctamente.' });
  } catch (error: any) {
    console.error('Error deleting campaign:', error);
    return NextResponse.json(
      { error: error.message || 'Error al eliminar campaña' },
      { status: 500 }
    );
  }
}


import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { launchCampaign } from '@/lib/marketing';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const campaign = await launchCampaign(params.id, {
      id: session.userId,
      name: session.name || session.email,
    });

    return NextResponse.json({
      success: true,
      message: `¡Campaña lanzada con éxito a ${campaign.totalRecipients} clientes!`,
      campaign,
    });
  } catch (error: any) {
    console.error('Error launching marketing campaign:', error);
    return NextResponse.json(
      { error: error.message || 'Error al lanzar campaña' },
      { status: 500 }
    );
  }
}


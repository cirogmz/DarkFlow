import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { trackRecipientConversion } from '@/lib/marketing';

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

    const body = await req.json().catch(() => ({}));
    const recipient = await trackRecipientConversion(params.id, body.orderId);

    if (!recipient) {
      return NextResponse.json({ error: 'Destinatario no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ success: true, recipient });
  } catch (error: any) {
    console.error('Error tracking recipient conversion:', error);
    return NextResponse.json(
      { error: error.message || 'Error al registrar conversión' },
      { status: 500 }
    );
  }
}


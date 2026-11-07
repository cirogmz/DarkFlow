import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { resolveTerminalPaymentIntent } from '@/lib/smartTerminals';

export async function POST(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado o marca no seleccionada' }, { status: 401 });
    }

    const body = await req.json();
    const {
      intentId,
      action = 'APPROVE', // 'APPROVE' | 'REJECT' | 'CANCEL'
      cardBrand = 'VISA',
      cardLast4 = '4242',
      authCode,
      tip = 0,
      rejectionReason,
    } = body;

    if (!intentId) {
      return NextResponse.json({ error: 'Parámetro obligatorio: intentId' }, { status: 400 });
    }

    const result = await resolveTerminalPaymentIntent({
      intentId,
      action,
      cardBrand,
      cardLast4,
      authCode,
      tip: parseFloat(String(tip || '0')),
      rejectionReason,
      req,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('Error simulating terminal result:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al procesar simulación en terminal' },
      { status: 400 }
    );
  }
}


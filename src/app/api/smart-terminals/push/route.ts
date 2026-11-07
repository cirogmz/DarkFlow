import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { pushPaymentToTerminal } from '@/lib/smartTerminals';

export async function POST(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado o marca no seleccionada' }, { status: 401 });
    }

    const body = await req.json();
    const { terminalId, orderId, amount, tip = 0 } = body;

    if (!terminalId || !orderId || amount === undefined) {
      return NextResponse.json(
        { error: 'Parámetros obligatorios: terminalId, orderId y amount' },
        { status: 400 }
      );
    }

    const result = await pushPaymentToTerminal({
      brandId: session.activeBrandId,
      terminalId,
      orderId,
      amount: parseFloat(String(amount)),
      tip: parseFloat(String(tip || '0')),
      req,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('Error pushing payment to terminal:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al enviar cobro a terminal' },
      { status: 400 }
    );
  }
}

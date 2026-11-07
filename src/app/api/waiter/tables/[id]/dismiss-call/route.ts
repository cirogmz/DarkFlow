import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { dismissWaiterCall } from '@/lib/splitBill';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado o marca no seleccionada' }, { status: 401 });
    }

    const { id } = await params;
    const updated = await dismissWaiterCall(id);

    return NextResponse.json({
      success: true,
      message: `Llamado de Mesa #${updated.number} atendido`,
      table: updated,
    });
  } catch (error: unknown) {
    console.error('Error dismissing waiter call:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al atender llamado' },
      { status: 500 }
    );
  }
}


import { NextRequest, NextResponse } from 'next/server';
import { callWaiter } from '@/lib/splitBill';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { brandSlug, tableNumber, reason = 'CALL_WAITER', notes } = body;

    if (!brandSlug || !tableNumber) {
      return NextResponse.json(
        { error: 'Parámetros obligatorios: brandSlug y tableNumber' },
        { status: 400 }
      );
    }

    const res = await callWaiter({
      brandSlug,
      tableNumber: String(tableNumber),
      reason,
      notes,
      req,
    });

    return NextResponse.json(res);
  } catch (error: unknown) {
    console.error('Error calling waiter:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al solicitar llamado a mesero' },
      { status: 400 }
    );
  }
}


import { NextRequest, NextResponse } from 'next/server';
import { getTableBill, calculateEqualSplits } from '@/lib/splitBill';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get('slug');
    const tableNumber = searchParams.get('table');
    const splitsCount = parseInt(searchParams.get('splits') || '2', 10);

    if (!slug || !tableNumber) {
      return NextResponse.json(
        { error: 'Faltan parámetros requeridos: slug de la marca y número de mesa' },
        { status: 400 }
      );
    }

    const bill = await getTableBill(slug, tableNumber);

    if (!bill) {
      return NextResponse.json(
        { error: 'Mesa o marca no encontrada' },
        { status: 404 }
      );
    }

    const equalSplits = bill.remainingBalance > 0
      ? calculateEqualSplits(bill.remainingBalance, splitsCount)
      : [];

    return NextResponse.json({
      success: true,
      bill,
      equalSplits,
    });
  } catch (error: unknown) {
    console.error('Error fetching table bill:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error interno al consultar cuenta de mesa' },
      { status: 500 }
    );
  }
}


import { NextRequest, NextResponse } from 'next/server';
import { processSplitPayment } from '@/lib/splitBill';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      brandSlug,
      tableNumber,
      paymentMethod = 'CARD',
      splitType = 'FULL',
      amount,
      tip = 0,
      splitIndex,
      payerName,
      payerPhone,
      selectedItems,
      gatewayPaymentId,
    } = body;

    if (!brandSlug || !tableNumber || amount === undefined) {
      return NextResponse.json(
        { error: 'Parámetros obligatorios faltantes: brandSlug, tableNumber y amount' },
        { status: 400 }
      );
    }

    const numericAmount = parseFloat(String(amount));
    const numericTip = parseFloat(String(tip || '0'));

    if (isNaN(numericAmount) || numericAmount <= 0) {
      return NextResponse.json(
        { error: 'El monto ingresado es inválido' },
        { status: 400 }
      );
    }

    const result = await processSplitPayment({
      brandSlug,
      tableNumber: String(tableNumber),
      paymentMethod,
      splitType,
      amount: numericAmount,
      tip: numericTip,
      splitIndex: splitIndex ? parseInt(String(splitIndex), 10) : undefined,
      payerName,
      payerPhone,
      selectedItems,
      gatewayPaymentId,
      req,
    });

    return NextResponse.json({
      success: true,
      message: result.isNowFullyPaid
        ? '¡Cuenta pagada en su totalidad! Gracias por tu visita.'
        : `Pago de $${result.effectiveAmount.toFixed(2)} MXN recibido con éxito. Saldo restante: $${result.newRemaining.toFixed(2)} MXN.`,
      result,
    });
  } catch (error: unknown) {
    console.error('Error processing split payment:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al procesar pago dividido' },
      { status: 400 }
    );
  }
}


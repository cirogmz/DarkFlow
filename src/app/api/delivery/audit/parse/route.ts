import { NextRequest, NextResponse } from 'next/server';
import { parseDeliveryStatement, DeliveryPlatform } from '@/lib/deliveryAudit';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fileContent, platform } = body;

    if (!fileContent || typeof fileContent !== 'string') {
      return NextResponse.json(
        { error: 'El contenido del archivo (fileContent) es requerido en formato texto.' },
        { status: 400 }
      );
    }

    const parsed = parseDeliveryStatement(fileContent, platform as DeliveryPlatform);

    return NextResponse.json({
      success: true,
      platform: parsed.platform,
      totalRows: parsed.rows.length,
      rows: parsed.rows,
      preview: parsed.rows.slice(0, 5),
    });
  } catch (error: any) {
    console.error('Error al parsear estado de cuenta delivery:', error);
    return NextResponse.json({ error: error.message || 'Error al procesar el archivo' }, { status: 400 });
  }
}

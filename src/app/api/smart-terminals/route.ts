import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { listSmartTerminals, upsertSmartTerminal, TerminalProvider } from '@/lib/smartTerminals';

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado o marca no seleccionada' }, { status: 401 });
    }

    const terminals = await listSmartTerminals(session.activeBrandId);

    return NextResponse.json({
      success: true,
      terminals,
    });
  } catch (error: unknown) {
    console.error('Error fetching smart terminals:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al consultar terminales' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado o marca no seleccionada' }, { status: 401 });
    }

    const body = await req.json();
    const { id, name, provider, serialNumber, deviceId, zone, notes } = body;

    const terminal = await upsertSmartTerminal({
      id,
      brandId: session.activeBrandId,
      name,
      provider: (provider || 'CLIP') as TerminalProvider,
      serialNumber,
      deviceId,
      zone,
      notes,
    });

    return NextResponse.json({
      success: true,
      message: id ? 'Terminal actualizada con éxito' : 'Terminal registrada con éxito',
      terminal,
    });
  } catch (error: unknown) {
    console.error('Error saving smart terminal:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al guardar terminal' },
      { status: 400 }
    );
  }
}

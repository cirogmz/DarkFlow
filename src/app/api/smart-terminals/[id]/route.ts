import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { deleteSmartTerminal } from '@/lib/smartTerminals';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado o marca no seleccionada' }, { status: 401 });
    }

    const { id } = await params;
    await deleteSmartTerminal(id, session.activeBrandId);

    return NextResponse.json({
      success: true,
      message: 'Terminal eliminada con éxito',
    });
  } catch (error: unknown) {
    console.error('Error deleting terminal:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al eliminar terminal' },
      { status: 500 }
    );
  }
}

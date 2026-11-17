import { NextRequest, NextResponse } from 'next/server';
import { executeAutomatedGlobalInvoicing } from '@/lib/globalInvoiceScheduler';

export async function GET(req: NextRequest) {
  return handleCronExecution(req);
}

export async function POST(req: NextRequest) {
  return handleCronExecution(req);
}

async function handleCronExecution(req: NextRequest) {
  try {
    // Verificación opcional de clave secreta para entornos de producción
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = req.headers.get('authorization');
      const querySecret = req.nextUrl.searchParams.get('secret');
      const providedSecret = authHeader?.replace(/^Bearer\s+/i, '') || querySecret;

      if (providedSecret !== cronSecret) {
        return NextResponse.json({ error: 'No autorizado: Token de cron inválido' }, { status: 401 });
      }
    }

    const { searchParams } = new URL(req.url);
    const brandId = searchParams.get('brandId') || undefined;
    const force = searchParams.get('force') === 'true';

    console.log(`[CRON] Iniciando proceso automatizado de facturación global SAT (brand: ${brandId || 'TODAS'}, force: ${force})...`);

    const outcome = await executeAutomatedGlobalInvoicing({
      brandId,
      force,
      req,
    });

    console.log(`[CRON] Finalizado. Marcas timbradas: ${outcome.executedCount}, Total evaluadas: ${outcome.results.length}`);

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      ...outcome,
    });
  } catch (error: any) {
    console.error('[CRON] Error crítico durante la ejecución de facturación global:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno del servidor en cron job',
    }, { status: 500 });
  }
}

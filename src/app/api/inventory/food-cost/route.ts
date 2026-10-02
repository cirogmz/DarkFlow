import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { getFoodCostAnalysis } from '@/lib/costAudit';

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);
    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const range = searchParams.get('range') || 'month'; // today, week, month, all, custom
    const startParam = searchParams.get('startDate');
    const endParam = searchParams.get('endDate');

    let startDate: Date | undefined;
    let endDate: Date | undefined = new Date();

    const now = new Date();
    if (range === 'today') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    } else if (range === 'week') {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
    } else if (range === 'month') {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
    } else if (range === 'custom' && startParam) {
      startDate = new Date(startParam);
      if (endParam) {
        endDate = new Date(endParam);
      }
    } else if (range === 'all') {
      startDate = undefined;
      endDate = undefined;
    }

    const report = await getFoodCostAnalysis(session.activeBrandId, startDate, endDate);

    return NextResponse.json(report);
  } catch (error: any) {
    console.error('Error fetching food cost analysis:', error);
    return NextResponse.json(
      { error: 'Error al calcular auditoría de costos', details: error.message },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startTime = Date.now();
  
  try {
    // Ping database with generic SQL query supported by SQLite, PostgreSQL and MySQL
    await prisma.$queryRawUnsafe('SELECT 1');
    const latencyMs = Date.now() - startTime;

    return NextResponse.json(
      {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.floor(process.uptime()),
        database: {
          connected: true,
          latencyMs,
        },
        environment: process.env.NODE_ENV || 'development',
      },
      { status: 200 }
    );
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    console.error('Healthcheck DB error:', error);

    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        database: {
          connected: false,
          latencyMs,
          error: error instanceof Error ? error.message : 'Database ping failed',
        },
        environment: process.env.NODE_ENV || 'development',
      },
      { status: 503 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    let brands;

    if (session.role === 'SUPER_ADMIN') {
      // Super admin can access all brands
      brands = await prisma.brand.findMany({
        orderBy: { name: 'asc' },
      });
    } else {
      // Return brands assigned to this user
      brands = await prisma.brand.findMany({
        where: {
          id: { in: session.brandIds },
        },
        orderBy: { name: 'asc' },
      });
    }

    return NextResponse.json({ brands });
  } catch (error: unknown) {
    console.error('Error fetching brands:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

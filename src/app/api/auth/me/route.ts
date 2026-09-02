import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies, encryptSession } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  const cookieHeader = req.headers.get('cookie') || '';
  const session = getSessionFromCookies(cookieHeader);

  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  // Fetch full details of the active brand if present
  let activeBrand = null;
  if (session.activeBrandId) {
    activeBrand = await prisma.brand.findUnique({
      where: { id: session.activeBrandId },
    });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: session.userId,
      email: session.email,
      name: session.name,
      role: session.role,
      brandIds: session.brandIds,
      activeBrandId: session.activeBrandId,
      activeBrand,
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { brandId } = await req.json();

    if (!brandId) {
      return NextResponse.json({ error: 'Falta brandId' }, { status: 400 });
    }

    // Verify user has access to this brand, or is SUPER_ADMIN
    if (session.role !== 'SUPER_ADMIN' && !session.brandIds.includes(brandId)) {
      return NextResponse.json({ error: 'Acceso no autorizado a esta marca' }, { status: 403 });
    }

    // Encrypt new session with updated activeBrandId
    const newSessionToken = encryptSession({
      userId: session.userId,
      email: session.email,
      name: session.name,
      role: session.role,
      brandIds: session.brandIds,
      activeBrandId: brandId,
    });

    const activeBrand = await prisma.brand.findUnique({
      where: { id: brandId },
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: session.userId,
        email: session.email,
        name: session.name,
        role: session.role,
        brandIds: session.brandIds,
        activeBrandId: brandId,
        activeBrand,
      },
    });

    // Set HTTP-Only Cookie
    response.cookies.set({
      name: 'df_session',
      value: newSessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 8 * 60 * 60, // 8 hours
    });

    return response;
  } catch (error: any) {
    console.error('Error updating active brand:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

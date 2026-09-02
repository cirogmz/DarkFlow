import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyPassword } from '@/lib/hash';
import { encryptSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Faltan credenciales' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        brands: {
          include: {
            brand: true,
          },
        },
      },
    });

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
    }

    // Get brand associations
    const brandIds = user.brands.map((ub) => ub.brandId);
    
    // Select default active brand (first associated brand, or empty if Super Admin)
    const activeBrandId = brandIds[0] || undefined;

    // Encrypt session
    const sessionToken = encryptSession({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role as any,
      brandIds,
      activeBrandId,
    });

    // Create response
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        brands: user.brands.map((ub) => ({ id: ub.brand.id, name: ub.brand.name })),
        activeBrandId,
      },
    });

    // Set HTTP-Only Cookie
    response.cookies.set({
      name: 'df_session',
      value: sessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 8 * 60 * 60, // 8 hours
    });

    return response;
  } catch (error: any) {
    console.error('Error in login API:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

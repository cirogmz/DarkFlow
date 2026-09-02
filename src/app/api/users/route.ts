import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/hash';

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'BRAND_ADMIN')) {
      return NextResponse.json({ error: 'No autorizado para consultar personal' }, { status: 403 });
    }

    let users;

    if (session.role === 'SUPER_ADMIN') {
      users = await prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          brands: {
            include: {
              brand: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  primaryColor: true,
                },
              },
            },
          },
          deliveryProfile: true,
        },
        orderBy: [
          { role: 'asc' },
          { name: 'asc' },
        ],
      });
    } else {
      // Brand Admin only sees users associated with their brands
      users = await prisma.user.findMany({
        where: {
          brands: {
            some: {
              brandId: { in: session.brandIds },
            },
          },
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          brands: {
            include: {
              brand: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  primaryColor: true,
                },
              },
            },
          },
          deliveryProfile: true,
        },
        orderBy: [
          { role: 'asc' },
          { name: 'asc' },
        ],
      });
    }

    return NextResponse.json({ users });
  } catch (error: unknown) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'BRAND_ADMIN')) {
      return NextResponse.json({ error: 'Permisos insuficientes para crear usuarios' }, { status: 403 });
    }

    const { 
      name, 
      email, 
      password, 
      role = 'CASHIER', 
      brandIds = [], 
      vehicleType, 
      plateNumber 
    } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Nombre, correo y contraseña son obligatorios' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check email uniqueness
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      return NextResponse.json({ error: 'Ya existe un usuario con este correo electrónico' }, { status: 400 });
    }

    // Security check: Only SUPER_ADMIN can create another SUPER_ADMIN
    if (role === 'SUPER_ADMIN' && session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'No tienes permisos para crear Super Administradores' }, { status: 403 });
    }

    const passwordHash = hashPassword(password.trim());

    // Resolve brands to associate
    const targetBrandIds: string[] = Array.isArray(brandIds) && brandIds.length > 0 
      ? brandIds 
      : session.activeBrandId 
      ? [session.activeBrandId] 
      : [];

    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: name.trim(),
          email: normalizedEmail,
          passwordHash,
          role,
        },
      });

      // Link User to Brands
      if (targetBrandIds.length > 0) {
        await tx.userBrand.createMany({
          data: targetBrandIds.map((bId) => ({
            userId: user.id,
            brandId: bId,
          })),
        });
      }

      // If DELIVERY role, create DeliveryProfile
      if (role === 'DELIVERY') {
        await tx.deliveryProfile.create({
          data: {
            userId: user.id,
            vehicleType: vehicleType || 'MOTO',
            plateNumber: plateNumber ? plateNumber.trim() : null,
            status: 'AVAILABLE',
          },
        });
      }

      return user;
    });

    return NextResponse.json({ success: true, user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role } });
  } catch (error: unknown) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Error al crear usuario' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'BRAND_ADMIN')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { 
      id, 
      name, 
      email, 
      password, 
      role, 
      brandIds, 
      vehicleType, 
      plateNumber 
    } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'ID de usuario requerido' }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id },
      include: { deliveryProfile: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    // Security: non-super admin cannot edit a super admin
    if (targetUser.role === 'SUPER_ADMIN' && session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'No tienes permisos para modificar a un Super Administrador' }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      // 1. Update basic user data
      const updateData: { name?: string; email?: string; passwordHash?: string; role?: string } = {};
      if (name) updateData.name = name.trim();
      if (email) updateData.email = email.trim().toLowerCase();
      if (password && password.trim().length > 0) {
        updateData.passwordHash = hashPassword(password.trim());
      }
      if (role && (session.role === 'SUPER_ADMIN' || role !== 'SUPER_ADMIN')) {
        updateData.role = role;
      }

      await tx.user.update({
        where: { id },
        data: updateData,
      });

      // 2. Update brand associations if provided
      if (Array.isArray(brandIds)) {
        await tx.userBrand.deleteMany({
          where: { userId: id },
        });

        if (brandIds.length > 0) {
          await tx.userBrand.createMany({
            data: brandIds.map((bId) => ({
              userId: id,
              brandId: bId,
            })),
          });
        }
      }

      // 3. Update delivery profile if applicable
      const effectiveRole = role || targetUser.role;
      if (effectiveRole === 'DELIVERY') {
        if (targetUser.deliveryProfile) {
          await tx.deliveryProfile.update({
            where: { userId: id },
            data: {
              vehicleType: vehicleType !== undefined ? vehicleType : undefined,
              plateNumber: plateNumber !== undefined ? plateNumber : undefined,
            },
          });
        } else {
          await tx.deliveryProfile.create({
            data: {
              userId: id,
              vehicleType: vehicleType || 'MOTO',
              plateNumber: plateNumber || null,
              status: 'AVAILABLE',
            },
          });
        }
      }
    });

    return NextResponse.json({ success: true, updated: true });
  } catch (error: unknown) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Error al actualizar usuario' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Solo los Super Administradores pueden eliminar usuarios' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('id');

    if (!userId) {
      return NextResponse.json({ error: 'ID de usuario requerido' }, { status: 400 });
    }

    if (userId === session.userId) {
      return NextResponse.json({ error: 'No puedes eliminar tu propia cuenta de usuario en sesión' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    // Prevent deleting the last super admin
    if (user.role === 'SUPER_ADMIN') {
      const superAdminCount = await prisma.user.count({
        where: { role: 'SUPER_ADMIN' },
      });
      if (superAdminCount <= 1) {
        return NextResponse.json({ error: 'No se puede eliminar el único Super Administrador del sistema' }, { status: 400 });
      }
    }

    await prisma.user.delete({
      where: { id: userId },
    });

    return NextResponse.json({ success: true, deleted: true });
  } catch (error: unknown) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Error al eliminar usuario' }, { status: 500 });
  }
}

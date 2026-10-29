import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import {
  determineCustomerTier,
  calculateNextTierProgress,
  checkBirthdayCelebration,
  LOYALTY_TIERS,
  LoyaltyTierId,
} from '@/lib/loyaltyTiers';
import { generateCustomerWalletQrCode, getCashbackRateByTier } from '@/lib/wallet';

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q');
    const brandId = searchParams.get('brandId') || (session.activeBrandId as string | undefined);
    const filter = searchParams.get('filter'); // 'all', 'vip', 'recent', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'birthdays'

    const whereClause: Prisma.CustomerWhereInput = {};

    // Filter by active brand if brandId provided or customer belongs to brand
    if (brandId && session.role !== 'SUPER_ADMIN') {
      whereClause.OR = [
        { brandId },
        { brandId: null },
      ];
    }

    if (q) {
      const searchTerms: Prisma.CustomerWhereInput[] = [
        { name: { contains: q } },
        { phone: { contains: q } },
      ];
      if (whereClause.OR) {
        whereClause.AND = [{ OR: searchTerms }];
      } else {
        whereClause.OR = searchTerms;
      }
    }

    if (filter === 'vip') {
      whereClause.OR = [
        { totalOrders: { gte: 5 } },
        { totalSpent: { gte: 2500 } },
        { tier: { in: ['SILVER', 'GOLD', 'PLATINUM'] } },
      ];
    } else if (filter && ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'].includes(filter)) {
      whereClause.tier = filter;
    }

    let customers = await prisma.customer.findMany({
      where: whereClause,
      include: {
        brand: {
          select: { id: true, name: true, primaryColor: true },
        },
        orders: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          include: {
            brand: { select: { name: true } },
            items: {
              include: {
                product: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: filter === 'recent' ? { updatedAt: 'desc' } : { totalSpent: 'desc' },
    });

    // Evaluate auto-tier promotions and augment with tier progress and birthday info
    const now = new Date();
    const augmentedCustomers = await Promise.all(
      customers.map(async (c) => {
        const correctTier = determineCustomerTier(c.totalSpent, c.totalOrders);
        let currentTier = c.tier as LoyaltyTierId;

        // Auto-upgrade tier if customer has earned higher tier but DB has lower
        if (
          (currentTier === 'BRONZE' && correctTier.id !== 'BRONZE') ||
          (currentTier === 'SILVER' && (correctTier.id === 'GOLD' || correctTier.id === 'PLATINUM')) ||
          (currentTier === 'GOLD' && correctTier.id === 'PLATINUM')
        ) {
          try {
            await prisma.customer.update({
              where: { id: c.id },
              data: {
                tier: correctTier.id,
                pointsMultiplier: correctTier.pointsMultiplier,
                tierDiscountPct: correctTier.discountPct,
              },
            });
            currentTier = correctTier.id;
            c.tier = correctTier.id;
            c.pointsMultiplier = correctTier.pointsMultiplier;
            c.tierDiscountPct = correctTier.discountPct;
          } catch (e) {
            console.error('Error auto-upgrading customer tier:', e);
          }
        }

        const tierConfig = LOYALTY_TIERS[currentTier] || LOYALTY_TIERS.BRONZE;
        const tierProgress = calculateNextTierProgress(c.totalSpent, c.totalOrders);
        const birthdayInfo = checkBirthdayCelebration(c.birthDate, now);

        return {
          ...c,
          tierConfig,
          tierProgress,
          birthdayInfo,
        };
      })
    );

    // Apply birthdays filter in-memory if requested
    let finalCustomers = augmentedCustomers;
    if (filter === 'birthdays') {
      finalCustomers = augmentedCustomers.filter(c => c.birthdayInfo.isBirthdayThisMonth);
    }

    // Compute stats
    const totalCustomers = await prisma.customer.count();
    const vipCount = await prisma.customer.count({
      where: {
        OR: [
          { totalOrders: { gte: 5 } },
          { totalSpent: { gte: 2500 } },
          { tier: { in: ['SILVER', 'GOLD', 'PLATINUM'] } },
        ],
      },
    });

    const bronzeCount = await prisma.customer.count({ where: { tier: 'BRONZE' } });
    const silverCount = await prisma.customer.count({ where: { tier: 'SILVER' } });
    const goldCount = await prisma.customer.count({ where: { tier: 'GOLD' } });
    const platinumCount = await prisma.customer.count({ where: { tier: 'PLATINUM' } });

    const birthdayCount = augmentedCustomers.filter(c => c.birthdayInfo.isBirthdayThisMonth).length;

    const aggregates = await prisma.customer.aggregate({
      _sum: {
        loyaltyPoints: true,
        totalSpent: true,
        walletBalance: true,
        totalCashbackEarned: true,
        totalCashbackSpent: true,
      },
      _avg: {
        totalSpent: true,
      },
    });

    return NextResponse.json({
      customers: finalCustomers,
      stats: {
        totalCustomers,
        vipCustomers: vipCount,
        totalPoints: aggregates._sum.loyaltyPoints || 0,
        totalSpent: aggregates._sum.totalSpent || 0,
        averageSpent: aggregates._avg.totalSpent || 0,
        totalWalletBalance: aggregates._sum.walletBalance || 0,
        totalCashbackEarned: aggregates._sum.totalCashbackEarned || 0,
        totalCashbackSpent: aggregates._sum.totalCashbackSpent || 0,
        bronzeCount,
        silverCount,
        goldCount,
        platinumCount,
        birthdayCount,
      },
    });
  } catch (error: unknown) {
    console.error('Error fetching customers:', error);
    return NextResponse.json({ error: 'Error al obtener clientes' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const data = await req.json();
    const {
      name,
      phone,
      email,
      address,
      notes,
      birthDate,
      initialPoints = 0,
      tier = 'BRONZE',
    } = data;

    if (!name || !phone) {
      return NextResponse.json({ error: 'Nombre y teléfono son obligatorios' }, { status: 400 });
    }

    const cleanPhone = phone.trim();

    const existing = await prisma.customer.findUnique({
      where: { phone: cleanPhone },
    });

    if (existing) {
      return NextResponse.json({ error: 'Ya existe un cliente registrado con este teléfono' }, { status: 409 });
    }

    const tierKey = (tier in LOYALTY_TIERS ? tier : 'BRONZE') as LoyaltyTierId;
    const tierConfig = LOYALTY_TIERS[tierKey];

    const customer = await prisma.customer.create({
      data: {
        name: name.trim(),
        phone: cleanPhone,
        email: email ? email.trim() : null,
        address: address ? address.trim() : null,
        notes: notes ? notes.trim() : null,
        birthDate: birthDate ? birthDate.trim() : null,
        tier: tierConfig.id,
        pointsMultiplier: tierConfig.pointsMultiplier,
        tierDiscountPct: tierConfig.discountPct,
        loyaltyPoints: parseInt(String(initialPoints), 10) || 0,
        walletBalance: 0,
        walletQrCode: generateCustomerWalletQrCode(cleanPhone),
        cashbackRatePct: getCashbackRateByTier(tierConfig.id),
        totalCashbackEarned: 0,
        totalCashbackSpent: 0,
        brandId: session.activeBrandId || null,
      },
    });

    return NextResponse.json({ success: true, customer }, { status: 201 });
  } catch (error: unknown) {
    console.error('Error creating customer:', error);
    return NextResponse.json({ error: 'Error al registrar cliente' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const data = await req.json();
    const {
      id,
      name,
      phone,
      email,
      address,
      notes,
      birthDate,
      tier,
      pointsMultiplier,
      tierDiscountPct,
      pointsAdjustment,
      cashbackRatePct,
    } = data;

    if (!id) {
      return NextResponse.json({ error: 'ID de cliente requerido' }, { status: 400 });
    }

    const customer = await prisma.customer.findUnique({
      where: { id },
    });

    if (!customer) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }

    // Check phone uniqueness if changing
    if (phone && phone.trim() !== customer.phone) {
      const existingPhone = await prisma.customer.findUnique({
        where: { phone: phone.trim() },
      });
      if (existingPhone && existingPhone.id !== id) {
        return NextResponse.json({ error: 'El número de teléfono ya está registrado por otro cliente' }, { status: 409 });
      }
    }

    let updatedPoints = customer.loyaltyPoints;
    if (typeof pointsAdjustment === 'number') {
      updatedPoints = Math.max(0, updatedPoints + pointsAdjustment);
    }

    // If tier is explicitly modified, sync multipliers unless explicitly provided
    let newTier = customer.tier;
    let newMultiplier = customer.pointsMultiplier;
    let newDiscount = customer.tierDiscountPct;

    if (tier && tier in LOYALTY_TIERS) {
      const tConfig = LOYALTY_TIERS[tier as LoyaltyTierId];
      newTier = tConfig.id;
      newMultiplier = pointsMultiplier !== undefined ? Number(pointsMultiplier) : tConfig.pointsMultiplier;
      newDiscount = tierDiscountPct !== undefined ? Number(tierDiscountPct) : tConfig.discountPct;
    } else {
      if (pointsMultiplier !== undefined) newMultiplier = Number(pointsMultiplier);
      if (tierDiscountPct !== undefined) newDiscount = Number(tierDiscountPct);
    }

    const updated = await prisma.customer.update({
      where: { id },
      data: {
        name: name ? name.trim() : customer.name,
        phone: phone ? phone.trim() : customer.phone,
        email: email !== undefined ? (email ? email.trim() : null) : customer.email,
        address: address !== undefined ? (address ? address.trim() : null) : customer.address,
        notes: notes !== undefined ? (notes ? notes.trim() : null) : customer.notes,
        birthDate: birthDate !== undefined ? (birthDate ? birthDate.trim() : null) : customer.birthDate,
        tier: newTier,
        pointsMultiplier: newMultiplier,
        tierDiscountPct: newDiscount,
        loyaltyPoints: updatedPoints,
        cashbackRatePct: cashbackRatePct !== undefined ? (cashbackRatePct === null ? null : Number(cashbackRatePct)) : customer.cashbackRatePct,
        walletQrCode: customer.walletQrCode || generateCustomerWalletQrCode(customer.id),
      },
    });

    return NextResponse.json({ success: true, customer: updated });
  } catch (error: unknown) {
    console.error('Error updating customer:', error);
    return NextResponse.json({ error: 'Error al actualizar cliente' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'BRAND_ADMIN')) {
      return NextResponse.json({ error: 'No autorizado para eliminar clientes' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID de cliente requerido' }, { status: 400 });
    }

    // Unlink orders before deleting customer if any
    await prisma.order.updateMany({
      where: { customerId: id },
      data: { customerId: null },
    });

    await prisma.customer.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Cliente eliminado correctamente' });
  } catch (error: unknown) {
    console.error('Error deleting customer:', error);
    return NextResponse.json({ error: 'Error al eliminar cliente' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateGiftCardCode } from '@/lib/giftCards';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const brandId = searchParams.get('brandId');
    const search = searchParams.get('search')?.trim();
    const status = searchParams.get('status');
    const customerId = searchParams.get('customerId');

    if (!brandId) {
      return NextResponse.json({ error: 'Marca requerida' }, { status: 400 });
    }

    const where: any = { brandId };

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (customerId) {
      where.customerId = customerId;
    }

    if (search) {
      where.OR = [
        { code: { contains: search } },
        { customer: { name: { contains: search } } },
        { customer: { phone: { contains: search } } },
        { notes: { contains: search } },
      ];
    }

    const [cards, totalCards, totalBalanceAgg] = await Promise.all([
      prisma.giftCard.findMany({
        where,
        include: {
          customer: {
            select: { id: true, name: true, phone: true, email: true },
          },
          transactions: {
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.giftCard.count({ where: { brandId } }),
      prisma.giftCard.aggregate({
        where: { brandId, status: 'ACTIVE' },
        _sum: { balance: true },
      }),
    ]);

    // Check expiration on the fly
    const now = new Date();
    const activeCount = cards.filter(
      (c) => c.status === 'ACTIVE' && (!c.expiresAt || new Date(c.expiresAt) > now)
    ).length;

    return NextResponse.json({
      cards,
      summary: {
        totalCards,
        activeCards: activeCount,
        totalCirculatingBalance: totalBalanceAgg._sum.balance || 0,
      },
    });
  } catch (error: any) {
    console.error('Error fetching gift cards:', error);
    return NextResponse.json({ error: 'Error al obtener tarjetas de regalo' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      brandId,
      code,
      pin,
      customerId,
      initialBalance = 0,
      cardType = 'DIGITAL',
      expiresAt,
      notes,
      createdById,
    } = body;

    if (!brandId) {
      return NextResponse.json({ error: 'Marca requerida' }, { status: 400 });
    }

    // Auto-generate code if not provided
    const cardCode = code ? String(code).trim().toUpperCase() : generateGiftCardCode();

    // Check unique code
    const existing = await prisma.giftCard.findUnique({
      where: { code: cardCode },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Ya existe una tarjeta con el código ${cardCode}. Por favor ingresa otro o genera uno nuevo.` },
        { status: 409 }
      );
    }

    const balanceNum = parseFloat(String(initialBalance)) || 0;
    if (balanceNum < 0) {
      return NextResponse.json({ error: 'El saldo inicial no puede ser negativo' }, { status: 400 });
    }

    const initialStatus = balanceNum > 0 ? 'ACTIVE' : 'DEPLETED';

    const card = await prisma.$transaction(async (tx) => {
      const created = await tx.giftCard.create({
        data: {
          brandId,
          code: cardCode,
          pin: pin ? String(pin).trim() : null,
          customerId: customerId || null,
          initialBalance: balanceNum,
          balance: balanceNum,
          status: initialStatus,
          cardType,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          notes: notes ? notes.trim() : null,
        },
        include: {
          customer: {
            select: { id: true, name: true, phone: true },
          },
        },
      });

      // If initial balance was loaded, create initial RECHARGE transaction
      if (balanceNum > 0) {
        await tx.giftCardTransaction.create({
          data: {
            giftCardId: created.id,
            type: 'RECHARGE',
            amount: balanceNum,
            balanceBefore: 0,
            balanceAfter: balanceNum,
            notes: 'Carga de saldo inicial por emisión de tarjeta',
            createdById: createdById || null,
          },
        });
      }

      return created;
    });

    return NextResponse.json({ success: true, card });
  } catch (error: any) {
    console.error('Error creating gift card:', error);
    return NextResponse.json({ error: error.message || 'Error al emitir tarjeta de regalo' }, { status: 500 });
  }
}

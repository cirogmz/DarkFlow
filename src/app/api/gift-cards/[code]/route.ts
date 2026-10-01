import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const cleanCode = decodeURIComponent(code).trim().toUpperCase();

    // Search by code or id
    let card = await prisma.giftCard.findFirst({
      where: {
        OR: [{ code: cleanCode }, { id: code }],
      },
      include: {
        customer: {
          select: { id: true, name: true, phone: true, email: true, loyaltyPoints: true },
        },
        transactions: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!card) {
      return NextResponse.json({ error: 'Tarjeta de regalo o monedero no encontrado' }, { status: 404 });
    }

    // Auto-expire if date passed
    if (card.status === 'ACTIVE' && card.expiresAt && new Date() > new Date(card.expiresAt)) {
      card = await prisma.giftCard.update({
        where: { id: card.id },
        data: { status: 'EXPIRED' },
        include: {
          customer: {
            select: { id: true, name: true, phone: true, email: true, loyaltyPoints: true },
          },
          transactions: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });
    }

    return NextResponse.json({ card });
  } catch (error: any) {
    console.error('Error fetching gift card:', error);
    return NextResponse.json({ error: 'Error al consultar tarjeta de regalo' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const cleanCode = decodeURIComponent(code).trim().toUpperCase();
    const body = await req.json();

    const existing = await prisma.giftCard.findFirst({
      where: {
        OR: [{ code: cleanCode }, { id: code }],
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Tarjeta no encontrada' }, { status: 404 });
    }

    const { status, notes, pin, expiresAt, customerId, cardType } = body;

    const updated = await prisma.giftCard.update({
      where: { id: existing.id },
      data: {
        ...(status !== undefined && { status }),
        ...(notes !== undefined && { notes: notes ? notes.trim() : null }),
        ...(pin !== undefined && { pin: pin ? String(pin).trim() : null }),
        ...(expiresAt !== undefined && { expiresAt: expiresAt ? new Date(expiresAt) : null }),
        ...(customerId !== undefined && { customerId: customerId || null }),
        ...(cardType !== undefined && { cardType }),
      },
      include: {
        customer: {
          select: { id: true, name: true, phone: true, email: true },
        },
      },
    });

    return NextResponse.json({ success: true, card: updated });
  } catch (error: any) {
    console.error('Error updating gift card:', error);
    return NextResponse.json({ error: 'Error al actualizar tarjeta de regalo' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const settlement = await prisma.tipSettlement.findUnique({
      where: { id },
      include: {
        distributionDetails: {
          orderBy: { adjustedAmount: 'desc' },
        },
        brand: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    if (!settlement) {
      return NextResponse.json({ error: 'Liquidación no encontrada' }, { status: 404 });
    }

    return NextResponse.json(settlement);
  } catch (error: any) {
    console.error('Error al obtener liquidación:', error);
    return NextResponse.json({ error: error.message || 'Error del servidor' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const {
      status,
      notes,
      approvedById,
      approvedByName,
      updatedItems, // Array de { id, adjustedAmount, adjustmentReason, payoutMethod, payoutStatus }
    } = body;

    const existing = await prisma.tipSettlement.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Liquidación no encontrada' }, { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Actualizar campos del encabezado
      const updateData: any = {};
      if (status) {
        updateData.status = status;
        if (status === 'APPROVED') {
          updateData.approvedAt = new Date();
          updateData.approvedById = approvedById || null;
          updateData.approvedByName = approvedByName || 'Supervisor';
        } else if (status === 'DISPERSED') {
          updateData.dispersedAt = new Date();
        }
      }
      if (notes !== undefined) updateData.notes = notes;

      // 2. Si se dispersa la liquidación completa, marcar todos los ítems como PAID
      if (status === 'DISPERSED') {
        await tx.tipDisbursementItem.updateMany({
          where: { settlementId: id },
          data: {
            payoutStatus: 'PAID',
            paidAt: new Date(),
          },
        });
      }

      // 3. Actualizar ítems individuales si fueron provistos
      if (Array.isArray(updatedItems)) {
        for (const item of updatedItems) {
          if (!item.id) continue;
          await tx.tipDisbursementItem.update({
            where: { id: item.id },
            data: {
              adjustedAmount: item.adjustedAmount !== undefined ? Number(item.adjustedAmount) : undefined,
              adjustmentReason: item.adjustmentReason !== undefined ? item.adjustmentReason : undefined,
              payoutMethod: item.payoutMethod || undefined,
              payoutStatus: item.payoutStatus || undefined,
              paidAt: item.payoutStatus === 'PAID' ? new Date() : undefined,
            },
          });
        }
      }

      await tx.tipSettlement.update({
        where: { id },
        data: updateData,
      });

      return tx.tipSettlement.findUnique({
        where: { id },
        include: {
          distributionDetails: {
            orderBy: { adjustedAmount: 'desc' },
          },
        },
      });
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Error al actualizar liquidación:', error);
    return NextResponse.json({ error: error.message || 'Error del servidor' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const existing = await prisma.tipSettlement.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Liquidación no encontrada' }, { status: 404 });
    }

    if (existing.status === 'DISPERSED') {
      return NextResponse.json(
        { error: 'No se puede eliminar una liquidación que ya ha sido dispersada.' },
        { status: 400 }
      );
    }

    await prisma.tipSettlement.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Liquidación eliminada' });
  } catch (error: any) {
    console.error('Error al eliminar liquidación:', error);
    return NextResponse.json({ error: error.message || 'Error del servidor' }, { status: 500 });
  }
}


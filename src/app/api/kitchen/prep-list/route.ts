import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { recordAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const activeBrandId = session.activeBrandId as string;
    const { searchParams } = new URL(req.url);

    const dateParam = searchParams.get('date');
    const shiftParam = searchParams.get('shift');

    const whereClause: Record<string, unknown> = {
      brandId: activeBrandId,
    };

    if (dateParam) {
      const startOfDay = new Date(`${dateParam}T00:00:00.000Z`);
      const endOfDay = new Date(`${dateParam}T23:59:59.999Z`);
      whereClause.date = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }

    if (shiftParam && shiftParam !== 'ALL') {
      whereClause.shift = shiftParam.toUpperCase();
    }

    const prepLists = await prisma.dailyPrepList.findMany({
      where: whereClause,
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
        items: {
          include: {
            ingredient: {
              select: {
                id: true,
                name: true,
                unit: true,
                stock: true,
                cost: true,
                type: true,
                yieldQuantity: true,
                yieldUnit: true,
              },
            },
            product: {
              select: {
                id: true,
                name: true,
                price: true,
                kitchenStation: true,
              },
            },
          },
          orderBy: [
            { station: 'asc' },
            { status: 'asc' },
            { suggestedPrepQty: 'desc' },
          ],
        },
      },
      orderBy: { date: 'desc' },
      take: 30,
    });

    // Decorate with progress stats
    const decoratedLists = prepLists.map((list) => {
      const total = list.items.length;
      const completed = list.items.filter((i) => i.status === 'COMPLETED').length;
      const inPrep = list.items.filter((i) => i.status === 'IN_PREP').length;
      const pending = list.items.filter((i) => i.status === 'PENDING').length;
      const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

      return {
        ...list,
        stats: {
          total,
          completed,
          inPrep,
          pending,
          progressPct,
        },
      };
    });

    return NextResponse.json({ prepLists: decoratedLists });
  } catch (error: unknown) {
    console.error('Error fetching prep lists:', error);
    return NextResponse.json({ error: 'Error al consultar listas de preparación' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const activeBrandId = session.activeBrandId as string;
    const userId = session.userId as string;

    const body = await req.json();
    const {
      date,
      shift = 'ALL_DAY',
      bufferPct = 15,
      lookbackWeeks = 4,
      notes,
      items = [],
    } = body;

    if (!date) {
      return NextResponse.json({ error: 'La fecha es obligatoria' }, { status: 400 });
    }

    const targetDate = new Date(`${date}T12:00:00.000Z`);
    const startOfDay = new Date(`${date}T00:00:00.000Z`);
    const endOfDay = new Date(`${date}T23:59:59.999Z`);

    // Execute atomic save or update
    const savedList = await prisma.$transaction(async (tx) => {
      // Check if a prep list for this brand, date and shift already exists
      const existing = await tx.dailyPrepList.findFirst({
        where: {
          brandId: activeBrandId,
          date: {
            gte: startOfDay,
            lte: endOfDay,
          },
          shift: shift.toUpperCase(),
        },
        include: {
          items: true,
        },
      });

      let listId: string;

      if (existing) {
        listId = existing.id;
        await tx.dailyPrepList.update({
          where: { id: listId },
          data: {
            bufferPct: parseFloat(bufferPct) || 15,
            lookbackWeeks: parseInt(lookbackWeeks, 10) || 4,
            notes: notes || existing.notes,
            updatedAt: new Date(),
          },
        });

        // Delete existing items that are still PENDING to avoid duplicates
        await tx.dailyPrepItem.deleteMany({
          where: {
            prepListId: listId,
            status: 'PENDING',
          },
        });
      } else {
        const created = await tx.dailyPrepList.create({
          data: {
            brandId: activeBrandId,
            date: targetDate,
            shift: shift.toUpperCase(),
            bufferPct: parseFloat(bufferPct) || 15,
            lookbackWeeks: parseInt(lookbackWeeks, 10) || 4,
            notes: notes || null,
            createdById: userId || null,
            status: 'DRAFT',
          },
        });
        listId = created.id;
      }

      // Insert new items
      if (Array.isArray(items) && items.length > 0) {
        for (const item of items) {
          await tx.dailyPrepItem.create({
            data: {
              prepListId: listId,
              ingredientId: item.ingredientId || null,
              productId: item.productId || null,
              itemName: item.itemName || 'Insumo Preparado',
              itemType: item.itemType || 'SUB_RECIPE',
              station: (item.station || 'COCINA').toUpperCase(),
              unit: item.unit || 'UNIDAD',
              currentStock: parseFloat(item.currentStock) || 0,
              projectedDemand: parseFloat(item.projectedDemand) || 0,
              suggestedPrepQty: parseFloat(item.suggestedPrepQty) || 0,
              actualPrepQty: parseFloat(item.actualPrepQty) || 0,
              status: item.status || 'PENDING',
              notes: item.notes || null,
            },
          });
        }
      }

      return tx.dailyPrepList.findUnique({
        where: { id: listId },
        include: {
          items: {
            include: {
              ingredient: true,
              product: true,
            },
            orderBy: [{ station: 'asc' }, { suggestedPrepQty: 'desc' }],
          },
          createdBy: {
            select: { id: true, name: true },
          },
        },
      });
    });

    await recordAuditLog({
      action: 'PREP_LIST_SAVED',
      entityType: 'DAILY_PREP_LIST',
      entityId: savedList?.id,
      brandId: activeBrandId,
      userId,
      severity: 'INFO',
      details: {
        date,
        shift,
        itemsCount: items.length,
      },
      req,
    });

    return NextResponse.json({
      success: true,
      message: 'Lista de preparación guardada con éxito',
      prepList: savedList,
    });
  } catch (error: unknown) {
    console.error('Error saving prep list:', error);
    return NextResponse.json({ error: 'Error al guardar lista de preparación' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { recordAuditLog } from '@/lib/audit';
import { calculateEquipmentHealth, calculateNextMaintenanceDate } from '@/lib/equipmentMaintenance';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const activeBrandId = session.activeBrandId as string;

    const equipment = await prisma.kitchenEquipment.findFirst({
      where: { id, brandId: activeBrandId },
      include: {
        workOrders: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!equipment) {
      return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 });
    }

    const health = calculateEquipmentHealth(equipment, equipment.workOrders, new Date());

    return NextResponse.json({
      success: true,
      equipment: {
        ...equipment,
        health,
      },
    });
  } catch (error: unknown) {
    console.error('Error fetching equipment details:', error);
    return NextResponse.json({ error: 'Error al obtener equipo' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const activeBrandId = session.activeBrandId as string;
    const body = await req.json();

    const existing = await prisma.kitchenEquipment.findFirst({
      where: { id, brandId: activeBrandId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 });
    }

    const {
      name,
      code,
      category,
      location,
      brandModel,
      serialNumber,
      vendorName,
      vendorContact,
      status,
      criticality,
      purchaseDate,
      purchaseCost,
      warrantyExpiration,
      maintenanceFrequencyDays,
      nextMaintenanceDate,
      notes,
    } = body;

    const updated = await prisma.kitchenEquipment.update({
      where: { id },
      data: {
        name: name !== undefined ? String(name).trim() : existing.name,
        code: code !== undefined ? String(code).trim().toUpperCase() : existing.code,
        category: category !== undefined ? category : existing.category,
        location: location !== undefined ? String(location).trim() : existing.location,
        brandModel: brandModel !== undefined ? (brandModel ? String(brandModel).trim() : null) : existing.brandModel,
        serialNumber: serialNumber !== undefined ? (serialNumber ? String(serialNumber).trim() : null) : existing.serialNumber,
        vendorName: vendorName !== undefined ? (vendorName ? String(vendorName).trim() : null) : existing.vendorName,
        vendorContact: vendorContact !== undefined ? (vendorContact ? String(vendorContact).trim() : null) : existing.vendorContact,
        status: status !== undefined ? status : existing.status,
        criticality: criticality !== undefined ? criticality : existing.criticality,
        purchaseDate: purchaseDate !== undefined ? (purchaseDate ? new Date(purchaseDate) : null) : existing.purchaseDate,
        purchaseCost: purchaseCost !== undefined ? parseFloat(String(purchaseCost)) || 0 : existing.purchaseCost,
        warrantyExpiration: warrantyExpiration !== undefined ? (warrantyExpiration ? new Date(warrantyExpiration) : null) : existing.warrantyExpiration,
        maintenanceFrequencyDays: maintenanceFrequencyDays !== undefined ? parseInt(String(maintenanceFrequencyDays), 10) || 90 : existing.maintenanceFrequencyDays,
        nextMaintenanceDate: nextMaintenanceDate !== undefined ? (nextMaintenanceDate ? new Date(nextMaintenanceDate) : null) : existing.nextMaintenanceDate,
        notes: notes !== undefined ? (notes ? String(notes).trim() : null) : existing.notes,
      },
    });

    await recordAuditLog({
      action: 'EQUIPMENT_UPDATED',
      entityType: 'EQUIPMENT',
      entityId: id,
      details: {
        code: updated.code,
        name: updated.name,
        status: updated.status,
      },
      severity: 'INFO',
      brandId: activeBrandId,
      userId: session.userId,
      req,
    });

    return NextResponse.json({ success: true, equipment: updated });
  } catch (error: any) {
    console.error('Error updating kitchen equipment:', error);
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Ya existe otro equipo con ese código' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Error al actualizar equipo' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const activeBrandId = session.activeBrandId as string;

    const existing = await prisma.kitchenEquipment.findFirst({
      where: { id, brandId: activeBrandId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 });
    }

    await prisma.kitchenEquipment.delete({
      where: { id },
    });

    await recordAuditLog({
      action: 'EQUIPMENT_DELETED',
      entityType: 'EQUIPMENT',
      entityId: id,
      details: {
        code: existing.code,
        name: existing.name,
      },
      severity: 'WARNING',
      brandId: activeBrandId,
      userId: session.userId,
      req,
    });

    return NextResponse.json({ success: true, message: 'Equipo eliminado correctamente' });
  } catch (error: unknown) {
    console.error('Error deleting kitchen equipment:', error);
    return NextResponse.json({ error: 'Error al eliminar equipo' }, { status: 500 });
  }
}

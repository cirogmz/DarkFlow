import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const existing = await prisma.reservation.findUnique({
      where: { id },
      include: { table: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Reservación no encontrada" }, { status: 404 });
    }

    const {
      customerName,
      customerPhone,
      customerEmail,
      diners,
      reservationDate,
      durationMinutes,
      status,
      tableId,
      zonePreference,
      notes,
    } = body;

    const targetTableId = tableId !== undefined ? tableId : existing.tableId;
    const targetStatus = status !== undefined ? status : existing.status;

    // Execute in transaction to keep table status consistent
    const updated = await prisma.$transaction(async (tx) => {
      // If seating comensal at a table, mark table OCCUPIED
      if (targetStatus === "SEATED" && targetTableId) {
        await tx.table.update({
          where: { id: targetTableId },
          data: { status: "OCCUPIED" },
        });
      }

      // If cancelling a seated reservation, check if table should be made AVAILABLE
      if ((targetStatus === "CANCELLED" || targetStatus === "NO_SHOW") && existing.status === "SEATED" && targetTableId) {
        // Only set available if no active orders on table
        const activeOrders = await tx.order.count({
          where: {
            tableId: targetTableId,
            status: { in: ["RECEIVED", "PREPARING", "READY"] },
          },
        });
        if (activeOrders === 0) {
          await tx.table.update({
            where: { id: targetTableId },
            data: { status: "AVAILABLE" },
          });
        }
      }

      return await tx.reservation.update({
        where: { id },
        data: {
          ...(customerName !== undefined && { customerName: customerName.trim() }),
          ...(customerPhone !== undefined && { customerPhone: customerPhone ? customerPhone.trim() : null }),
          ...(customerEmail !== undefined && { customerEmail: customerEmail ? customerEmail.trim().toLowerCase() : null }),
          ...(diners !== undefined && { diners: parseInt(String(diners), 10) }),
          ...(reservationDate !== undefined && { reservationDate: new Date(reservationDate) }),
          ...(durationMinutes !== undefined && { durationMinutes: parseInt(String(durationMinutes), 10) }),
          ...(targetStatus !== undefined && { status: targetStatus }),
          ...(tableId !== undefined && { tableId: tableId || null }),
          ...(zonePreference !== undefined && { zonePreference }),
          ...(notes !== undefined && { notes: notes ? notes.trim() : null }),
        },
        include: {
          table: true,
        },
      });
    });

    return NextResponse.json({ success: true, reservation: updated });
  } catch (error: any) {
    console.error("Error updating reservation:", error);
    return NextResponse.json({ error: "Error al actualizar la reservación" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.reservation.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Reservación no encontrada" }, { status: 404 });
    }

    await prisma.reservation.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Reservación eliminada correctamente" });
  } catch (error: any) {
    console.error("Error deleting reservation:", error);
    return NextResponse.json({ error: "Error al eliminar la reservación" }, { status: 500 });
  }
}

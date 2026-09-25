import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();

    const existing = await prisma.waitlistEntry.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Entrada en lista de espera no encontrada" }, { status: 404 });
    }

    const {
      status,
      tableId,
      diners,
      estimatedWaitMinutes,
      zonePreference,
      notes,
    } = body;

    const targetStatus = status !== undefined ? status : existing.status;
    const targetTableId = tableId !== undefined ? tableId : existing.tableId;

    const updated = await prisma.$transaction(async (tx) => {
      // If seating comensal at a table, mark table OCCUPIED
      if (targetStatus === "SEATED" && targetTableId) {
        await tx.table.update({
          where: { id: targetTableId },
          data: { status: "OCCUPIED" },
        });
      }

      const updateData: any = {
        ...(status !== undefined && { status }),
        ...(tableId !== undefined && { tableId: tableId || null }),
        ...(diners !== undefined && { diners: parseInt(String(diners), 10) }),
        ...(estimatedWaitMinutes !== undefined && { estimatedWaitMinutes: parseInt(String(estimatedWaitMinutes), 10) }),
        ...(zonePreference !== undefined && { zonePreference }),
        ...(notes !== undefined && { notes: notes ? notes.trim() : null }),
      };

      if (targetStatus === "NOTIFIED" && !existing.notifiedAt) {
        updateData.notifiedAt = new Date();
      }

      if (targetStatus === "SEATED" && !existing.seatedAt) {
        updateData.seatedAt = new Date();
      }

      return await tx.waitlistEntry.update({
        where: { id },
        data: updateData,
        include: {
          table: true,
        },
      });
    });

    return NextResponse.json({ success: true, entry: updated });
  } catch (error: any) {
    console.error("Error updating waitlist entry:", error);
    return NextResponse.json({ error: "Error al actualizar entrada en lista de espera" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const existing = await prisma.waitlistEntry.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Entrada no encontrada" }, { status: 404 });
    }

    await prisma.waitlistEntry.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Entrada eliminada de la lista de espera" });
  } catch (error: any) {
    console.error("Error deleting waitlist entry:", error);
    return NextResponse.json({ error: "Error al eliminar de lista de espera" }, { status: 500 });
  }
}

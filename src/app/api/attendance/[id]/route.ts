import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const existing = await prisma.attendanceRecord.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Registro de asistencia no encontrado" }, { status: 404 });
    }

    const { clockIn, clockOut, breakMinutes, notes, status } = body;

    const newClockIn = clockIn ? new Date(clockIn) : existing.clockIn;
    const newClockOut = clockOut !== undefined ? (clockOut ? new Date(clockOut) : null) : existing.clockOut;
    const newBreak = breakMinutes !== undefined ? Number(breakMinutes) : existing.breakMinutes;

    let computedHours = existing.totalHours;
    let newStatus = status !== undefined ? status : existing.status;

    if (newClockOut) {
      const diffMs = newClockOut.getTime() - newClockIn.getTime() - (newBreak * 60 * 1000);
      computedHours = parseFloat(Math.max(0, diffMs / (1000 * 60 * 60)).toFixed(2));
      if (existing.status === "ACTIVE") {
        newStatus = "COMPLETED";
      }
    } else {
      computedHours = null;
    }

    const updated = await prisma.attendanceRecord.update({
      where: { id },
      data: {
        clockIn: newClockIn,
        clockOut: newClockOut,
        breakMinutes: newBreak,
        totalHours: computedHours,
        status: newStatus,
        ...(notes !== undefined && { notes: notes ? notes.trim() : null }),
      },
      include: {
        user: {
          select: { id: true, name: true, role: true },
        },
      },
    });

    return NextResponse.json({ success: true, record: updated });
  } catch (error: any) {
    console.error("Error updating attendance record:", error);
    return NextResponse.json({ error: "Error al actualizar registro de asistencia" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.attendanceRecord.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });
    }

    await prisma.attendanceRecord.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Registro eliminado correctamente" });
  } catch (error: any) {
    console.error("Error deleting attendance record:", error);
    return NextResponse.json({ error: "Error al eliminar registro" }, { status: 500 });
  }
}

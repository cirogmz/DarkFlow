import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();

    const existing = await prisma.printer.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Impresora no encontrada" }, { status: 404 });
    }

    const {
      name,
      connectionType,
      ipAddress,
      port,
      paperWidth,
      targetStation,
      autoPrintTrigger,
      isActive,
      notes,
    } = body;

    const updated = await prisma.printer.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(connectionType !== undefined && { connectionType }),
        ...(ipAddress !== undefined && { ipAddress: ipAddress.trim() }),
        ...(port !== undefined && { port: parseInt(String(port), 10) }),
        ...(paperWidth !== undefined && { paperWidth }),
        ...(targetStation !== undefined && { targetStation }),
        ...(autoPrintTrigger !== undefined && { autoPrintTrigger }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
        ...(notes !== undefined && { notes: notes ? notes.trim() : null }),
      },
    });

    return NextResponse.json({ success: true, printer: updated });
  } catch (error: any) {
    console.error("Error updating printer:", error);
    return NextResponse.json({ error: "Error al actualizar la impresora" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const existing = await prisma.printer.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Impresora no encontrada" }, { status: 404 });
    }

    await prisma.printer.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Impresora eliminada correctamente" });
  } catch (error: any) {
    console.error("Error deleting printer:", error);
    return NextResponse.json({ error: "Error al eliminar impresora" }, { status: 500 });
  }
}

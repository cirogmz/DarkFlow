import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { pinCode } = body;

    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    if (pinCode === null || pinCode === "") {
      // Clear PIN
      await prisma.user.update({
        where: { id },
        data: { pinCode: null },
      });
      return NextResponse.json({ success: true, message: "PIN de checador desactivado" });
    }

    const cleanPin = String(pinCode).trim();
    if (!/^\d{4}$/.test(cleanPin)) {
      return NextResponse.json(
        { error: "El PIN debe ser exactamente de 4 dígitos numéricos (ej. 1234)" },
        { status: 400 }
      );
    }

    // Check collision with another user
    const existingPinUser = await prisma.user.findFirst({
      where: {
        pinCode: cleanPin,
        NOT: { id },
      },
    });

    if (existingPinUser) {
      return NextResponse.json(
        { error: `Este PIN ya está asignado a otro colaborador (${existingPinUser.name}). Elige un PIN diferente.` },
        { status: 409 }
      );
    }

    await prisma.user.update({
      where: { id },
      data: { pinCode: cleanPin },
    });

    return NextResponse.json({
      success: true,
      message: `PIN asignado correctamente a ${user.name}`,
    });
  } catch (error: any) {
    console.error("Error setting user pin:", error);
    return NextResponse.json({ error: "Error al configurar el PIN de usuario" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  return POST(req, context);
}

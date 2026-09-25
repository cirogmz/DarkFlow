import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { pinCode, userId: explicitUserId, brandId: explicitBrandId, action = "AUTO", notes } = body;

    const cookieHeader = req.headers.get("cookie") || "";
    const session = getSessionFromCookies(cookieHeader);
    const headerBrandId = req.headers.get("x-brand-id");

    // 1. Identify User either by PIN or explicit UserId/Session
    let targetUser: any = null;

    if (pinCode && typeof pinCode === "string") {
      const cleanPin = pinCode.trim();
      targetUser = await prisma.user.findFirst({
        where: { pinCode: cleanPin },
        include: {
          brands: { include: { brand: true } },
        },
      });

      if (!targetUser) {
        return NextResponse.json(
          { error: "PIN no reconocido. Verifica tu clave de 4 dígitos." },
          { status: 401 }
        );
      }
    } else if (explicitUserId) {
      targetUser = await prisma.user.findUnique({
        where: { id: explicitUserId },
        include: {
          brands: { include: { brand: true } },
        },
      });
    } else if (session?.userId) {
      targetUser = await prisma.user.findUnique({
        where: { id: session.userId },
        include: {
          brands: { include: { brand: true } },
        },
      });
    }

    if (!targetUser) {
      return NextResponse.json(
        { error: "Usuario no identificado. Ingresa tu PIN de 4 dígitos." },
        { status: 400 }
      );
    }

    // 2. Resolve Active Brand
    const resolvedBrandId =
      explicitBrandId ||
      headerBrandId ||
      session?.activeBrandId ||
      targetUser.brands?.[0]?.brandId;

    if (!resolvedBrandId) {
      return NextResponse.json(
        { error: "No se pudo determinar la sucursal de trabajo." },
        { status: 400 }
      );
    }

    const brand = await prisma.brand.findUnique({
      where: { id: resolvedBrandId },
    });

    // 3. Find current active shift for this user and brand
    const activeShift = await prisma.attendanceRecord.findFirst({
      where: {
        userId: targetUser.id,
        brandId: resolvedBrandId,
        status: "ACTIVE",
      },
      orderBy: { clockIn: "desc" },
    });

    const now = new Date();

    // 4. Determine operation
    let determinedAction = action;
    if (action === "AUTO") {
      determinedAction = activeShift ? "CLOCK_OUT" : "CLOCK_IN";
    }

    if (determinedAction === "CLOCK_IN") {
      if (activeShift) {
        return NextResponse.json(
          {
            error: `Ya tienes un turno activo iniciado a las ${new Date(activeShift.clockIn).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}.`,
            activeShift,
          },
          { status: 400 }
        );
      }

      const newRecord = await prisma.attendanceRecord.create({
        data: {
          userId: targetUser.id,
          brandId: resolvedBrandId,
          clockIn: now,
          status: "ACTIVE",
          notes: notes ? notes.trim() : null,
        },
      });

      return NextResponse.json({
        success: true,
        action: "CLOCK_IN",
        record: newRecord,
        user: {
          id: targetUser.id,
          name: targetUser.name,
          role: targetUser.role,
        },
        brand: brand ? { id: brand.id, name: brand.name } : null,
        message: `¡Hola ${targetUser.name}! Tu entrada ha sido registrada correctamente a las ${now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}.`,
      });
    }

    if (determinedAction === "CLOCK_OUT") {
      if (!activeShift) {
        return NextResponse.json(
          { error: "No tienes ningún turno activo abierto para registrar salida." },
          { status: 400 }
        );
      }

      const startMs = new Date(activeShift.clockIn).getTime();
      const endMs = now.getTime();
      const breakMs = (activeShift.breakMinutes || 0) * 60 * 1000;
      const effectiveHours = Math.max(0, (endMs - startMs - breakMs) / (1000 * 60 * 60));
      const roundedHours = parseFloat(effectiveHours.toFixed(2));

      const updatedRecord = await prisma.attendanceRecord.update({
        where: { id: activeShift.id },
        data: {
          clockOut: now,
          totalHours: roundedHours,
          status: "COMPLETED",
          notes: notes ? `${activeShift.notes ? activeShift.notes + " | " : ""}${notes.trim()}` : activeShift.notes,
        },
      });

      const totalMins = Math.round(effectiveHours * 60);
      const hoursPart = Math.floor(totalMins / 60);
      const minsPart = totalMins % 60;
      const formattedDuration = `${hoursPart}h ${minsPart}m`;

      return NextResponse.json({
        success: true,
        action: "CLOCK_OUT",
        record: updatedRecord,
        user: {
          id: targetUser.id,
          name: targetUser.name,
          role: targetUser.role,
        },
        brand: brand ? { id: brand.id, name: brand.name } : null,
        totalHours: roundedHours,
        durationString: formattedDuration,
        message: `¡Hasta luego ${targetUser.name}! Salida registrada. Tiempo efectivo laborado: ${formattedDuration}.`,
      });
    }

    return NextResponse.json({ error: "Acción no soportada" }, { status: 400 });
  } catch (error: any) {
    console.error("Error in attendance clock route:", error);
    return NextResponse.json(
      { error: "Error al procesar el reloj checador" },
      { status: 500 }
    );
  }
}

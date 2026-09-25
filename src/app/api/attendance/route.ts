import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromCookies } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get("cookie") || "";
    const session = getSessionFromCookies(cookieHeader);
    const headerBrandId = req.headers.get("x-brand-id");

    const brandId = session?.activeBrandId || headerBrandId;
    if (!brandId) {
      return NextResponse.json({ error: "Sucursal / Marca no seleccionada" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    const status = searchParams.get("status");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const where: any = { brandId };

    if (userId) {
      where.userId = userId;
    }
    if (status) {
      where.status = status;
    }
    if (startDate || endDate) {
      where.clockIn = {};
      if (startDate) {
        where.clockIn.gte = new Date(startDate);
      }
      if (endDate) {
        const eDate = new Date(endDate);
        eDate.setHours(23, 59, 59, 999);
        where.clockIn.lte = eDate;
      }
    }

    const records = await prisma.attendanceRecord.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { clockIn: "desc" },
    });

    // Summary metrics for the view
    const activeCount = records.filter((r) => r.status === "ACTIVE").length;
    const completedCount = records.filter((r) => r.status === "COMPLETED").length;
    const totalHours = records.reduce((sum, r) => sum + (r.totalHours || 0), 0);

    return NextResponse.json({
      records,
      metrics: {
        totalRecords: records.length,
        activeCount,
        completedCount,
        totalHours: parseFloat(totalHours.toFixed(2)),
      },
    });
  } catch (error: any) {
    console.error("Error fetching attendance records:", error);
    return NextResponse.json({ error: "Error al obtener registros de asistencia" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get("cookie") || "";
    const session = getSessionFromCookies(cookieHeader);
    const headerBrandId = req.headers.get("x-brand-id");

    const body = await req.json();
    const brandId = body.brandId || session?.activeBrandId || headerBrandId;

    if (!brandId) {
      return NextResponse.json({ error: "brandId es requerido" }, { status: 400 });
    }

    const { userId, clockIn, clockOut, breakMinutes = 0, notes, status = "COMPLETED" } = body;

    if (!userId || !clockIn) {
      return NextResponse.json(
        { error: "userId y fecha/hora de entrada son requeridos" },
        { status: 400 }
      );
    }

    const cIn = new Date(clockIn);
    const cOut = clockOut ? new Date(clockOut) : null;
    let computedHours: number | null = null;

    if (cOut) {
      const diffMs = cOut.getTime() - cIn.getTime() - (Number(breakMinutes) || 0) * 60 * 1000;
      computedHours = parseFloat(Math.max(0, diffMs / (1000 * 60 * 60)).toFixed(2));
    }

    const record = await prisma.attendanceRecord.create({
      data: {
        userId,
        brandId,
        clockIn: cIn,
        clockOut: cOut,
        breakMinutes: Number(breakMinutes) || 0,
        totalHours: computedHours,
        status: cOut ? "COMPLETED" : status,
        notes: notes ? notes.trim() : null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, record }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating attendance record:", error);
    return NextResponse.json({ error: "Error al registrar asistencia manual" }, { status: 500 });
  }
}

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
    const dateParam = searchParams.get("date"); // YYYY-MM-DD
    const status = searchParams.get("status");
    const phone = searchParams.get("phone");

    const where: any = { brandId };

    if (status && status !== "ALL") {
      where.status = status;
    }

    if (phone) {
      where.customerPhone = { contains: phone.trim() };
    }

    if (dateParam) {
      const startOfDay = new Date(`${dateParam}T00:00:00.000Z`);
      const endOfDay = new Date(`${dateParam}T23:59:59.999Z`);
      where.reservationDate = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }

    const reservations = await prisma.reservation.findMany({
      where,
      include: {
        table: {
          select: {
            id: true,
            number: true,
            name: true,
            capacity: true,
            zone: true,
            status: true,
          },
        },
      },
      orderBy: { reservationDate: "asc" },
    });

    return NextResponse.json({ reservations });
  } catch (error: any) {
    console.error("Error fetching reservations:", error);
    return NextResponse.json({ error: "Error al obtener reservaciones" }, { status: 500 });
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

    const {
      customerName,
      customerPhone,
      customerEmail,
      diners = 2,
      reservationDate,
      durationMinutes = 90,
      tableId,
      zonePreference = "ANY",
      notes,
    } = body;

    if (!customerName || !customerName.trim()) {
      return NextResponse.json({ error: "El nombre del comensal es obligatorio" }, { status: 400 });
    }

    if (!reservationDate) {
      return NextResponse.json({ error: "La fecha y hora de la reservación son obligatorias" }, { status: 400 });
    }

    const resDate = new Date(reservationDate);
    const duration = parseInt(String(durationMinutes), 10) || 90;
    const resEndDate = new Date(resDate.getTime() + duration * 60 * 1000);

    // If table assigned, validate capacity and check for conflicts
    if (tableId) {
      const table = await prisma.table.findUnique({
        where: { id: tableId },
      });

      if (!table) {
        return NextResponse.json({ error: "Mesa seleccionada no encontrada" }, { status: 404 });
      }

      const numDiners = parseInt(String(diners), 10) || 1;

      // Check conflict with other active reservations on this table
      const conflict = await prisma.reservation.findFirst({
        where: {
          tableId,
          status: { in: ["CONFIRMED", "SEATED", "PENDING"] },
          reservationDate: {
            lt: resEndDate,
          },
          // Ending after this reservation starts
        },
      });

      if (conflict) {
        const conflictStart = new Date(conflict.reservationDate);
        const conflictEnd = new Date(conflictStart.getTime() + conflict.durationMinutes * 60 * 1000);

        if (conflictEnd > resDate) {
          return NextResponse.json(
            {
              error: `La mesa ${table.name} ya tiene una reservación a las ${conflictStart.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })} para ${conflict.customerName}.`,
            },
            { status: 409 }
          );
        }
      }
    }

    const reservation = await prisma.reservation.create({
      data: {
        brandId,
        customerName: customerName.trim(),
        customerPhone: customerPhone ? customerPhone.trim() : null,
        customerEmail: customerEmail ? customerEmail.trim().toLowerCase() : null,
        diners: parseInt(String(diners), 10) || 2,
        reservationDate: resDate,
        durationMinutes: duration,
        tableId: tableId || null,
        zonePreference,
        notes: notes ? notes.trim() : null,
        status: "CONFIRMED",
      },
      include: {
        table: true,
      },
    });

    return NextResponse.json({ success: true, reservation }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating reservation:", error);
    return NextResponse.json({ error: "Error al crear la reservación" }, { status: 500 });
  }
}

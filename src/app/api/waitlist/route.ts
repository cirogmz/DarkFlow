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
    const status = searchParams.get("status"); // 'ACTIVE' (WAITING + NOTIFIED), 'ALL', or specific

    const where: any = { brandId };

    if (!status || status === "ACTIVE") {
      where.status = { in: ["WAITING", "NOTIFIED"] };
    } else if (status !== "ALL") {
      where.status = status;
    }

    const entries = await prisma.waitlistEntry.findMany({
      where,
      include: {
        table: {
          select: { id: true, number: true, name: true, capacity: true, zone: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ entries });
  } catch (error: any) {
    console.error("Error fetching waitlist:", error);
    return NextResponse.json({ error: "Error al obtener lista de espera" }, { status: 500 });
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
      diners = 2,
      estimatedWaitMinutes = 15,
      zonePreference = "ANY",
      notes,
    } = body;

    if (!customerName || !customerName.trim()) {
      return NextResponse.json({ error: "El nombre del comensal es obligatorio" }, { status: 400 });
    }

    const entry = await prisma.waitlistEntry.create({
      data: {
        brandId,
        customerName: customerName.trim(),
        customerPhone: customerPhone ? customerPhone.trim() : null,
        diners: parseInt(String(diners), 10) || 2,
        estimatedWaitMinutes: parseInt(String(estimatedWaitMinutes), 10) || 15,
        zonePreference,
        notes: notes ? notes.trim() : null,
        status: "WAITING",
      },
    });

    return NextResponse.json({ success: true, entry }, { status: 201 });
  } catch (error: any) {
    console.error("Error adding to waitlist:", error);
    return NextResponse.json({ error: "Error al registrar en lista de espera" }, { status: 500 });
  }
}

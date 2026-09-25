import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get("cookie") || "";
    const session = getSessionFromCookies(cookieHeader);
    const headerBrandId = req.headers.get("x-brand-id");

    const brandId = session?.activeBrandId || headerBrandId;

    if (!brandId) {
      // Fallback to first active brand if none provided
      const firstBrand = await prisma.brand.findFirst({ where: { isActive: true } });
      if (!firstBrand) {
        return NextResponse.json({ error: "No se encontró marca activa" }, { status: 400 });
      }
      const printers = await prisma.printer.findMany({
        where: { brandId: firstBrand.id },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json({ printers });
    }

    const printers = await prisma.printer.findMany({
      where: { brandId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ printers });
  } catch (error: any) {
    console.error("Error fetching printers:", error);
    return NextResponse.json({ error: "Error al obtener impresoras" }, { status: 500 });
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
      name,
      connectionType = "NETWORK",
      ipAddress = "192.168.1.200",
      port = 9100,
      paperWidth = "80mm",
      targetStation = "ALL",
      autoPrintTrigger = "ON_ORDER_CREATED",
      isActive = true,
      notes,
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "El nombre de la impresora es obligatorio" }, { status: 400 });
    }

    const printer = await prisma.printer.create({
      data: {
        brandId,
        name: name.trim(),
        connectionType,
        ipAddress: ipAddress.trim(),
        port: parseInt(String(port), 10) || 9100,
        paperWidth,
        targetStation,
        autoPrintTrigger,
        isActive: Boolean(isActive),
        notes: notes ? notes.trim() : null,
      },
    });

    return NextResponse.json({ success: true, printer }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating printer:", error);
    return NextResponse.json({ error: "Error al registrar la impresora" }, { status: 500 });
  }
}

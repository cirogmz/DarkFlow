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
    const activeOnly = searchParams.get("active") === "true";

    const where: any = { brandId };
    if (activeOnly) {
      where.isActive = true;
    }

    const rules = await prisma.priceRule.findMany({
      where,
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ rules });
  } catch (error: any) {
    console.error("Error fetching price rules:", error);
    return NextResponse.json({ error: "Error al obtener reglas de precios" }, { status: 500 });
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
      description,
      type = "PERCENTAGE_DISCOUNT",
      discountValue = 0,
      buyQty = 2,
      getQty = 1,
      daysOfWeek = "1,2,3,4,5",
      startTime = "17:00",
      endTime = "20:00",
      isActive = true,
      appliesToAll = false,
      categoryIds,
      productIds,
      zone,
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "El nombre de la regla es obligatorio" }, { status: 400 });
    }

    const newRule = await prisma.priceRule.create({
      data: {
        brandId,
        name: name.trim(),
        description: description?.trim() || null,
        type,
        discountValue: Number(discountValue) || 0,
        buyQty: buyQty ? Number(buyQty) : null,
        getQty: getQty ? Number(getQty) : null,
        daysOfWeek: daysOfWeek || "1,2,3,4,5",
        startTime: startTime || "17:00",
        endTime: endTime || "20:00",
        isActive: Boolean(isActive),
        appliesToAll: Boolean(appliesToAll),
        categoryIds: typeof categoryIds === "object" ? JSON.stringify(categoryIds) : categoryIds || null,
        productIds: typeof productIds === "object" ? JSON.stringify(productIds) : productIds || null,
        zone: zone?.trim() || null,
      },
    });

    return NextResponse.json({ rule: newRule }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating price rule:", error);
    return NextResponse.json({ error: error.message || "Error al crear regla de precios" }, { status: 500 });
  }
}

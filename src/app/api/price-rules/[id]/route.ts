import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const existing = await prisma.priceRule.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Regla de precio no encontrada" }, { status: 404 });
    }

    const {
      name,
      description,
      type,
      discountValue,
      buyQty,
      getQty,
      daysOfWeek,
      startTime,
      endTime,
      isActive,
      appliesToAll,
      categoryIds,
      productIds,
      zone,
    } = body;

    const updated = await prisma.priceRule.update({
      where: { id },
      data: {
        name: name !== undefined ? name.trim() : existing.name,
        description: description !== undefined ? description?.trim() || null : existing.description,
        type: type !== undefined ? type : existing.type,
        discountValue: discountValue !== undefined ? Number(discountValue) : existing.discountValue,
        buyQty: buyQty !== undefined ? (buyQty ? Number(buyQty) : null) : existing.buyQty,
        getQty: getQty !== undefined ? (getQty ? Number(getQty) : null) : existing.getQty,
        daysOfWeek: daysOfWeek !== undefined ? daysOfWeek : existing.daysOfWeek,
        startTime: startTime !== undefined ? startTime : existing.startTime,
        endTime: endTime !== undefined ? endTime : existing.endTime,
        isActive: isActive !== undefined ? Boolean(isActive) : existing.isActive,
        appliesToAll: appliesToAll !== undefined ? Boolean(appliesToAll) : existing.appliesToAll,
        categoryIds:
          categoryIds !== undefined
            ? typeof categoryIds === "object"
              ? JSON.stringify(categoryIds)
              : categoryIds || null
            : existing.categoryIds,
        productIds:
          productIds !== undefined
            ? typeof productIds === "object"
              ? JSON.stringify(productIds)
              : productIds || null
            : existing.productIds,
        zone: zone !== undefined ? zone?.trim() || null : existing.zone,
      },
    });

    return NextResponse.json({ rule: updated });
  } catch (error: any) {
    console.error("Error updating price rule:", error);
    return NextResponse.json({ error: error.message || "Error al actualizar regla de precios" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.priceRule.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Regla no encontrada" }, { status: 404 });
    }

    await prisma.priceRule.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Regla eliminada exitosamente" });
  } catch (error: any) {
    console.error("Error deleting price rule:", error);
    return NextResponse.json({ error: "Error al eliminar regla de precios" }, { status: 500 });
  }
}

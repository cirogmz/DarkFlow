import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  generateKotBuffer,
  generateReceiptBuffer,
  sendToNetworkPrinter,
} from "@/lib/escpos";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, printerId, type = "KOT", stageFilter } = body;

    if (!orderId) {
      return NextResponse.json({ error: "orderId es requerido" }, { status: 400 });
    }

    // Load full order with items and relations
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: {
              include: { category: true },
            },
          },
        },
        table: true,
        brand: true,
        user: {
          select: { id: true, name: true, role: true },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
    }

    // Parse modifiers if stored as JSON string
    const processedOrder = {
      ...order,
      items: order.items.map((it) => {
        let parsedMods = [];
        if (it.modifiers) {
          try {
            parsedMods = typeof it.modifiers === "string" ? JSON.parse(it.modifiers) : it.modifiers;
          } catch {
            parsedMods = [];
          }
        }
        return {
          ...it,
          selectedModifiers: parsedMods,
        };
      }),
    };

    // If specific printer requested
    if (printerId) {
      const printer = await prisma.printer.findUnique({ where: { id: printerId } });
      if (!printer) {
        return NextResponse.json({ error: "Impresora no encontrada" }, { status: 404 });
      }

      if (printer.connectionType === "VIRTUAL") {
        return NextResponse.json({
          success: true,
          virtual: true,
          message: `Impresión simulada en impresora virtual ${printer.name}`,
        });
      }

      if (type === "RECEIPT") {
        const buffer = generateReceiptBuffer(processedOrder, printer, order.brand);
        const res = await sendToNetworkPrinter(printer.ipAddress, printer.port, buffer);
        return NextResponse.json({ success: res.success, printer: printer.name, result: res });
      } else {
        const kot = generateKotBuffer(processedOrder, printer, { stageFilter });
        if (!kot || kot.itemCount === 0) {
          return NextResponse.json({
            success: true,
            message: `No hay platillos correspondientes a la estación ${printer.targetStation}`,
          });
        }
        const res = await sendToNetworkPrinter(printer.ipAddress, printer.port, kot.buffer);
        return NextResponse.json({ success: res.success, printer: printer.name, result: res });
      }
    }

    // Otherwise, dispatch to all relevant active printers for the brand
    const printers = await prisma.printer.findMany({
      where: {
        brandId: order.brandId,
        isActive: true,
      },
    });

    if (printers.length === 0) {
      return NextResponse.json({
        success: false,
        message: "No hay impresoras activas configuradas para esta sucursal",
      });
    }

    const printResults: any[] = [];

    if (type === "RECEIPT") {
      // Find cashier / receipt printer
      const cashierPrinter = printers.find((p) => p.targetStation === "CASHIER") || printers[0];
      if (cashierPrinter.connectionType === "VIRTUAL") {
        printResults.push({ printer: cashierPrinter.name, success: true, virtual: true });
      } else {
        const buffer = generateReceiptBuffer(processedOrder, cashierPrinter, order.brand);
        const res = await sendToNetworkPrinter(cashierPrinter.ipAddress, cashierPrinter.port, buffer);
        printResults.push({ printer: cashierPrinter.name, success: res.success, error: res.error });
      }
    } else {
      // Kitchen order ticket routing (KOT)
      const kitchenPrinters = printers.filter((p) => p.targetStation !== "CASHIER");
      const targetPrinters = kitchenPrinters.length > 0 ? kitchenPrinters : printers;

      for (const p of targetPrinters) {
        if (p.connectionType === "VIRTUAL") {
          printResults.push({ printer: p.name, success: true, virtual: true });
          continue;
        }

        const kot = generateKotBuffer(processedOrder, p, { stageFilter });
        if (!kot || kot.itemCount === 0) {
          printResults.push({
            printer: p.name,
            skipped: true,
            reason: `Sin platillos para estación ${p.targetStation}`,
          });
          continue;
        }

        const res = await sendToNetworkPrinter(p.ipAddress, p.port, kot.buffer);
        printResults.push({
          printer: p.name,
          station: p.targetStation,
          itemCount: kot.itemCount,
          success: res.success,
          error: res.error,
        });
      }
    }

    return NextResponse.json({
      success: true,
      dispatchedCount: printResults.length,
      results: printResults,
    });
  } catch (error: any) {
    console.error("Error in print-order route:", error);
    return NextResponse.json({ error: "Error al procesar impresión de orden" }, { status: 500 });
  }
}

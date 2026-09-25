import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  testPrinterConnection,
  generateTestPrintBuffer,
  sendToNetworkPrinter,
  COMMANDS,
} from "@/lib/escpos";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const action = body.action || "PRINT_TEST"; // "PRINT_TEST" | "PING_ONLY" | "KICK_DRAWER"

    const printer = await prisma.printer.findUnique({
      where: { id },
    });

    if (!printer) {
      return NextResponse.json({ error: "Impresora no encontrada" }, { status: 404 });
    }

    if (printer.connectionType === "VIRTUAL") {
      await prisma.printer.update({
        where: { id },
        data: {
          status: "ONLINE",
          lastTestedAt: new Date(),
        },
      });
      return NextResponse.json({
        success: true,
        online: true,
        message: "Impresora virtual simulada correctamente",
      });
    }

    // Ping check first
    const pingResult = await testPrinterConnection(printer.ipAddress, printer.port, 3000);

    if (!pingResult.online) {
      await prisma.printer.update({
        where: { id },
        data: {
          status: "OFFLINE",
          lastTestedAt: new Date(),
        },
      });

      return NextResponse.json(
        {
          success: false,
          online: false,
          error: `No se pudo conectar a la impresora en ${printer.ipAddress}:${printer.port}. (${pingResult.error || "Offline"})`,
        },
        { status: 502 }
      );
    }

    // Connected!
    let printResult = null;

    if (action === "PRINT_TEST") {
      const buffer = generateTestPrintBuffer(printer);
      printResult = await sendToNetworkPrinter(printer.ipAddress, printer.port, buffer);
    } else if (action === "KICK_DRAWER") {
      const kickBuffer = Buffer.concat([COMMANDS.HW_INIT, COMMANDS.DRAWER_KICK]);
      printResult = await sendToNetworkPrinter(printer.ipAddress, printer.port, kickBuffer);
    }

    await prisma.printer.update({
      where: { id },
      data: {
        status: "ONLINE",
        lastTestedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      online: true,
      latencyMs: pingResult.latencyMs,
      printResult,
      message: action === "KICK_DRAWER" 
        ? "Pulso de apertura de cajón enviado exitosamente"
        : "Ticket de prueba impreso exitosamente",
    });
  } catch (error: any) {
    console.error("Error testing printer:", error);
    return NextResponse.json({ error: "Error al probar conexión con impresora" }, { status: 500 });
  }
}

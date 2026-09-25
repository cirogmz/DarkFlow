import net from "net";

/**
 * Pure Node.js ESC/POS Buffer Generator & Network Printer Driver
 * Zero binary/native node-gyp dependencies. Works seamlessly on Windows, Linux, Docker.
 */

// ESC/POS Command Constants
export const ESC = 0x1b;
export const GS = 0x1d;
export const FS = 0x1c;

export const COMMANDS = {
  // Initialization
  HW_INIT: Buffer.from([ESC, 0x40]), // ESC @

  // Text alignment
  TXT_ALIGN_LT: Buffer.from([ESC, 0x61, 0x00]), // Left
  TXT_ALIGN_CT: Buffer.from([ESC, 0x61, 0x01]), // Center
  TXT_ALIGN_RT: Buffer.from([ESC, 0x61, 0x02]), // Right

  // Font Styles
  TXT_BOLD_ON: Buffer.from([ESC, 0x45, 0x01]),
  TXT_BOLD_OFF: Buffer.from([ESC, 0x45, 0x00]),
  TXT_UNDERL_ON: Buffer.from([ESC, 0x2d, 0x01]),
  TXT_UNDERL_OFF: Buffer.from([ESC, 0x2d, 0x00]),

  // Text Scaling (GS ! n)
  // Lower nibble = height (0-7), upper nibble = width (0-7)
  TXT_NORMAL: Buffer.from([GS, 0x21, 0x00]),
  TXT_2HEIGHT: Buffer.from([GS, 0x21, 0x01]),
  TXT_2WIDTH: Buffer.from([GS, 0x21, 0x10]),
  TXT_4SQUARE: Buffer.from([GS, 0x21, 0x11]), // 2x width & 2x height
  TXT_3SQUARE: Buffer.from([GS, 0x21, 0x22]), // 3x width & 3x height

  // Paper feed & Cut
  FEED_LINE: (lines = 1) => Buffer.from([ESC, 0x64, lines]),
  PAPER_PART_CUT: Buffer.from([GS, 0x56, 0x42, 0x00]), // GS V 66 0 (Feed and cut)
  PAPER_FULL_CUT: Buffer.from([GS, 0x56, 0x41, 0x00]),

  // Cash Drawer Kick (ESC p m t1 t2)
  DRAWER_KICK: Buffer.from([ESC, 0x70, 0x00, 0x19, 0xfa]), // Pin 2, 50ms on, 500ms off
  DRAWER_KICK_PIN5: Buffer.from([ESC, 0x70, 0x01, 0x19, 0xfa]), // Pin 5
};

/**
 * Sanitizes and formats text for universal receipt printer compatibility.
 * Replaces or normalizes special characters to avoid garbled symbols on printers
 * that lack UTF-8 code page support.
 */
export function sanitizeEscposText(text: string): string {
  if (!text) return "";
  return text
    .replace(/[áàäâã]/g, "a")
    .replace(/[éèëê]/g, "e")
    .replace(/[íìïî]/g, "i")
    .replace(/[óòöôõ]/g, "o")
    .replace(/[úùüû]/g, "u")
    .replace(/[ÁÀÄÂÃ]/g, "A")
    .replace(/[ÉÈËÊ]/g, "E")
    .replace(/[ÍÌÏÎ]/g, "I")
    .replace(/[ÓÒÖÔÕ]/g, "O")
    .replace(/[ÚÙÜÛ]/g, "U")
    .replace(/ñ/g, "n")
    .replace(/Ñ/g, "N")
    .replace(/¿/g, "")
    .replace(/¡/g, "")
    .replace(/[^\x20-\x7E\n\r]/g, ""); // Keep printable ASCII & newlines
}

/**
 * Creates two-column text alignment (e.g. "Hamburguesa Doble ...... $145.00")
 */
export function formatTwoColumns(left: string, right: string, maxChars = 48): string {
  const cleanLeft = sanitizeEscposText(left);
  const cleanRight = sanitizeEscposText(right);
  
  const availableSpace = maxChars - cleanRight.length;
  if (availableSpace <= 0) {
    return (cleanLeft.slice(0, maxChars - cleanRight.length - 1) + " " + cleanRight).slice(0, maxChars);
  }
  
  const paddedLeft = cleanLeft.slice(0, availableSpace).padEnd(availableSpace, " ");
  return paddedLeft + cleanRight;
}

export function createDivider(char = "-", maxChars = 48): string {
  return char.repeat(maxChars);
}

/**
 * Builder class for chainable ESC/POS byte sequence generation
 */
export class EscposBuilder {
  private chunks: Buffer[] = [];
  private maxChars: number;

  constructor(paperWidth: "80mm" | "58mm" | string = "80mm") {
    this.maxChars = paperWidth === "58mm" ? 32 : 48;
    this.chunks.push(COMMANDS.HW_INIT);
  }

  alignLeft(): this {
    this.chunks.push(COMMANDS.TXT_ALIGN_LT);
    return this;
  }

  alignCenter(): this {
    this.chunks.push(COMMANDS.TXT_ALIGN_CT);
    return this;
  }

  alignRight(): this {
    this.chunks.push(COMMANDS.TXT_ALIGN_RT);
    return this;
  }

  bold(on = true): this {
    this.chunks.push(on ? COMMANDS.TXT_BOLD_ON : COMMANDS.TXT_BOLD_OFF);
    return this;
  }

  size(scaling: "normal" | "2h" | "2w" | "2x" | "3x" = "normal"): this {
    switch (scaling) {
      case "2h":
        this.chunks.push(COMMANDS.TXT_2HEIGHT);
        break;
      case "2w":
        this.chunks.push(COMMANDS.TXT_2WIDTH);
        break;
      case "2x":
        this.chunks.push(COMMANDS.TXT_4SQUARE);
        break;
      case "3x":
        this.chunks.push(COMMANDS.TXT_3SQUARE);
        break;
      default:
        this.chunks.push(COMMANDS.TXT_NORMAL);
        break;
    }
    return this;
  }

  text(str: string): this {
    const clean = sanitizeEscposText(str);
    this.chunks.push(Buffer.from(clean, "ascii"));
    return this;
  }

  line(str = ""): this {
    const clean = sanitizeEscposText(str);
    this.chunks.push(Buffer.from(clean + "\n", "ascii"));
    return this;
  }

  divider(char = "-"): this {
    return this.line(createDivider(char, this.maxChars));
  }

  twoColumns(left: string, right: string): this {
    return this.line(formatTwoColumns(left, right, this.maxChars));
  }

  feed(lines = 2): this {
    this.chunks.push(COMMANDS.FEED_LINE(lines));
    return this;
  }

  cut(full = false): this {
    this.feed(3);
    this.chunks.push(full ? COMMANDS.PAPER_FULL_CUT : COMMANDS.PAPER_PART_CUT);
    return this;
  }

  drawerKick(): this {
    this.chunks.push(COMMANDS.DRAWER_KICK);
    return this;
  }

  build(): Buffer {
    return Buffer.concat(this.chunks);
  }
}

/**
 * Formats a Kitchen Order Ticket (KOT / Comanda) based on target station
 */
export function generateKotBuffer(
  order: any,
  printer: { paperWidth?: string; targetStation?: string; name?: string },
  options?: { stageFilter?: string }
): { buffer: Buffer; itemCount: number } | null {
  const width = printer.paperWidth || "80mm";
  const station = (printer.targetStation || "ALL").toUpperCase();
  const stageFilter = options?.stageFilter;

  // Filter items matching the station
  const targetItems = (order.items || []).filter((item: any) => {
    // If filtering by stage
    if (stageFilter && item.serviceStage !== stageFilter) {
      return false;
    }

    // Station check
    if (station === "ALL") return true;
    const itemStation = (item.product?.kitchenStation || "COCINA").toUpperCase();
    return itemStation === station;
  });

  if (targetItems.length === 0) {
    return null; // Nothing for this station to print
  }

  const builder = new EscposBuilder(width);

  // Header
  builder
    .alignCenter()
    .size("2x")
    .bold(true)
    .line(`*** ${order.brand?.name || "COCINA"} ***`)
    .size("normal")
    .bold(false)
    .line(`ESTACION: ${station === "ALL" ? "GENERAL / TODAS" : station}`)
    .divider("=")
    .size("2x")
    .bold(true)
    .line(`ORDEN #${order.dailyNumber || order.id.slice(-5).toUpperCase()}`)
    .size("normal")
    .bold(false);

  // Order Details
  const orderTypeStr = 
    order.type === "DINE_IN" ? `MESA: ${order.table?.number || order.tableNumber || "S/N"} (${order.table?.zone || "Salon"})` :
    order.type === "TAKEOUT" ? "PARA LLEVAR" :
    order.type === "DELIVERY" ? `DELIVERY / A DOMICILIO` : order.type;

  builder
    .alignLeft()
    .bold(true)
    .line(`TIPO: ${orderTypeStr}`)
    .bold(false)
    .line(`MESERO / ATENDIO: ${order.user?.name || "Cajero"}`)
    .line(`FECHA: ${new Date(order.createdAt || Date.now()).toLocaleString("es-MX")}`);

  if (order.customerName) {
    builder.line(`CLIENTE: ${order.customerName}`);
  }

  if (order.currentStage) {
    builder
      .bold(true)
      .line(`TIEMPO SERVICIO ACTUAL: ${order.currentStage}`)
      .bold(false);
  }

  builder.divider("=");

  // Group items by service stage if multiple
  const stages: Record<string, any[]> = {};
  targetItems.forEach((item: any) => {
    const stage = item.serviceStage || "MAIN";
    if (!stages[stage]) stages[stage] = [];
    stages[stage].push(item);
  });

  const stageLabels: Record<string, string> = {
    DRINK: "BEBIDAS",
    STARTER: "1er TIEMPO (ENTRADAS)",
    MAIN: "2do TIEMPO (PLATOS FUERTES)",
    DESSERT: "3er TIEMPO (POSTRES)",
  };

  for (const [stgKey, items] of Object.entries(stages)) {
    builder
      .alignCenter()
      .bold(true)
      .line(`--- ${stageLabels[stgKey] || stgKey} ---`)
      .alignLeft()
      .bold(false);

    for (const item of items) {
      builder
        .size("2h")
        .bold(true)
        .line(`[ ${item.quantity}x ] ${item.product?.name || "Producto"}`)
        .size("normal")
        .bold(false);

      // Selected modifiers
      if (item.selectedModifiers && Array.isArray(item.selectedModifiers) && item.selectedModifiers.length > 0) {
        item.selectedModifiers.forEach((mod: any) => {
          const modName = typeof mod === "string" ? mod : mod.name || mod.modifierName || "";
          if (modName) {
            builder.line(`   * ${modName}`);
          }
        });
      }

      // Notes
      if (item.notes) {
        builder
          .bold(true)
          .line(`   >> NOTA: ${item.notes}`)
          .bold(false);
      }
    }
    builder.divider("-");
  }

  // General Order Notes
  if (order.notes) {
    builder
      .bold(true)
      .line("NOTAS GENERALES DE LA ORDEN:")
      .line(order.notes)
      .bold(false)
      .divider("-");
  }

  builder
    .alignCenter()
    .line(`TOTAL PLATILLOS: ${targetItems.reduce((sum: number, i: any) => sum + i.quantity, 0)}`)
    .line(`Impreso en: ${printer.name || "Impresora de Cocina"}`)
    .cut();

  return {
    buffer: builder.build(),
    itemCount: targetItems.length,
  };
}

/**
 * Formats a Customer Receipt / Ticket de Venta
 */
export function generateReceiptBuffer(
  order: any,
  printer: { paperWidth?: string; name?: string },
  brand: any
): Buffer {
  const width = printer.paperWidth || "80mm";
  const builder = new EscposBuilder(width);

  builder
    .alignCenter()
    .size("2x")
    .bold(true)
    .line(brand.name || "DARKFLOW RESTAURANT")
    .size("normal")
    .bold(false);

  if (brand.legalName && brand.legalName !== brand.name) {
    builder.line(brand.legalName);
  }
  if (brand.rfc) {
    builder.line(`RFC: ${brand.rfc}`);
  }
  builder
    .line("COMPROBANTE DE CONSUMO")
    .divider("=")
    .alignLeft()
    .bold(true)
    .line(`FOLIO: #${order.dailyNumber || order.id.slice(-6).toUpperCase()}`)
    .bold(false)
    .line(`FECHA: ${new Date(order.createdAt || Date.now()).toLocaleString("es-MX")}`)
    .line(`ATENDIO: ${order.user?.name || "Caja"}`);

  if (order.table?.number || order.tableNumber) {
    builder.line(`MESA: ${order.table?.number || order.tableNumber}`);
  }
  if (order.customerName) {
    builder.line(`CLIENTE: ${order.customerName}`);
  }

  builder
    .divider("-")
    .twoColumns("CANT/CONCEPTO", "IMPORTE")
    .divider("-");

  // Items
  const items = order.items || [];
  let subtotalCalc = 0;

  for (const item of items) {
    const itemTotal = (item.unitPrice || 0) * (item.quantity || 1);
    subtotalCalc += itemTotal;
    const nameStr = `${item.quantity}x ${item.product?.name || "Item"}`;
    builder.twoColumns(nameStr, `$${itemTotal.toFixed(2)}`);

    if (item.selectedModifiers && Array.isArray(item.selectedModifiers) && item.selectedModifiers.length > 0) {
      item.selectedModifiers.forEach((mod: any) => {
        const modName = typeof mod === "string" ? mod : mod.name || "";
        const modPrice = typeof mod === "object" && mod.price ? ` +$${Number(mod.price).toFixed(2)}` : "";
        if (modName) {
          builder.line(`   + ${modName}${modPrice}`);
        }
      });
    }
  }

  builder.divider("-");

  const subtotal = order.subtotal ?? subtotalCalc;
  const discount = order.discountTotal ?? 0;
  const tip = order.tipAmount ?? 0;
  const total = order.total ?? (subtotal - discount + tip);

  builder.twoColumns("SUBTOTAL:", `$${Number(subtotal).toFixed(2)}`);

  if (discount > 0) {
    builder.twoColumns("DESCUENTO:", `-$${Number(discount).toFixed(2)}`);
  }

  if (tip > 0) {
    builder.twoColumns("PROPINA:", `$${Number(tip).toFixed(2)}`);
  }

  builder
    .divider("=")
    .size("2h")
    .bold(true)
    .twoColumns("TOTAL A PAGAR:", `$${Number(total).toFixed(2)}`)
    .size("normal")
    .bold(false)
    .divider("=");

  // Payment information
  if (order.paymentMethod) {
    builder
      .alignLeft()
      .line(`METODO DE PAGO: ${order.paymentMethod}`)
      .line(`ESTADO: ${order.paymentStatus || "PAGADO"}`);
  }

  // CFDI Auto-Invoicing Message
  builder
    .feed(1)
    .alignCenter()
    .bold(true)
    .line("*** FACTURACION ELECTRONICA CFDI 4.0 ***")
    .bold(false)
    .line("Genere su factura en linea dentro de las")
    .line("72 horas posteriores a su consumo en:")
    .line("/facturacion")
    .line(`Codigo de Ticket: ${order.id.slice(-8).toUpperCase()}`)
    .feed(1)
    .line("Gracias por su preferencia!")
    .line("DarkFlow POS v2.0");

  // Drawer Kick for cash payments
  if (order.paymentMethod === "CASH" || order.paymentMethod === "EFECTIVO") {
    builder.drawerKick();
  }

  builder.cut();
  return builder.build();
}

/**
 * Generates a test print ticket
 */
export function generateTestPrintBuffer(printer: {
  name: string;
  ipAddress: string;
  port: number;
  targetStation: string;
  paperWidth: string;
}): Buffer {
  const builder = new EscposBuilder(printer.paperWidth || "80mm");

  builder
    .alignCenter()
    .size("2x")
    .bold(true)
    .line("PRUEBA DE IMPRESION")
    .size("normal")
    .bold(false)
    .line("DARKFLOW HARDWARE BRIDGE")
    .divider("=")
    .alignLeft()
    .bold(true)
    .twoColumns("IMPRESORA:", printer.name)
    .twoColumns("IP:", printer.ipAddress)
    .twoColumns("PUERTO:", String(printer.port))
    .twoColumns("ANCHO PAPEL:", printer.paperWidth)
    .twoColumns("ESTACION:", printer.targetStation)
    .twoColumns("FECHA/HORA:", new Date().toLocaleTimeString("es-MX"))
    .bold(false)
    .divider("-")
    .alignCenter()
    .line("Conexion LAN/TCP exitosa.")
    .line("El hardware responde correctamente a")
    .line("los comandos binarios ESC/POS.")
    .divider("=")
    .feed(1)
    .cut();

  return builder.build();
}

/**
 * Sends a raw byte buffer to a thermal printer via TCP socket
 */
export function sendToNetworkPrinter(
  ip: string,
  port = 9100,
  data: Buffer,
  timeoutMs = 4000
): Promise<{ success: boolean; message?: string; error?: string }> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let isHandled = false;

    const cleanup = (success: boolean, message?: string, error?: string) => {
      if (isHandled) return;
      isHandled = true;
      socket.removeAllListeners();
      socket.destroy();
      resolve({ success, message, error });
    };

    socket.setTimeout(timeoutMs);

    socket.on("connect", () => {
      socket.write(data, (err) => {
        if (err) {
          cleanup(false, undefined, `Error escribiendo datos: ${err.message}`);
        } else {
          // Allow buffer to flush to printer buffer before closing
          setTimeout(() => {
            cleanup(true, "Comandos enviados exitosamente a la impresora");
          }, 200);
        }
      });
    });

    socket.on("timeout", () => {
      cleanup(false, undefined, `Tiempo de espera agotado (${timeoutMs}ms) conectando a ${ip}:${port}`);
    });

    socket.on("error", (err: any) => {
      cleanup(false, undefined, `Error de socket (${err.code || err.name}): ${err.message}`);
    });

    try {
      socket.connect(port, ip);
    } catch (err: any) {
      cleanup(false, undefined, `No se pudo iniciar conexión TCP: ${err.message}`);
    }
  });
}

/**
 * Tests TCP connectivity to a network thermal printer
 */
export function testPrinterConnection(
  ip: string,
  port = 9100,
  timeoutMs = 3000
): Promise<{ online: boolean; latencyMs?: number; error?: string }> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const socket = new net.Socket();
    let isHandled = false;

    const cleanup = (online: boolean, latencyMs?: number, error?: string) => {
      if (isHandled) return;
      isHandled = true;
      socket.removeAllListeners();
      socket.destroy();
      resolve({ online, latencyMs, error });
    };

    socket.setTimeout(timeoutMs);

    socket.on("connect", () => {
      const latencyMs = Date.now() - startTime;
      cleanup(true, latencyMs);
    });

    socket.on("timeout", () => {
      cleanup(false, undefined, `Timeout alcanzado (${timeoutMs}ms) conectando a ${ip}:${port}`);
    });

    socket.on("error", (err: any) => {
      cleanup(false, undefined, err.message);
    });

    try {
      socket.connect(port, ip);
    } catch (err: any) {
      cleanup(false, undefined, err.message);
    }
  });
}

import { prisma } from './db';
import { generateCfdi40, validateRfc, ConceptoFiscal } from './cfdi';

export interface WhatsAppIncomingPayload {
  brandId: string;
  customerPhone: string;
  customerName?: string;
  content: string;
  mediaUrl?: string;
}

export interface WhatsAppBotReply {
  replyText: string;
  replyType: 'TEXT' | 'INVOICE_ISSUED' | 'ORDER_TRACKING' | 'MENU_INFO' | 'AWAITING_DATA';
  invoiceId?: string;
  pdfUrl?: string;
  xmlUrl?: string;
  orderNumber?: string;
  orderStatus?: string;
  trackingUrl?: string;
  conversationId: string;
}

// ============================================================================
// REGEX & DATA EXTRACTION HELPERS
// ============================================================================

export function extractTicketFolio(text: string): string | null {
  if (!text) return null;
  // Matches "ORD-1234", "ORD-12345", "DF-9999", "#ORD-1234", "ticket ORD-1234", "folio 1234"
  const ordMatch = text.match(/\b(?:ORD|DF|TKT)[-_]?\d{3,8}\b/i);
  if (ordMatch) return ordMatch[0].toUpperCase();

  const hashMatch = text.match(/#(\d{4,8})\b/);
  if (hashMatch) return `ORD-${hashMatch[1]}`;

  const explicitMatch = text.match(/(?:ticket|folio|orden|cuenta|comanda)[:\s#]*([a-zA-Z0-9-_]{4,15})/i);
  if (explicitMatch) return explicitMatch[1].toUpperCase();

  return null;
}

export function extractRfc(text: string): string | null {
  if (!text) return null;
  // Mexican RFC regex: 3 or 4 letters, 6 digits (YYMMDD), 3 alphanumeric homoclave
  const rfcMatch = text.match(/\b[A-Z&Ñ]{3,4}\d{6}[A-V1-9][A-Z1-9][0-9A]\b/i);
  return rfcMatch ? rfcMatch[0].toUpperCase() : null;
}

export function extractPostalCode(text: string): string | null {
  if (!text) return null;
  // Matches 5 digit postal codes: "CP 06700", "C.P. 06700", or isolated 5 digits
  const cpMatch = text.match(/(?:cp|c\.p\.|postal|código postal)[:\s]*(\d{5})\b/i);
  if (cpMatch) return cpMatch[1];

  const isolatedMatch = text.match(/\b\d{5}\b/);
  return isolatedMatch ? isolatedMatch[0] : null;
}

export function extractEmail(text: string): string | null {
  if (!text) return null;
  const emailMatch = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,7}\b/);
  return emailMatch ? emailMatch[0].toLowerCase() : null;
}

export function extractFiscalRegime(text: string): string | null {
  if (!text) return null;
  // Mexican SAT regime codes: 601, 603, 605, 606, 612, 616, 621, 625, 626
  const regimeMatch = text.match(/(?:regimen|régimen|reg)[:\s]*([6]\d{2})\b/i);
  if (regimeMatch) return regimeMatch[1];

  const directCode = text.match(/\b(601|603|605|606|612|616|621|625|626)\b/);
  return directCode ? directCode[0] : null;
}

export function extractCfdiUse(text: string): string | null {
  if (!text) return null;
  // Common CFDI Uses: G01, G02, G03, S01, CP01
  const usoMatch = text.match(/(?:uso|cfdi)[:\s]*([GSI][0-9]{2}|CP01)\b/i);
  if (usoMatch) return usoMatch[1].toUpperCase();

  const directCode = text.match(/\b(G01|G02|G03|S01|CP01)\b/i);
  return directCode ? directCode[0].toUpperCase() : null;
}

export function extractTaxName(text: string): string | null {
  if (!text) return null;
  const nameMatch = text.match(/(?:nombre|razon|razón|social|receptor)[:\s]+([A-Za-zÁÉÍÓÚáéíóúñÑ\s.,&]{4,60})(?=(?:rfc|cp|c\.p\.|regimen|uso|correo|$))/i);
  if (nameMatch) {
    return nameMatch[1].trim().replace(/\s+/g, ' ');
  }
  return null;
}

// ============================================================================
// INTENT CLASSIFIER
// ============================================================================

export function classifyMessageIntent(
  text: string,
  hasImage: boolean = false
): 'INVOICE_REQUEST' | 'ORDER_TRACKING' | 'MENU_INQUIRY' | 'HELP_GREETING' | 'GENERAL' {
  const lower = text.toLowerCase();

  if (
    hasImage ||
    lower.includes('factura') ||
    lower.includes('facturar') ||
    lower.includes('cfdi') ||
    lower.includes('ticket') ||
    lower.includes('rfc') ||
    lower.includes('comprobante fiscal') ||
    extractRfc(text) !== null
  ) {
    return 'INVOICE_REQUEST';
  }

  if (
    lower.includes('estatus') ||
    lower.includes('rastreo') ||
    lower.includes('pedido') ||
    lower.includes('orden') ||
    lower.includes('donde viene') ||
    lower.includes('dónde viene') ||
    lower.includes('mi comida') ||
    lower.includes('repartidor')
  ) {
    return 'ORDER_TRACKING';
  }

  if (
    lower.includes('menu') ||
    lower.includes('menú') ||
    lower.includes('carta') ||
    lower.includes('precios') ||
    lower.includes('promociones') ||
    lower.includes('combos') ||
    lower.includes('happy hour')
  ) {
    return 'MENU_INQUIRY';
  }

  if (
    lower.includes('hola') ||
    lower.includes('buenos dias') ||
    lower.includes('buenas tardes') ||
    lower.includes('buenas noches') ||
    lower.includes('ayuda') ||
    lower.includes('informacion') ||
    lower.includes('información')
  ) {
    return 'HELP_GREETING';
  }

  return 'GENERAL';
}

// ============================================================================
// INVOICING EXECUTION HELPER
// ============================================================================

export async function issueInvoiceForOrder(params: {
  brandId: string;
  orderNumber: string;
  rfc: string;
  taxName: string;
  taxZipCode: string;
  fiscalRegime: string;
  cfdiUse: string;
  customerEmail?: string;
  customerPhone: string;
}) {
  const { brandId, orderNumber, rfc, taxName, taxZipCode, fiscalRegime, cfdiUse, customerEmail, customerPhone } = params;

  // 1. Obtener la orden y la marca
  const [order, brand] = await Promise.all([
    prisma.order.findFirst({
      where: {
        brandId,
        orderNumber: { equals: orderNumber },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    }),
    prisma.brand.findUnique({
      where: { id: brandId },
    }),
  ]);

  if (!order) {
    throw new Error(`No encontramos el ticket #${orderNumber}. Verifica el número en tu comprobante de compra.`);
  }

  if (!brand) {
    throw new Error('Configuración de marca no encontrada.');
  }

  // 2. Verificar si la orden ya fue facturada previamente
  const existingInvoice = await prisma.invoice.findFirst({
    where: {
      brandId,
      orderId: order.id,
      status: 'TIMBRADO',
    },
  });

  if (existingInvoice) {
    return {
      invoice: existingInvoice,
      alreadyInvoiced: true,
      pdfUrl: `/api/invoices/${existingInvoice.id}/pdf`,
      xmlUrl: `/api/invoices/${existingInvoice.id}/xml`,
      order,
    };
  }

  // 3. Validar RFC
  if (!validateRfc(rfc)) {
    throw new Error(`El RFC "${rfc}" no tiene un formato válido ante el SAT. Debe tener 12 o 13 caracteres alfanuméricos.`);
  }

  // 4. Preparar conceptos de la orden
  const conceptos: ConceptoFiscal[] = order.items.map((item) => {
    const baseIva = Number(((item.price * item.quantity) / 1.16).toFixed(2));
    const importeIva = Number(((item.price * item.quantity) - baseIva).toFixed(2));
    return {
      claveProdServ: '90101501', // Restaurantes
      claveUnidad: 'H87', // Pieza
      unidad: 'Pieza',
      descripcion: item.product.name,
      cantidad: item.quantity,
      valorUnitario: Number((item.price / 1.16).toFixed(2)),
      importe: baseIva,
      baseIva,
      importeIva,
    };
  });

  const subtotal = Number(conceptos.reduce((acc, c) => acc + c.importe, 0).toFixed(2));
  const iva = Number(conceptos.reduce((acc, c) => acc + c.importeIva, 0).toFixed(2));
  const total = Number((subtotal + iva).toFixed(2));

  // Determinar forma de pago SAT
  let formaPagoSat = '01'; // Efectivo
  if (order.paymentMethod === 'CARD' || order.paymentMethod === 'CLIP_TERMINAL' || order.paymentMethod === 'MERCADOPAGO_POINT') {
    formaPagoSat = '04'; // Tarjeta de crédito/débito
  } else if (order.paymentMethod === 'STRIPE' || order.paymentMethod === 'MERCADOPAGO') {
    formaPagoSat = '04';
  } else if (order.paymentMethod === 'WALLET' || order.paymentMethod === 'GIFT_CARD') {
    formaPagoSat = '05'; // Monedero electrónico
  }

  const nextFolio = (brand.invoiceNextFolio || 1);

  // 5. Timbrar comprobante con motor CFDI 4.0
  const timbre = generateCfdi40({
    emisor: {
      rfc: brand.rfc || 'XAXX010101000',
      nombre: brand.legalName || brand.name,
      regimenFiscal: brand.taxRegime || '601',
      codigoPostal: brand.postalCode || '06700',
    },
    receptor: {
      rfc,
      nombre: taxName,
      codigoPostal: taxZipCode,
      regimenFiscal: fiscalRegime,
      usoCfdi: cfdiUse,
      email: customerEmail,
    },
    folio: nextFolio,
    serie: brand.invoiceSeries || 'FAC',
    subtotal,
    descuento: 0,
    iva,
    total,
    formaPago: formaPagoSat,
    metodoPago: 'PUE',
    conceptos,
  });

  // 6. Transacción atómica en BD
  const invoice = await prisma.$transaction(async (tx) => {
    const createdInvoice = await tx.invoice.create({
      data: {
        uuid: timbre.uuid,
        folio: nextFolio,
        serie: brand.invoiceSeries || 'FAC',
        brandId,
        orderId: order.id,
        rfcReceptor: rfc,
        nombreReceptor: taxName,
        regimenFiscalReceptor: fiscalRegime,
        codigoPostalReceptor: taxZipCode,
        usoCfdi: cfdiUse,
        emailReceptor: customerEmail,
        subtotal,
        iva,
        total,
        formaPago: formaPagoSat,
        metodoPago: 'PUE',
        fechaEmision: new Date(),
        fechaTimbrado: new Date(),
        selloDigital: timbre.selloDigital,
        selloSat: timbre.selloSat,
        noCertificadoSat: timbre.noCertificadoSat,
        cadenaOriginalSat: timbre.cadenaOriginalSat,
        qrSatUrl: timbre.qrSatUrl,
        xmlContent: timbre.xmlContent,
        status: 'TIMBRADO',
      },
    });

    // Actualizar folio correlativo de la marca
    await tx.brand.update({
      where: { id: brandId },
      data: { invoiceNextFolio: { increment: 1 } },
    });

    // Registrar en bitácora de solicitudes de bot
    await tx.whatsAppBotInvoiceRequest.create({
      data: {
        brandId,
        customerPhone,
        ticketNumber: orderNumber,
        orderId: order.id,
        rfc,
        taxName,
        taxZipCode,
        fiscalRegime,
        cfdiUse,
        customerEmail: customerEmail || `${rfc.toLowerCase()}@facturacion.local`,
        invoiceId: createdInvoice.id,
        status: 'COMPLETED',
      },
    });

    return createdInvoice;
  });

  return {
    invoice,
    alreadyInvoiced: false,
    pdfUrl: `/api/invoices/${invoice.id}/pdf`,
    xmlUrl: `/api/invoices/${invoice.id}/xml`,
    order,
  };
}

// ============================================================================
// CONVERSATIONAL PROCESSING ENGINE
// ============================================================================

export async function processInboundWhatsAppMessage(
  payload: WhatsAppIncomingPayload
): Promise<WhatsAppBotReply> {
  const { brandId, customerPhone, customerName, content, mediaUrl } = payload;

  const brand = await prisma.brand.findUnique({
    where: { id: brandId },
    select: { id: true, name: true, slug: true, whatsappWelcomeMsg: true, whatsappBotEnabled: true },
  });

  const brandName = brand?.name || 'Restaurante';

  // 1. Obtener o crear la Conversación
  let conversation = await prisma.whatsAppConversation.findFirst({
    where: { brandId, customerPhone },
  });

  if (!conversation) {
    conversation = await prisma.whatsAppConversation.create({
      data: {
        brandId,
        customerPhone,
        customerName: customerName || null,
        lastMessageText: content,
        status: 'ACTIVE',
      },
    });
  }

  // 2. Registrar el mensaje entrante del cliente
  const intent = classifyMessageIntent(content, !!mediaUrl);

  await prisma.whatsAppMessage.create({
    data: {
      conversationId: conversation.id,
      direction: 'INBOUND',
      senderType: 'CUSTOMER',
      messageType: mediaUrl ? 'IMAGE' : 'TEXT',
      content,
      mediaUrl,
      intentDetected: intent,
      status: 'READ',
    },
  });

  // 3. Parsear contexto previo de la conversación
  let context: Record<string, any> = {};
  try {
    if (conversation.contextData) {
      context = JSON.parse(conversation.contextData);
    }
  } catch {
    context = {};
  }

  // 4. Extraer datos presentes en el mensaje
  const detectedFolio = extractTicketFolio(content);
  const detectedRfc = extractRfc(content);
  const detectedCp = extractPostalCode(content);
  const detectedEmail = extractEmail(content);
  const detectedRegime = extractFiscalRegime(content);
  const detectedUso = extractCfdiUse(content);
  const detectedName = extractTaxName(content);

  // Actualizar contexto acumulado
  if (detectedFolio) context.ticketNumber = detectedFolio;
  if (detectedRfc) context.rfc = detectedRfc;
  if (detectedCp) context.taxZipCode = detectedCp;
  if (detectedEmail) context.customerEmail = detectedEmail;
  if (detectedRegime) context.fiscalRegime = detectedRegime;
  if (detectedUso) context.cfdiUse = detectedUso;
  if (detectedName) context.taxName = detectedName;

  let replyText = '';
  let replyType: WhatsAppBotReply['replyType'] = 'TEXT';
  let invoiceId: string | undefined;
  let pdfUrl: string | undefined;
  let xmlUrl: string | undefined;
  let orderNumber: string | undefined;
  let orderStatus: string | undefined;
  let trackingUrl: string | undefined;

  // ==========================================================================
  // FLUJO A: FACTURACIÓN EN 1-CLIC (INVOICE_REQUEST / DATOS FISCALES)
  // ==========================================================================
  if (intent === 'INVOICE_REQUEST' || context.ticketNumber) {
    // Si tenemos todos los datos fiscales y el folio: TIMBRAR DIRECTAMENTE
    const hasAllData =
      context.ticketNumber &&
      context.rfc &&
      context.taxName &&
      context.taxZipCode &&
      (context.fiscalRegime || '601') &&
      (context.cfdiUse || 'G03');

    if (hasAllData) {
      try {
        const issueResult = await issueInvoiceForOrder({
          brandId,
          orderNumber: context.ticketNumber,
          rfc: context.rfc,
          taxName: context.taxName,
          taxZipCode: context.taxZipCode,
          fiscalRegime: context.fiscalRegime || '601',
          cfdiUse: context.cfdiUse || 'G03',
          customerEmail: context.customerEmail || `${context.rfc.toLowerCase()}@facturacion.local`,
          customerPhone,
        });

        invoiceId = issueResult.invoice.id;
        pdfUrl = issueResult.pdfUrl;
        xmlUrl = issueResult.xmlUrl;
        replyType = 'INVOICE_ISSUED';

        if (issueResult.alreadyInvoiced) {
          replyText = `📄 *¡Tu Factura ya estaba generada!* \n\n` +
            `Ticket: *#${context.ticketNumber}*\n` +
            `Folio Fiscal: *${issueResult.invoice.serie}-${issueResult.invoice.folio}*\n` +
            `UUID SAT: \`${issueResult.invoice.uuid}\`\n` +
            `Total: *$${issueResult.invoice.total.toFixed(2)} MXN*\n\n` +
            `Puedes descargar tus archivos directamente aquí:\n` +
            `📥 *PDF Oficial:* ${process.env.NEXT_PUBLIC_APP_URL || ''}${issueResult.pdfUrl}\n` +
            `📥 *XML Timbrado:* ${process.env.NEXT_PUBLIC_APP_URL || ''}${issueResult.xmlUrl}\n\n` +
            `¿Necesitas facturar otro ticket o realizar alguna otra consulta? 😊`;
        } else {
          replyText = `✅ *¡Factura Generada y Timbrada con Éxito!* 🎉\n\n` +
            `Ticket: *#${context.ticketNumber}*\n` +
            `Folio Fiscal: *${issueResult.invoice.serie}-${issueResult.invoice.folio}*\n` +
            `UUID SAT: \`${issueResult.invoice.uuid}\`\n` +
            `Receptor: *${context.taxName}* (${context.rfc})\n` +
            `Total: *$${issueResult.invoice.total.toFixed(2)} MXN*\n\n` +
            `Descarga tus archivos con validez fiscal SAT:\n` +
            `📄 *Descargar PDF:* ${process.env.NEXT_PUBLIC_APP_URL || ''}${issueResult.pdfUrl}\n` +
            `📑 *Descargar XML:* ${process.env.NEXT_PUBLIC_APP_URL || ''}${issueResult.xmlUrl}\n\n` +
            `¡Gracias por tu preferencia en *${brandName}*! Vuelve pronto.`;
        }

        // Limpiar contexto tras emisión exitosa
        context = {};
      } catch (err: any) {
        replyType = 'AWAITING_DATA';
        replyText = `⚠️ *Atención con tu solicitud de factura:*\n\n${err.message}\n\n` +
          `Por favor verifica los datos o escribe tu número de ticket nuevamente.`;
      }
    } else if (context.ticketNumber) {
      // Tenemos el ticket, pero faltan datos fiscales
      // Verificar si la orden existe en BD
      const existingOrder = await prisma.order.findFirst({
        where: { brandId, orderNumber: context.ticketNumber },
      });

      if (!existingOrder) {
        replyType = 'AWAITING_DATA';
        replyText = `🔍 No localizamos el ticket *#${context.ticketNumber}* en nuestro sistema.\n\n` +
          `Verifica que el número coincida con el encabezado de tu comanda o comprobante (ejemplo: *ORD-1024*). También puedes enviarme una fotografía de tu ticket.`;
      } else {
        replyType = 'AWAITING_DATA';
        const missingFields: string[] = [];
        if (!context.rfc) missingFields.push('• RFC (12 o 13 caracteres)');
        if (!context.taxName) missingFields.push('• Nombre o Razón Social');
        if (!context.taxZipCode) missingFields.push('• Código Postal fiscal (5 dígitos)');
        if (!context.fiscalRegime) missingFields.push('• Régimen Fiscal (ej. 601, 626, 612)');
        if (!context.customerEmail) missingFields.push('• Correo Electrónico (opcional)');

        replyText = `🧾 *Ticket #${existingOrder.orderNumber} localizado con éxito* ($${existingOrder.total.toFixed(2)} MXN) ✅\n\n` +
          `Para emitir tu factura CFDI 4.0 ante el SAT, por favor respóndeme con tus datos fiscales copiando y llenando esta plantilla:\n\n` +
          `*RFC:* ${context.rfc || ''}\n` +
          `*Razón Social:* ${context.taxName || ''}\n` +
          `*Código Postal:* ${context.taxZipCode || ''}\n` +
          `*Régimen Fiscal:* ${context.fiscalRegime || '601'}\n` +
          `*Uso CFDI:* ${context.cfdiUse || 'G03'}\n` +
          `*Correo:* ${context.customerEmail || ''}\n\n` +
          `_En cuanto me los envíes, tu factura será timbrada en menos de 10 segundos._ ⚡`;
      }
    } else {
      // No hay ticket identificado aún
      replyType = 'AWAITING_DATA';
      replyText = `📄 *Asistente de Facturación Automática en 1-Clic* ⚡\n\n` +
        `Para comenzar, por favor envíame el *número de ticket* de tu consumo (ejemplo: *ORD-1045*) o tómale una *fotografía a tu ticket de compra*. 📸`;
    }
  }

  // ==========================================================================
  // FLUJO B: RASTREO Y ESTATUS DE PEDIDOS (ORDER_TRACKING)
  // ==========================================================================
  else if (intent === 'ORDER_TRACKING') {
    const targetFolio = detectedFolio || context.ticketNumber;

    let targetOrder = null;
    if (targetFolio) {
      targetOrder = await prisma.order.findFirst({
        where: { brandId, orderNumber: targetFolio },
        include: { driver: true },
      });
    } else {
      // Buscar la orden más reciente vinculada al teléfono del cliente
      targetOrder = await prisma.order.findFirst({
        where: { brandId, customerPhone },
        orderBy: { createdAt: 'desc' },
        include: { driver: true },
      });
    }

    if (!targetOrder) {
      replyType = 'TEXT';
      replyText = `🛵 *Rastreo de Pedidos en Vivo*\n\n` +
        `No encontré pedidos activos asociados a tu número. Por favor indícame tu número de orden (ejemplo: *ORD-1234*) para localizarlo de inmediato.`;
    } else {
      orderNumber = targetOrder.orderNumber;
      orderStatus = targetOrder.status;
      trackingUrl = `/order-tracking/${targetOrder.id}`;
      replyType = 'ORDER_TRACKING';

      const statusLabels: Record<string, string> = {
        RECEIVED: '📥 Recibido en cocina',
        PREPARING: '🍳 En preparación en la línea de fuego',
        READY: '✅ Listo para empaque / despacho',
        IN_DELIVERY: '🛵 En camino con nuestro repartidor',
        SERVED: '🍽️ Entregado / Finalizado',
        CANCELLED: '❌ Cancelado',
      };

      const friendlyStatus = statusLabels[targetOrder.status] || targetOrder.status;

      replyText = `🛵 *Estatus de tu Pedido #${targetOrder.orderNumber}*\n\n` +
        `Estado actual: *${friendlyStatus}*\n` +
        `Cliente: *${targetOrder.customerName}*\n` +
        `Total: *$${targetOrder.total.toFixed(2)} MXN*\n` +
        (targetOrder.driver ? `Repartidor asignado: *${targetOrder.driver.name}*\n` : '') +
        `\nPuedes ver el mapa en tiempo real y progreso aquí:\n` +
        `👉 ${process.env.NEXT_PUBLIC_APP_URL || ''}/order-tracking/${targetOrder.id}\n\n` +
        `¿Deseas algo más? 😊`;
    }
  }

  // ==========================================================================
  // FLUJO C: CONSULTA DE MENÚ Y PROMOCIONES (MENU_INQUIRY)
  // ==========================================================================
  else if (intent === 'MENU_INQUIRY') {
    replyType = 'MENU_INFO';
    const menuUrl = `${process.env.NEXT_PUBLIC_APP_URL || ''}/m/${brand?.slug || 'menu'}`;

    replyText = `📋 *Menú Digital & Promociones de ${brandName}* 🍔\n\n` +
      `Conoce todos nuestros platillos, combos y bebidas disponibles hoy:\n` +
      `👉 *Ver Menú y Ordenar en Línea:* ${menuUrl}\n\n` +
      `🔥 *Promociones del Día:*\n` +
      `• Pregunta por nuestro *Happy Hour* y combos especiales.\n` +
      `• Acumula puntos de lealtad Cashback con cada compra.\n\n` +
      `Si deseas facturar o rastrear un pedido, sólo dime el número de tu ticket. 👍`;
  }

  // ==========================================================================
  // FLUJO D: AYUDA / SALUDO GENERAL (HELP_GREETING / GENERAL)
  // ==========================================================================
  else {
    replyType = 'TEXT';
    const defaultWelcome = brand?.whatsappWelcomeMsg ||
      `¡Hola! 👋 Bienvenido al Asistente Virtual de ${brandName}.\n\nPuedo ayudarte con:\n` +
      `1️⃣ *Facturar un Ticket* en menos de 1 minuto 📄\n` +
      `2️⃣ *Rastrear un Pedido* a domicilio en tiempo real 🛵\n` +
      `3️⃣ *Consultar el Menú Digital* y promociones 📋\n\n` +
      `¿En qué puedo apoyarte hoy? Escribe tu número de ticket o elige una opción.`;

    replyText = defaultWelcome.replace('{{brandName}}', brandName);
  }

  // 5. Registrar mensaje de respuesta saliente del Bot
  await prisma.whatsAppMessage.create({
    data: {
      conversationId: conversation.id,
      direction: 'OUTBOUND',
      senderType: 'BOT',
      messageType: 'TEXT',
      content: replyText,
      intentDetected: intent,
      metadata: JSON.stringify({
        invoiceId,
        pdfUrl,
        xmlUrl,
        orderNumber,
        orderStatus,
        trackingUrl,
      }),
      status: 'DELIVERED',
    },
  });

  // 6. Actualizar Conversación con último mensaje y contexto
  await prisma.whatsAppConversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageText: replyText.slice(0, 200),
      lastMessageAt: new Date(),
      currentIntent: intent,
      contextData: JSON.stringify(context),
    },
  });

  return {
    replyText,
    replyType,
    invoiceId,
    pdfUrl,
    xmlUrl,
    orderNumber,
    orderStatus,
    trackingUrl,
    conversationId: conversation.id,
  };
}

// ============================================================================
// SIMULATION & TESTING HELPER
// ============================================================================

export async function simulateCustomerWhatsAppMessage(params: {
  brandId: string;
  customerPhone?: string;
  customerName?: string;
  content: string;
  mediaUrl?: string;
}): Promise<WhatsAppBotReply> {
  const customerPhone = params.customerPhone || '5215512345678';
  const customerName = params.customerName || 'Cliente Simulado';

  return await processInboundWhatsAppMessage({
    brandId: params.brandId,
    customerPhone,
    customerName,
    content: params.content,
    mediaUrl: params.mediaUrl,
  });
}


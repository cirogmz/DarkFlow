import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isDetractorAlert, executeAutomaticCompensation } from '@/lib/surveys';
import { recordAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');
    const orderNumber = searchParams.get('orderNumber');
    const tableId = searchParams.get('tableId');
    const brandId = searchParams.get('brandId');

    let order = null;

    if (orderId) {
      order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          brand: {
            select: {
              id: true,
              name: true,
              slug: true,
              logoUrl: true,
              primaryColor: true,
              surveyQrFooterText: true,
            },
          },
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
              walletBalance: true,
              walletQrCode: true,
              tier: true,
            },
          },
          survey: true,
        },
      });
    } else if (orderNumber && brandId) {
      order = await prisma.order.findFirst({
        where: {
          orderNumber: String(orderNumber),
          brandId,
        },
        include: {
          brand: {
            select: {
              id: true,
              name: true,
              slug: true,
              logoUrl: true,
              primaryColor: true,
              surveyQrFooterText: true,
            },
          },
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
              walletBalance: true,
              walletQrCode: true,
              tier: true,
            },
          },
          survey: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    } else if (tableId) {
      // Find latest completed/delivered or open order on table
      order = await prisma.order.findFirst({
        where: {
          tableId,
        },
        include: {
          brand: {
            select: {
              id: true,
              name: true,
              slug: true,
              logoUrl: true,
              primaryColor: true,
              surveyQrFooterText: true,
            },
          },
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
              walletBalance: true,
              walletQrCode: true,
              tier: true,
            },
          },
          survey: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!order) {
      return NextResponse.json({ error: 'Comanda u orden no encontrada' }, { status: 404 });
    }

    // Resolve waiter name if present
    let waiterName = null;
    if (order.waiterId) {
      const waiter = await prisma.user.findUnique({
        where: { id: order.waiterId },
        select: { name: true },
      });
      waiterName = waiter?.name || null;
    }

    // Resolve table number if present
    let tableNumber = null;
    if (order.tableId) {
      const table = await prisma.table.findUnique({
        where: { id: order.tableId },
        select: { number: true },
      });
      tableNumber = table ? `Mesa ${table.number}` : null;
    }

    return NextResponse.json({
      exists: !!order.survey,
      survey: order.survey,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        total: order.total,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        tableId: order.tableId,
        tableNumber,
        waiterId: order.waiterId,
        waiterName,
        createdAt: order.createdAt,
      },
      customer: order.customer,
      brand: order.brand,
    });
  } catch (error) {
    console.error('Error querying public survey:', error);
    return NextResponse.json({ error: 'Error al consultar encuesta' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      orderId,
      overallRating,
      npsScore,
      foodRating,
      serviceRating,
      speedRating,
      cleanlinessRating,
      tags,
      comment,
      customerName,
      customerPhone,
      source,
    } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'orderId es requerido' }, { status: 400 });
    }

    const parsedRating = Number(overallRating);
    const parsedNPS = Number(npsScore);

    if (isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return NextResponse.json({ error: 'Calificación general debe estar entre 1 y 5 estrellas' }, { status: 400 });
    }

    if (isNaN(parsedNPS) || parsedNPS < 0 || parsedNPS > 10) {
      return NextResponse.json({ error: 'Calificación NPS debe estar entre 0 y 10' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Orden no encontrada' }, { status: 404 });
    }

    const existingSurvey = await prisma.satisfactionSurvey.findUnique({
      where: { orderId },
    });

    if (existingSurvey) {
      return NextResponse.json({ error: 'Ya existe una encuesta registrada para esta orden' }, { status: 409 });
    }

    const isDetractor = isDetractorAlert(parsedRating, parsedNPS);
    const initialStatus = isDetractor ? 'PENDING_RESOLUTION' : 'RESOLVED';

    // Resolve waiter info
    let waiterName = null;
    if (order.waiterId) {
      const w = await prisma.user.findUnique({ where: { id: order.waiterId }, select: { name: true } });
      waiterName = w?.name || null;
    }

    // Resolve table info
    let tableNumber = null;
    if (order.tableId) {
      const t = await prisma.table.findUnique({ where: { id: order.tableId }, select: { number: true } });
      tableNumber = t ? `Mesa ${t.number}` : null;
    }

    // Phase 51: Process automatic compensation if diner is dissatisfied
    const compResult = await executeAutomaticCompensation({
      brandId: order.brandId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      overallRating: parsedRating,
      npsScore: parsedNPS,
      customerId: order.customerId,
      customerPhone: customerPhone || order.customerPhone,
      customerName: customerName || order.customerName,
    });

    const survey = await prisma.satisfactionSurvey.create({
      data: {
        orderId: order.id,
        brandId: order.brandId,
        customerId: order.customerId || null,
        overallRating: parsedRating,
        npsScore: parsedNPS,
        foodRating: foodRating ? Math.max(1, Math.min(5, Number(foodRating))) : null,
        serviceRating: serviceRating ? Math.max(1, Math.min(5, Number(serviceRating))) : null,
        speedRating: speedRating ? Math.max(1, Math.min(5, Number(speedRating))) : null,
        cleanlinessRating: cleanlinessRating ? Math.max(1, Math.min(5, Number(cleanlinessRating))) : null,
        tags: Array.isArray(tags) && tags.length > 0 ? JSON.stringify(tags) : null,
        comment: comment?.trim() || null,
        customerName: customerName?.trim() || order.customerName,
        customerPhone: customerPhone?.trim() || order.customerPhone || null,
        status: initialStatus,
        tableId: order.tableId || null,
        tableNumber,
        waiterId: order.waiterId || null,
        waiterName,
        source: source || (order.tableId ? 'QR_TABLE' : 'QR_TICKET'),
        compensationType: compResult.type,
        compensationAmount: compResult.amount > 0 ? compResult.amount : null,
        compensationCouponId: compResult.couponId || null,
        compensationCouponCode: compResult.couponCode || null,
        compensationWalletTxId: compResult.walletTxId || null,
        compensationStatus: compResult.applied ? (compResult.type === 'WALLET_CREDIT' ? 'CLAIMED' : 'OFFERED') : 'NONE',
        compensationClaimedAt: compResult.type === 'WALLET_CREDIT' ? new Date() : null,
      },
    });

    // Detractor immediate alert logging
    if (isDetractor) {
      await recordAuditLog({
        action: 'DETRACTOR_ALERT',
        entityType: 'SATISFACTION_SURVEY',
        entityId: survey.id,
        severity: 'CRITICAL',
        details: `🚨 Alerta de Cliente Detractor en Orden #${order.orderNumber}. Calificación: ${parsedRating}★ | NPS: ${parsedNPS}/10. Comensal: ${order.customerName}. ${compResult.applied ? `[Compensación: ${compResult.type} de ${compResult.amount}]` : ''} ${comment ? `Comentario: "${comment.slice(0, 150)}"` : 'Sin comentario escrito.'}`,
        brandId: order.brandId,
        req: request,
      });
    }

    return NextResponse.json({
      success: true,
      survey,
      isDetractor,
      compensation: compResult,
      message: compResult.applied
        ? compResult.message
        : isDetractor
        ? 'Lamentamos mucho que tu experiencia no haya sido perfecta. Nuestro equipo de gerencia revisará tu caso de inmediato.'
        : '¡Muchas gracias por tus comentarios! Nos alegra contar con tu preferencia.',
    });
  } catch (error) {
    console.error('Error creating public survey:', error);
    return NextResponse.json({ error: 'Error al enviar la encuesta' }, { status: 500 });
  }
}

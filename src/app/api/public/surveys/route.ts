import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isDetractorAlert } from '@/lib/surveys';
import { recordAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');

    if (!orderId) {
      return NextResponse.json({ error: 'orderId es requerido' }, { status: 400 });
    }

    const survey = await prisma.satisfactionSurvey.findUnique({
      where: { orderId },
    });

    return NextResponse.json({
      exists: !!survey,
      survey,
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
      },
    });

    // Detractor immediate alert logging
    if (isDetractor) {
      await recordAuditLog({
        action: 'DETRACTOR_ALERT',
        entityType: 'SATISFACTION_SURVEY',
        entityId: survey.id,
        severity: 'CRITICAL',
        details: `🚨 Alerta de Cliente Detractor en Orden #${order.orderNumber}. Calificación: ${parsedRating}★ | NPS: ${parsedNPS}/10. Comensal: ${order.customerName}. ${comment ? `Comentario: "${comment.slice(0, 150)}"` : 'Sin comentario escrito.'}`,
        brandId: order.brandId,
        req: request,
      });
    }

    return NextResponse.json({
      success: true,
      survey,
      isDetractor,
      message: isDetractor
        ? 'Lamentamos mucho que tu experiencia no haya sido perfecta. Nuestro equipo de gerencia revisará tu caso de inmediato.'
        : '¡Muchas gracias por tus comentarios! Nos alegra contar con tu preferencia.',
    });
  } catch (error) {
    console.error('Error creating public survey:', error);
    return NextResponse.json({ error: 'Error al enviar la encuesta' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { recordAuditLog } from '@/lib/audit';
import { validateRfc } from '@/lib/cfdi';

export async function GET(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'BRAND_ADMIN')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const brandId = searchParams.get('brandId') || session.activeBrandId;

    if (!brandId) {
      return NextResponse.json({ error: 'Marca no seleccionada' }, { status: 400 });
    }

    const brand = await prisma.brand.findUnique({
      where: { id: brandId },
      select: {
        id: true,
        name: true,
        slug: true,
        rfc: true,
        legalName: true,
        taxRegime: true,
        postalCode: true,
        invoiceSeries: true,
        invoiceNextFolio: true,
        pacEnvironment: true,
      },
    });

    if (!brand) {
      return NextResponse.json({ error: 'Marca no encontrada' }, { status: 404 });
    }

    // Count issued invoices for metrics
    const invoiceCount = await prisma.invoice.count({
      where: { brandId: brand.id, status: 'STAMPED' },
    });

    return NextResponse.json({
      config: {
        ...brand,
        invoiceCount,
      },
    });
  } catch (error: any) {
    console.error('Error fetching invoicing configuration:', error);
    return NextResponse.json(
      { error: 'Error al obtener la configuración fiscal' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'BRAND_ADMIN')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = await req.json();
    const brandId = body.brandId || session.activeBrandId;

    if (!brandId) {
      return NextResponse.json({ error: 'Marca no seleccionada' }, { status: 400 });
    }

    const {
      rfc,
      legalName,
      taxRegime,
      postalCode,
      invoiceSeries,
      invoiceNextFolio,
      pacEnvironment,
    } = body;

    // Validate RFC if provided
    if (rfc) {
      const cleanRfc = rfc.trim().toUpperCase();
      if (!validateRfc(cleanRfc)) {
        return NextResponse.json({ error: 'El RFC del Emisor no cumple con el formato fiscal oficial del SAT' }, { status: 400 });
      }
    }

    // Update brand
    const updatedBrand = await prisma.brand.update({
      where: { id: brandId },
      data: {
        rfc: rfc ? rfc.trim().toUpperCase() : null,
        legalName: legalName ? legalName.trim().toUpperCase() : null,
        taxRegime: taxRegime || null,
        postalCode: postalCode ? postalCode.trim() : null,
        invoiceSeries: invoiceSeries ? invoiceSeries.trim().toUpperCase() : 'A',
        invoiceNextFolio: typeof invoiceNextFolio === 'number' && invoiceNextFolio >= 1 ? invoiceNextFolio : undefined,
        pacEnvironment: pacEnvironment === 'PRODUCTION' ? 'PRODUCTION' : 'SANDBOX',
      },
      select: {
        id: true,
        name: true,
        slug: true,
        rfc: true,
        legalName: true,
        taxRegime: true,
        postalCode: true,
        invoiceSeries: true,
        invoiceNextFolio: true,
        pacEnvironment: true,
      },
    });

    await recordAuditLog({
      action: 'UPDATE',
      entityType: 'Brand',
      entityId: brandId,
      brandId: brandId,
      userId: session.userId,
      details: {
        message: 'Configuración de Facturación CFDI 4.0 actualizada',
        rfc: updatedBrand.rfc,
        legalName: updatedBrand.legalName,
        pacEnvironment: updatedBrand.pacEnvironment,
      },
    });

    return NextResponse.json({
      message: 'Configuración fiscal guardada correctamente',
      config: updatedBrand,
    });
  } catch (error: any) {
    console.error('Error updating invoicing configuration:', error);
    return NextResponse.json(
      { error: error.message || 'Error al actualizar la configuración fiscal' },
      { status: 500 }
    );
  }
}

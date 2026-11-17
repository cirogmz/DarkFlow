import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getOrCreateBrandTipConfig } from '@/lib/tipPool';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const brandId = searchParams.get('brandId');

    if (!brandId) {
      return NextResponse.json({ error: 'brandId requerido' }, { status: 400 });
    }

    const config = await getOrCreateBrandTipConfig(brandId);
    return NextResponse.json(config);
  } catch (error: any) {
    console.error('Error al obtener configuración de propinas:', error);
    return NextResponse.json({ error: error.message || 'Error del servidor' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      brandId,
      isEnabled,
      distributionModel,
      includeCashTips,
      includeCardTips,
      includeDigitalTips,
      kitchenKickoutPct,
      barKickoutPct,
      minHoursRequired,
      roleRules,
    } = body;

    if (!brandId) {
      return NextResponse.json({ error: 'brandId requerido' }, { status: 400 });
    }

    const existing = await getOrCreateBrandTipConfig(brandId);

    const updated = await prisma.$transaction(async (tx) => {
      const cfg = await tx.tipPoolConfig.update({
        where: { id: existing.id },
        data: {
          isEnabled: isEnabled !== undefined ? Boolean(isEnabled) : true,
          distributionModel: distributionModel || 'POINTS_HOURS',
          includeCashTips: includeCashTips !== undefined ? Boolean(includeCashTips) : true,
          includeCardTips: includeCardTips !== undefined ? Boolean(includeCardTips) : true,
          includeDigitalTips: includeDigitalTips !== undefined ? Boolean(includeDigitalTips) : true,
          kitchenKickoutPct: Number(kitchenKickoutPct || 0),
          barKickoutPct: Number(barKickoutPct || 0),
          minHoursRequired: Number(minHoursRequired || 1.0),
        },
      });

      if (Array.isArray(roleRules)) {
        for (const rule of roleRules) {
          if (rule.id) {
            await tx.tipPoolRoleRule.update({
              where: { id: rule.id },
              data: {
                roleDisplayName: rule.roleDisplayName,
                pointsWeight: Number(rule.pointsWeight || 1),
                percentageShare: Number(rule.percentageShare || 0),
                isActive: rule.isActive !== undefined ? Boolean(rule.isActive) : true,
              },
            });
          } else if (rule.role) {
            await tx.tipPoolRoleRule.upsert({
              where: {
                configId_role: {
                  configId: cfg.id,
                  role: rule.role,
                },
              },
              create: {
                configId: cfg.id,
                role: rule.role,
                roleDisplayName: rule.roleDisplayName || rule.role,
                pointsWeight: Number(rule.pointsWeight || 1),
                percentageShare: Number(rule.percentageShare || 0),
                isActive: rule.isActive !== undefined ? Boolean(rule.isActive) : true,
              },
              update: {
                roleDisplayName: rule.roleDisplayName || rule.role,
                pointsWeight: Number(rule.pointsWeight || 1),
                percentageShare: Number(rule.percentageShare || 0),
                isActive: rule.isActive !== undefined ? Boolean(rule.isActive) : true,
              },
            });
          }
        }
      }

      return tx.tipPoolConfig.findUnique({
        where: { id: cfg.id },
        include: { roleRules: true },
      });
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('Error al actualizar configuración de propinas:', error);
    return NextResponse.json({ error: error.message || 'Error del servidor' }, { status: 500 });
  }
}


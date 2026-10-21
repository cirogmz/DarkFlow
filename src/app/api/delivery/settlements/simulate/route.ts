import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { recordAuditLog } from '@/lib/audit';

const SAMPLE_CUSTOMERS = [
  { name: 'Valeria Domínguez', phone: '5541829011', address: 'Col. Roma Norte #42, CDMX' },
  { name: 'Mateo González', phone: '5578291034', address: 'Av. Horacio 120, Polanco, CDMX' },
  { name: 'Camila Morales', phone: '5529481726', address: 'Insurgentes Sur 890, Del Valle' },
  { name: 'Santiago Herrera', phone: '5561029384', address: 'Calle Sonora 78, Condesa, CDMX' },
  { name: 'Regina Carrillo', phone: '5598127364', address: 'Paseo de la Reforma 250, Juárez' },
  { name: 'Emiliano Vargas', phone: '5539201847', address: 'Av. Revolución 1420, San Ángel' },
];

export async function POST(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie') || '';
    const session = getSessionFromCookies(cookieHeader);

    if (!session || !session.activeBrandId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const activeBrandId = session.activeBrandId as string;
    const body = await req.json();
    const { action = 'SEED_DELIVERY_WEEK', platform = 'UBER_EATS', scenario = 'EXACT_MATCH' } = body;

    if (action === 'SEED_DELIVERY_WEEK') {
      // Find products of this brand to attach items to orders
      const products = await prisma.product.findMany({
        where: { brandId: activeBrandId, isActive: true },
        take: 8,
      });

      if (products.length === 0) {
        return NextResponse.json({
          error: 'La marca debe tener al menos un producto activo para generar pedidos de prueba',
        }, { status: 400 });
      }

      const platforms = ['UBER_EATS', 'RAPPI', 'DIDI_FOOD'];
      const commissionRates: Record<string, number> = {
        UBER_EATS: 28,
        RAPPI: 25,
        DIDI_FOOD: 22,
      };

      const now = new Date();
      const createdOrders = [];

      // Generate 15 delivery orders distributed across the last 6 days
      for (let i = 0; i < 15; i++) {
        const plat = platforms[i % 3];
        const cust = SAMPLE_CUSTOMERS[i % SAMPLE_CUSTOMERS.length];
        const daysAgo = Math.floor(i / 3) + 1;
        const orderDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000 + (i * 37 * 60 * 1000));

        // Select 1 to 3 products
        const numItems = (i % 3) + 1;
        const selectedProds = products.slice(0, numItems);

        let subtotal = 0;
        const itemsData = selectedProds.map((p, idx) => {
          const qty = (idx % 2) + 1;
          subtotal += p.price * qty;
          return {
            productId: p.id,
            quantity: qty,
            price: p.price,
          };
        });

        const tax = parseFloat((subtotal * 0.16).toFixed(2));
        const total = parseFloat((subtotal + tax).toFixed(2));
        const rate = commissionRates[plat];
        const commission = parseFloat(((total * rate) / 100).toFixed(2));
        const netPayout = parseFloat((total - commission).toFixed(2));

        const orderCount = await prisma.order.count();
        const orderNum = `DF-DELIV-${1000 + orderCount + 1}`;
        const externalId = `${plat.slice(0, 4)}-${Math.floor(10000 + Math.random() * 90000)}`;

        const order = await prisma.order.create({
          data: {
            orderNumber: orderNum,
            brandId: activeBrandId,
            source: plat,
            status: 'DELIVERED',
            customerName: cust.name,
            customerPhone: cust.phone,
            customerAddress: cust.address,
            subtotal,
            tax,
            total,
            externalOrderId: externalId,
            platformCommissionRate: rate,
            platformCommission: commission,
            netPayout,
            deliveryService: 'PLATFORM_DRIVER',
            paymentStatus: 'PAID',
            paymentMethod: 'ONLINE_APP',
            reconciliationStatus: 'UNRECONCILED',
            createdAt: orderDate,
            items: {
              create: itemsData,
            },
          },
        });

        createdOrders.push(order);
      }

      await recordAuditLog({
        brandId: activeBrandId,
        userId: session.userId,
        action: 'DELIVERY_SIMULATOR_SEEDED',
        entityType: 'Order',
        severity: 'INFO',
        details: { count: createdOrders.length },
      });

      return NextResponse.json({
        success: true,
        message: `Se generaron exitosamente 15 pedidos de delivery distribuidos en Uber Eats, Rappi y DiDi Food listos para conciliar`,
        count: createdOrders.length,
      });
    }

    if (action === 'SIMULATE_SETTLEMENT') {
      const selectedPlatform = platform || 'UBER_EATS';
      
      // Fetch unreconciled orders of this platform
      const unreconciled = await prisma.order.findMany({
        where: {
          brandId: activeBrandId,
          source: selectedPlatform,
          reconciliationStatus: 'UNRECONCILED',
        },
        take: 10,
        orderBy: { createdAt: 'desc' },
      });

      if (unreconciled.length === 0) {
        return NextResponse.json({
          error: `No hay pedidos pendientes de ${selectedPlatform}. Usa 'Generar Comandas de Prueba' primero.`,
        }, { status: 400 });
      }

      let grossSales = 0;
      let platformCommission = 0;
      for (const o of unreconciled) {
        grossSales += o.total;
        platformCommission += (o.platformCommission || 0);
      }

      grossSales = parseFloat(grossSales.toFixed(2));
      platformCommission = parseFloat(platformCommission.toFixed(2));
      const commissionTax = parseFloat(((platformCommission * 0.16)).toFixed(2));
      const withholdingIsr = parseFloat(((grossSales * 0.01)).toFixed(2));
      const withholdingIva = parseFloat(((grossSales * 0.08)).toFixed(2));

      let promotionsFunded = 0;
      let adjustmentsRefunds = 0;
      let artificialVariance = 0;

      if (scenario === 'UNJUSTIFIED_REFUND') {
        adjustmentsRefunds = 280.0; // Food complaint deduction
      } else if (scenario === 'MISSING_PAYOUT') {
        artificialVariance = -420.0; // Bank deposit short
      }

      const netCalculated = parseFloat((
        grossSales - platformCommission - commissionTax - withholdingIsr - withholdingIva - promotionsFunded - adjustmentsRefunds
      ).toFixed(2));

      const bankDeposit = parseFloat((netCalculated + artificialVariance).toFixed(2));
      const finalVariance = parseFloat((bankDeposit - netCalculated).toFixed(2));
      const isReconciled = Math.abs(finalVariance) <= 1.0;

      const folio = `SIM-SETTLE-${selectedPlatform.replace('_', '')}-${Date.now().toString().slice(-5)}`;
      const dates = unreconciled.map((o) => o.createdAt.getTime());
      const minDate = new Date(Math.min(...dates));
      const maxDate = new Date(Math.max(...dates));

      const result = await prisma.$transaction(async (tx) => {
        const settlement = await tx.deliveryPayoutSettlement.create({
          data: {
            brandId: activeBrandId,
            platform: selectedPlatform,
            folio,
            periodStart: minDate,
            periodEnd: maxDate,
            bankDepositDate: new Date(),
            bankReference: `SPEI BBVA *${Math.floor(1000 + Math.random() * 9000)} REF-${Math.floor(100000 + Math.random() * 900000)}`,
            status: isReconciled ? 'RECONCILED' : 'DISCREPANCY',
            ordersCount: unreconciled.length,
            grossSales,
            platformCommission,
            commissionTax,
            withholdingIsr,
            withholdingIva,
            promotionsFunded,
            adjustmentsRefunds,
            netPayoutCalculated: netCalculated,
            bankDepositAmount: bankDeposit,
            variance: finalVariance,
            notes: `Liquidación simulada (${scenario}) con ${unreconciled.length} comandas auditadas`,
            reconciledById: session.userId,
            reconciledByName: session.name,
            reconciledAt: new Date(),
          },
        });

        await tx.order.updateMany({
          where: { id: { in: unreconciled.map((o) => o.id) } },
          data: {
            payoutSettlementId: settlement.id,
            reconciliationStatus: isReconciled ? 'RECONCILED' : 'DISPUTED',
          },
        });

        if (finalVariance < -1.0) {
          await tx.deliveryDispute.create({
            data: {
              brandId: activeBrandId,
              settlementId: settlement.id,
              platform: selectedPlatform,
              disputeType: 'UNPAID_ORDER',
              claimedAmount: Math.abs(finalVariance),
              status: 'OPEN',
              ticketFolio: `DISP-${folio}`,
              reason: `Faltante de depósito bancario de $${Math.abs(finalVariance).toFixed(2)} MXN en corte semanal`,
              createdById: session.userId,
              createdByName: session.name,
            },
          });
        }

        return settlement;
      });

      return NextResponse.json({
        success: true,
        settlement: result,
        message: `Liquidación simulada ${folio} creada con estado ${result.status} (Varianza: $${finalVariance.toFixed(2)} MXN)`,
      });
    }

    if (action === 'RESET_SETTLEMENTS') {
      await prisma.$transaction(async (tx) => {
        // Unlink orders
        await tx.order.updateMany({
          where: { brandId: activeBrandId, payoutSettlementId: { not: null } },
          data: {
            payoutSettlementId: null,
            reconciliationStatus: 'UNRECONCILED',
          },
        });

        // Delete disputes
        await tx.deliveryDispute.deleteMany({
          where: { brandId: activeBrandId },
        });

        // Delete settlements
        await tx.deliveryPayoutSettlement.deleteMany({
          where: { brandId: activeBrandId },
        });
      });

      return NextResponse.json({
        success: true,
        message: 'Todas las liquidaciones de delivery fueron eliminadas y las comandas regresaron a estado no conciliado',
      });
    }

    return NextResponse.json({ error: 'Acción no reconocida' }, { status: 400 });
  } catch (error: any) {
    console.error('Error in delivery simulator:', error);
    return NextResponse.json({ error: error.message || 'Error en simulador de liquidaciones' }, { status: 500 });
  }
}

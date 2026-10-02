export type LoyaltyTierId = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';

export interface LoyaltyTierConfig {
  id: LoyaltyTierId;
  name: string;
  badge: string;
  icon: string;
  badgeClass: string;
  minSpent: number;
  minOrders: number;
  pointsMultiplier: number;
  discountPct: number;
  perks: string[];
}

export const LOYALTY_TIERS: Record<LoyaltyTierId, LoyaltyTierConfig> = {
  BRONZE: {
    id: 'BRONZE',
    name: 'Bronce',
    badge: 'Bronce 🥉',
    icon: '🥉',
    badgeClass: 'bg-amber-800/20 text-amber-500 border border-amber-700/40 shadow-sm shadow-amber-900/10',
    minSpent: 0,
    minOrders: 0,
    pointsMultiplier: 1.0,
    discountPct: 0.0,
    perks: [
      'Acumulación base: 1 pt por cada $10 MXN de consumo',
      'Acceso al catálogo de recompensas estándar',
    ],
  },
  SILVER: {
    id: 'SILVER',
    name: 'Plata',
    badge: 'Plata 🥈',
    icon: '🥈',
    badgeClass: 'bg-slate-300/20 text-slate-200 border border-slate-300/40 shadow-sm shadow-slate-400/10',
    minSpent: 2500,
    minOrders: 5,
    pointsMultiplier: 1.25,
    discountPct: 5.0,
    perks: [
      '1.25x Puntos en todos tus pedidos (+25% acelerado)',
      '5% Descuento automático permanente en consumos',
      'Postre de cortesía en tu mes de cumpleaños',
    ],
  },
  GOLD: {
    id: 'GOLD',
    name: 'Oro',
    badge: 'Oro 🥇',
    icon: '🥇',
    badgeClass: 'bg-amber-400/20 text-amber-300 border border-amber-400/50 shadow-sm shadow-amber-500/20',
    minSpent: 6000,
    minOrders: 15,
    pointsMultiplier: 1.5,
    discountPct: 10.0,
    perks: [
      '1.5x Puntos en todos tus pedidos (+50% acelerado)',
      '10% Descuento automático permanente en consumos',
      'Combo de Bebida & Postre especial en tu cumpleaños',
      'Asignación prioritaria en reservaciones de mesa',
    ],
  },
  PLATINUM: {
    id: 'PLATINUM',
    name: 'Platino VIP',
    badge: 'Platino 💎',
    icon: '💎',
    badgeClass: 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/60 shadow-md shadow-cyan-500/20',
    minSpent: 15000,
    minOrders: 30,
    pointsMultiplier: 2.0,
    discountPct: 15.0,
    perks: [
      '2.0x Doble acumulación de puntos (100% bonus)',
      '15% Descuento automático permanente en consumos',
      'Botella o Menú Degustación cortesía de cumpleaños',
      'Acceso preferencial sin fila y atención exclusiva VIP',
    ],
  },
};

export const TIER_ORDER: LoyaltyTierId[] = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];

/**
 * Determines customer tier based on totalSpent OR totalOrders achieved.
 */
export function determineCustomerTier(totalSpent: number, totalOrders: number): LoyaltyTierConfig {
  if (totalSpent >= LOYALTY_TIERS.PLATINUM.minSpent || totalOrders >= LOYALTY_TIERS.PLATINUM.minOrders) {
    return LOYALTY_TIERS.PLATINUM;
  }
  if (totalSpent >= LOYALTY_TIERS.GOLD.minSpent || totalOrders >= LOYALTY_TIERS.GOLD.minOrders) {
    return LOYALTY_TIERS.GOLD;
  }
  if (totalSpent >= LOYALTY_TIERS.SILVER.minSpent || totalOrders >= LOYALTY_TIERS.SILVER.minOrders) {
    return LOYALTY_TIERS.SILVER;
  }
  return LOYALTY_TIERS.BRONZE;
}

export interface TierProgress {
  currentTier: LoyaltyTierConfig;
  nextTier: LoyaltyTierConfig | null;
  spentProgressPct: number;
  ordersProgressPct: number;
  overallProgressPct: number;
  spentRemaining: number;
  ordersRemaining: number;
}

/**
 * Calculates progress toward the next loyalty tier.
 */
export function calculateNextTierProgress(totalSpent: number, totalOrders: number): TierProgress {
  const currentTier = determineCustomerTier(totalSpent, totalOrders);
  const currentIndex = TIER_ORDER.indexOf(currentTier.id);

  if (currentIndex === TIER_ORDER.length - 1) {
    return {
      currentTier,
      nextTier: null,
      spentProgressPct: 100,
      ordersProgressPct: 100,
      overallProgressPct: 100,
      spentRemaining: 0,
      ordersRemaining: 0,
    };
  }

  const nextTierId = TIER_ORDER[currentIndex + 1];
  const nextTier = LOYALTY_TIERS[nextTierId];

  const spentRemaining = Math.max(0, nextTier.minSpent - totalSpent);
  const ordersRemaining = Math.max(0, nextTier.minOrders - totalOrders);

  const spentProgressPct = Math.min(100, Math.max(0, Math.round((totalSpent / nextTier.minSpent) * 100)));
  const ordersProgressPct = Math.min(100, Math.max(0, Math.round((totalOrders / nextTier.minOrders) * 100)));
  const overallProgressPct = Math.max(spentProgressPct, ordersProgressPct);

  return {
    currentTier,
    nextTier,
    spentProgressPct,
    ordersProgressPct,
    overallProgressPct,
    spentRemaining,
    ordersRemaining,
  };
}

/**
 * Calculates loyalty points earned for an order amount considering the tier multiplier.
 * Base: 1 pt per $10 MXN subtotal.
 */
export function calculateLoyaltyPointsEarned(amount: number, multiplier = 1.0): number {
  if (amount <= 0) return 0;
  const basePoints = Math.floor(amount / 10);
  return Math.round(basePoints * Math.max(1.0, multiplier));
}

/**
 * Calculates automatic tier discount amount given an order subtotal.
 */
export function calculateTierDiscountAmount(subtotal: number, discountPct = 0.0): number {
  if (subtotal <= 0 || discountPct <= 0) return 0;
  return Math.round(((subtotal * discountPct) / 100) * 100) / 100;
}

export interface BirthdayAnalysis {
  isBirthdayThisMonth: boolean;
  isBirthdayThisWeek: boolean;
  isBirthdayToday: boolean;
  formattedBirthDate: string | null;
  day: number | null;
  month: number | null;
}

/**
 * Analyzes whether customer is celebrating a birthday this month or week.
 * Supported birthDate formats: 'YYYY-MM-DD' or 'MM-DD'.
 */
export function checkBirthdayCelebration(birthDateStr: string | null | undefined, referenceDate = new Date()): BirthdayAnalysis {
  if (!birthDateStr || !birthDateStr.trim()) {
    return {
      isBirthdayThisMonth: false,
      isBirthdayThisWeek: false,
      isBirthdayToday: false,
      formattedBirthDate: null,
      day: null,
      month: null,
    };
  }

  try {
    const parts = birthDateStr.trim().split('-');
    let month: number;
    let day: number;

    if (parts.length === 3) {
      // YYYY-MM-DD
      month = parseInt(parts[1], 10);
      day = parseInt(parts[2], 10);
    } else if (parts.length === 2) {
      // MM-DD
      month = parseInt(parts[0], 10);
      day = parseInt(parts[1], 10);
    } else {
      return {
        isBirthdayThisMonth: false,
        isBirthdayThisWeek: false,
        isBirthdayToday: false,
        formattedBirthDate: birthDateStr,
        day: null,
        month: null,
      };
    }

    if (isNaN(month) || isNaN(day) || month < 1 || month > 12 || day < 1 || day > 31) {
      return {
        isBirthdayThisMonth: false,
        isBirthdayThisWeek: false,
        isBirthdayToday: false,
        formattedBirthDate: birthDateStr,
        day: null,
        month: null,
      };
    }

    const currentYear = referenceDate.getFullYear();
    const currentMonth = referenceDate.getMonth() + 1; // 1-12
    const currentDay = referenceDate.getDate();

    const isBirthdayThisMonth = month === currentMonth;
    const isBirthdayToday = isBirthdayThisMonth && day === currentDay;

    // Birthday this week (within +/- 3 days of today)
    const thisYearBirthday = new Date(currentYear, month - 1, day);
    const diffTime = Math.abs(thisYearBirthday.getTime() - referenceDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const isBirthdayThisWeek = diffDays <= 4;

    const monthNames = [
      'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
      'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
    ];
    const formattedBirthDate = `${day} de ${monthNames[month - 1]}`;

    return {
      isBirthdayThisMonth,
      isBirthdayThisWeek,
      isBirthdayToday,
      formattedBirthDate,
      day,
      month,
    };
  } catch {
    return {
      isBirthdayThisMonth: false,
      isBirthdayThisWeek: false,
      isBirthdayToday: false,
      formattedBirthDate: birthDateStr,
      day: null,
      month: null,
    };
  }
}

export interface PriceRuleItem {
  id: string;
  brandId: string;
  name: string;
  description?: string | null;
  type: 'PERCENTAGE_DISCOUNT' | 'FIXED_PRICE' | 'BUY_X_GET_Y' | string;
  discountValue: number;
  buyQty?: number | null;
  getQty?: number | null;
  daysOfWeek: string; // Comma-separated: 0=Sun, 1=Mon, ..., 6=Sat
  startTime: string; // "HH:mm" e.g. "17:00"
  endTime: string; // "HH:mm" e.g. "20:00"
  isActive: boolean;
  appliesToAll: boolean;
  categoryIds?: string | null;
  productIds?: string | null;
  zone?: string | null;
  isFlashDeal?: boolean;
  flashDealExpiresAt?: Date | string | null;
  badgeLabel?: string | null;
  minOrderAmount?: number | null;
  priority?: number;
}

export interface RuleEvaluationResult {
  hasPromo: boolean;
  rule?: PriceRuleItem;
  originalUnitPrice: number;
  effectiveUnitPrice: number;
  originalLineTotal: number;
  effectiveLineTotal: number;
  savings: number;
  badgeText?: string;
  remainingSeconds?: number;
  isFlashDeal?: boolean;
}

/**
 * Checks if a given price rule is currently within its active time window and day.
 */
export function isRuleActiveNow(rule: PriceRuleItem, now = new Date(), zone?: string): boolean {
  if (!rule.isActive) return false;

  // Flash Deal absolute expiration check
  if (rule.isFlashDeal && rule.flashDealExpiresAt) {
    const expires = new Date(rule.flashDealExpiresAt).getTime();
    if (now.getTime() > expires) {
      return false;
    }
  }

  // Zone match check (if rule specifies a zone, it must match or be omitted)
  if (rule.zone && zone && rule.zone.trim().toLowerCase() !== zone.trim().toLowerCase()) {
    return false;
  }

  // If it's a pure Flash Deal without specific hours, it's active as long as expiresAt is in the future
  if (rule.isFlashDeal && (!rule.startTime || rule.startTime === '00:00') && (!rule.endTime || rule.endTime === '23:59')) {
    return true;
  }

  // Day of week check (0=Sunday, 1=Monday, ..., 6=Saturday)
  const currentDay = now.getDay();
  const allowedDays = (rule.daysOfWeek || '0,1,2,3,4,5,6')
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n));

  if (!allowedDays.includes(currentDay)) {
    return false;
  }

  // Time window check (HH:mm format)
  const startTime = rule.startTime || '00:00';
  const endTime = rule.endTime || '23:59';

  const [startHour, startMin] = startTime.split(':').map((s) => parseInt(s, 10));
  const [endHour, endMin] = endTime.split(':').map((s) => parseInt(s, 10));

  if (isNaN(startHour) || isNaN(endHour)) return false;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = startHour * 60 + (startMin || 0);
  const endMinutes = endHour * 60 + (endMin || 0);

  // If time wraps midnight (e.g. 22:00 to 02:00)
  if (endMinutes < startMinutes) {
    return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
  }

  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

/**
 * Calculates remaining active seconds for a rule (for live countdowns)
 */
export function getRuleRemainingSeconds(rule: PriceRuleItem, now = new Date()): number {
  if (rule.isFlashDeal && rule.flashDealExpiresAt) {
    const diff = Math.floor((new Date(rule.flashDealExpiresAt).getTime() - now.getTime()) / 1000);
    return Math.max(0, diff);
  }

  // Calculate seconds until rule's endTime today
  const endTime = rule.endTime || '23:59';
  const [endHour, endMin] = endTime.split(':').map((s) => parseInt(s, 10));
  if (isNaN(endHour)) return 0;

  const endToday = new Date(now);
  endToday.setHours(endHour, endMin || 0, 0, 0);

  // If endTime was earlier today (e.g. past midnight wrap)
  if (endToday.getTime() <= now.getTime()) {
    endToday.setDate(endToday.getDate() + 1);
  }

  return Math.max(0, Math.floor((endToday.getTime() - now.getTime()) / 1000));
}

/**
 * Formats seconds into a clean human countdown string: e.g. "01:45:22" or "45m 10s"
 */
export function formatRuleCountdown(seconds: number): string {
  if (seconds <= 0) return '00:00:00';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const pad = (n: number) => String(n).padStart(2, '0');

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }

  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
}

/**
 * Checks if a price rule applies to a specific product by ID or Category ID.
 */
export function doesRuleApplyToProduct(
  rule: PriceRuleItem,
  product: { id: string; categoryId?: string | null }
): boolean {
  if (rule.appliesToAll) return true;

  // Check product IDs
  if (rule.productIds) {
    let ids: string[] = [];
    try {
      if (rule.productIds.startsWith('[')) {
        ids = JSON.parse(rule.productIds);
      } else {
        ids = rule.productIds.split(',').map((s) => s.trim());
      }
    } catch {
      ids = rule.productIds.split(',').map((s) => s.trim());
    }
    if (ids.includes(product.id)) return true;
  }

  // Check category IDs
  if (rule.categoryIds && product.categoryId) {
    let catIds: string[] = [];
    try {
      if (rule.categoryIds.startsWith('[')) {
        catIds = JSON.parse(rule.categoryIds);
      } else {
        catIds = rule.categoryIds.split(',').map((s) => s.trim());
      }
    } catch {
      catIds = rule.categoryIds.split(',').map((s) => s.trim());
    }
    if (catIds.includes(product.categoryId)) return true;
  }

  return false;
}

/**
 * Calculates promo pricing for a product given a list of rules.
 */
export function calculateItemPriceRule(
  product: { id: string; price: number; categoryId?: string | null },
  quantity: number,
  rules: PriceRuleItem[],
  now = new Date(),
  zone?: string
): RuleEvaluationResult {
  const originalUnitPrice = Number(product.price) || 0;
  const originalLineTotal = Math.round(originalUnitPrice * quantity * 100) / 100;

  // Default no-promo response
  const noPromo: RuleEvaluationResult = {
    hasPromo: false,
    originalUnitPrice,
    effectiveUnitPrice: originalUnitPrice,
    originalLineTotal,
    effectiveLineTotal: originalLineTotal,
    savings: 0,
  };

  if (!rules || rules.length === 0 || quantity <= 0) {
    return noPromo;
  }

  // Filter rules active right now and applicable to this item
  const applicableRules = rules
    .filter((rule) => isRuleActiveNow(rule, now, zone) && doesRuleApplyToProduct(rule, product))
    .sort((a, b) => (b.priority || 0) - (a.priority || 0));

  if (applicableRules.length === 0) {
    return noPromo;
  }

  // Evaluate candidate discounts and pick the best one for the customer
  let bestResult = noPromo;

  for (const rule of applicableRules) {
    let effectiveLineTotal = originalLineTotal;
    let badgeText = rule.badgeLabel || '';

    if (rule.type === 'PERCENTAGE_DISCOUNT') {
      const discountRatio = Math.min(100, Math.max(0, rule.discountValue)) / 100;
      const unitDiscount = originalUnitPrice * discountRatio;
      const effectiveUnitPrice = Math.max(0, originalUnitPrice - unitDiscount);
      effectiveLineTotal = Math.round(effectiveUnitPrice * quantity * 100) / 100;
      if (!badgeText) {
        badgeText = `-${rule.discountValue}%`;
      }
    } else if (rule.type === 'FIXED_PRICE') {
      const promoUnit = Math.max(0, rule.discountValue);
      // Only apply if promo price is lower than regular price
      if (promoUnit < originalUnitPrice) {
        effectiveLineTotal = Math.round(promoUnit * quantity * 100) / 100;
        if (!badgeText) {
          badgeText = `$${promoUnit.toFixed(2)}`;
        }
      }
    } else if (rule.type === 'BUY_X_GET_Y') {
      const buyQty = rule.buyQty && rule.buyQty > 0 ? rule.buyQty : 2;
      const getQty = rule.getQty && rule.getQty > 0 ? rule.getQty : 1;

      // e.g. 2x1: buyQty=2, getQty=1. For quantity 2: sets=1, paidUnits=1.
      if (quantity >= buyQty) {
        const sets = Math.floor(quantity / buyQty);
        const remainder = quantity % buyQty;
        const paidUnits = sets * getQty + remainder;
        effectiveLineTotal = Math.round(paidUnits * originalUnitPrice * 100) / 100;
        if (!badgeText) {
          badgeText = `${buyQty}x${getQty}`;
        }
      } else {
        if (!badgeText) {
          badgeText = `${buyQty}x${getQty}`;
        }
      }
    }

    const savings = Math.max(0, Math.round((originalLineTotal - effectiveLineTotal) * 100) / 100);
    const effectiveUnitPrice =
      quantity > 0 ? Math.round((effectiveLineTotal / quantity) * 100) / 100 : originalUnitPrice;

    const remainingSeconds = getRuleRemainingSeconds(rule, now);

    if (savings > bestResult.savings || (bestResult.savings === 0 && savings === 0 && !bestResult.hasPromo)) {
      bestResult = {
        hasPromo: true,
        rule,
        originalUnitPrice,
        effectiveUnitPrice,
        originalLineTotal,
        effectiveLineTotal,
        savings,
        badgeText: badgeText || rule.name,
        remainingSeconds,
        isFlashDeal: Boolean(rule.isFlashDeal),
      };
    }
  }

  return bestResult;
}

/**
 * Evaluates full cart items against active price rules
 */
export function evaluateCartDynamicPricing(
  cartItems: Array<{
    product: { id: string; price: number; name: string; categoryId?: string | null };
    quantity: number;
    price?: number;
  }>,
  rules: PriceRuleItem[],
  now = new Date(),
  zone?: string
) {
  let totalOriginal = 0;
  let totalEffective = 0;
  let totalSavings = 0;

  const evaluatedItems = cartItems.map((item) => {
    const evalResult = calculateItemPriceRule(item.product, item.quantity, rules, now, zone);
    totalOriginal += evalResult.originalLineTotal;
    totalEffective += evalResult.effectiveLineTotal;
    totalSavings += evalResult.savings;

    return {
      ...item,
      evalResult,
      effectiveUnitPrice: evalResult.effectiveUnitPrice,
      effectiveLineTotal: evalResult.effectiveLineTotal,
      savings: evalResult.savings,
      badgeText: evalResult.badgeText,
    };
  });

  return {
    items: evaluatedItems,
    totalOriginal: Math.round(totalOriginal * 100) / 100,
    totalEffective: Math.round(totalEffective * 100) / 100,
    totalSavings: Math.round(totalSavings * 100) / 100,
    hasAnyPromo: totalSavings > 0,
  };
}

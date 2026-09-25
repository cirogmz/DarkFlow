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
}

/**
 * Checks if a given price rule is currently within its active time window and day.
 */
export function isRuleActiveNow(rule: PriceRuleItem, now = new Date(), zone?: string): boolean {
  if (!rule.isActive) return false;

  // Zone match check (if rule specifies a zone, it must match or be omitted)
  if (rule.zone && zone && rule.zone.trim().toLowerCase() !== zone.trim().toLowerCase()) {
    return false;
  }

  // Day of week check (0=Sunday, 1=Monday, ..., 6=Saturday)
  const currentDay = now.getDay();
  const allowedDays = rule.daysOfWeek
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n));

  if (!allowedDays.includes(currentDay)) {
    return false;
  }

  // Time window check (HH:mm format)
  const [startHour, startMin] = rule.startTime.split(':').map((s) => parseInt(s, 10));
  const [endHour, endMin] = rule.endTime.split(':').map((s) => parseInt(s, 10));

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
  const applicableRules = rules.filter(
    (rule) => isRuleActiveNow(rule, now, zone) && doesRuleApplyToProduct(rule, product)
  );

  if (applicableRules.length === 0) {
    return noPromo;
  }

  // Evaluate candidate discounts and pick the best one for the customer
  let bestResult = noPromo;

  for (const rule of applicableRules) {
    let effectiveLineTotal = originalLineTotal;
    let badgeText = '';

    if (rule.type === 'PERCENTAGE_DISCOUNT') {
      const discountRatio = Math.min(100, Math.max(0, rule.discountValue)) / 100;
      const unitDiscount = originalUnitPrice * discountRatio;
      const effectiveUnitPrice = Math.max(0, originalUnitPrice - unitDiscount);
      effectiveLineTotal = Math.round(effectiveUnitPrice * quantity * 100) / 100;
      badgeText = `-${rule.discountValue}%`;
    } else if (rule.type === 'FIXED_PRICE') {
      const promoUnit = Math.max(0, rule.discountValue);
      // Only apply if promo price is lower than regular price
      if (promoUnit < originalUnitPrice) {
        effectiveLineTotal = Math.round(promoUnit * quantity * 100) / 100;
        badgeText = `$${promoUnit.toFixed(2)}`;
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
        badgeText = `${buyQty}x${getQty}`;
      } else {
        badgeText = `${buyQty}x${getQty}`;
      }
    }

    const savings = Math.max(0, Math.round((originalLineTotal - effectiveLineTotal) * 100) / 100);
    const effectiveUnitPrice =
      quantity > 0 ? Math.round((effectiveLineTotal / quantity) * 100) / 100 : originalUnitPrice;

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
      };
    }
  }

  return bestResult;
}

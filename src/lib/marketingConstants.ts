export type CampaignChannel = 'WHATSAPP' | 'EMAIL' | 'SMS';
export type CampaignTriggerType = 'MANUAL' | 'BIRTHDAY_TRIGGER' | 'INACTIVE_RECOVERY' | 'VIP_PROMOTION';
export type CampaignStatus = 'DRAFT' | 'SCHEDULED' | 'SENDING' | 'SENT' | 'CANCELLED';
export type TargetSegment =
  | 'ALL'
  | 'BIRTHDAY_MONTH'
  | 'INACTIVE_30_DAYS'
  | 'VIP_PLATINUM'
  | 'VIP_GOLD'
  | 'VIP_SILVER'
  | 'TOP_SPENDERS';

export type RecipientStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'CONVERTED';

export interface SegmentInfo {
  id: TargetSegment;
  name: string;
  description: string;
  iconName: string;
  badgeColor: string;
}

export const MARKETING_SEGMENTS: Record<TargetSegment, SegmentInfo> = {
  ALL: {
    id: 'ALL',
    name: 'Todos los Clientes',
    description: 'Toda la base de datos de comensales registrados con teléfono o correo.',
    iconName: 'Users',
    badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  },
  BIRTHDAY_MONTH: {
    id: 'BIRTHDAY_MONTH',
    name: 'Club de Cumpleaños',
    description: 'Clientes que cumplen años durante este mes en curso.',
    iconName: 'Cake',
    badgeColor: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
  },
  INACTIVE_30_DAYS: {
    id: 'INACTIVE_30_DAYS',
    name: 'Inactivos (+30 Días)',
    description: 'Clientes sin pedidos en los últimos 30 días para reactivación.',
    iconName: 'Clock',
    badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  },
  VIP_PLATINUM: {
    id: 'VIP_PLATINUM',
    name: 'VIP Platinum',
    description: 'Comensales de mayor fidelidad en nivel Platinum.',
    iconName: 'Crown',
    badgeColor: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  },
  VIP_GOLD: {
    id: 'VIP_GOLD',
    name: 'VIP Gold',
    description: 'Clientes de nivel Gold con recurrencia destacada.',
    iconName: 'Award',
    badgeColor: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  },
  VIP_SILVER: {
    id: 'VIP_SILVER',
    name: 'VIP Silver',
    description: 'Clientes nivel Silver en ascenso de consumo.',
    iconName: 'Shield',
    badgeColor: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
  TOP_SPENDERS: {
    id: 'TOP_SPENDERS',
    name: 'Top Spenders (> $1,500 MXN)',
    description: 'Clientes con consumo acumulado histórico superior a $1,500 MXN.',
    iconName: 'Sparkles',
    badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
};

export interface MessageTemplatePreset {
  id: string;
  name: string;
  channel: CampaignChannel;
  triggerType: CampaignTriggerType;
  targetSegment: TargetSegment;
  defaultSubject: string;
  template: string;
  suggestedDiscount?: number;
  suggestedWalletBonus?: number;
}

export const TEMPLATE_PRESETS: MessageTemplatePreset[] = [
  {
    id: 'birthday_club',
    name: '🎂 Regalo de Cumpleaños',
    channel: 'WHATSAPP',
    triggerType: 'BIRTHDAY_TRIGGER',
    targetSegment: 'BIRTHDAY_MONTH',
    defaultSubject: '¡Feliz Cumpleaños de parte de {{marca}}! 🎁',
    template: '🎂 ¡Hola {{nombre}}! En {{marca}} celebramos tu cumpleaños todo el mes. 🎉 Disfruta un {{descuento}}% de descuento en tu próxima visita o pedido usando tu cupón especial: *{{cupon}}*. ¡Ven a festejar con nosotros! 🍔🥳',
    suggestedDiscount: 20,
  },
  {
    id: 'winback_inactive',
    name: '🍕 Reactivación de Inactivos',
    channel: 'WHATSAPP',
    triggerType: 'INACTIVE_RECOVERY',
    targetSegment: 'INACTIVE_30_DAYS',
    defaultSubject: '¡Te extrañamos en {{marca}}!',
    template: '🍕 ¡Hola {{nombre}}! Te extrañamos mucho en {{marca}}. 🥺 Queremos verte de vuelta hoy mismo, por eso preparamos un {{descuento}}% OFF exclusivo para ti con el cupón: *{{cupon}}*. ¡Válido sólo esta semana! 🚀 Consulta nuestro menú aquí: {{link_menu}}',
    suggestedDiscount: 15,
  },
  {
    id: 'vip_wallet_boost',
    name: '⭐ Bono Monedero VIP',
    channel: 'WHATSAPP',
    triggerType: 'VIP_PROMOTION',
    targetSegment: 'VIP_PLATINUM',
    defaultSubject: 'Beneficio exclusivo para ti en {{marca}}',
    template: '⭐ ¡Hola {{nombre}}! Como miembro distinguido de {{marca}}, te hemos consentido con un beneficio VIP exclusivo. Revisa tu saldo actual de monedero (*{{saldo_monedero}}*) y ven a deleitarte con tus platillos favoritos. ¡Es un placer tenerte con nosotros! 👑',
    suggestedWalletBonus: 50,
  },
  {
    id: 'flash_promo',
    name: '🔥 Promo Flash de Fin de Semana',
    channel: 'WHATSAPP',
    triggerType: 'MANUAL',
    targetSegment: 'ALL',
    defaultSubject: '🔥 ¡Promoción Especial de Fin de Semana en {{marca}}!',
    template: '🔥 ¡Hola {{nombre}}! Este fin de semana en {{marca}} tenemos sorpresas para ti. Aprovecha un *{{descuento}}% de descuento* en tu cuenta usando el cupón *{{cupon}}*. ¡Ordena rápido antes de que se agote! 🏃‍♂️💨',
    suggestedDiscount: 10,
  },
];


export type NPSCategory = 'PROMOTER' | 'PASSIVE' | 'DETRACTOR';
export type CompensationType = 'NONE' | 'WALLET_CREDIT' | 'COUPON' | 'MANUAL_RECOVERY';
export type CompensationStatus = 'NONE' | 'OFFERED' | 'CLAIMED' | 'EXPIRED';

export const POPULAR_SURVEY_TAGS = {
  positive: [
    'Comida deliciosa',
    'Excelente presentación',
    'Entrega súper rápida',
    'Atención de 10',
    'Porciones generosas',
    'Empaque impecable',
    'Calidad insuperable',
    'Ambiente agradable',
  ],
  negative: [
    'Comida fría',
    'Demora en entrega / cocina',
    'Faltó un producto',
    'Empaque maltratado',
    'Falta de sazón',
    'Atención deficiente del mesero',
    'Temperatura incorrecta',
    'Mesa / área sucia',
  ],
} as const;


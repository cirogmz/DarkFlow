export interface ChecklistItem {
  id: string;
  task: string;
  done: boolean;
  notes?: string;
}

export interface EquipmentHealthMetrics {
  totalWorkOrders: number;
  preventiveCompleted: number;
  correctiveBreakdowns: number;
  totalMaintenanceCost: number;
  totalDowntimeHours: number;
  mttrHours: number; // Mean Time to Repair
  mtbfDays: number;  // Mean Time Between Failures
  warrantyStatus: 'ACTIVE' | 'EXPIRED' | 'NO_WARRANTY';
  warrantyDaysRemaining?: number;
  preventiveStatus: 'UP_TO_DATE' | 'DUE_SOON' | 'OVERDUE' | 'NOT_SCHEDULED';
  daysUntilNextMaintenance?: number;
}

/**
 * Standard maintenance checklist templates by kitchen equipment category
 */
export const CATEGORY_CHECKLIST_TEMPLATES: Record<string, string[]> = {
  COOKING: [
    'Inspección y limpieza de quemadores / resistencias calefactoras',
    'Calibración y verificación de termostatos / sondas térmicas',
    'Revisión de empaques, sellos y bisagras de puertas',
    'Comprobación de líneas de gas / conexiones eléctricas seguras',
    'Descalcificación y purga de generador de vapor (en hornos combinados)',
    'Prueba de corte de seguridad por sobretemperatura',
  ],
  REFRIGERATION: [
    'Lavado y desengrase de serpentines del condensador',
    'Inspección de ventiladores del evaporador y flujo de aire',
    'Verificación de presión y carga de gas refrigerante',
    'Revisión y hermeticidad de empaques magnéticos de puertas',
    'Prueba y ciclo de deshielo automático (Defrost)',
    'Desazolve y limpieza de charolas y líneas de drenaje',
  ],
  EXTRACTION_VENTILATION: [
    'Desengrase y descarbonización de filtros metálicos tipo laberinto',
    'Inspección de tensión y desgaste de bandas del extractor centrífugo',
    'Lubricación de chumaceras y baleros del motor',
    'Verificación de compuertas cortafuego y switch de extracción',
    'Revisión de no-vibración y sujeción en azotea / ductería',
  ],
  BEVERAGE_COFFEE: [
    'Reemplazo / purga de cartuchos de filtro de agua (Sedimentos y Carbón)',
    'Descalcificación profunda de calderas y electroválvulas',
    'Sanitización de tolva, cortina y depósito de hielo (máquina de hielo)',
    'Verificación de presión de bomba de agua y manómetros',
    'Inspección de empaques de regaderas y portafiltros',
  ],
  FOOD_PREPARATION: [
    'Afilado y calibración de cuchillas / discos cortadores',
    'Inspección de microswitches y sensores de protección de seguridad',
    'Revisión de engranes y aceite de transmisión de planetaria',
    'Limpieza y desinfección interna de carcasas de motor',
  ],
  DISHWASHING: [
    'Descalcificación de cámara de lavado y calderín de aclarado',
    'Inspección y limpieza de toberas de brazos giratorios de lavado',
    'Calibración de dosificadores de detergente y abrillantador químico',
    'Revisión de cortinas antisalpicaduras y cedazos atrapa-grasa',
  ],
  OTHER: [
    'Inspección visual y fijación mecánica general',
    'Prueba de cableado, clavija industrial y tierra física',
    'Limpieza profunda y sanitización exterior',
    'Prueba funcional bajo carga de trabajo',
  ],
};

/**
 * Returns default checklist for an equipment category
 */
export function getDefaultChecklist(category: string): ChecklistItem[] {
  const tasks = CATEGORY_CHECKLIST_TEMPLATES[category] || CATEGORY_CHECKLIST_TEMPLATES.OTHER;
  return tasks.map((task, idx) => ({
    id: `chk-${idx + 1}`,
    task,
    done: false,
  }));
}

/**
 * Calculates equipment health metrics, warranty, and maintenance status
 */
export function calculateEquipmentHealth(
  equipment: {
    purchaseDate?: Date | string | null;
    warrantyExpiration?: Date | string | null;
    lastMaintenanceDate?: Date | string | null;
    nextMaintenanceDate?: Date | string | null;
    maintenanceFrequencyDays?: number | null;
  },
  workOrders: Array<{
    orderType: string;
    status: string;
    totalCost?: number | null;
    downtimeHours?: number | null;
    completedAt?: Date | string | null;
    createdAt: Date | string;
  }> = [],
  referenceDate: Date = new Date()
): EquipmentHealthMetrics {
  const totalWorkOrders = workOrders.length;
  const completedOrders = workOrders.filter((w) => w.status === 'COMPLETED');
  const preventiveCompleted = completedOrders.filter((w) => w.orderType === 'PREVENTIVE').length;
  const correctiveOrders = workOrders.filter(
    (w) => w.orderType === 'CORRECTIVE' || w.orderType === 'EMERGENCY_BREAKDOWN'
  );
  const correctiveBreakdowns = correctiveOrders.length;

  const totalMaintenanceCost = completedOrders.reduce((sum, w) => sum + (w.totalCost || 0), 0);
  const totalDowntimeHours = completedOrders.reduce((sum, w) => sum + (w.downtimeHours || 0), 0);

  // Mean Time to Repair (MTTR) in hours
  const mttrHours = correctiveBreakdowns > 0 
    ? Math.round((totalDowntimeHours / correctiveBreakdowns) * 10) / 10 
    : 0;

  // Mean Time Between Failures (MTBF) in days
  let mtbfDays = 180; // default safe baseline if no breakdowns
  if (equipment.purchaseDate) {
    const ageDays = Math.max(1, Math.floor((referenceDate.getTime() - new Date(equipment.purchaseDate).getTime()) / (1000 * 60 * 60 * 24)));
    mtbfDays = correctiveBreakdowns > 0 ? Math.round(ageDays / correctiveBreakdowns) : ageDays;
  }

  // Warranty Status
  let warrantyStatus: 'ACTIVE' | 'EXPIRED' | 'NO_WARRANTY' = 'NO_WARRANTY';
  let warrantyDaysRemaining: number | undefined;

  if (equipment.warrantyExpiration) {
    const expDate = new Date(equipment.warrantyExpiration);
    const diffMs = expDate.getTime() - referenceDate.getTime();
    warrantyDaysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    warrantyStatus = warrantyDaysRemaining >= 0 ? 'ACTIVE' : 'EXPIRED';
  }

  // Preventive Maintenance Status
  let preventiveStatus: 'UP_TO_DATE' | 'DUE_SOON' | 'OVERDUE' | 'NOT_SCHEDULED' = 'NOT_SCHEDULED';
  let daysUntilNextMaintenance: number | undefined;

  if (equipment.nextMaintenanceDate) {
    const nextDate = new Date(equipment.nextMaintenanceDate);
    const diffMs = nextDate.getTime() - referenceDate.getTime();
    daysUntilNextMaintenance = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (daysUntilNextMaintenance < 0) {
      preventiveStatus = 'OVERDUE';
    } else if (daysUntilNextMaintenance <= 7) {
      preventiveStatus = 'DUE_SOON';
    } else {
      preventiveStatus = 'UP_TO_DATE';
    }
  }

  return {
    totalWorkOrders,
    preventiveCompleted,
    correctiveBreakdowns,
    totalMaintenanceCost: Math.round(totalMaintenanceCost * 100) / 100,
    totalDowntimeHours: Math.round(totalDowntimeHours * 10) / 10,
    mttrHours,
    mtbfDays,
    warrantyStatus,
    warrantyDaysRemaining,
    preventiveStatus,
    daysUntilNextMaintenance,
  };
}

/**
 * Calculates next preventive maintenance date based on frequency
 */
export function calculateNextMaintenanceDate(
  lastDate: Date = new Date(),
  frequencyDays = 90
): Date {
  const next = new Date(lastDate);
  next.setDate(next.getDate() + (frequencyDays || 90));
  return next;
}

/**
 * Generates official 80mm printable Work Order / Service Sign-off Ticket (ASCII)
 */
export function generateWorkOrderTicket(params: {
  brandName?: string;
  folio: string;
  orderType: string;
  priority: string;
  status: string;
  title: string;
  description: string;
  equipmentName: string;
  equipmentCode: string;
  equipmentCategory: string;
  equipmentLocation?: string | null;
  technicianName?: string | null;
  serviceCompany?: string | null;
  scheduledDate?: Date | string | null;
  completedAt?: Date | string | null;
  laborCost?: number | null;
  partsCost?: number | null;
  totalCost?: number | null;
  downtimeHours?: number | null;
  partsReplaced?: string | null;
  actionTaken?: string | null;
  checklist?: ChecklistItem[] | null;
  reportedByName?: string | null;
}): string {
  const pad = (str: string, len: number, fill = ' ') => {
    return str.length >= len ? str.slice(0, len) : str + fill.repeat(len - str.length);
  };
  const center = (str: string, len: number) => {
    if (str.length >= len) return str.slice(0, len);
    const left = Math.floor((len - str.length) / 2);
    const right = len - str.length - left;
    return ' '.repeat(left) + str + ' '.repeat(right);
  };

  const line = '='.repeat(42);
  const dash = '-'.repeat(42);

  const orderTypeLabels: Record<string, string> = {
    PREVENTIVE: 'MANTENIMIENTO PREVENTIVO',
    CORRECTIVE: 'REPARACIÓN CORRECTIVA',
    EMERGENCY_BREAKDOWN: 'EMERGENCIA / PARO DE LÍNEA',
    CALIBRATION: 'CALIBRACIÓN Y AJUSTE',
    INSPECTION: 'INSPECCIÓN TÉCNICA',
  };

  const lines: string[] = [
    line,
    center(params.brandName ? params.brandName.toUpperCase() : 'DARKFLOW ENTERPRISE', 42),
    center('ORDEN DE SERVICIO Y MANTENIMIENTO', 42),
    center('KITCHEN CMMS & ASSET WATCHDOG', 42),
    line,
    `Folio OT    : ${params.folio}`,
    `Tipo        : ${orderTypeLabels[params.orderType] || params.orderType}`,
    `Prioridad   : ${params.priority}`,
    `Estado      : ${params.status}`,
    `Fecha Prog. : ${params.scheduledDate ? new Date(params.scheduledDate).toLocaleDateString('es-MX') : 'Inmediata'}`,
    dash,
    center('DATOS DEL ACTIVO / EQUIPO', 42),
    dash,
    `Equipo      : ${params.equipmentName}`,
    `Código / Tag: ${params.equipmentCode}`,
    `Categoría   : ${params.equipmentCategory}`,
    `Ubicación   : ${params.equipmentLocation || 'Cocina Principal'}`,
    dash,
    center('DESCRIPCIÓN DEL REQUERIMIENTO', 42),
    dash,
    params.title,
    params.description,
  ];

  if (params.checklist && params.checklist.length > 0) {
    lines.push(dash);
    lines.push(center('CHECKLIST DE PUNTOS DE CONTROL', 42));
    lines.push(dash);
    for (const chk of params.checklist) {
      const box = chk.done ? '[X]' : '[ ]';
      lines.push(`${box} ${chk.task}`);
    }
  }

  if (params.status === 'COMPLETED') {
    lines.push(dash);
    lines.push(center('RESOLUCIÓN Y LIQUIDACIÓN TÉCNICA', 42));
    lines.push(dash);
    if (params.actionTaken) {
      lines.push(`Acción Realizada: ${params.actionTaken}`);
    }
    if (params.partsReplaced) {
      lines.push(`Refacciones: ${params.partsReplaced}`);
    }
    lines.push(`${pad('Tiempo Fuera de Servicio', 26)}: ${params.downtimeHours ?? 0} hrs`);
    lines.push(`${pad('Costo Mano de Obra', 26)}: $${(params.laborCost ?? 0).toFixed(2)}`);
    lines.push(`${pad('Costo Refacciones', 26)}: $${(params.partsCost ?? 0).toFixed(2)}`);
    lines.push(`${pad('COSTO TOTAL DE SERVICIO', 26)}: $${(params.totalCost ?? 0).toFixed(2)}`);
  }

  lines.push(dash);
  lines.push(`Técnico     : ${params.technicianName || 'Servicio Técnico Autorizado'}`);
  if (params.serviceCompany) {
    lines.push(`Proveedor   : ${params.serviceCompany}`);
  }
  lines.push(`Reportó     : ${params.reportedByName || 'Jefe de Cocina'}`);
  lines.push(dash);
  lines.push('');
  lines.push('_____________________       _____________________');
  lines.push('  Firma de Técnico            Firma Chef / Gerente');
  lines.push('');
  lines.push(line);
  lines.push(center('COMPROBANTE VÁLIDO PARA AUDITORÍA', 42), center('DARKFLOW KITCHEN CMMS ENGINE', 42), line);

  return lines.join('\n');
}

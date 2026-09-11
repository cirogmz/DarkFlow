import { prisma } from '@/lib/db';

export type AuditSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface AuditLogInput {
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Record<string, unknown> | string | null;
  severity?: AuditSeverity;
  brandId?: string | null;
  userId?: string | null;
  req?: Request | null;
}

/**
 * Record an immutable audit log entry.
 * Resilient: never throws error up to the caller to avoid interrupting primary business workflows.
 */
export async function recordAuditLog({
  action,
  entityType,
  entityId = null,
  details = null,
  severity = 'INFO',
  brandId = null,
  userId = null,
  req = null,
}: AuditLogInput): Promise<void> {
  try {
    let ipAddress: string | null = null;
    if (req) {
      const forwarded = req.headers.get('x-forwarded-for');
      ipAddress = forwarded ? forwarded.split(',')[0].trim() : req.headers.get('x-real-ip') || null;
    }

    let serializedDetails: string | null = null;
    if (typeof details === 'string') {
      serializedDetails = details;
    } else if (details && typeof details === 'object') {
      serializedDetails = JSON.stringify(details);
    }

    await prisma.auditLog.create({
      data: {
        action: action.toUpperCase(),
        entityType: entityType.toUpperCase(),
        entityId: entityId ? String(entityId) : null,
        details: serializedDetails,
        severity,
        ipAddress,
        brandId: brandId || null,
        userId: userId || null,
      },
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}

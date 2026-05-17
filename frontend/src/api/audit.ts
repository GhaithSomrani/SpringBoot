import api from './axios';

export type AuditAction = 'CREATED' | 'UPDATED' | 'DELETED' | 'JOINED' | 'LEFT' | 'PERMISSION_CHANGED';
export type AuditEntityType = 'EXPENSE' | 'CATEGORY' | 'EVENT' | 'GROUP' | 'MEMBER';

export interface AuditPerformer {
  userId: string;
  email: string;
}

export interface AuditLogDto {
  id: string;
  groupId: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  entitySnapshot?: string;
  performedBy: AuditPerformer;
  performedAt: string;
}

export interface AuditFilters {
  entityType?: AuditEntityType;
  action?: AuditAction;
  userId?: string;
  dateFrom?: string; // ISO instant
  dateTo?: string;
}

export interface PagedAuditLogs {
  content: AuditLogDto[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

export async function getAuditLogs(
  groupId: string,
  filters: AuditFilters,
  page: number,
  size: number,
): Promise<PagedAuditLogs> {
  const params: Record<string, string | number> = { page, size };
  if (filters.entityType) params.entityType = filters.entityType;
  if (filters.action)     params.action = filters.action;
  if (filters.userId)     params.userId = filters.userId;
  if (filters.dateFrom)   params.dateFrom = filters.dateFrom;
  if (filters.dateTo)     params.dateTo = filters.dateTo;

  const res = await api.get<{ data: PagedAuditLogs }>(
    `/api/groups/${groupId}/audit-logs`,
    { params },
  );
  return res.data.data;
}

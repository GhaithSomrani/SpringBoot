// ─── Auth ─────────────────────────────────────────────────────────────────────

export type Role = 'ADMIN' | 'MANAGER' | 'MEMBER';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: Role;
}

// ─── API wrappers ─────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface PagedResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

// ─── Group ────────────────────────────────────────────────────────────────────

export type Permission = 'VIEW' | 'EDIT' | 'ADMIN';

export interface GroupMember {
  userId: string;
  email: string;
  permission: Permission;
  joinedAt: string;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  members: GroupMember[];
  createdAt: string;
  updatedAt: string;
}

// ─── Category ─────────────────────────────────────────────────────────────────

export interface Subcategory {
  id: string;
  name: string;
}

export interface Category {
  id: string;
  groupId: string;
  name: string;
  color: string;
  icon: string;
  subcategories: Subcategory[];
  createdAt: string;
  updatedAt: string;
}

// ─── Expense ──────────────────────────────────────────────────────────────────

export interface Expense {
  id: string;
  groupId: string;
  title: string;
  amount: number;
  currency: string;
  categoryId: string;
  subcategoryId?: string;
  date: string;
  description?: string;
  attachments: string[];
  addedBy: string;
  eventId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseSummary {
  totalAmount: number;
  byCategory: { categoryId: string; categoryName: string; total: number }[];
  byMonth: { month: string; total: number }[];
}

// ─── Event ────────────────────────────────────────────────────────────────────

export type EventStatus = 'UPCOMING' | 'ACTIVE' | 'CLOSED';

export interface Event {
  id: string;
  groupId: string;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  creatorId: string;
  categories: string[];
  status: EventStatus;
  expenseTotal: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Invitation ───────────────────────────────────────────────────────────────

export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'CANCELLED';

export interface Invitation {
  id: string;
  groupId: string;
  groupName: string;
  invitedEmail: string;
  invitedBy: string;
  invitedByName: string;
  permission: Permission;
  status: InvitationStatus;
  expiresAt: string;
  createdAt: string;
  respondedAt?: string | null;
  directLink?: string;
  acceptUrl?: string;
  declineUrl?: string;
}

export interface InvitationAcceptResponse {
  groupId: string;
  groupName: string;
  requiresAuth: boolean;
  invitedEmail: string;
  permission: Permission;
}

export interface InvitationDeclineResponse {
  groupName: string;
}

// ─── Notification ─────────────────────────────────────────────────────────────

export type NotificationType =
  | 'EXPENSE_ADDED'
  | 'EXPENSE_UPDATED'
  | 'MEMBER_JOINED'
  | 'INVITE_RECEIVED'
  | 'PERMISSION_CHANGED'
  | 'INVITATION_ACCEPTED'
  | 'INVITATION_DECLINED'
  | 'UPGRADE_REQUEST_RECEIVED'
  | 'UPGRADE_REQUEST_APPROVED'
  | 'UPGRADE_REQUEST_DENIED';

export interface Notification {
  id: string;
  userId: string;
  groupId: string;
  type: NotificationType;
  message: string;
  referenceId: string;
  read: boolean;
  createdAt: string;
}

// ─── Audit ────────────────────────────────────────────────────────────────────

export type AuditAction =
  | 'CREATED'
  | 'UPDATED'
  | 'DELETED'
  | 'JOINED'
  | 'LEFT'
  | 'PERMISSION_CHANGED';

export type AuditEntityType = 'EXPENSE' | 'CATEGORY' | 'EVENT' | 'GROUP' | 'MEMBER';

export interface AuditPerformer {
  userId: string;
  email: string;
}

export interface AuditLog {
  id: string;
  groupId: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  entitySnapshot: string | null;
  performedBy: AuditPerformer;
  performedAt: string;
}

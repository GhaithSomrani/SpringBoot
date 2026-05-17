import api from './axios';

export interface ExpenseDto {
  id: string;
  groupId: string;
  title: string;
  amount: number;
  currency: string;
  categoryId: string;
  subcategoryId?: string;
  eventId?: string;
  date: string; // ISO date string
  description?: string;
  fileId?: string;        // legacy single-file field
  attachments?: string[]; // preferred multi-file array of fileIds
  addedBy: string; // userId
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseSummaryDto {
  totalAmount: number;
  byCategory: Record<string, number>; // categoryId → total
}

export interface PagedExpenses {
  content: ExpenseDto[];
  totalElements: number;
  totalPages: number;
  number: number; // current page (0-based)
  size: number;
}

export interface ExpenseFilters {
  dateFrom?: string;
  dateTo?: string;
  categoryId?: string;
  subcategoryId?: string;
  minAmount?: number;
  maxAmount?: number;
}

export interface CreateExpensePayload {
  title: string;
  amount: number;
  currency: string;
  categoryId: string;
  subcategoryId?: string;
  eventId?: string;
  date: string;
  description?: string;
  fileId?: string;        // legacy
  attachments?: string[]; // preferred multi-file
}

export async function getExpenses(
  groupId: string,
  filters: ExpenseFilters,
  page: number,
  size: number,
  sortBy: string,
  sortDir: 'asc' | 'desc',
): Promise<PagedExpenses> {
  const params: Record<string, string | number> = { page, size, sortBy, sortDir };
  if (filters.dateFrom) params.dateFrom = filters.dateFrom;
  if (filters.dateTo) params.dateTo = filters.dateTo;
  if (filters.categoryId) params.categoryId = filters.categoryId;
  if (filters.subcategoryId) params.subcategoryId = filters.subcategoryId;
  if (filters.minAmount != null) params.minAmount = filters.minAmount;
  if (filters.maxAmount != null) params.maxAmount = filters.maxAmount;

  const res = await api.get<{ data: PagedExpenses }>(`/api/groups/${groupId}/expenses`, { params });
  return res.data.data;
}

export async function getExpenseSummary(groupId: string, filters?: ExpenseFilters): Promise<ExpenseSummaryDto> {
  const params: Record<string, string | number> = {};
  if (filters?.dateFrom) params.dateFrom = filters.dateFrom;
  if (filters?.dateTo) params.dateTo = filters.dateTo;
  if (filters?.categoryId) params.categoryId = filters.categoryId;

  const res = await api.get<{ data: ExpenseSummaryDto }>(`/api/groups/${groupId}/expenses/summary`, { params });
  return res.data.data;
}

export async function createExpense(groupId: string, payload: CreateExpensePayload): Promise<ExpenseDto> {
  const res = await api.post<{ data: ExpenseDto }>(`/api/groups/${groupId}/expenses`, payload);
  return res.data.data;
}

export async function updateExpense(
  groupId: string,
  expenseId: string,
  payload: CreateExpensePayload,
): Promise<ExpenseDto> {
  const res = await api.put<{ data: ExpenseDto }>(`/api/groups/${groupId}/expenses/${expenseId}`, payload);
  return res.data.data;
}

export async function deleteExpense(groupId: string, expenseId: string): Promise<void> {
  await api.delete(`/api/groups/${groupId}/expenses/${expenseId}`);
}
